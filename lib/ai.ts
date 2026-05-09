// SERVER-SIDE ONLY - never import this in client components.
// This file is the single gateway to any AI provider used by the app.

import { URL } from 'url';

// GROQ SDK import — used when AI_PROVIDER === 'groq'
import GroqSDK from 'groq-sdk';

const DEFAULT_MODEL = 'llama-3.3-70b-versatile';
const MAX_RETRIES = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: any) {
  if (!err) return false;
  const status = err?.status || err?.statusCode;
  if (status === 429) return true;
  const msg = String(err?.message || err?.toString()).toLowerCase();
  return msg.includes('rate limit') || msg.includes('too many requests');
}

async function callGroq(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set');

  const client = new GroqSDK({ apiKey: process.env.GROQ_API_KEY });

  let attempt = 0;
  const delays = [1000, 2000, 4000];

  while (true) {
    try {
      // The groq-sdk API surface may differ; we attempt a common pattern
      // that many LLM SDKs follow. If this needs adjustment for the
      // official Groq SDK, update the call accordingly.
      const res: any = await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: maxTokens,
      });

      // Try common fields where model output might live
      const textCandidates = [];
      if (typeof res === 'string') textCandidates.push(res);
      if (res?.output_text) textCandidates.push(res.output_text);
      // Groq chat/completions shape: { choices: [{ message: { content: '...' } }] }
      if (res?.choices?.length) {
        for (const choice of res.choices) {
          if (choice?.message?.content) textCandidates.push(choice.message.content);
          if (choice?.message?.content?.text) textCandidates.push(choice.message.content.text);
          if (Array.isArray(choice?.message?.content)) {
            for (const c of choice.message.content) {
              if (typeof c === 'string') textCandidates.push(c);
              if (c?.text) textCandidates.push(c.text);
            }
          }
        }
      }
      if (res?.output?.length) {
        for (const item of res.output) {
          if (typeof item === 'string') textCandidates.push(item);
          if (item?.content) {
            if (typeof item.content === 'string') textCandidates.push(item.content);
            if (Array.isArray(item.content)) {
              for (const c of item.content) {
                if (typeof c === 'string') textCandidates.push(c);
                if (c?.text) textCandidates.push(c.text);
              }
            }
          }
        }
      }

      const text = textCandidates.find(Boolean) || '';

      if (!text || !text.trim()) {
        throw new Error('Empty response from Groq provider');
      }

      return text.trim();
    } catch (err: any) {
      if (isRateLimitError(err) && attempt < MAX_RETRIES) {
        const delay = delays[attempt] ?? 4000;
        attempt += 1;
        await sleep(delay);
        continue;
      }

      const provider = 'groq';
      throw new Error(`AI (${provider}) call failed: ${err?.message ?? err}`);
    }
  }
}

// GEMINI BRANCH — uncomment when switching providers
// import { GoogleGenerativeAI } from '@google/generative-ai'
// For Gemini (AI_PROVIDER='gemini'): model 'gemini-1.5-flash', read GEMINI_API_KEY
// [implementation goes here]

export async function generateText(systemPrompt: string, userPrompt: string, maxTokens = 2000): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'groq';

  if (provider === 'groq') {
    return await callGroq(systemPrompt, userPrompt, maxTokens);
  }

  if (provider === 'gemini') {
    throw new Error('Gemini provider is not yet implemented.');
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

export async function generateJSON<T = unknown>(systemPrompt: string, userPrompt: string): Promise<T> {
  const provider = process.env.AI_PROVIDER || 'groq';
  const jsonSystem = `${systemPrompt}\n\nRespond ONLY with valid JSON. No markdown, no backticks, no explanation.`;

  const raw = await generateText(jsonSystem, userPrompt, 2000);

  try {
    // Trim anything before first brace or bracket to be forgiving
    const first = raw.search(/[\{\[]/);
    const candidate = first >= 0 ? raw.slice(first) : raw;
    return JSON.parse(candidate) as T;
  } catch (err: any) {
    const snippet = String(raw).slice(0, 200);
    throw new Error(`Failed to parse JSON from ${provider} response. Raw (first 200 chars): ${snippet}`);
  }
}
