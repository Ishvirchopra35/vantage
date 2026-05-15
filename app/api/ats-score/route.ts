import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError, notFound, rateLimited } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';
import { generateJSON } from '@/lib/ai';
import { checkLimit, LIMITS } from '@/lib/rateLimit';
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext';
import { createClient } from '@/lib/supabase/server';

interface ATSScoreResult {
  overall_score: number;
  keyword_score: number;
  format_score: number;
  experience_score: number;
  skills_score: number;
  missing_keywords: string[];
  present_keywords: string[];
  suggestions: string[];
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const validation = validateBody<{ jobId: string; resumeId?: string; documentId?: string }>(
    body,
    ['jobId']
  );
  if (!validation.valid) return err(validation.error, 400);
  const { jobId, resumeId, documentId } = validation.data;

  // Validate that one of resumeId or documentId is provided
  if (!resumeId && !documentId) {
    return err('One of resumeId or documentId is required', 400);
  }

  // Check rate limit for 'tailoring' feature
  const limitCheck = await checkLimit(user.id, 'tailoring');
  if (!limitCheck.allowed) {
    await logRoute('/api/ats-score', user.id, Date.now() - start, 429);
    return rateLimited('ATS scoring', LIMITS.tailoring, 30);
  }

  const supabase = await createClient();

  // Step 1: Fetch job row
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, user_id, title, company, required_skills, years_experience_required, key_responsibilities, keywords')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    await logRoute('/api/ats-score', user.id, Date.now() - start, 404);
    return notFound('Job');
  }

  // Verify job.user_id === user.id
  if (job.user_id !== user.id) {
    await logRoute('/api/ats-score', user.id, Date.now() - start, 403);
    return err('Forbidden', 403);
  }

  // Step 2: Fetch resume text
  let resumeText: string | null = null;

  if (documentId) {
    const { data: doc, error: docError } = await supabase
      .from('documents')
      .select('content')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !doc) {
      await logRoute('/api/ats-score', user.id, Date.now() - start, 404);
      return notFound('Document');
    }
    resumeText = doc.content;
  } else if (resumeId) {
    const { data: resume, error: resumeError } = await supabase
      .from('resumes')
      .select('raw_text')
      .eq('id', resumeId)
      .eq('user_id', user.id)
      .single();

    if (resumeError || !resume) {
      await logRoute('/api/ats-score', user.id, Date.now() - start, 404);
      return notFound('Resume');
    }
    resumeText = resume.raw_text;
  }

  if (!resumeText) {
    await logRoute('/api/ats-score', user.id, Date.now() - start, 400);
    return err('Could not retrieve resume text', 400);
  }

  // Step 3: Build user context
  let userContext: any = {};
  try {
    userContext = await buildUserContext(user.id);
  } catch {
    // Continue without context if it fails
  }
  const contextStr = formatContextForPrompt(userContext);

  // Step 4: Call generateJSON with ATS scoring prompt
  const systemPrompt =
    'You are an expert ATS (Applicant Tracking System) analyst. Score resumes against job requirements. Return ONLY valid JSON.';

  const userPrompt = `Analyze this resume against this job description and ATS keyword list.

${contextStr}

JOB DETAILS:
Title: ${job.title} at ${job.company}
Required skills: ${(job.required_skills || []).join(', ')}
Experience required: ${job.years_experience_required || 0} years
Key responsibilities: ${(job.key_responsibilities || []).join(' | ')}
ATS KEYWORD LIST (every word an ATS would scan for): ${(job.keywords || []).join(', ')}

RESUME TO SCORE:
${resumeText}

Return JSON with:
- overall_score: integer 0-100 (weighted: keyword 40%, experience 30%, format 20%, skills 10%)
- keyword_score: integer 0-100 (what % of the ATS keyword list appears in the resume)
- format_score: integer 0-100 (ATS readability: no tables, no images, standard section headings, parseable structure)
- experience_score: integer 0-100 (how well candidate's experience matches the required years and responsibilities)
- skills_score: integer 0-100 (coverage of required_skills specifically)
- missing_keywords: string[] max 12 (most impactful keywords from the ATS list NOT found in resume)
- present_keywords: string[] max 12 (ATS keywords that ARE found in resume)
- suggestions: string[] max 6 (specific, actionable improvements each under 25 words — not generic advice)`;

  let score: ATSScoreResult;
  try {
    score = await withTimeout(generateJSON<ATSScoreResult>(systemPrompt, userPrompt), 30000, 'ats-score');
  } catch (e) {
    await logRoute('/api/ats-score', user.id, Date.now() - start, 500);
    return serverError(new Error('Could not generate ATS score'));
  }

  // Step 5: Save to ats_scores table
  const { data: savedScore, error: saveError } = await supabase
    .from('ats_scores')
    .insert({
      user_id: user.id,
      job_id: jobId,
      resume_id: resumeId || null,
      document_id: documentId || null,
      overall_score: score.overall_score,
      keyword_score: score.keyword_score,
      format_score: score.format_score,
      experience_score: score.experience_score,
      skills_score: score.skills_score,
      missing_keywords: score.missing_keywords,
      present_keywords: score.present_keywords,
      suggestions: score.suggestions,
    })
    .select('id, overall_score, keyword_score, format_score, experience_score, skills_score, missing_keywords, present_keywords, suggestions')
    .single();

  if (saveError || !savedScore) {
    await logRoute('/api/ats-score', user.id, Date.now() - start, 500);
    return serverError(new Error(saveError?.message || 'Failed to save ATS score'));
  }

  // Track analytics event
  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: 'ats_score_checked',
      properties: {
        overall_score: savedScore.overall_score,
        job_title: job.title,
        job_id: jobId,
      },
    })
  ).catch(() => {});

  await logRoute('/api/ats-score', user.id, Date.now() - start, 200);
  return ok({ score: savedScore });
}
