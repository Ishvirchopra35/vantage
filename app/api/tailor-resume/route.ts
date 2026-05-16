import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, LIMITS } from '@/lib/rateLimit';
import { withTimeout } from '@/lib/withTimeout';
import { generateText, generateJSON } from '@/lib/ai';
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

function parseSkillGaps(raw: string): { resumeText: string; skillGaps: string[] } {
  const lines = raw.split('\n');
  let gapLineIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].trimStart().startsWith('SKILL_GAPS:')) {
      gapLineIdx = i;
      break;
    }
  }

  if (gapLineIdx === -1) {
    return { resumeText: raw.trim(), skillGaps: [] };
  }

  const gapLine = lines[gapLineIdx];
  const afterColon = gapLine.slice(gapLine.indexOf(':') + 1).trim();
  const skillGaps = afterColon
    ? afterColon.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  return { resumeText: lines.slice(0, gapLineIdx).join('\n').trim(), skillGaps };
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

  const systemPrompt = `You are an expert resume writer specializing in students and new graduates entering competitive job markets. Your output will be submitted directly to ATS systems before a human reads it.

Non-negotiable rules:
1. NEVER add any experience, skill, project, achievement, or fact not present in the original resume. If it's not there, it cannot appear in the output.
2. Preserve the candidate's authentic voice — the output must sound like the same person who wrote the original resume.
3. You have full freedom to: reorder bullet points within a role, reorder entire sections, rephrase existing bullets, adjust the summary/objective section, and change formatting choices.
4. Keyword integration: naturally weave keywords from the job's ATS keyword list into existing bullets where they genuinely match the candidate's actual experience. Do not force keywords that don't fit — this looks fake to human reviewers.
5. Return ONLY the complete resume text. No commentary, no explanations, no markdown formatting beyond what's already in the resume.
6. End the response with exactly one line in this format: SKILL_GAPS: [comma-separated list of required_skills not present in the resume]`;

  const userPrompt = `Tailor this resume for the following job. Focus on maximizing ATS keyword coverage while keeping the content authentic.

${contextStr}

TARGET JOB:
Title: ${job.title} at ${job.company}
Required skills: ${(job.required_skills || []).join(', ')}
Nice to have: ${(job.nice_to_have_skills || []).join(', ')}
Key responsibilities: ${(job.key_responsibilities || []).join('\n- ')}
ATS keywords to naturally incorporate: ${(job.keywords || []).slice(0, 30).join(', ')}

Instructions:
- Reorder all bullets within each role so the most relevant experience for THIS job appears first
- If a summary/objective section exists, rewrite it to reflect this specific role and company
- For each bullet, consider whether any ATS keyword from the list naturally fits the described work
- Prioritize coverage of required_skills over nice_to_have_skills

ORIGINAL RESUME:
${resume.raw_text}`;

  let rawOutput: string;
  try {
    rawOutput = await withTimeout(generateText(systemPrompt, userPrompt, 4000), 30000, 'tailor-resume');
  } catch (e) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error('Failed to generate tailored resume'));
  }

  const { resumeText: tailoredResumeText, skillGaps: parsedGaps } = parseSkillGaps(rawOutput);

  const { data: savedDoc, error: saveError } = await supabase
    .from('documents')
    .insert({
      user_id: user.id,
      job_id: jobId,
      type: 'tailored_resume',
      content: tailoredResumeText,
      skill_gaps: parsedGaps,
    })
    .select('id, user_id, job_id, type, content, skill_gaps, version')
    .single();

  if (saveError || !savedDoc) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 500);
    return serverError(new Error(saveError?.message || 'Failed to save document'));
  }

  // ATS score the tailored document immediately — best-effort, does not fail the request
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
- suggestions: string[] max 6 (specific, actionable improvements each under 25 words — not generic advice)`;

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
    // Fail silently — ATS score is a bonus, not required for a successful tailoring
  }

  void Promise.resolve(
    supabase.from('events').insert({
      user_id: user.id,
      event_name: 'tailored_resume',
      properties: {
        job_title: job.title,
        company: job.company,
        skill_gap_count: parsedGaps.length,
      },
    })
  ).catch(() => {});

  await logRoute('/api/tailor-resume', user.id, Date.now() - start, 200);
  return ok({ document: savedDoc, skillGaps: parsedGaps, atsScore: immediateScore });
}
