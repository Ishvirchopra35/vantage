// Tailors the base resume to a job posting and returns a per-bullet diff;
// optionally ATS-scores the result. The heaviest AI route in the app.
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

interface TailorChange {
  section: string;
  entry: string;
  original: string;
  tailored: string;
  reason: string;
}

interface TailorResult {
  changes: TailorChange[];
  tailored_resume_text: string;
  skill_gaps: string[];
}

// Safety net behind the prompt: even with instructions to skip cosmetic
// edits, the model occasionally returns "removed 'a' for conciseness"-style
// changes. Those are noise in the diff view, so they are dropped server-side.
const INTERCHANGEABLE_VERBS = new Map<string, string>([
  ['built', 'made'], ['developed', 'made'], ['created', 'made'], ['made', 'made'],
  ['implemented', 'made'], ['constructed', 'made'], ['engineered', 'made'],
]);
const FILLER_WORDS = new Set(['a', 'an', 'the', 'and', 'with', 'using', 'to', 'of', 'for', 'in', 'on']);

function isTrivialChange(original: string, tailored: string, reason: string): boolean {
  // A reason about wording/conciseness means no job-alignment happened.
  if (/\b(concis|wording|redundant|filler|shorten|brevity|streamlin)\w*/i.test(reason)) return true;

  const normalize = (text: string): string =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s%$.+~-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w && !FILLER_WORDS.has(w))
      .map((w) => INTERCHANGEABLE_VERBS.get(w) ?? w)
      .join(' ');

  return normalize(original) === normalize(tailored);
}

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
    proLimit: 5,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
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
      .select('id, raw_text')
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

  const jobSkills = (job.required_skills || []).join(', ');
  const jobNiceToHave = (job.nice_to_have_skills || []).join(', ');
  const jobResponsibilities = (job.key_responsibilities || []).join('\n- ');
  const jobKeywords = (job.keywords || []).slice(0, 30).join(', ');

  const systemPrompt =
    `You are an expert resume writer specializing in students and new graduates. ` +
    `You tailor resumes to job descriptions by rewriting individual bullet points. ` +
    `Return ONLY valid JSON.\n\n` +
    `YOUR PRIMARY GOAL: re-frame each relevant bullet so it speaks the job description's language. ` +
    `Scan the required skills, key responsibilities, and ATS keywords below; whenever a bullet ` +
    `describes work that touches one of them, rewrite the bullet to NAME it using the job's exact ` +
    `terminology and to mirror how the job describes that responsibility. Example: if the job lists ` +
    `React, Node.js, PostgreSQL, Jest, and Agile, a bullet about building a web feature should say ` +
    `React/Node.js, a bullet about databases should say PostgreSQL, a bullet about testing should ` +
    `say Jest - provided the original bullet is genuinely about that work. Re-framing can also mean ` +
    `re-ordering the bullet to lead with the part the job cares about, or describing the same work ` +
    `at the altitude the job posting uses (e.g. "data pipeline" instead of "script" for a data role).\n\n` +
    `WHAT COUNTS AS A CHANGE - every entry in "changes" must do at least one of:\n` +
    `(a) weave in a required skill, responsibility phrase, or ATS keyword from the job,\n` +
    `(b) re-frame the bullet toward the job's domain or seniority language, or\n` +
    `(c) restructure the bullet to front-load the result or metric the job values.\n` +
    `NOT a change: shortening the wording, deleting articles ("a", "the"), swapping one generic verb ` +
    `for another ("Built" -> "Developed"), or any edit whose only benefit is conciseness. If the best ` +
    `you can do for a bullet is trim words, LEAVE IT OUT of "changes" entirely - an unchanged strong ` +
    `bullet is better than a cosmetic edit.\n\n` +
    `ABSOLUTE RULES:\n` +
    `1. NEVER add experience, skills, or facts not in the original resume - only name a technology if the original bullet's work plausibly involved it (e.g. the resume mentions it elsewhere or the bullet describes exactly that activity)\n` +
    `2. Preserve ALL specific numbers, percentages, dollar amounts, and metrics verbatim - "45s to 38s", "$45K+", "99%" must appear exactly as in the original\n` +
    `3. Keep each rewritten bullet roughly the original's length (never longer than 25 words), in the same direct, first-person-implied tone - never add filler like "demonstrating my ability to" or "leveraging my expertise in"\n` +
    `4. Max 2 job keywords per bullet; never force a keyword into a bullet about unrelated work\n` +
    `5. Do not invent new bullets or drop existing ones; keep every section, job title, company name, date, and education entry unchanged\n` +
    `6. Only rewrite bullets that materially improve the match for THIS job - leave already-strong bullets untouched and OUT of the changes array. It is normal and correct to change only a handful of bullets.\n\n` +
    `Return a JSON object with exactly these keys:\n` +
    `{\n` +
    `  "changes": [\n` +
    `    {\n` +
    `      "section": "the resume section heading this bullet lives under, e.g. Experience, Projects",\n` +
    `      "entry": "the company name (for work experience) or project name this bullet belongs to, exactly as written in the resume",\n` +
    `      "original": "the original bullet text, verbatim",\n` +
    `      "tailored": "the rewritten bullet",\n` +
    `      "reason": "one short line (max 12 words) that NAMES the specific keyword, skill, or responsibility from the job this rewrite serves - e.g. 'Added PostgreSQL keyword from job description' or 'Mirrored data pipeline responsibility wording'. Never write a reason about conciseness or wording."\n` +
    `    }\n` +
    `  ],\n` +
    `  "tailored_resume_text": "the COMPLETE updated resume as plain text, all sections included, with the rewritten bullets in place of the originals",\n` +
    `  "skill_gaps": ["required skills genuinely absent from the resume"]\n` +
    `}\n` +
    `Only bullets that actually changed belong in "changes".`;

  const userPrompt =
    `${contextStr}\n\n` +
    `TARGET JOB:\n` +
    `Title: ${job.title} at ${job.company}\n` +
    `Required skills: ${jobSkills}\n` +
    `Nice to have: ${jobNiceToHave}\n` +
    `Key responsibilities: ${jobResponsibilities}\n` +
    `ATS keywords to weave in naturally: ${jobKeywords}\n\n` +
    `ORIGINAL RESUME:\n${resume.raw_text}`;

  let result: TailorResult;
  try {
    result = await withTimeout(
      generateJSON<TailorResult>(systemPrompt, userPrompt, 6000),
      60000,
      'tailor-resume'
    );
  } catch (e) {
    if (isAiQuotaError(e)) {
      await logRoute('/api/tailor-resume', user.id, Date.now() - start, 429);
      return err(AI_BUSY_MESSAGE, 429);
    }
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error('Failed to generate tailored resume'));
  }

  const tailoredResumeText =
    typeof result.tailored_resume_text === 'string' ? result.tailored_resume_text.trim() : '';
  if (!tailoredResumeText) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error('AI returned an empty tailored resume'));
  }

  // Keep only well-formed changes where the text actually differs and the
  // edit is substantive (not a pure conciseness/verb-swap edit).
  const changes: TailorChange[] = (Array.isArray(result.changes) ? result.changes : [])
    .filter(
      (c): c is TailorChange =>
        !!c &&
        typeof c.original === 'string' &&
        typeof c.tailored === 'string' &&
        c.original.trim() !== '' &&
        c.tailored.trim() !== '' &&
        c.original.trim() !== c.tailored.trim() &&
        !isTrivialChange(c.original, c.tailored, typeof c.reason === 'string' ? c.reason : '')
    )
    .map((c) => ({
      section: typeof c.section === 'string' && c.section.trim() ? c.section.trim() : 'Resume',
      entry: typeof c.entry === 'string' ? c.entry.trim() : '',
      original: c.original.trim(),
      tailored: c.tailored.trim(),
      reason: typeof c.reason === 'string' ? c.reason.trim() : '',
    }))
    .slice(0, 60);

  const parsedGaps = (Array.isArray(result.skill_gaps) ? result.skill_gaps : [])
    .filter((s): s is string => typeof s === 'string' && s.trim() !== '')
    .map((s) => s.trim())
    .slice(0, 20);

  const { data: savedDoc, error: saveError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      job_id: jobId,
      type: 'tailored_resume',
      content: tailoredResumeText,
      // The per-bullet diff is what users see everywhere; the full text in
      // `content` is kept for internal use only (ATS scoring, auto-fill).
      changes,
      skill_gaps: parsedGaps,
    })
    .select('id, user_id, job_id, type, content, changes, skill_gaps, version')
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
      },
    })
  ).catch(() => {});

  // Charge the limits only now that the tailoring actually succeeded.
  await Promise.all([
    consumeLimit(user.id, 'tailoring'),
    recordRateLimitUse('tailor-resume', user.id),
    logRoute('/api/tailor-resume', user.id, Date.now() - start, 200),
  ]);
  return ok({ document: savedDoc, changes, skillGaps: parsedGaps, atsScore: immediateScore });
}
