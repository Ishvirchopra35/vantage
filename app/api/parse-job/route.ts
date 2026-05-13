import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { withTimeout } from '@/lib/withTimeout';
import { generateJSON } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';

interface ParsedJob {
  title: string;
  company: string;
  location: string;
  employment_type: string;
  required_skills: string[];
  nice_to_have_skills: string[];
  years_experience_required: number | null;
  key_responsibilities: string[];
  company_description: string;
  keywords: string[];
}

const SYSTEM_PROMPT =
  'You are a precise job description parser. Extract structured information from job postings. Return ONLY valid JSON with no other text, no markdown formatting, no explanation.';

function buildUserPrompt(content: string): string {
  return `Parse this job description and return a JSON object with EXACTLY these fields:
- title: string (job title)
- company: string (company name)
- location: string (city, state/province, remote, or hybrid)
- employment_type: string (one of: Full-time, Part-time, Contract, Internship, Co-op)
- required_skills: string[] (hard skills explicitly listed as required — programming languages, tools, frameworks, max 15 items)
- nice_to_have_skills: string[] (explicitly listed as nice-to-have or preferred, max 10)
- years_experience_required: number or null (minimum years required, or null if not specified)
- key_responsibilities: string[] (main job duties, max 8 items, each under 20 words)
- company_description: string (2-3 sentences about the company from the posting)
- keywords: string[] (ALL significant words and phrases from the posting that an ATS would scan for — include technical terms, soft skills, methodologies, tools, certifications. This is the most important field. Aim for 20-40 keywords.)

Job posting content: ${content}`;
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const validation = validateBody<{ url: string }>(body, ['url']);
  if (!validation.valid) return err(validation.error, 400);
  const { url } = validation.data;

  let rawText: string;
  try {
    const response = await withTimeout(
      fetch('https://r.jina.ai/' + encodeURIComponent(url), { headers: { Accept: 'text/markdown' } }),
      10000,
      'Jina fetch'
    );
    if (!response.ok) {
      return err('Could not fetch that job posting. Try pasting the job description directly.', 400);
    }
    rawText = await response.text();
  } catch {
    return err('Could not fetch that job posting. Try pasting the job description directly.', 400);
  }

  let parsed: ParsedJob;
  try {
    parsed = await withTimeout(
      generateJSON<ParsedJob>(SYSTEM_PROMPT, buildUserPrompt(rawText)),
      30000,
      'parse-job'
    );
  } catch {
    return err('Could not extract structured data from this job posting. The page may require login or have unusual formatting.', 422);
  }

  const supabase = await createClient();

  const { data: job, error: dbError } = await supabase
    .from('jobs')
    .insert({
      user_id: user.id,
      url,
      raw_text: rawText,
      title: parsed.title,
      company: parsed.company,
      location: parsed.location,
      employment_type: parsed.employment_type,
      required_skills: parsed.required_skills,
      nice_to_have_skills: parsed.nice_to_have_skills,
      years_experience_required: parsed.years_experience_required,
      key_responsibilities: parsed.key_responsibilities,
      company_description: parsed.company_description,
      keywords: parsed.keywords,
    })
    .select('id, user_id, url, title, company, location, employment_type, required_skills, nice_to_have_skills, years_experience_required, key_responsibilities, company_description, keywords')
    .single();

  if (dbError) {
    await logRoute('/api/parse-job', user.id, Date.now() - start, 500);
    return serverError(new Error(dbError.message));
  }

  void Promise.resolve(supabase.from('events').insert({
    user_id: user.id,
    event_name: 'parsed_job',
    properties: { title: parsed.title, company: parsed.company },
  })).catch(() => {});

  await logRoute('/api/parse-job', user.id, Date.now() - start, 200);
  return ok({ job });
}
