import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit } from '@/lib/rateLimit'
import { generateJSON } from '@/lib/ai'
import { buildUserContext } from '@/lib/userContext'
import { withTimeout } from '@/lib/withTimeout'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/find-contacts'

interface Contact {
  name: string
  title: string
  company: string
  linkedin_url: string | null
  relevance_reason: string
}

interface ScoredContact extends Contact {
  job_relevance_score?: number
}

async function fetchViaJina(url: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/markdown' }
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
  const res = await fetch(`https://r.jina.ai/${url}`, { headers })
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status}`)
  return res.text()
}

function isUsableMarkdown(text: string): boolean {
  if (!text || text.length < 300) return false
  const lower = text.toLowerCase()
  // LinkedIn authwall / login wall detected
  if (lower.includes('sign in') && lower.includes('join now')) return false
  if (lower.includes('authwall') || lower.includes('checkpoint/lg/login')) return false
  return true
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json()
  const validation = validateBody<{ company: string; role?: string; jobId?: string }>(body, ['company'])
  if (!validation.valid) return err(validation.error, 400)
  const { company, role, jobId } = validation.data

  // Monthly networking limit (respects free/pro tier)
  const limit = await checkLimit(user.id, 'networking')
  if (!limit.allowed) return rateLimited('contact search', 15, 30)

  // Hard daily cap: 5 searches per user per day regardless of plan
  const supabase = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: todayCount } = await supabase
    .from('route_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('route', ROUTE)
    .gte('created_at', todayStart.toISOString())

  if ((todayCount ?? 0) >= 5) {
    return err('Daily limit of 5 contact searches reached. Try again tomorrow.', 429)
  }

  try {
    const keywords = encodeURIComponent(`${company} ${role ?? 'recruiter hiring'}`)
    const linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${keywords}&origin=GLOBAL_SEARCH_HEADER`

    // Step 1 — LinkedIn public search via Jina.ai
    let markdown = ''
    let source = 'linkedin_public'

    try {
      const text = await withTimeout(fetchViaJina(linkedinUrl), 10000, 'jina-linkedin')
      if (isUsableMarkdown(text)) markdown = text
    } catch {
      // fall through to Google
    }

    // Step 2 (fallback) — Google search if LinkedIn returned an authwall or thin content
    if (!markdown) {
      source = 'google_fallback'
      const googleQuery = encodeURIComponent(`${company} ${role ?? 'recruiter'} site:linkedin.com/in`)
      try {
        const text = await withTimeout(
          fetchViaJina(`https://www.google.com/search?q=${googleQuery}`),
          10000,
          'jina-google'
        )
        if (text && text.length > 100) markdown = text
      } catch {
        // both sources failed
      }
    }

    if (!markdown) {
      await logRoute(ROUTE, user.id, Date.now() - start, 200)
      return ok({ contacts: [], source: 'no_results' })
    }

    // Step 3 — Extract contacts from markdown with AI
    const systemPrompt =
      'Extract professional contact information from search result text. Return only valid JSON.'
    const userPrompt =
      `From this search result, extract people who work at ${company}. ` +
      `For each person, extract: name, title, company, linkedin_url (if visible), relevance_reason ` +
      `(e.g. "Recruiter at ${company}", "Engineering hiring manager"). ` +
      `Return JSON: { "contacts": [{ "name": string, "title": string, "company": string, ` +
      `"linkedin_url": string | null, "relevance_reason": string }] }. ` +
      `Up to 8 contacts. If none found return { "contacts": [] }.\n\nText:\n${markdown.slice(0, 4000)}`

    const parsed = await withTimeout(
      generateJSON<{ contacts: Contact[] }>(systemPrompt, userPrompt),
      30000,
      'find-contacts-parse'
    )

    let contacts: ScoredContact[] = (parsed.contacts ?? []).slice(0, 8)

    // Step 4 — Score relevance to specific job if jobId provided
    if (jobId && contacts.length > 0) {
      const ctx = await buildUserContext(user.id)
      const targetRoles = (ctx.targetRoles ?? []).join(', ') || 'software engineering'

      try {
        const scored = await withTimeout(
          generateJSON<{ contacts: ScoredContact[] }>(
            'Score contact relevance for a job application. Return only valid JSON.',
            `Candidate is applying to ${company}. Target roles: ${targetRoles}. ` +
            `Rate each contact's networking value (0-100 as job_relevance_score) and return the same ` +
            `contacts array with that field added.\n\nContacts: ${JSON.stringify(contacts)}`
          ),
          20000,
          'find-contacts-score'
        )
        contacts = scored.contacts ?? contacts
      } catch {
        // scoring is best-effort — return unscored contacts rather than failing
      }
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ contacts, source })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
