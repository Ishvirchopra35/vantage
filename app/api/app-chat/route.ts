// Help chat backend: multi-turn Q&A about how to use Vantage, answered from
// the hardcoded knowledge base. Deliberately NOT a document generator - the
// system prompt refuses tailoring/cover-letter requests and points at the
// right feature page instead.
import { requireAuth } from '@/lib/requireAuth'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateChat, isAiQuotaError, AI_BUSY_MESSAGE, type ChatMessage } from '@/lib/ai'
import { HELP_SYSTEM_PROMPT } from '@/lib/appKnowledge'

const ROUTE = '/api/app-chat'
const MAX_MESSAGES = 20
const MAX_MESSAGE_CHARS = 2000

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== 'object') return null
  const raw = (body as { messages?: unknown }).messages
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null

  const messages: ChatMessage[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null
    const { role, text } = item as { role?: unknown; text?: unknown }
    if (role !== 'user' && role !== 'model') return null
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_MESSAGE_CHARS) return null
    messages.push({ role, text: text.trim() })
  }
  // Gemini requires the conversation to end on the new user turn.
  if (messages[messages.length - 1].role !== 'user') return null
  return messages
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json().catch(() => null)
  const messages = parseMessages(body)
  if (!messages) return err('Invalid chat messages', 400)

  const rateLimit = await checkRateLimit({
    key: 'app-chat',
    userId: user.id,
    devLimit: 5,
    freeLimit: 50,
    proLimit: 10,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  try {
    const reply = await withTimeout(
      generateChat(HELP_SYSTEM_PROMPT, messages, 500),
      20000,
      'app-chat'
    )
    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ reply })
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
