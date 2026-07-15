// Resume Studio (experimental) backend. Three actions on one route:
//   extract  - multipart upload -> plain text (in memory only, no storage)
//   generate - plain text -> whitelist-tag resume HTML
//   edit     - current HTML + instruction -> full updated HTML
// The HTML itself carries all editing state, so edits are single-turn AI
// calls - no chat history needed. Nothing is persisted server-side; the
// client keeps the HTML in sessionStorage.
import { requireAuth } from '@/lib/requireAuth'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { generateText, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai'
import { extractResumeText, extractResumeLinks, isDocxFile } from '@/lib/extractResumeText'
import {
  RESUME_HTML_RULES as HTML_RULES,
  MAX_RESUME_HTML_CHARS as MAX_HTML_CHARS,
  sanitizeResumeHtml,
  linkifyResumeHtml,
} from '@/lib/resumeHtml'

const ROUTE = '/api/resume-studio'

// AI generation over long resumes can exceed Vercel's default budget.
export const maxDuration = 60

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_CHARS = 50_000
const MAX_INSTRUCTION_CHARS = 500
const MAX_LINKS = 30
const MAX_LINK_CHARS = 500

const ALLOWED_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]

async function handleExtract(request: Request, userId: string, start: number): Promise<Response> {
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) return err('No file uploaded', 400)
  if (file.size > MAX_FILE_BYTES) return err('File must be under 5MB', 400)

  const isDocx = isDocxFile(file.name, file.type)
  if (!isDocx && !ALLOWED_MIME.includes(file.type) && !/\.pdf$/i.test(file.name)) {
    return err('Upload a PDF or Word (.docx) resume', 400)
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    // Text and link annotations extracted together: pdf text extraction
    // drops link destinations, so they ride along as a separate list.
    const [text, links] = await Promise.all([
      extractResumeText(buffer, isDocx),
      extractResumeLinks(buffer, isDocx),
    ])
    if (!text.trim()) return err('Could not read any text from that file', 400)
    await logRoute(ROUTE, userId, Date.now() - start, 200)
    return ok({ text: text.slice(0, MAX_TEXT_CHARS), links })
  } catch {
    await logRoute(ROUTE, userId, Date.now() - start, 500)
    return err('Could not read that file. Try re-exporting it as a PDF.', 400)
  }
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  // File extraction is local parsing (no AI) and stays outside the limit -
  // only the AI-backed actions below count against resume-studio.
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    return handleExtract(request, user.id, start)
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return err('Invalid request body', 400)
  const { action, text, html, instruction, links } = body as {
    action?: string
    text?: string
    html?: string
    instruction?: string
    links?: unknown
  }

  // Hyperlink destinations from the original file, echoed back by the client
  // after extraction so the generated HTML can restore them.
  const knownLinks = (Array.isArray(links) ? links : [])
    .filter((l): l is string => typeof l === 'string' && l.length <= MAX_LINK_CHARS)
    .filter((l) => /^(https?:\/\/|mailto:)/i.test(l.trim()))
    .slice(0, MAX_LINKS)

  if (action !== 'generate' && action !== 'edit') return err('Invalid action', 400)

  // Validate input before touching the limit - a bad request costs nothing.
  let validText = ''
  let validHtml = ''
  let validInstruction = ''
  if (action === 'generate') {
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_CHARS) {
      return err('Invalid resume text', 400)
    }
    validText = text
  } else {
    if (typeof html !== 'string' || !html.trim() || html.length > MAX_HTML_CHARS) {
      return err('Invalid resume HTML', 400)
    }
    if (typeof instruction !== 'string' || !instruction.trim() || instruction.length > MAX_INSTRUCTION_CHARS) {
      return err(`Instruction must be 1-${MAX_INSTRUCTION_CHARS} characters`, 400)
    }
    validHtml = html
    validInstruction = instruction.trim()
  }

  const rateLimit = await checkRateLimit({
    key: 'resume-studio',
    userId: user.id,
    devLimit: 10,
    freeLimit: 20,
    proLimit: 15,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  let systemPrompt: string
  let userPrompt: string

  if (action === 'generate') {
    systemPrompt = `You are a resume formatter. ${HTML_RULES} Preserve 100% of the original content - never add, remove, or invent anything.`
    const linksBlock = knownLinks.length
      ? `\n\nHYPERLINKS FROM THE ORIGINAL FILE (the PDF's link annotations - text extraction dropped them):\n` +
        knownLinks.map((l) => `- ${l}`).join('\n') +
        `\nAttach each to its matching visible text with <a href="...">. A URL shown as text ` +
        `(e.g. "site.com") links to its full destination above; names like "LinkedIn" or "GitHub" ` +
        `link to the matching URL. Never attach a link to unrelated text and never invent URLs.`
      : ''
    userPrompt = `Convert this resume to HTML:${linksBlock}\n\n${validText}`
  } else {
    systemPrompt =
      `You edit resumes. Apply the user's instruction to the resume HTML and return the FULL updated resume. ` +
      `${HTML_RULES} Keep everything the instruction does not ask to change, byte for byte where possible. ` +
      `Preserve every existing <a href> hyperlink exactly unless the instruction explicitly asks to change it. ` +
      `Never invent employers, roles, degrees, dates, or numbers that are not in the resume or the instruction.`
    userPrompt = `CURRENT RESUME HTML:\n${validHtml}\n\nINSTRUCTION: ${validInstruction}\n\nReturn the full updated resume HTML.`
  }

  try {
    const raw = await withTimeout(
      generateText(systemPrompt, userPrompt, 6000),
      45000,
      'resume-studio'
    )
    const cleaned = sanitizeResumeHtml(raw)
    if (!cleaned) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return err('The AI returned an unusable result. Please try again.', 500)
    }
    // Deterministic safety net: even if the AI ignored the link instructions,
    // bare URLs/emails and known destinations still end up clickable.
    const linked = linkifyResumeHtml(cleaned, knownLinks)
    // Charge the limit only now that the AI actually produced a usable result.
    await Promise.all([
      recordRateLimitUse('resume-studio', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ])
    return ok({ html: linked })
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
