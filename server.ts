import express, { Request, Response } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '30mb' }));

async function generateWithFallback(
  ai: GoogleGenAI,
  contents: any[],
  systemInstruction: string
): Promise<{ text: string; modelUsed: string }> {
  // Use ultra-fast flash-lite as primary model for near-instant responses
  const modelsToTry = ['gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.8-flash'];
  let lastError: any = null;

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
        },
      });

      const text = response?.text;
      if (text && text.trim().length > 0) {
        return { text, modelUsed: model };
      }
    } catch (err: any) {
      lastError = err;
      console.warn(`[Gemini Attempt ${i + 1}] Model '${model}' error: ${err?.message}. Attempting fallback...`);
      if (i < modelsToTry.length - 1) {
        await new Promise(res => setTimeout(res, 800));
      }
    }
  }

  throw lastError || new Error('All AI models are currently at peak capacity. Please retry in a few moments.');
}

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Gemini Chat Endpoint
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  try {
    const { prompt, history, image, userName, userEmail, apiKey: clientApiKey } = req.body;
    const apiKey = clientApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

    if (!apiKey) {
      res.status(400).json({
        error: 'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your .env file or click "Set API Key" in the app.',
      });
      return;
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const contents: any[] = [];

    if (Array.isArray(history) && history.length > 0) {
      for (const turn of history) {
        if (turn.role && turn.content) {
          contents.push({
            role: turn.role === 'model' ? 'model' : 'user',
            parts: [{ text: turn.content }],
          });
        }
      }
    }

    const currentParts: any[] = [];
    if (image && image.base64) {
      currentParts.push({
        inlineData: {
          mimeType: image.mimeType || 'image/png',
          data: image.base64,
        },
      });
    }

    const promptText = prompt || (image ? 'Please analyze this image thoroughly and write corresponding code or insights.' : '');
    currentParts.push({ text: promptText });

    contents.push({
      role: 'user',
      parts: currentParts,
    });

    const userIdentityContext = userName && userName !== 'Guest Explorer'
      ? `The user's registered name is "${userName}"${userEmail ? ` (email: ${userEmail})` : ''}. Remember the user's name and personal data accurately throughout the conversation. If asked about their name or identity, confirm you know them as ${userName}.`
      : 'The user is currently a guest explorer. If they provide their name or preferences in conversation, remember them.';

    const systemInstruction =
      `You are CipherAI, an elite AI coding and visual analysis assistant. ${userIdentityContext} You generate clean, elegant, production-ready code with markdown syntax tagging (e.g. \`\`\`javascript, \`\`\`html, \`\`\`css, \`\`\`python). When analyzing images, identify UI elements, layout, bugs, OCR text, or diagram structures thoroughly. Always be helpful, engaging, and attentive to user memory and personal data.`;

    const result = await generateWithFallback(ai, contents, systemInstruction);

    res.json({ text: result.text, model: result.modelUsed });
  } catch (error: any) {
    console.error('API Error:', error);
    const errorMsg =
      error?.message?.includes('503') || error?.message?.includes('high demand')
        ? 'The model is currently experiencing high demand. Automatic backup retries were attempted. Please click "Retry" in a moment.'
        : error?.message || 'Internal Server Error';
    res.status(500).json({ error: errorMsg });
  }
});

// Serve static frontend in production
const distPath = path.resolve(__dirname, 'dist');
app.use(express.static(distPath));

app.get('*', (_req: Request, res: Response) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
