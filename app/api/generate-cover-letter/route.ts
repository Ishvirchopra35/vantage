// Generates a tailored cover letter from the user's context + job posting;
// saved to documents with type cover_letter.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, LIMITS, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { withTimeout } from '@/lib/withTimeout';
import { generateText, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai';
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

  const rateLimit = await checkRateLimit({
    key: 'cover-letter',
    userId: user.id,
    devLimit: 1,
    freeLimit: 10,
    proLimit: 4,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  });
  if (!rateLimit.allowed) {
    await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
  }

  const supabase = await createClient();

  const [jobResult, profileResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, user_id, title, company, company_description, required_skills, key_responsibilities, keywords')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('full_name, phone, email, linkedin_url, portfolio_url, cover_letter_template')
      .eq('id', user.id)
      .single(),
  ]);

  if (jobResult.error || !jobResult.data) {
    await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 404);
    return notFound('Job');
  }

  const job = jobResult.data;
  const profile = profileResult.data as {
    full_name: string | null
    phone: string | null
    email: string | null
    linkedin_url: string | null
    portfolio_url: string | null
    cover_letter_template: string | null
  } | null;

  const ctx = await buildUserContext(user.id);
  const contextStr = formatContextForPrompt(ctx);

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const senderName = profile?.full_name || ctx.fullName || '';
  const senderPhone = profile?.phone || ctx.phone || '';
  const senderEmail = profile?.email || ctx.email || '';
  const senderLink = profile?.portfolio_url || profile?.linkedin_url || ctx.linkedinUrl || '';

  const letterHeader = [
    senderName,
    senderPhone,
    senderEmail,
    senderLink,
    '',
    today,
  ].filter((line, idx) => idx >= 4 || line).join('\n');

  const BANNED_PHRASES =
    `'I am excited to apply', 'I am passionate about', 'I would be a great fit', ` +
    `'I hope to', 'I believe I', 'please find attached', 'to whom it may concern', ` +
    `'I am writing to express', or any variation of these clichés`;

  let systemPrompt: string;
  let userPrompt: string;

  if (profile?.cover_letter_template) {
    systemPrompt =
      `You are adapting a user's personal cover letter template for a specific job application. ` +
      `Keep their exact voice, sentence structure, and style. ` +
      `Replace {company}, {role}, {hiring_manager}, and any other placeholders with real values. ` +
      `Tailor the body to highlight experience relevant to this specific job. ` +
      `Return ONLY the completed letter - no commentary, no meta-text.`;

    userPrompt =
      `Complete this cover letter template for the job below.\n\n` +
      `TEMPLATE:\n${profile.cover_letter_template}\n\n` +
      `JOB: ${job.title} at ${job.company}\n` +
      `Company description: ${job.company_description || 'Not provided'}\n` +
      `Key responsibilities: ${(job.key_responsibilities || []).slice(0, 5).join(', ')}\n` +
      `Required skills: ${(job.required_skills || []).slice(0, 6).join(', ')}\n\n` +
      `CANDIDATE CONTEXT:\n${contextStr}\n\n` +
      `Replace all placeholders. Keep the candidate's voice. Return the completed letter only.`;
  } else {
    systemPrompt =
      `You are an expert cover letter writer. Write a professional cover letter in proper letter format.\n\n` +
      `Rules:\n` +
      `1. Write in first person, confident and direct tone\n` +
      `2. BANNED PHRASES - never use: ${BANNED_PHRASES}\n` +
      `3. Sound like a specific real person, not a template\n` +
      `4. Naturally weave in ATS keywords throughout the letter\n` +
      `5. Return the COMPLETE letter including header block, date, salutation, body, and closing\n` +
      `6. Do NOT use placeholder brackets in the output`;

    userPrompt =
      `Write a cover letter for this application.\n\n` +
      `${contextStr}\n\n` +
      `JOB: ${job.title} at ${job.company}\n` +
      `Company description: ${job.company_description || 'Not provided'}\n` +
      `Key responsibilities: ${(job.key_responsibilities || []).slice(0, 5).join(', ')}\n` +
      `Required skills: ${(job.required_skills || []).slice(0, 6).join(', ')}\n` +
      `ATS keywords to weave in: ${(job.keywords || []).slice(0, 20).join(', ')}\n\n` +
      `Format the letter EXACTLY like this:\n` +
      `${letterHeader}\n\n` +
      `Dear Hiring Team,\n\n` +
      `[Paragraph 1 - Why this specific company and role. Reference the company description. No generic excitement language.]\n\n` +
      `[Paragraph 2 - Most relevant experience or project from their background that directly matches the key responsibilities. Include a specific achievement or scope if one exists in their resume.]\n\n` +
      `[Paragraph 3 - Skills alignment with the role's requirements. 2-3 sentences.]\n\n` +
      `[Paragraph 4 (optional) - Brief, confident close with a clear call to action. No 'please consider me'.]\n\n` +
      `Sincerely,\n${senderName}\n\n` +
      `Maximum 350 words total. Do NOT include the bracket instructions in your output.`;
  }

  let coverLetterText: string;
  try {
    coverLetterText = await withTimeout(generateText(systemPrompt, userPrompt, 1500), 30000, 'generate-cover-letter');
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute('/api/generate-cover-letter', user.id, Date.now() - start, 429);
      return err(AI_BUSY_MESSAGE, 429);
    }
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
