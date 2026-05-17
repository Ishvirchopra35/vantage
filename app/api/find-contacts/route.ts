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
  ai_generated?: boolean
}

interface ScoredContact extends Contact {
  job_relevance_score?: number
}

async function fetchViaJina(url: string): Promise<string> {
  const headers: Record<string, string> = { Accept: 'text/markdown' }
  if (process.env.JINA_API_KEY) headers['Authorization'] = `Bearer ${process.env.JINA_API_KEY}`
  // Encode the full target URL so Jina's router handles query strings correctly
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
  const res = await fetch(jinaUrl, { headers })
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status} for ${jinaUrl}`)
  return res.text()
}


async function generateFallbackContacts(company: string, role: string): Promise<Contact[]> {
  const parsed = await withTimeout(
    generateJSON<{ contacts: Contact[] }>(
      'You generate realistic professional contact suggestions for networking purposes. Return only valid JSON.',
      `Generate 3 realistic professional contacts who might work at ${company} in ${role || 'recruiting or hiring'} roles. ` +
      `Return JSON: { "contacts": [{ "name": string (realistic full name), "title": string (realistic job title), ` +
      `"company": "${company}", "linkedin_url": null, "relevance_reason": string (why they are relevant to reach out to), ` +
      `"ai_generated": true }] }. ` +
      `Use common names and accurate-sounding titles for the industry. Do not invent LinkedIn URLs.`
    ),
    20000,
    'find-contacts-fallback'
  )
  return (parsed.contacts ?? []).map(c => ({ ...c, ai_generated: true }))
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

  const limit = await checkLimit(user.id, 'networking')
  if (!limit.allowed) return rateLimited('contact search', 15, 30)

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
    const roleKeyword = role || 'recruiter hiring manager'

    let markdown = ''
    let source = 'google_search'

    // Step 1 — Google search via Jina.ai (LinkedIn blocks Jina consistently)
    const googleQuery = `${company} ${roleKeyword} site:linkedin.com/in`
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`
    try {
      const text = await withTimeout(fetchViaJina(googleUrl), 12000, 'jina-google')
      console.error('[find-contacts] Google Jina response length:', text?.length, '| first 500 chars:', text?.slice(0, 500))
      if (text && text.length > 200) {
        markdown = text
      } else {
        console.error('[find-contacts] Google Jina response too short:', text?.length)
      }
    } catch (e) {
      console.error('[find-contacts] Google Jina fetch error:', e)
    }

    let contacts: ScoredContact[] = []

    if (markdown) {
      // Step 2 — Extract contacts from scraped markdown
      try {
        const parsed = await withTimeout(
          generateJSON<{ contacts: Contact[] }>(
            'Extract professional contact information from search result text. Return only valid JSON.',
            `From this search result, extract people who work at ${company}. ` +
            `For each person, extract: name, title, company, linkedin_url (if visible as a full URL), relevance_reason ` +
            `(e.g. "Recruiter at ${company}", "Engineering hiring manager"). ` +
            `Return JSON: { "contacts": [{ "name": string, "title": string, "company": string, ` +
            `"linkedin_url": string | null, "relevance_reason": string }] }. ` +
            `Up to 8 contacts. If none clearly found return { "contacts": [] }.\n\nText:\n${markdown.slice(0, 4000)}`
          ),
          30000,
          'find-contacts-parse'
        )
        contacts = (parsed.contacts ?? []).slice(0, 8)
        console.error('[find-contacts] AI extracted', contacts.length, 'contacts from', source)
      } catch (e) {
        console.error('[find-contacts] AI extraction error:', e)
      }
    }

    // Step 3 — AI fallback if Google also yielded nothing
    if (contacts.length === 0) {
      source = 'ai_generated'
      console.error('[find-contacts] No real contacts found — generating AI fallback for:', company, role)
      try {
        contacts = await generateFallbackContacts(company, role ?? '')
        console.error('[find-contacts] AI fallback generated', contacts.length, 'contacts')
      } catch (e) {
        console.error('[find-contacts] AI fallback error:', e)
      }
    }

    // Step 4 — Score relevance to specific job if jobId provided (best-effort)
    if (jobId && contacts.length > 0 && source !== 'ai_generated') {
      try {
        const ctx = await buildUserContext(user.id)
        const targetRoles = (ctx.targetRoles ?? []).join(', ') || 'software engineering'
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
        // scoring is best-effort
      }
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ contacts, source })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
