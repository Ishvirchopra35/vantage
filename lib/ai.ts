// SERVER-SIDE ONLY - never import this in client components.
// This file is the single gateway to any AI provider used by the app.
// Provider: Gemini 2.5 Flash-Lite

import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL_NAME = 'gemini-2.5-flash-lite';

function getGenAI(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');
  return new GoogleGenerativeAI(apiKey);
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
  });

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: maxTokens },
      });

      const text = result.response.text();
      if (!text || text.trim() === '') {
        throw new Error('Empty response from Gemini');
      }
      return text;
    } catch (err: unknown) {
      lastError = err;

      const status =
        (err as { status?: number })?.status ??
        (err as { statusCode?: number })?.statusCode;

      if (status === 429) {
        // Exponential backoff: 2s, 4s, 6s
        await sleep((attempt + 1) * 2000);
        continue;
      }

      throw new Error(
        `Gemini call failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  throw new Error(
    `Gemini failed after retries: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

export async function generateJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const jsonSystemPrompt =
    systemPrompt +
    '\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown formatting, no backticks, no explanation text before or after the JSON.';

  const raw = await generateText(jsonSystemPrompt, userPrompt, 3000);

  try {
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();

    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (!match) throw new Error('No JSON found in response');
    return JSON.parse(match[1]) as T;
  } catch {
    throw new Error('Failed to parse JSON from AI response.');
  }
}

// ── Aliases kept for backward compatibility ───────────────────────────────────
// Legacy routes now share the same Gemini-backed helpers.

export const generateTextSecondary = generateText;
export const generateJSONSecondary = generateJSON;
