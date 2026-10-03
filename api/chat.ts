import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      prompt,
      history,
      image,
      userName,
      userEmail,
    } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
    });

    const contents: any[] = [];

    if (Array.isArray(history)) {
      for (const turn of history) {
        if (turn.role && turn.content) {
          contents.push({
            role: turn.role === "model" ? "model" : "user",
            parts: [{ text: turn.content }],
          });
        }
      }
    }

    const currentParts: any[] = [];

    if (image?.base64) {
      currentParts.push({
        inlineData: {
          mimeType: image.mimeType || "image/png",
          data: image.base64,
        },
      });
    }

    currentParts.push({
      text:
        prompt ||
        (image
          ? "Please analyze this image thoroughly."
          : ""),
    });

    contents.push({
      role: "user",
      parts: currentParts,
    });

    const userIdentityContext =
      userName && userName !== "Guest Explorer"
        ? `The user's registered name is "${userName}"${
            userEmail ? ` (email: ${userEmail})` : ""
          }.`
        : "The user is currently a guest explorer.";

    const systemInstruction = `You are CipherAI, an elite AI coding and visual analysis assistant.

${userIdentityContext}

Generate clean, elegant and production-ready code.
When using code, use markdown syntax such as javascript, html, css and python.
When analyzing images, identify UI elements, layout, bugs, OCR text and diagram structures.
Always be helpful and accurate.`;

    const models = [
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
    ];

    let lastError: any = null;

    for (const model of models) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
          },
        });

        const text = response?.text;

        if (text && text.trim()) {
          return res.status(200).json({
            text,
            model,
          });
        }
      } catch (error) {
        lastError = error;
        console.error(`Gemini ${model} error:`, error);
      }
    }

    return res.status(503).json({
      error:
        lastError?.message ||
        "All available Gemini models are currently unavailable.",
    });
  } catch (error: any) {
    console.error("CipherAI API Error:", error);

    return res.status(500).json({
      error: error?.message || "Internal Server Error",
    });
  }
}