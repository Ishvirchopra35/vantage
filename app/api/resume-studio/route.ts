// Resume Studio (experimental) backend. Three actions on one route:
//   extract  - multipart upload -> a ResumeDoc, or plain text when the file has
//              no structure to read (in memory only, nothing is stored)
//   generate - plain text -> a tagged ResumeDoc
//   edit     - current doc + instruction -> updated doc
//
// The document itself carries all editing state, so edits are single-turn AI
// calls - no chat history needed. Nothing is persisted server-side; the client
// keeps the document in sessionStorage.
import { requireAuth } from '@/lib/requireAuth'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit'
import { withTimeout } from '@/lib/withTimeout'
import { isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai'
import { extractResumeText, isDocxFile } from '@/lib/docx/extractText'
import { parseResumeFile, parseResumeText } from '@/lib/tagged/parseResume'
import { editTagged } from '@/lib/tagged/edit'
import { carrySources } from '@/lib/tagged/sources'
import { isResumeDoc, isReasonableSize } from '@/lib/tagged/validate'
import type { ResumeDoc } from '@/lib/tagged/schema'

const ROUTE = '/api/resume-studio'

// AI work over long resumes can exceed Vercel's default budget.
export const maxDuration = 60

const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_TEXT_CHARS = 50_000
const MAX_INSTRUCTION_CHARS = 500

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

    // A Word file is read rather than transcribed: its own paragraphs are the
    // resume's lines, so nothing is retyped and each line keeps a reference to
    // the paragraph it came from. That reference is what lets the download
    // write into the user's document instead of rebuilding it, which is the
    // only way the Studio can match what Tailor produces.
    if (isDocx) {
      const parsed = await parseResumeFile(buffer, true)
      if (parsed.doc.sections.length > 0) {
        await logRoute(ROUTE, userId, Date.now() - start, 200)
        return ok({ doc: parsed.doc })
      }
    }

    // extractResumeText writes hyperlink destinations into the text itself, so
    // there is no separate link list to carry around any more - the address is
    // in the words the AI tags, and lib/docx/links.ts finds it again on the
    // way out.
    const text = await extractResumeText(buffer, isDocx)
    if (!text.trim()) return err('Could not read any text from that file', 400)
    await logRoute(ROUTE, userId, Date.now() - start, 200)
    return ok({ text: text.slice(0, MAX_TEXT_CHARS) })
  } catch {
    await logRoute(ROUTE, userId, Date.now() - start, 400)
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
  const { action, text, doc, instruction } = body as {
    action?: string
    text?: string
    doc?: unknown
    instruction?: string
  }

  if (action !== 'generate' && action !== 'edit') return err('Invalid action', 400)

  // Validate input before touching the limit - a bad request costs nothing.
  let validText = ''
  let validInstruction = ''
  let validDoc: ResumeDoc | null = null
  if (action === 'generate') {
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT_CHARS) {
      return err('Invalid resume text', 400)
    }
    validText = text
  } else {
    if (!isResumeDoc(doc) || !isReasonableSize(doc)) {
      return err('Invalid resume document', 400)
    }
    validDoc = doc
    if (
      typeof instruction !== 'string' ||
      !instruction.trim() ||
      instruction.length > MAX_INSTRUCTION_CHARS
    ) {
      return err(`Instruction must be 1-${MAX_INSTRUCTION_CHARS} characters`, 400)
    }
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

  try {
    if (action === 'generate') {
      const { doc: parsed } = await withTimeout(
        parseResumeText(validText),
        55000,
        'resume-studio-generate'
      )
      await Promise.all([
        recordRateLimitUse('resume-studio', user.id),
        logRoute(ROUTE, user.id, Date.now() - start, 200),
      ])
      return ok({ doc: parsed })
    }

    // validDoc is non-null on every path that reaches here: the 'edit' branch
    // above returns 400 unless isResumeDoc accepted it.
    const result = await withTimeout(
      editTagged(validDoc as ResumeDoc, validInstruction),
      55000,
      'resume-studio-edit'
    )

    if (result.failed) {
      await logRoute(ROUTE, user.id, Date.now() - start, 422)
      return err('We could not apply that change. Try describing it differently.', 422)
    }

    // Charge the limit only now that the edit actually applied.
    await Promise.all([
      recordRateLimitUse('resume-studio', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ])

    // The tagged format carries text only, so the edit came back with no
    // paragraph references at all. Restoring them by text is what keeps the
    // download writing into the user's own file: an edit that reworded one
    // bullet should not cost them the formatting of the other forty lines.
    return ok({ doc: carrySources(validDoc as ResumeDoc, result.doc) })
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429)
      return err(AI_BUSY_MESSAGE, 429)
    }
    if (e instanceof Error && e.message.startsWith('Could not read that resume')) {
      await logRoute(ROUTE, user.id, Date.now() - start, 400)
      return err(e.message, 400)
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
