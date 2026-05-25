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
  // Encode the full target URL so Jina's router handles query strings correctly
  const jinaUrl = `https://r.jina.ai/${encodeURIComponent(url)}`
  const res = await fetch(jinaUrl, { headers })
  if (!res.ok) throw new Error(`Jina fetch failed: ${res.status} for ${jinaUrl}`)
  return res.text()
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
    const query = `${company} ${roleKeyword}`

    let markdown = ''
    let source = 'linkedin'

    // Step 1 — LinkedIn people search via Jina
    const linkedinUrl = `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`
    try {
      const text = await withTimeout(fetchViaJina(linkedinUrl), 12000, 'jina-linkedin')
      const isBlocked = !text || text.length < 200
        || text.toLowerCase().includes('authwall')
        || text.toLowerCase().includes('sign in to')
        || text.toLowerCase().includes('join now')
      if (!isBlocked) {
        markdown = text
      } else {
        console.error('[find-contacts] LinkedIn blocked, length:', text?.length)
      }
    } catch (e) {
      console.error('[find-contacts] LinkedIn Jina error:', e)
    }

    // Step 2 — Fall back to Google search via Jina if LinkedIn was blocked
    if (!markdown) {
      source = 'google_search'
      const googleQuery = `${company} ${roleKeyword} site:linkedin.com/in OR contact email`
      const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(googleQuery)}`
      try {
        const text = await withTimeout(fetchViaJina(googleUrl), 12000, 'jina-google')
        console.error('[find-contacts] Google Jina length:', text?.length, '| preview:', text?.slice(0, 300))
        if (text && text.length > 200) {
          markdown = text
        } else {
          console.error('[find-contacts] Google Jina too short:', text?.length)
        }
      } catch (e) {
        console.error('[find-contacts] Google Jina error:', e)
      }
    }

    let contacts: ScoredContact[] = []

    // Step 3 — Extract real contacts from whatever markdown was found
    if (markdown) {
      try {
        const parsed = await withTimeout(
          generateJSON<{ contacts: Contact[] }>(
            'Extract professional contact information from search result text. Return only valid JSON. Only include people who are clearly real individuals with names and titles found in the text — do not invent or guess any contact details.',
            `From this search result, extract people who work at ${company}. ` +
            `For each person, extract ONLY details explicitly present in the text: name, title, company, ` +
            `linkedin_url (full URL only if visible in the text — do not construct or guess URLs), ` +
            `relevance_reason (e.g. "Recruiter at ${company}", "Engineering hiring manager"). ` +
            `Return JSON: { "contacts": [{ "name": string, "title": string, "company": string, ` +
            `"linkedin_url": string | null, "relevance_reason": string }] }. ` +
            `Up to 8 contacts. If no real people are clearly identifiable, return { "contacts": [] }.\n\nText:\n${markdown.slice(0, 4000)}`
          ),
          30000,
          'find-contacts-parse'
        )
        contacts = (parsed.contacts ?? []).slice(0, 8)
        console.error('[find-contacts] extracted', contacts.length, 'contacts from', source)
      } catch (e) {
        console.error('[find-contacts] extraction error:', e)
      }
    }

    // No AI fallback — if nothing found, return empty and let the UI say so

    // Step 4 — Score relevance to specific job if jobId provided (best-effort)
    if (jobId && contacts.length > 0) {
      try {
        const ctx = await buildUserContext(user.id)
        const targetRoles = (ctx.targetRoles ?? []).join(', ') || 'the applied role'
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
