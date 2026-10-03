import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

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
      const errMsg = err?.message || String(err);
      console.warn(`[Gemini Attempt ${i + 1}] Model '${model}' error: ${errMsg}. Attempting fallback...`);

      // If rate limited or unavailable, wait briefly before trying next fallback model
      if (i < modelsToTry.length - 1) {
        await new Promise(res => setTimeout(res, 800));
      }
    }
  }

  throw lastError || new Error('All AI models are currently at peak capacity. Please retry in a few moments.');
}

function geminiServerPlugin(): Plugin {
  return {
    name: 'gemini-server-plugin',
    configureServer(server) {
      server.middlewares.use('/api/chat', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });

        req.on('end', async () => {
          try {
            const data = JSON.parse(body || '{}');
            const { prompt, history, image, userName, userEmail, apiKey: clientApiKey } = data;

            const apiKey = clientApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
            if (!apiKey) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  error: 'GEMINI_API_KEY is not configured. Please add GEMINI_API_KEY to your .env file or click "Set API Key" in the app.',
                })
              );
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

            // Prepare conversation contents
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

            // Current turn
            const currentParts: any[] = [];
            if (image && image.base64) {
              currentParts.push({
                inlineData: {
                  mimeType: image.mimeType || 'image/png',
                  data: image.base64,
                },
              });
            }

            const promptText =
              prompt || (image ? 'Please analyze this image thoroughly and write corresponding code or insights.' : '');
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

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text: result.text, model: result.modelUsed }));
          } catch (error: any) {
            console.error('Server Gemini API error:', error);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            const errorMsg =
              error?.message?.includes('503') || error?.message?.includes('high demand')
                ? 'The model is currently experiencing high demand. Automatic backup retries were attempted. Please click "Retry" in a moment.'
                : error?.message || 'Failed to process AI request';

            res.end(
              JSON.stringify({
                error: errorMsg,
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), geminiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
