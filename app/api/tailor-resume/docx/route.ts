// ResumeDoc -> a finished download, as Word or PDF.
//
// No AI, so a user can re-download after every tweak in the preview without
// cost or latency. Word is the primary format: it is the one that carries the
// user's own template, because injecting into their .docx is what preserves
// their fonts, header and footer. The PDF is drawn from the same document by
// lib/docx/pdf.ts - see the note there about why it is not a conversion.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { err, notFound, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';
import { buildResumeDocx } from '@/lib/docx/buildDocx';
import { buildResumePdf } from '@/lib/docx/pdf';
import { fromLegacyDoc, isResumeDoc, isReasonableSize } from '@/lib/tagged/validate';
import type { ResumeDoc, StyleMapping } from '@/lib/tagged/schema';

const ROUTE = '/api/tailor-resume/docx';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PDF_MIME = 'application/pdf';

// Unzipping, rewriting and re-zipping a template is quick, but a cold start
// plus a large template can still outrun the default budget.
export const maxDuration = 60;

/** Strips characters Windows and Content-Disposition both dislike. */
function safeFileName(label: string, extension: 'docx' | 'pdf'): string {
  const base = label.replace(/[^\w\s.-]/g, '').trim().replace(/\s+/g, '-') || 'resume';
  return `${base.slice(0, 120)}.${extension}`;
}

interface ProfileTemplate {
  resume_template_path: string | null;
  resume_template_mapping: StyleMapping | null;
}

interface BaseResumeFile {
  file_url: string | null;
  file_name: string | null;
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  // Validate before touching the limit - a bad request costs nothing.
  const body = await request.json().catch(() => null);
  const validation = validateBody<{
    documentId: string;
    doc?: unknown;
    fileName?: string;
    format?: string;
  }>(body, ['documentId']);
  if (!validation.valid) return err(validation.error, 400);
  const { documentId, doc: editedDoc, fileName } = validation.data;

  // Word unless a PDF is asked for by name, so an older client that sends no
  // format keeps getting exactly what it got before.
  const format: 'docx' | 'pdf' = validation.data.format === 'pdf' ? 'pdf' : 'docx';

  // An edited document from the preview is used in preference to the stored
  // one: the user's last edit is the version they mean to send.
  if (editedDoc !== undefined && (!isResumeDoc(editedDoc) || !isReasonableSize(editedDoc))) {
    return err('That resume could not be read. Refresh the page and try again.', 400);
  }

  // Generating a document is cheap but not free - each one unzips and rezips a
  // Word file in memory.
  const rateLimit = await checkRateLimit({
    key: 'resume-docx',
    userId: user.id,
    devLimit: 40,
    freeLimit: 60,
    proLimit: 120,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  });
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
  }

  const supabase = await createClient();

  const [docResult, profileResult, resumeResult] = await Promise.all([
    supabase
      .from('documents')
      .select('id, user_id, type, tailored_doc')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .eq('type', 'tailored_resume')
      .single(),
    supabase
      .from('profiles')
      .select('resume_template_path, resume_template_mapping')
      .eq('id', user.id)
      .single(),
    // The base resume doubles as a template when no explicit one was uploaded.
    supabase
      .from('resumes')
      .select('file_url, file_name')
      .eq('user_id', user.id)
      .eq('is_base', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (docResult.error || !docResult.data) {
    await logRoute(ROUTE, user.id, Date.now() - start, 404);
    return notFound('Tailored resume');
  }

  // A resume tailored before the format changed is converted rather than
  // rejected, so an old download link keeps working.
  const stored = docResult.data.tailored_doc;
  const resumeDoc: ResumeDoc | null = isResumeDoc(editedDoc)
    ? editedDoc
    : isResumeDoc(stored)
      ? stored
      : fromLegacyDoc(stored);

  if (!resumeDoc) {
    // Documents created before this pipeline existed hold plain text only.
    // Re-tailoring produces a structured one; nothing here can reconstruct it.
    await logRoute(ROUTE, user.id, Date.now() - start, 409);
    return err(
      'This tailored resume was made before file downloads were available. Tailor it again to download it.',
      409
    );
  }

  const profile = (profileResult.data ?? null) as ProfileTemplate | null;
  const baseResume = (resumeResult.data ?? null) as BaseResumeFile | null;

  try {
    let buffer: Buffer;

    if (format === 'pdf') {
      // The PDF is drawn from the document rather than converted from the
      // Word file, so the user's template does not reach it. That is stated
      // in the UI next to the button rather than left as a surprise.
      buffer = await buildResumePdf(resumeDoc);
    } else {
      // When the resume was uploaded as Word this reopens that very file and
      // changes only the words that changed, so the download is the user's own
      // document rather than a rebuilt lookalike.
      buffer = (
        await buildResumeDocx(resumeDoc, {
          templatePath: profile?.resume_template_path,
          templateMapping: profile?.resume_template_mapping,
          baseResumePath: baseResume?.file_url,
          baseResumeName: baseResume?.file_name,
        })
      ).buffer;
    }

    // Charge the limit only now that the document actually built.
    await Promise.all([
      recordRateLimitUse('resume-docx', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ]);

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': format === 'pdf' ? PDF_MIME : DOCX_MIME,
        'Content-Disposition': `attachment; filename="${safeFileName(fileName || resumeDoc.name || 'resume', format)}"`,
        'Content-Length': String(buffer.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500);
    // injectIntoTemplate throws messages written for the user when their
    // template is malformed, so those are worth surfacing rather than burying.
    if (e instanceof Error && e.message.startsWith('That template is not a valid .docx')) {
      return err(`${e.message} Upload a different template on your profile.`, 400);
    }
    return serverError(e);
  }
}
