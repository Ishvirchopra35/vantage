// Resume Studio PDF download: renders the current resume HTML with the
// shared print stylesheet and streams the PDF straight back - nothing is
// written to storage (this feature is an experiment and leaves no trace).
import { requireAuth } from '@/lib/requireAuth'
import { err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit'
import { generateResumeBuffer } from '@/lib/generatePdf'

const ROUTE = '/api/resume-studio/pdf'

// Puppeteer cold starts + render can exceed the default budget.
export const maxDuration = 60

const MAX_HTML_CHARS = 200_000

// Same defense as the studio route: the HTML comes back from the client,
// so re-sanitize before handing it to a headless browser.
function sanitize(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript:/gi, '')
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  // No AI here, but each render spins up headless Chromium - bound it.
  const rateLimit = await checkRateLimit({
    key: 'resume-pdf',
    userId: user.id,
    devLimit: 20,
    freeLimit: 40,
    proLimit: 60,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  const body = await request.json().catch(() => null)
  const html = (body as { html?: unknown } | null)?.html
  if (typeof html !== 'string' || !html.trim() || html.length > MAX_HTML_CHARS) {
    return err('Invalid resume HTML', 400)
  }

  try {
    const pdf = await generateResumeBuffer(sanitize(html))
    if (!pdf) {
      await logRoute(ROUTE, user.id, Date.now() - start, 500)
      return err('PDF rendering is unavailable right now. Please try again later.', 500)
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="resume.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
