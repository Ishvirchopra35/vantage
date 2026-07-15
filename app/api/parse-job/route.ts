// Parses a job posting (URL via Jina, or raw text) into structured fields
// (skills, responsibilities, keywords) and stores it in jobs.
import { requireAuth } from '@/lib/requireAuth';
import { validateBody } from '@/lib/validateRequest';
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse';
import { logRoute } from '@/lib/logger';
import { checkLimit, consumeLimit, LIMITS, checkRateLimit, rateLimitResponse, recordRateLimitUse, checkSharedQuota, incrementSharedQuota } from '@/lib/rateLimit';
import { withTimeout } from '@/lib/withTimeout';
import { generateText } from '@/lib/ai';
import { createClient } from '@/lib/supabase/server';
import { hasRealJobTitle } from '@/lib/jobFilters';

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

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function buildUserPrompt(content: string): string {
  return `Parse this job description and return a JSON object with EXACTLY these fields:
- title: string (job title)
- company: string (company name)
- location: string (city, state/province, remote, or hybrid)
- employment_type: string (one of: Full-time, Part-time, Contract, Internship, Co-op)
- required_skills: string[] (hard skills explicitly listed as required - programming languages, tools, frameworks, max 15 items)
- nice_to_have_skills: string[] (explicitly listed as nice-to-have or preferred, max 10)
- years_experience_required: number or null (minimum years required, or null if not specified)
- key_responsibilities: string[] (main job duties, max 8 items, each under 20 words)
- company_description: string (2-3 sentences about the company from the posting)
- keywords: string[] (ALL significant words and phrases from the posting that an ATS would scan for - include technical terms, soft skills, methodologies, tools, certifications. This is the most important field. Aim for 20-40 keywords.)

Job posting content: ${content}`;
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();

  try {
    const auth = await requireAuth();
    if ('error' in auth) return auth.error;
    const { user } = auth;

    // Validate input before touching any limits - a bad request costs nothing.
    const body = await request.json().catch(() => null);
    const validation = validateBody<{ url?: string; rawText?: string }>(body, []);
    if (!validation.valid) {
      return err(validation.error, 400);
    }

    const url = typeof validation.data.url === 'string' && validation.data.url.trim()
      ? validation.data.url.trim()
      : '';
    const pastedText = typeof validation.data.rawText === 'string' && validation.data.rawText.trim()
      ? validation.data.rawText.trim()
      : '';

    if (!url && !pastedText) {
      return err('Either url or rawText is required', 400);
    }

    const limitCheck = await checkLimit(user.id, 'tailoring');
    if (!limitCheck.allowed) {
      await logRoute('/api/parse-job', user.id, Date.now() - start, 429);
      return rateLimited('job parsing', LIMITS.tailoring, 30);
    }

    const rateLimit = await checkRateLimit({
      key: 'parse-job',
      userId: user.id,
      devLimit: 5,
      freeLimit: 20,
      proLimit: 10,
      devWindowMinutes: 1440,
      freeWindowMinutes: 43200,
      proWindowMinutes: 1440,
    });
    if (!rateLimit.allowed) {
      await logRoute('/api/parse-job', user.id, Date.now() - start, 429);
      return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier);
    }

    const parsedAsUrl = url ? isHttpUrl(url) : false;
    const inputKind: 'rawText' | 'url' = pastedText || !parsedAsUrl ? 'rawText' : 'url';

    // Treat non-URL `url` field values as raw pasted descriptions.
    const directText = pastedText || (url && !parsedAsUrl ? url : '');

    let rawText: string;
    if (inputKind === 'rawText') {
      rawText = directText;
    } else {
      // Platform-wide Jina token budget - only consumed when we actually scrape
      // a URL (pasted text never hits Jina). Guard before spending a request.
      const jinaQuota = await checkSharedQuota('jina_lifetime', 150, 36500);
      if (!jinaQuota.allowed) {
        await logRoute('/api/parse-job', user.id, Date.now() - start, 429);
        return Response.json(
          { error: 'URL scraping limit reached. Please paste the job description as text instead.' },
          { status: 429 }
        );
      }
      try {
        const jinaHeaders: Record<string, string> = {
          'Accept': 'text/markdown',
          'X-Return-Format': 'markdown',
        };
        if (process.env.JINA_API_KEY) {
          jinaHeaders['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`;
        }

        const response = await withTimeout(
          fetch('https://r.jina.ai/' + encodeURIComponent(url), { headers: jinaHeaders }),
          10000,
          'Jina fetch'
        );
        const responsePreview = (await response.clone().text()).slice(0, 200);
        console.log('[parse-job] Jina fetch response:', { status: response.status, preview: responsePreview });
        if (!response.ok) {
          console.error(`Jina.ai response status: ${response.status}`);
          if (response.status === 402) {
            return err('Jina.ai token balance is empty - top up at jina.ai', 400);
          }
          if (response.status === 429) {
            return err('Jina.ai rate limit hit - try again in a moment', 429);
          }
          return err('Could not fetch that job posting. Try pasting the job description directly.', 400);
        }
        rawText = await response.text();

        // Guard against scraper-block pages or empty extracts that produce downstream parse failures.
        if (!rawText.trim() || rawText.trim().length < 80) {
          return err('Could not fetch usable job posting content. Try pasting the full job description directly.', 400);
        }

        // Successful scrape - charge one against the shared Jina budget.
        void incrementSharedQuota('jina_lifetime').catch(() => {});
      } catch {
        return err('Could not fetch that job posting. Try pasting the job description directly.', 400);
      }
    }

    let parsed: ParsedJob;
    try {
      const rawAiOutput = await withTimeout(
        generateText(SYSTEM_PROMPT, buildUserPrompt(rawText), 2000),
        30000,
        'parse-job'
      );
      let candidate = rawAiOutput.trim();

      candidate = candidate
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '');

      const first = candidate.search(/[\{\[]/);

      if (first > 0) {
        candidate = candidate.slice(first);
      }

      parsed = JSON.parse(candidate) as ParsedJob;
    } catch (parseError) {
      console.error('[parse-job] AI error:', parseError);
      if (inputKind === 'rawText') {
        return err('Could not extract structured data from the pasted text. Please paste the full job description.', 422);
      }
      return err('Could not extract structured data from this job posting. The page may require login or have unusual formatting.', 422);
    }

    // The AI can "succeed" with an empty shell (title "." and nothing else,
    // usually from a login wall or scraper-block page). Reject junk parses
    // before saving so the user gets a clear error and is not charged.
    const hasSubstance =
      (parsed.required_skills?.length ?? 0) > 0 ||
      (parsed.key_responsibilities?.length ?? 0) > 0 ||
      (parsed.keywords?.length ?? 0) > 0;
    if (!hasRealJobTitle(parsed.title) || !hasSubstance) {
      if (inputKind === 'rawText') {
        return err('That text does not look like a full job posting - no job title or requirements were found. Please paste the complete job description.', 422);
      }
      return err('Could not read a real job posting from that page - it may require login or block scrapers. Try pasting the job description as text instead.', 422);
    }

    const supabase = await createClient();

    const { data: job, error: dbError } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        url: url || null,
        raw_text: rawText,
        title: parsed.title,
        company: parsed.company,
        location: parsed.location,
        employment_type: parsed.employment_type,
        required_skills: parsed.required_skills ?? [],
        nice_to_have_skills: parsed.nice_to_have_skills ?? [],
        years_experience_required: parsed.years_experience_required,
        key_responsibilities: parsed.key_responsibilities ?? [],
        company_description: parsed.company_description,
        keywords: parsed.keywords ?? [],
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

    // Charge the limits only now that the job was parsed and saved.
    await Promise.all([
      consumeLimit(user.id, 'tailoring'),
      recordRateLimitUse('parse-job', user.id),
      logRoute('/api/parse-job', user.id, Date.now() - start, 200),
    ]);
    return ok({ job });
  } catch (parseError) {
    console.error('[parse-job] unhandled error:', parseError);
    return serverError(parseError);
  }
}
