export const maxDuration = 120;

import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, notFound, rateLimited, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, LIMITS, checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
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

  const rateLimit = await checkRateLimit({
    key: 'tailor-resume',
    userId: user.id,
    maxRequests: 5,
    windowMinutes: 60,
  });
  if (!rateLimit.allowed) {
    await logRoute('/api/tailor-resume', user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining);
  }

  const supabase = await createClient();

  const [jobResult, resumeResult, profileResult] = await Promise.all([
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
    supabase
      .from('profiles')
      .select('resume_html')
      .eq('id', user.id)
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
  const resumeHtml = (profileResult.data as { resume_html: string | null } | null)?.resume_html ?? null;
  console.log('[tailor-resume] resumeHtml length:', resumeHtml?.length ?? 'null');

  const ctx = await buildUserContext(user.id);
  const contextStr = formatContextForPrompt(ctx);

  const jobSkills = (job.required_skills || []).join(', ');
  const jobNiceToHave = (job.nice_to_have_skills || []).join(', ');
  const jobResponsibilities = (job.key_responsibilities || []).join('\n- ');
  const jobKeywords = (job.keywords || []).slice(0, 30).join(', ');

  let rawOutput: string;
  try {
    if (resumeHtml) {
      // Surgical HTML update - only bullet text changes, everything else is frozen
      console.log('[tailor-resume] before AI call', { mode: 'html', jobId, userId: user.id });
      const systemPrompt =
        `You are performing a surgical edit on an existing resume's HTML. ` +
        `Your only job is to rewrite bullet point text to better match the target job description.\n\n` +
        `ABSOLUTE RULES - violating any of these is a failure:\n` +
        `1. Keep every HTML tag, attribute, href, and hyperlink byte-for-byte identical\n` +
        `2. Keep the candidate's name, contact info, email, phone, LinkedIn, and all URLs exactly as-is\n` +
        `3. Keep every section heading (h1, h2, h3) exactly as-is - do not rename, reorder, or remove any section\n` +
        `4. Keep job titles, company names, dates, and education entries exactly as-is\n` +
        `5. Only rewrite the text content inside <li> elements - nothing else\n` +
        `6. Do NOT add new <li> items or remove existing ones - the bullet count per section must stay identical\n` +
        `7. Do NOT reorder sections or move bullets between sections\n` +
        `8. Each rewritten bullet must stay under 20 words\n` +
        `9. Write in the same direct, first-person-implied tone as the original - never add phrases like "demonstrating my ability to", "showcasing my", "leveraging my expertise in", or similar filler\n` +
        `10. Weave in relevant ATS keywords naturally only where they fit the bullet's existing context\n` +
        `11. Preserve ALL specific numbers, percentages, dollar amounts, and metrics verbatim - "45s to 38s", "R² = 0.89", "$45K+", "99%", "~20%" must appear exactly as in the original\n` +
        `12. A rewritten bullet must contain every quantitative fact from the original bullet - if the original has a metric, the rewrite must include it unchanged\n` +
        `13. Do NOT force job keywords into every bullet - only weave in a keyword if it fits naturally without changing the meaning. Never append animation-related terms, framework names, or unrelated technology to a bullet about a different topic\n` +
        `14. Maximum 1-2 keywords per bullet, only where they genuinely fit the existing context\n` +
        `15. The tech stack line under each project heading (e.g. "Python, OpenCV, Pickle...") must be preserved exactly - do not remove, shorten, or modify it\n` +
        `16. Return ONLY the modified HTML body content - no <html>, <head>, or <body> tags\n` +
        `17. On the very last line after the HTML, write: SKILL_GAPS: [comma-separated required_skills absent from the resume]`;

      const userPrompt =
        `${contextStr}\n\n` +
        `TARGET JOB:\n` +
        `Title: ${job.title} at ${job.company}\n` +
        `Required skills: ${jobSkills}\n` +
        `Nice to have: ${jobNiceToHave}\n` +
        `Key responsibilities: ${jobResponsibilities}\n` +
        `ATS keywords to weave in naturally: ${jobKeywords}\n\n` +
        `ORIGINAL RESUME HTML - rewrite ONLY <li> text, leave everything else byte-for-byte identical:\n` +
        `${resumeHtml}`;

      rawOutput = await withTimeout(generateText(systemPrompt, userPrompt, 4000), 30000, 'tailor-resume');
      console.log('[tailor-resume] after AI call', { mode: 'html', jobId, userId: user.id });
    } else {
      // Fallback: plain-text tailoring when no HTML is available
      console.log('[tailor-resume] before AI call', { mode: 'text', jobId, userId: user.id });
      try {
        const systemPrompt =
          `You are an expert resume writer specializing in students and new graduates. ` +
          `Your output will be submitted directly to ATS systems.\n\n` +
          `Rules:\n` +
          `1. NEVER add experience, skills, or facts not in the original resume\n` +
          `2. Preserve the candidate's authentic voice\n` +
          `3. Reorder bullets, rephrase existing content, and adjust the summary freely\n` +
          `4. Weave in ATS keywords naturally where they genuinely fit\n` +
          `5. Return ONLY the complete resume text - no commentary\n` +
          `6. End with exactly: SKILL_GAPS: [comma-separated missing required_skills]`;

        const userPrompt =
          `Tailor this resume for the job below.\n\n` +
          `${contextStr}\n\n` +
          `TARGET JOB:\n` +
          `Title: ${job.title} at ${job.company}\n` +
          `Required skills: ${jobSkills}\n` +
          `Nice to have: ${jobNiceToHave}\n` +
          `Key responsibilities: ${jobResponsibilities}\n` +
          `ATS keywords: ${jobKeywords}\n\n` +
          `Instructions:\n` +
          `- Reorder bullets so the most relevant experience appears first\n` +
          `- Use WORK EXPERIENCE and PROJECTS sections above to tailor bullets to key_responsibilities\n` +
          `- Rewrite the summary/objective for this specific role and company\n\n` +
          `ORIGINAL RESUME:\n${resume.raw_text}`;

        rawOutput = await withTimeout(generateText(systemPrompt, userPrompt, 4000), 30000, 'tailor-resume');
      } catch (aiError) {
        console.error('[tailor-resume] AI call failed:', aiError);
        const errorMessage = aiError instanceof Error ? aiError.message : String(aiError);
        if (errorMessage.includes('rate_limit_exceeded') || errorMessage.includes('429')) {
          return err('Our AI is temporarily over capacity. Please try again in a little while.', 429);
        }
        return serverError(new Error('Failed to generate tailored resume'));
      }
      console.log('[tailor-resume] after AI call', { mode: 'text', jobId, userId: user.id });
    }
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

  // Generate and store PDF - best-effort, only when content is HTML
  let pdfUrl: string | null = null;
  if (tailoredResumeText.trim().startsWith('<')) {
    try {
      console.log('[tailor-resume] before PDF generation', { jobId, userId: user.id, documentId: savedDoc.id });
      const { generateResumeBuffer } = await import('@/lib/generatePdf');
      const pdfBuffer = await generateResumeBuffer(tailoredResumeText);
      if (pdfBuffer) {
        const pdfPath = `tailored-resumes/${user.id}/${savedDoc.id}.pdf`;
        const { error: uploadError } = await supabase.storage
          .from('pdfs')
          .upload(pdfPath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('pdfs').getPublicUrl(pdfPath);
          pdfUrl = urlData.publicUrl;
          await supabase.from('documents').update({ pdf_url: pdfUrl }).eq('id', savedDoc.id);
        }
      }
      console.log('[tailor-resume] after PDF generation', { jobId, userId: user.id, documentId: savedDoc.id, hasPdf: !!pdfBuffer, pdfUrl });
    } catch {
      // PDF generation is non-critical
    }
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

    console.log('[tailor-resume] before Supabase insert', { jobId, userId: user.id, hasPdf: !!pdfUrl });
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
      },
    })
  ).catch(() => {});

  await logRoute('/api/tailor-resume', user.id, Date.now() - start, 200);
  return ok({ document: savedDoc, skillGaps: parsedGaps, atsScore: immediateScore, pdfUrl });
}
