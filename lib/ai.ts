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

interface GeminiTurn {
  role: 'user' | 'model';
  parts: { text: string }[];
}

// Shared Gemini call with retry/backoff. All public helpers funnel through
// here so capacity handling stays in one place.
async function callGemini(
  systemPrompt: string,
  contents: GeminiTurn[],
  maxTokens: number
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
        contents,
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

      // 429 = rate limit/quota, 503 = "model experiencing high demand".
      // Both are transient capacity errors worth retrying.
      if (status === 429 || status === 503) {
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

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  return callGemini(systemPrompt, [{ role: 'user', parts: [{ text: userPrompt }] }], maxTokens);
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

/**
 * Multi-turn chat completion. `messages` is the conversation so far, oldest
 * first; the last entry must be the new user message. No streaming - the
 * full reply comes back as one string.
 */
export async function generateChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 1000
): Promise<string> {
  return callGemini(
    systemPrompt,
    messages.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    maxTokens
  );
}

export async function generateJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 3000
): Promise<T> {
  const jsonSystemPrompt =
    systemPrompt +
    '\n\nIMPORTANT: Respond with ONLY valid JSON. No markdown formatting, no backticks, no explanation text before or after the JSON.';

  const raw = await generateText(jsonSystemPrompt, userPrompt, maxTokens);

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

// True when the provider rejected the call for capacity reasons - quota /
// rate limits (429) or "model experiencing high demand" (503). Routes use
// this to answer with a friendly 429 instead of a generic 500.
export function isAiQuotaError(e: unknown): boolean {
  const message = e instanceof Error ? e.message : String(e);
  return /429|503|quota|rate.?limit|resource.?exhausted|too many requests|overloaded|high demand|service unavailable/i.test(message);
}

// Shared user-facing copy for AI-capacity 429s so every feature says the
// same thing.
export const AI_BUSY_MESSAGE =
  'Our AI is temporarily over capacity. Please try again in a few minutes.';

// -- Aliases kept for backward compatibility -----------------------------------
// Legacy routes now share the same Gemini-backed helpers.

export const generateTextSecondary = generateText;
export const generateJSONSecondary = generateJSON;
