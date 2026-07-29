// Persists an uploaded resume row (file path, extracted text, and the tagged
// ResumeDoc from /api/parse-resume); demotes the previous base resume so
// exactly one is_base resume exists.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { isResumeDoc, isReasonableSize } from '@/lib/tagged/validate';
import { CURRENT_TAGGED_VERSION } from '@/lib/tagged/baseResume';

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ fileUrl: string; fileName: string; rawText: string }>(
    body,
    ['fileUrl', 'fileName', 'rawText']
  );
  if (!validation.valid) return err(validation.error, 400);
  const { fileUrl, fileName, rawText } = validation.data;

  if (!rawText.trim()) {
    return err('Could not extract text from the PDF. Please try a text-based PDF, not a scanned image.', 400);
  }

  // The tagged document is optional so a save never fails on account of it.
  // A row without one still works: /api/tailor-resume tags on demand and
  // writes the result back, which is also how resumes uploaded before this
  // pipeline existed get their tagged_doc.
  const rawDoc = (body as { doc?: unknown } | null)?.doc;
  const taggedDoc =
    rawDoc !== undefined && isResumeDoc(rawDoc) && isReasonableSize(rawDoc) ? rawDoc : null;

  const supabase = await createClient();

  // Demote any existing base resume before inserting the new one
  await supabase
    .from('resumes')
    .update({ is_base: false })
    .eq('user_id', user.id)
    .eq('is_base', true);

  const { data: resume, error: dbError } = await supabase
    .from('resumes')
    .insert({
      user_id: user.id,
      file_url: fileUrl,
      file_name: fileName,
      raw_text: rawText,
      tagged_doc: taggedDoc,
      // Stamped so a later pipeline improvement knows this document is stale
      // and re-derives it, rather than the user having to re-upload.
      tagged_version: taggedDoc ? CURRENT_TAGGED_VERSION : 0,
      is_base: true,
    })
    .select('id, user_id, file_url, file_name, is_base')
    .single();

  if (dbError || !resume) {
    await logRoute('/api/save-resume', user.id, Date.now() - start, 500);
    return serverError(new Error(dbError?.message || 'Failed to save resume'));
  }

  await logRoute('/api/save-resume', user.id, Date.now() - start, 200);
  return ok({ resume });
}
