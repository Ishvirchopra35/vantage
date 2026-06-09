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

function isRateLimitError(err: unknown) {
  if (!err) return false;

  const typed = err as {
    status?: number;
    statusCode?: number;
    message?: string;
    toString?: () => string;
  };

  const status = typed.status || typed.statusCode;

  if (status === 429) return true;

  const msg = String(
    typed.message || typed.toString?.() || err
  ).toLowerCase();

  return (
    msg.includes('rate limit') ||
    msg.includes('too many requests')
  );
}

type GroqResponse =
  | string
  | {
      output_text?: string;
      choices?: Array<{
        message?: {
          content?: string | Array<{ text?: string }>;
        };
      }>;
      output?: Array<
        | {
            content?: string | Array<{ text?: string }>;
          }
        | string
      >;
    };

async function callGroqWithKey(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const client = new GroqSDK({ apiKey });

  let attempt = 0;
  const delays = [1000, 2000, 4000];

  while (true) {
    try {
      const res = (await client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
        max_tokens: maxTokens,
      })) as GroqResponse;

      // Collect possible text outputs
      const textCandidates: string[] = [];

      if (typeof res === 'string') {
        textCandidates.push(res);
      } else {
        // output_text
        if (res.output_text) {
          textCandidates.push(res.output_text);
        }

        // choices[].message.content
        if (res.choices?.length) {
          for (const choice of res.choices) {
            const content = choice?.message?.content;

            if (typeof content === 'string') {
              textCandidates.push(content);
            }

            if (Array.isArray(content)) {
              for (const c of content) {
                if (c?.text) {
                  textCandidates.push(c.text);
                }
              }
            }
          }
        }

        // output[]
        if (res.output?.length) {
          for (const item of res.output) {
            if (typeof item === 'string') {
              textCandidates.push(item);
            } else if (item?.content) {
              if (typeof item.content === 'string') {
                textCandidates.push(item.content);
              }

              if (Array.isArray(item.content)) {
                for (const c of item.content) {
                  if (c?.text) {
                    textCandidates.push(c.text);
                  }
                }
              }
            }
          }
        }
      }

      const text = textCandidates.find(Boolean) || '';

      if (!text.trim()) {
        throw new Error('Empty response from Groq provider');
      }

      return text.trim();
    } catch (err: unknown) {
      if (
        isRateLimitError(err) &&
        attempt < MAX_RETRIES
      ) {
        const delay = delays[attempt] ?? 4000;

        attempt += 1;

        await sleep(delay);

        continue;
      }

      const provider = 'groq';

      throw new Error(
        `AI (${provider}) call failed: ${
          err instanceof Error
            ? err.message
            : String(err)
        }`
      );
    }
  }
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set')
  return callGroqWithKey(process.env.GROQ_API_KEY, systemPrompt, userPrompt, maxTokens)
}

async function callGroqSecondary(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  if (!process.env.GROQ_API_KEY_SECONDARY) throw new Error('GROQ_API_KEY_SECONDARY is not set')
  return callGroqWithKey(process.env.GROQ_API_KEY_SECONDARY, systemPrompt, userPrompt, maxTokens)
}

// GEMINI BRANCH — uncomment when switching providers
// import { GoogleGenerativeAI } from '@google/generative-ai'
// For Gemini (AI_PROVIDER='gemini'): model 'gemini-1.5-flash'

export async function generateText(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  const provider = process.env.AI_PROVIDER || 'groq';

  if (provider === 'groq') {
    return await callGroq(
      systemPrompt,
      userPrompt,
      maxTokens
    );
  }

  if (provider === 'gemini') {
    throw new Error(
      'Gemini provider is not yet implemented.'
    );
  }

  throw new Error(`Unknown AI_PROVIDER: ${provider}`);
}

export async function generateJSON<T = unknown>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const provider = process.env.AI_PROVIDER || 'groq';

  const jsonSystem = `${systemPrompt}

Respond ONLY with valid JSON. No markdown, no backticks, no explanation.`;

  const raw = await generateText(
    jsonSystem,
    userPrompt,
    2000
  );

  try {
    let candidate = raw.trim();

    // Strip markdown code fences
    candidate = candidate
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '');

    // Remove leading junk before JSON
    const first = candidate.search(/[\{\[]/);

    if (first > 0) {
      candidate = candidate.slice(first);
    }

    return JSON.parse(candidate) as T;
  } catch {
    const snippet = String(raw).slice(0, 200);

    throw new Error(
      `Failed to parse JSON from ${provider} response. Raw (first 200 chars): ${snippet}`
    );
  }
}

// ── Cerebras (OpenAI-compatible) ─────────────────────────────────────────────
// Used for interview prep routes — separate rate limit from Groq.

async function generateTextCerebras(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000
): Promise<string> {
  const apiKey = process.env.CEREBRAS_API_KEY
  if (!apiKey) throw new Error('CEREBRAS_API_KEY is not set')
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama3.1-70b',
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  const data = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>
    error?: { message: string }
  }
  if (!res.ok) throw new Error(data.error?.message ?? JSON.stringify(data))
  const content = data.choices?.[0]?.message?.content
  if (!content?.trim()) throw new Error('Empty response from Cerebras')
  return content.trim()
}

export async function generateJSONCerebras<T = unknown>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const jsonSystem = `${systemPrompt}\n\nRespond ONLY with valid JSON. No markdown, no backticks, no explanation.`
  const raw = await generateTextCerebras(jsonSystem, userPrompt, 2000)
  return parseJSONResponse<T>(raw, 'cerebras')
}

// ─────────────────────────────────────────────────────────────────────────────

function parseJSONResponse<T>(raw: string, label: string): T {
  let candidate = raw.trim()
  candidate = candidate
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
  const first = candidate.search(/[\{\[]/)
  if (first > 0) candidate = candidate.slice(first)
  try {
    return JSON.parse(candidate) as T
  } catch {
    throw new Error(`Failed to parse JSON from ${label} response. Raw (first 200 chars): ${candidate.slice(0, 200)}`)
  }
}

export async function generateTextSecondary(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000
): Promise<string> {
  return callGroqSecondary(systemPrompt, userPrompt, maxTokens)
}

export async function generateJSONSecondary<T = unknown>(
  systemPrompt: string,
  userPrompt: string
): Promise<T> {
  const jsonSystem = `${systemPrompt}\n\nRespond ONLY with valid JSON. No markdown, no backticks, no explanation.`
  const raw = await callGroqSecondary(jsonSystem, userPrompt, 2000)
  return parseJSONResponse<T>(raw, 'groq-secondary')
}