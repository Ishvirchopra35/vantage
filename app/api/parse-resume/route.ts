// Base resume upload -> raw text -> AI -> tagged ResumeDoc.
//
// This is the only place the AI is allowed to *decide* structure. Everything
// downstream - tailoring, the browser editor, the .docx download - treats the
// resulting tag tree as fixed, so the cost of a mistake here is high, which is
// why parseResumeText validates by round-tripping through our own parser
// rather than trusting the model's output text.
//
// The route stops at producing the document; /api/save-resume writes the row.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';
import { isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai';
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit';
import { extractResumeText, isDocxFile } from '@/lib/docx/extractText';
import { parseResumeFile } from '@/lib/tagged/parseResume';

const ROUTE = '/api/parse-resume';

// Tagging a long resume is the slowest AI call in the app.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rateLimit = await checkRateLimit({
    key: 'parse-resume',
    userId: user.id,
    devLimit: 1,
    freeLimit: 3,
    proLimit: 30,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 43200,
  });
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
  }

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ fileUrl: string; fileName?: string }>(body, ['fileUrl']);
  if (!validation.valid) return err(validation.error, 400);
  const { fileUrl, fileName = '' } = validation.data;

  let arrayBuffer: ArrayBuffer;
  let contentType = '';
  try {
    const response = await withTimeout(fetch(fileUrl), 10000, 'file fetch');
    if (!response.ok) {
      return err('Could not download the uploaded file - please try uploading again', 400);
    }
    contentType = response.headers.get('content-type') ?? '';
    arrayBuffer = await response.arrayBuffer();
  } catch {
    return err('Could not download the uploaded file - please try uploading again', 400);
  }

  const buffer = Buffer.from(arrayBuffer);
  const isDocx = isDocxFile(fileName, contentType);

  let text: string;
  try {
    text = await extractResumeText(buffer, isDocx);
  } catch {
    await logRoute(ROUTE, user.id, Date.now() - start, 400);
    return err(
      isDocx
        ? 'That file could not be read. Try re-saving it from Word as a .docx.'
        : 'That file could not be read. Scanned or image-only PDFs are not supported yet.',
      400
    );
  }

  if (text.trim().length < 50) {
    await logRoute(ROUTE, user.id, Date.now() - start, 400);
    return err(
      isDocx
        ? 'Almost no text was found in that file - it looks empty.'
        : 'Almost no text was found in that file - it may be a scan rather than a text PDF.',
      400
    );
  }

  try {
    // For a .docx this reads the file's own paragraphs instead of asking the
    // model to retype the resume, so no line can be dropped or reworded and
    // each one keeps a reference to the paragraph it came from.
    const { doc } = await withTimeout(parseResumeFile(buffer, isDocx), 55000, 'parse-resume-tagged');

    // The AI is told never to invent content, so feeding it something that is
    // not a resume produces an honest but empty result rather than a fabricated
    // career. Good - but silently handing back a nameless resume looks like a
    // bug, so say what happened.
    const looksLikeResume = Boolean(doc.name.trim()) || doc.sections.length > 0;

    // Charge the limit only now that the resume actually parsed.
    await Promise.all([
      recordRateLimitUse('parse-resume', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ]);

    return ok({
      text,
      doc,
      warning: looksLikeResume
        ? undefined
        : 'This does not look like a resume - no name or work history was found. Check you uploaded the right file.',
    });
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute(ROUTE, user.id, Date.now() - start, 429);
      return err(AI_BUSY_MESSAGE, 429);
    }
    // parseResumeText throws a message written for the user, so surface it.
    if (e instanceof Error && e.message.startsWith('Could not read that resume')) {
      await logRoute(ROUTE, user.id, Date.now() - start, 400);
      return err(e.message, 400);
    }
    await logRoute(ROUTE, user.id, Date.now() - start, 500);
    return serverError(e);
  }
}
