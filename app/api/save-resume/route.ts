// Persists an uploaded resume row (file path + extracted text); demotes the
// previous base resume so exactly one is_base resume exists.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

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
