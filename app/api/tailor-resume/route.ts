// Tailors the base resume to a job posting and returns a per-bullet diff;
// optionally ATS-scores the result. The heaviest AI route in the app.
//
// The AI edits bullet text inside the tagged document rather than rewriting the
// resume, and lib/tagged/tailor.ts refuses any result whose structure drifted.
// So the section order, job count, bullet count, employers, dates and education
// that come out are the ones that went in - guaranteed mechanically, not by
// asking the model nicely.
export const maxDuration = 120;

import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, consumeLimit, LIMITS, checkRateLimit, rateLimitResponse, recordRateLimitUse } from '@/lib/rateLimit';
import { withTimeout } from '@/lib/withTimeout';
import { generateJSON, isAiQuotaError, AI_BUSY_MESSAGE } from '@/lib/ai';
import { buildUserContext, formatContextForPrompt } from '@/lib/userContext';
import { createClient } from '@/lib/supabase/server';
import { docToPlainText } from '@/lib/tagged/plainText';
import { resolveBaseResume } from '@/lib/tagged/baseResume';
import { tailorTagged, diffBullets, findSkillGaps, type TailorTarget } from '@/lib/tagged/tailor';
import type { ResumeDoc } from '@/lib/tagged/schema';

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

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ jobId: string }>(body, ['jobId']);
  if (!validation.valid) return err(validation.error, 400);
  const { jobId } = validation.data;

  const limitCheck = await checkLimit(user.id, 'tailoring');
  if (!limitCheck.allowed) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 429);
    return rateLimited('resume tailoring', LIMITS.tailoring, 30);
  }

  const rateLimit = await checkRateLimit({
    key: 'tailor-resume',
    userId: user.id,
    devLimit: 1,
    freeLimit: 10,
    proLimit: 150,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 43200,
  });
  if (!rateLimit.allowed) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
  }

  const supabase = await createClient();

  const [jobResult, resumeResult] = await Promise.all([
    supabase
      .from('jobs')
      .select('id, user_id, title, company, required_skills, nice_to_have_skills, years_experience_required, key_responsibilities, keywords')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('resumes')
      .select('id, raw_text, tagged_doc, tagged_version, file_url, file_name')
      .eq('user_id', user.id)
      .eq('is_base', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single(),
  ]);

  if (jobResult.error || !jobResult.data) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 404);
    return notFound('Job');
  }
  if (resumeResult.error || !resumeResult.data?.raw_text) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 404);
    return notFound('Base resume');
  }

  const job = jobResult.data;
  const resume = resumeResult.data;

  const ctx = await buildUserContext(user.id);
  const contextStr = formatContextForPrompt(ctx);

  const target: TailorTarget = {
    title: job.title ?? '',
    company: job.company ?? '',
    requiredSkills: job.required_skills || [],
    niceToHaveSkills: job.nice_to_have_skills || [],
    keyResponsibilities: job.key_responsibilities || [],
    keywords: job.keywords || [],
  };

  // The tagged document is the input to tailoring. Resumes uploaded before this
  // pipeline existed get tagged here on demand, from the original file rather
  // than the stored text - see lib/tagged/baseResume.ts for why that matters
  // for hyperlinks.
  let baseDoc: ResumeDoc;
  try {
    const resolved = await withTimeout(
      resolveBaseResume(resume, supabase),
      55000,
      'tailor-backfill-tagged'
    );
    baseDoc = resolved.doc;
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute('/api/tailor-resume', user.id, Date.now() - start, 429);
      return err(AI_BUSY_MESSAGE, 429);
    }
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error('Could not read your base resume. Try re-uploading it.'));
  }


  let tailoredDoc: ResumeDoc;
  let usedFallback: boolean;
  try {
    const result = await withTimeout(
      tailorTagged(baseDoc, target, contextStr),
      60000,
      'tailor-resume'
    );
    tailoredDoc = result.doc;
    usedFallback = result.usedFallback;
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute('/api/tailor-resume', user.id, Date.now() - start, 429);
      return err(AI_BUSY_MESSAGE, 429);
    }
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error('Failed to generate tailored resume'));
  }

  // Both documents have the same structure by construction, so the diff pairs
  // bullets by position rather than trying to match them by text.
  const changes = diffBullets(baseDoc, tailoredDoc, target);
  const parsedGaps = findSkillGaps(tailoredDoc, target);
  const tailoredResumeText = docToPlainText(tailoredDoc);

  const { data: savedDoc, error: saveError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      job_id: jobId,
      type: 'tailored_resume',
      // `tailored_doc` is the real artifact - the browser editor and the .docx
      // download both work from it. `content` is its plain-text rendering, kept
      // because ATS scoring, auto-fill and the documents list all read text.
      tailored_doc: tailoredDoc,
      content: tailoredResumeText,
      changes,
      skill_gaps: parsedGaps,
    })
    .select('id, user_id, job_id, type, content, tailored_doc, changes, skill_gaps, version')
    .single();

  if (saveError || !savedDoc) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error(saveError?.message || 'Failed to save document'));
  }

  // ATS score the tailored document immediately - best-effort, does not fail the request
  let immediateScore: Record<string, unknown> | null = null;
  try {
    const atsSystemPrompt =
      'You are an expert ATS (Applicant Tracking System) analyst. Score resumes against job requirements. Return ONLY valid JSON.';

    const atsUserPrompt = `Analyze this resume against this job description and ATS keyword list.

${contextStr}

JOB DETAILS:
Title: ${job.title} at ${job.company}
Required skills: ${(job.required_skills || []).join(', ')}
Experience required: ${job.years_experience_required || 0} years
Key responsibilities: ${(job.key_responsibilities || []).join(' | ')}
ATS KEYWORD LIST (every word an ATS would scan for): ${(job.keywords || []).join(', ')}

RESUME TO SCORE:
${tailoredResumeText}

Return JSON with:
- overall_score: integer 0-100 (weighted: keyword 40%, experience 30%, format 20%, skills 10%)
- keyword_score: integer 0-100 (what % of the ATS keyword list appears in the resume)
- format_score: integer 0-100 (ATS readability: no tables, no images, standard section headings, parseable structure)
- experience_score: integer 0-100 (how well candidate's experience matches the required years and responsibilities)
- skills_score: integer 0-100 (coverage of required_skills specifically)
- missing_keywords: string[] max 12 (most impactful keywords from the ATS list NOT found in resume)
- present_keywords: string[] max 12 (ATS keywords that ARE found in resume)
- suggestions: string[] max 6 (specific, actionable improvements each under 25 words - not generic advice)`;

    const atsResult = await withTimeout(
      generateJSON<ATSScoreResult>(atsSystemPrompt, atsUserPrompt),
      30000,
      'ats-score-inline'
    );

    const { data: atsRow } = await supabase
      .from('ats_scores')
      .insert({
        user_id: user.id,
        job_id: jobId,
        document_id: savedDoc.id,
        overall_score: atsResult.overall_score,
        keyword_score: atsResult.keyword_score,
        format_score: atsResult.format_score,
        experience_score: atsResult.experience_score,
        skills_score: atsResult.skills_score,
        missing_keywords: atsResult.missing_keywords,
        present_keywords: atsResult.present_keywords,
        suggestions: atsResult.suggestions,
      })
      .select('id, overall_score, keyword_score, format_score, experience_score, skills_score, missing_keywords, present_keywords, suggestions')
      .single();

    immediateScore = atsRow;
  } catch {
    // Fail silently - ATS score is a bonus, not required for a successful tailoring
  }

  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: 'tailored_resume',
      properties: {
        job_title: job.title,
        company: job.company,
        skill_gap_count: parsedGaps.length,
        change_count: changes.length,
        used_fallback: usedFallback,
      },
    })
  ).catch(() => {});

  // Charge the limits only now that the tailoring actually succeeded - and
  // `usedFallback` means it did not. The model failed to keep the resume's
  // structure across both attempts, so what came back is the original resume
  // unchanged. The user still gets a document they can edit and download, but
  // charging a tailoring for work that was not done is not defensible.
  await Promise.all([
    ...(usedFallback ? [] : [consumeLimit(user.id, 'tailoring')]),
    recordRateLimitUse('tailor-resume', user.id),
    logRoute('/api/tailor-resume', user.id, Date.now() - start, 200),
  ]);

  return ok({
    document: savedDoc,
    changes,
    skillGaps: parsedGaps,
    atsScore: immediateScore,
    // The client shows an honest notice rather than an empty diff that looks
    // like "your resume was already perfect".
    warning: usedFallback
      ? 'We could not safely tailor this resume without changing its structure, so it has been left as-is. Please try again.'
      : undefined,
  });
}
