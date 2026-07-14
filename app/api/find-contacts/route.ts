// Networking contact search via SerpApi (LinkedIn results), gated by a
// platform-wide shared quota plus a per-user rate limit.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit, checkRateLimit, rateLimitResponse, checkSharedQuota, incrementSharedQuota } from '@/lib/rateLimit'

const ROUTE = '/api/find-contacts'

interface SerpApiItem {
  title: string
  link: string
  snippet?: string
}

interface SerpApiResponse {
  organic_results?: SerpApiItem[]
  error?: string
}

interface Contact {
  name: string
  title: string
  company: string
  linkedin: string
  snippet: string
  source: 'serpapi'
}

async function searchContacts(company: string, role: string): Promise<Contact[]> {
  // With a target role the search is restricted to that role only; the
  // recruiter/hiring-manager terms are the default when no role is given.
  const query = role
    ? `site:linkedin.com/in "${company}" "${role}"`
    : `site:linkedin.com/in "${company}" "recruiter" OR "hiring manager" OR "talent acquisition"`

  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('api_key', process.env.SERPAPI_KEY!)
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('num', '5')
  url.searchParams.set('hl', 'en')

  const res = await fetch(url.toString())
  const data = await res.json() as SerpApiResponse

  console.log('[find-contacts] SerpApi status:', res.status)

  if (!res.ok || data.error) {
    console.error('[find-contacts] SerpApi error:', data.error)
    return []
  }

  // Charge the shared SerpApi budget only after a genuinely successful call.
  void incrementSharedQuota('serpapi_monthly').catch(() => {})

  const contacts = (data.organic_results ?? [])
    .map((item: SerpApiItem) => {
      const cleaned = item.title.replace(' | LinkedIn', '').replace(' - LinkedIn', '')
      const parts = cleaned.split(' - ')
      const name = parts[0]?.trim() ?? ''
      const title = parts[1]?.trim() ?? ''
      return {
        name,
        title,
        company: parts[2]?.trim() || company,
        linkedin: item.link,
        snippet: item.snippet ?? '',
        source: 'serpapi' as const,
      }
    })
    .filter((c: Contact) => c.name.length > 0)

  if (!role) return contacts

  // Hard role filter: Google matches the quoted role anywhere on the page,
  // so drop results whose visible title/snippet doesn't mention it.
  const roleWords = role.toLowerCase().split(/\s+/).filter(Boolean)
  return contacts.filter((c: Contact) => {
    const haystack = `${c.title} ${c.snippet}`.toLowerCase()
    return roleWords.every((w) => haystack.includes(w))
  })
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const body = await request.json()
  const validation = validateBody<{ company: string; role?: string }>(body, ['company'])
  if (!validation.valid) return err(validation.error, 400)
  const { company, role } = validation.data

  const limit = await checkLimit(user.id, 'networking')
  if (!limit.allowed) return rateLimited('contact search', 15, 30)

  const rateLimit = await checkRateLimit({
    key: 'find-contacts',
    userId: user.id,
    devLimit: 1,
    freeLimit: 3,
    proLimit: 1,
    devWindowMinutes: 1440,
    freeWindowMinutes: 43200,
    proWindowMinutes: 1440,
  })
  if (!rateLimit.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return rateLimitResponse(rateLimit.resetAt, rateLimit.remaining, rateLimit.tier)
  }

  // Platform-wide SerpApi budget (checked after the per-user limit). The
  // increment happens inside searchContacts only on a successful response.
  const serpQuota = await checkSharedQuota('serpapi_monthly', 250, 30)
  if (!serpQuota.allowed) {
    await logRoute(ROUTE, user.id, Date.now() - start, 429)
    return Response.json({
      contacts: [],
      message: `Contact search is temporarily unavailable — monthly limit reached. Resets in ${serpQuota.daysUntilReset} day${serpQuota.daysUntilReset !== 1 ? 's' : ''}.`,
    }, { status: 429 })
  }

  try {
    const contacts = await searchContacts(company, role ?? '')

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({
      contacts,
      message: contacts.length === 0
        ? role
          ? `No contacts matching "${role}" at ${company}. Try removing the target role or searching a different role.`
          : 'No contacts found. Try a different company name.'
        : null,
    })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
