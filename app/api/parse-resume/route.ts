// SQL migration required:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_html text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_pdf_path text;

import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';
import { generateText } from '@/lib/ai';
import { checkRateLimit, rateLimitResponse } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';
import { extractResumeText, isDocxFile } from '@/lib/extractResumeText';

type ProfileLinks = {
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  projects: { name: string; url: string | null }[] | null;
};

// Strip <html>/<head>/<body> wrappers if the AI included them despite the prompt
function extractBodyContent(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  if (bodyMatch) return bodyMatch[1].trim()
  const htmlMatch = html.match(/<html[^>]*>([\s\S]*)<\/html>/i)
  if (htmlMatch) return htmlMatch[1].replace(/<head[^>]*>[\s\S]*<\/head>/i, '').trim()
  return html.trim()
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const rateLimit = await checkRateLimit({
    key: 'parse-resume',
    userId: user.id,
    devLimit: 1,
    freeLimit: 3,
    proLimit: 1,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  });
  if (!rateLimit.allowed) {
    await logRoute('/api/parse-resume', user.id, Date.now() - start, 429);
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
  }

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ fileUrl: string; fileName?: string }>(body, ['fileUrl']);
  if (!validation.valid) return err(validation.error, 400);
  const { fileUrl, fileName = '' } = validation.data;

  let arrayBuffer: ArrayBuffer;
  let contentType = '';
  try {
    const response = await withTimeout(fetch(fileUrl), 10000, 'file fetch');
    if (!response.ok) {
      return err('Could not download the uploaded file - please try uploading again', 400);
    }
    contentType = response.headers.get('content-type') ?? '';
    arrayBuffer = await response.arrayBuffer();
  } catch {
    return err('Could not download the uploaded file - please try uploading again', 400);
  }

  const buffer = Buffer.from(arrayBuffer);
  const isDocx = isDocxFile(fileName, contentType);

  let text: string;
  try {
    text = await extractResumeText(buffer, isDocx);
  } catch (e) {
    await logRoute('/api/parse-resume', user.id, Date.now() - start, 500);
    return serverError(e);
  }

  // Generate structured HTML - saved to profiles for surgical tailoring later.
  // Non-critical: text extraction already succeeded even if this fails.
  let resumeHtml: string | null = null;
  try {
    const supabase = await createClient();

    const { data: profileData } = await supabase
      .from('profiles')
      .select('linkedin_url, github_url, portfolio_url, projects')
      .eq('id', user.id)
      .single();

    const profile = profileData as ProfileLinks | null;
    const profileLinkedin = profile?.linkedin_url ?? null;
    const profileGithub = profile?.github_url ?? null;
    const profilePortfolio = profile?.portfolio_url ?? null;

    // Build project links block - only include projects that have a URL
    const projectsWithUrls = (profile?.projects ?? []).filter(p => p.url);
    const projectLinksBlock = projectsWithUrls.length > 0
      ? `PROJECT LINKS (use these exact URLs, do not guess or hallucinate):\n` +
        projectsWithUrls.map(p => `- ${p.name}: ${p.url}`).join('\n')
      : '';

    // Build contact link instructions using exact profile values
    const contactLinkLines = [
      profileLinkedin && `- "LinkedIn" in the contact line → <a href="${profileLinkedin}">LinkedIn</a>`,
      profileGithub && `- "GitHub" in the contact line → <a href="${profileGithub}">GitHub</a>`,
      profilePortfolio && `- "Portfolio" or "Website" in the contact line → <a href="${profilePortfolio}">Portfolio</a>`,
      `- Any email address → <a href="mailto:EMAIL">EMAIL</a>`,
      `- Any raw URL found in the text → <a href="URL">display text</a>`,
    ].filter(Boolean).join('\n');

    const rawHtml = await withTimeout(
      generateText(
        'You are a resume formatter. Convert plain-text resumes to clean, semantic HTML body content. Return ONLY the HTML body content - no <html>, <head>, or <body> tags.',
        `Convert this resume to clean HTML that exactly preserves the layout and formatting.

RULES:
- Use <h1> for the candidate's full name (first line)
- Use <h2> for section headers (Experience, Education, Skills, Projects, etc.)
- Use <p> for contact info and summary paragraphs
- Use <ul><li> for bullet points
- Use <strong> for bold text, <em> for italic
- Single column layout, no tables, no floats, no CSS classes
- Do NOT add, remove, or invent any content - preserve 100% of the original text

CONTACT LINE LINKS - reconstruct these exact hyperlinks:
${contactLinkLines}

${projectLinksBlock ? `${projectLinksBlock}

PROJECT LINK RULES:
- For project entries, use ONLY the URLs listed in PROJECT LINKS above - match by project name
- If a project is not listed in PROJECT LINKS, render the project name as plain text with NO link
- Do not fabricate any URLs under any circumstances` : `Do not fabricate any project URLs. Only link to URLs that appear verbatim in the resume text.`}

Resume text:
${text}`,
        2000
      ),
      20000,
      'resume-to-html'
    );
    resumeHtml = extractBodyContent(rawHtml);

    // If the AI dropped all hyperlinks, retry with an explicit link-injection prompt
    const linkCount = (resumeHtml.match(/<a\s/gi) ?? []).length;
    if (linkCount === 0 && (profileLinkedin || profileGithub)) {
      const mustHaveLinks = [
        profileLinkedin && `<a href="${profileLinkedin}">LinkedIn</a>`,
        profileGithub && `<a href="${profileGithub}">GitHub</a>`,
        profilePortfolio && `<a href="${profilePortfolio}">Portfolio</a>`,
      ].filter(Boolean).join(', ');

      const retryHtml = await withTimeout(
        generateText(
          'You are a resume formatter. Convert plain-text resumes to clean, semantic HTML body content. Return ONLY the HTML body content - no <html>, <head>, or <body> tags.',
          `Convert this resume to HTML using the same rules as before.

CRITICAL - the contact <p> tag MUST contain these exact links: ${mustHaveLinks}
Do NOT omit them under any circumstances.

${projectLinksBlock ? `${projectLinksBlock}\nDo not fabricate project URLs - only use URLs from PROJECT LINKS above.` : 'Do not fabricate any project URLs.'}

Rules:
- Use <h1> for the candidate's full name
- Use <h2> for section headers
- Use <p> for contact info and summary paragraphs
- Use <ul><li> for bullet points
- Single column, no tables, no CSS classes
- Preserve 100% of the original text

Resume text:
${text}`,
          2000
        ),
        20000,
        'resume-to-html-retry'
      );
      resumeHtml = extractBodyContent(retryHtml);
    }

    await supabase
      .from('profiles')
      .update({
        resume_html: resumeHtml,
        ...(!isDocx ? { resume_pdf_path: fileUrl } : {}),
      })
      .eq('id', user.id);
  } catch (e) {
    console.error('[parse-resume] html generation failed:', e)
  }

  await logRoute('/api/parse-resume', user.id, Date.now() - start, 200);
  return ok({ text, resumeHtml });
}
