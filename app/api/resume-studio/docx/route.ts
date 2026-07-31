// Resume Studio download: a ResumeDoc from the browser -> a Word file.
//
// Nothing is persisted - this feature is an experiment and leaves no trace - so
// unlike /api/tailor-resume/docx there is no document row to read from and the
// whole resume arrives in the request body. The user's saved template is still
// applied, so a studio download looks the same as a tailored one.
import { requireAuth } from '@/lib/requireAuth'
import { err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit'
import { createClient } from '@/lib/supabase/server'
import { buildResumeDocx } from '@/lib/docx/buildDocx'
import { buildResumePdf } from '@/lib/docx/pdf'
import { isReasonableSize, readStoredDoc } from '@/lib/tagged/validate'
import type { StyleMapping } from '@/lib/tagged/schema'

const ROUTE = '/api/resume-studio/docx'

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const PDF_MIME = 'application/pdf'

export const maxDuration = 60

interface ProfileTemplate {
  resume_template_path: string | null
  resume_template_mapping: StyleMapping | null
}

interface BaseResumeFile {
  file_url: string | null
  file_name: string | null
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  // Validate input before touching the limit - a bad request costs nothing.
  const body = await request.json().catch(() => null)
  const doc = readStoredDoc((body as { doc?: unknown } | null)?.doc)
  if (!doc || !isReasonableSize(doc)) {
    return err('Invalid resume document', 400)
  }

  const format: 'docx' | 'pdf' =
    (body as { format?: string } | null)?.format === 'pdf' ? 'pdf' : 'docx'

  const rateLimit = await checkRateLimit({
    key: 'resume-docx',
    userId: user.id,
    devLimit: 40,
    freeLimit: 60,
    proLimit: 4000,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 43200,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  try {
    if (format === 'pdf') {
      const pdf = await buildResumePdf(doc)
      await Promise.all([
        recordRateLimitUse('resume-docx', user.id),
        logRoute(ROUTE, user.id, Date.now() - start, 200),
      ])
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          'Content-Type': PDF_MIME,
          'Content-Disposition': 'attachment; filename="resume.pdf"',
          'Content-Length': String(pdf.byteLength),
          'Cache-Control': 'no-store',
        },
      })
    }

    const supabase = await createClient()
    const [profileResult, resumeResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('resume_template_path, resume_template_mapping')
        .eq('id', user.id)
        .single(),
      supabase
        .from('resumes')
        .select('file_url, file_name')
        .eq('user_id', user.id)
        .eq('is_base', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
    ])

    const profile = (profileResult.data ?? null) as ProfileTemplate | null
    const baseResume = (resumeResult.data ?? null) as BaseResumeFile | null

    // When the resume was uploaded as Word this reopens that very file and
    // changes only the words that changed, so the download is the user's own
    // document rather than a rebuilt lookalike.
    const { buffer } = await buildResumeDocx(doc, {
      templatePath: profile?.resume_template_path,
      templateMapping: profile?.resume_template_mapping,
      baseResumePath: baseResume?.file_url,
      baseResumeName: baseResume?.file_name,
    })

    // Charge the limit only now that the document actually built.
    await Promise.all([
      recordRateLimitUse('resume-docx', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ])

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': DOCX_MIME,
        'Content-Disposition': 'attachment; filename="resume.docx"',
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    if (e instanceof Error && e.message.startsWith('That template is not a valid .docx')) {
      return err(`${e.message} Upload a different template on your profile.`, 400)
    }
    return serverError(e)
  }
}
