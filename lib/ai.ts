// SERVER-SIDE ONLY - never import this in client components.
// This file is the single gateway to any AI provider used by the app.
// Provider: Gemini 2.5 Flash-Lite

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as Sentry from '@sentry/nextjs';
import { checkSharedQuota, incrementSharedQuota } from '@/lib/rateLimit';

const MODEL_NAME = 'gemini-2.5-flash-lite';

// Platform-wide kill switch: the absolute number of Gemini calls the whole
// app may make per 30 days, regardless of how many users sign up. Per-user
// rate limits scale with signups; this does not. At flash-lite pricing
// ($0.10/M in, $0.40/M out) 4500 worst-case calls is roughly $15 - the
// monthly AI budget ceiling. When exhausted, every AI feature returns the
// friendly "over capacity" 429 until the window resets.
const PLATFORM_MONTHLY_CALL_BUDGET = 4500;

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
  // Hard spend ceiling before anything reaches Google. The message contains
  // "quota" so isAiQuotaError() routes it to the friendly 429 path.
  const budget = await checkSharedQuota('gemini_monthly', PLATFORM_MONTHLY_CALL_BUDGET, 30);
  if (!budget.allowed) {
    // Exhaustion is routed to a friendly 429 (never serverError), so without
    // this explicit capture Sentry would never learn every AI feature is down.
    Sentry.captureMessage('Platform AI quota exhausted - all AI features are blocked', 'error');
    throw new Error('Platform AI quota exhausted for this period');
  }
  if (budget.used >= budget.max * 0.8) {
    // Early warning at 80% so exhaustion is never a surprise. Static message
    // text so Sentry groups every occurrence into one alertable issue.
    Sentry.captureMessage('Platform AI quota above 80% of monthly budget', 'warning');
  }

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
      // Count against the platform budget only when Google actually served
      // (and therefore billed) the call.
      void incrementSharedQuota('gemini_monthly').catch(() => {});
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
