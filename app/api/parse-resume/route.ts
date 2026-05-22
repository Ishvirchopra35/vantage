// SQL migration required:
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_html text;
// ALTER TABLE profiles ADD COLUMN IF NOT EXISTS resume_pdf_path text;

import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';
import { generateText } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';

type PdfResult = { text: string; numpages: number };

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

  const body = await request.json().catch(() => null);
  const validation = validateBody<{ fileUrl: string; fileName?: string }>(body, ['fileUrl']);
  if (!validation.valid) return err(validation.error, 400);
  const { fileUrl, fileName = '' } = validation.data;

  let arrayBuffer: ArrayBuffer;
  let contentType = '';
  try {
    const response = await withTimeout(fetch(fileUrl), 10000, 'file fetch');
    if (!response.ok) {
      return err('Could not download the uploaded file — please try uploading again', 400);
    }
    contentType = response.headers.get('content-type') ?? '';
    arrayBuffer = await response.arrayBuffer();
  } catch {
    return err('Could not download the uploaded file — please try uploading again', 400);
  }

  const buffer = Buffer.from(arrayBuffer);
  const isDocx =
    /\.docx?$/i.test(fileName) ||
    contentType.includes('officedocument') ||
    contentType.includes('msword');

  let text: string;
  try {
    if (isDocx) {
      const mammoth = require('mammoth') as { extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }> };
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      const pdfParse = require('pdf-parse/lib/pdf-parse.js') as (buffer: Buffer) => Promise<PdfResult>;
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    }
  } catch (e) {
    await logRoute('/api/parse-resume', user.id, Date.now() - start, 500);
    return serverError(e);
  }

  // Generate structured HTML — saved to profiles for surgical tailoring later.
  // Non-critical: text extraction already succeeded even if this fails.
  let resumeHtml: string | null = null;
  try {
    const rawHtml = await withTimeout(
      generateText(
        'You are a resume formatter. Convert plain-text resumes to clean, semantic HTML body content. Return ONLY the HTML body content — no <html>, <head>, or <body> tags.',
        `Convert this resume to clean HTML that exactly preserves the layout and formatting:
- Use <h1> for the candidate's full name (first line of the resume)
- Use <h2> for section headers (Experience, Education, Skills, Projects, etc.)
- Use <p> for contact info and summary paragraphs
- Use <ul><li> for bullet points
- Preserve ALL hyperlinks as <a href="URL">text</a>
- Use <strong> for bold text, <em> for italic
- Single column layout, no tables, no floats, no CSS classes
- Do NOT add, remove, or invent any content — preserve 100% of the original text

Resume text:
${text}`,
        2000
      ),
      20000,
      'resume-to-html'
    );
    resumeHtml = extractBodyContent(rawHtml);
    const supabase = await createClient();
    await supabase
      .from('profiles')
      .update({
        resume_html: resumeHtml,
        ...(!isDocx ? { resume_pdf_path: fileUrl } : {}),
      })
      .eq('id', user.id);
  } catch {
    // Intentionally swallowed — text parse succeeded
  }

  await logRoute('/api/parse-resume', user.id, Date.now() - start, 200);
  return ok({ text, resumeHtml });
}
