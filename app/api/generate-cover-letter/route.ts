import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, LIMITS } from '@/lib/rateLimit';
import { withTimeout } from '@/lib/withTimeout';
import { generateText } from '@/lib/ai';
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ jobId: string }>(body, ['jobId']);
  if (!validation.valid) return err(validation.error, 400);
  const { jobId } = validation.data;

  const limitCheck = await checkLimit(user.id, 'cover_letter');
  if (!limitCheck.allowed) {
    await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 429);
    return rateLimited('cover letter generation', LIMITS.cover_letter, 30);
  }

  const supabase = await createClient();

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, user_id, title, company, company_description, required_skills, keywords')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (jobError || !job) {
    await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 404);
    return notFound('Job');
  }

  const ctx = await buildUserContext(user.id);
  const contextStr = formatContextForPrompt(ctx);

  const systemPrompt = `You are an expert cover letter writer who understands both ATS systems and human hiring managers.

Non-negotiable rules:
1. Write in first person, present tense where appropriate, confident and direct tone.
2. BANNED PHRASES — never use: 'I am excited to apply', 'I am passionate about', 'I would be a great fit', 'I hope to', 'I believe I', 'please find attached', 'to whom it may concern', 'I am writing to express', or any variation of these clichés.
3. Sound like a real, specific person — not a template.
4. Naturally incorporate relevant keywords from the job's keyword list throughout the letter. This improves ATS scanning without sounding forced.
5. Structure: exactly 3 paragraphs.
6. Return ONLY the cover letter text — no subject line, no date, no address block, no 'Sincerely'.`;

  const userPrompt = `Write a cover letter for this application.

${contextStr}

JOB: ${job.title} at ${job.company}
Company description: ${job.company_description || 'Not provided'}
Key requirements: ${(job.required_skills || []).slice(0, 6).join(', ')}
ATS keywords to naturally weave in: ${(job.keywords || []).slice(0, 20).join(', ')}

Paragraph 1 — Why this specific company and role:
Reference something real from the company description. Do NOT use generic 'I'm excited' language. Show you've thought about why this specific company, not just the role type.

Paragraph 2 — Why this specific candidate:
Pull the 1-2 most relevant experiences from their resume that directly match the key requirements. Include one specific, quantifiable achievement if one exists in the resume. If no numbers exist, describe the scope or impact.

Paragraph 3 — Close:
Brief (2-3 sentences). Confident. Clear call to action. No begging, no 'please consider me'.

Maximum 260 words total.`;

  let coverLetterText: string;
  try {
    coverLetterText = await withTimeout(generateText(systemPrompt, userPrompt, 1000), 30000, 'generate-cover-letter');
  } catch (e) {
    await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 500);
    return serverError(new Error('Failed to generate cover letter'));
  }

  const { data: savedDoc, error: saveError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      job_id: jobId,
      type: 'cover_letter',
      content: coverLetterText,
    })
    .select('id, user_id, job_id, type, content, version')
    .single();

  if (saveError || !savedDoc) {
    await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 500);
    return serverError(new Error(saveError?.message || 'Failed to save cover letter'));
  }

  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: 'generated_cover_letter',
      properties: {
        job_title: job.title,
        company: job.company,
        job_id: jobId,
      },
    })
  ).catch(() => {});

  await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 200);
  return ok({ document: savedDoc });
}
