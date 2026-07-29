// The user's Word template: check it (GET), upload it (POST), remove it (DELETE).
//
// The template is the .docx whose look their downloads should keep. We read its
// paragraph styles, guess which of ours maps to which of theirs, and store that
// map on the profile. The guess runs unattended - there is no mapping table in
// the UI - so an unmatched slot simply inherits the template's Normal style
// rather than failing.
import { requireAuth } from '@/lib/requireAuth';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';
import {
  deleteTemplate,
  readTemplateStyles,
  saveTemplate,
  suggestMapping,
} from '@/lib/docx/template';

const ROUTE = '/api/resume-template';

const MAX_BYTES = 5 * 1024 * 1024;

export const maxDuration = 30;

/** Whether a template is on file, and enough about it to confirm it landed. */
export async function GET(): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('resume_template_path, resume_template_name, resume_template_mapping')
    .eq('id', user.id)
    .single();

  await logRoute(ROUTE, user.id, Date.now() - start, 200);
  return ok({
    hasTemplate: Boolean(data?.resume_template_path),
    name: data?.resume_template_name ?? null,
    // How many of our slots found a style. Enough for the UI to say the
    // template was understood without exposing the whole mapping.
    mappedSlots: Object.keys(data?.resume_template_mapping ?? {}).length,
  });
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');

  if (!(file instanceof File)) return err('No file was uploaded', 400);
  if (file.size > MAX_BYTES) return err('Templates must be under 5MB', 400);
  if (!/\.docx$/i.test(file.name)) {
    return err('Templates must be .docx files. Re-save yours from Word if it is a .doc.', 400);
  }

  const rateLimit = await checkRateLimit({
    key: 'resume-template',
    userId: user.id,
    devLimit: 20,
    freeLimit: 20,
    proLimit: 40,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  });
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse before saving, so an unreadable file is rejected rather than stored
    // and then failing at download time, when the user is least able to act.
    const styles = await readTemplateStyles(buffer);
    const mapping = suggestMapping(styles);

    const path = await saveTemplate(user.id, buffer);

    const supabase = await createClient();
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        resume_template_path: path,
        resume_template_name: file.name,
        resume_template_mapping: mapping,
      })
      .eq('id', user.id);

    if (updateError) throw new Error(updateError.message);

    await Promise.all([
      recordRateLimitUse('resume-template', user.id),
      logRoute(ROUTE, user.id, Date.now() - start, 200),
    ]);

    return ok({
      hasTemplate: true,
      name: file.name,
      mappedSlots: Object.keys(mapping).length,
      styleCount: styles.length,
    });
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 400);
    // readTemplateStyles throws a message written for the user.
    if (e instanceof Error && e.message.includes('styles.xml')) {
      return err('That file is not a readable Word document. Try re-saving it from Word.', 400);
    }
    return serverError(e);
  }
}

export async function DELETE(): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const supabase = await createClient();

  const { data } = await supabase
    .from('profiles')
    .select('resume_template_path')
    .eq('id', user.id)
    .single();

  if (data?.resume_template_path) {
    await deleteTemplate(data.resume_template_path);
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      resume_template_path: null,
      resume_template_name: null,
      resume_template_mapping: null,
    })
    .eq('id', user.id);

  if (updateError) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500);
    return serverError(new Error(updateError.message));
  }

  await logRoute(ROUTE, user.id, Date.now() - start, 200);
  return ok({ hasTemplate: false, name: null, mappedSlots: 0 });
}
