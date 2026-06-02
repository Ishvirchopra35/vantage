import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, serverError, rateLimited } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { checkLimit } from '@/lib/rateLimit'
import { createClient } from '@/lib/supabase/server'

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
  const roleQuery = role ? `"${role}" OR ` : ''
  const query = `site:linkedin.com/in "${company}" ${roleQuery}"recruiter" OR "hiring manager" OR "talent acquisition"`

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

  return (data.organic_results ?? [])
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

  const supabase = await createClient()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const { count: todayCount } = await supabase
    .from('route_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('route', ROUTE)
    .gte('created_at', todayStart.toISOString())

  if ((todayCount ?? 0) >= 3) {
    const tomorrow = new Date(todayStart)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const hoursLeft = Math.ceil((tomorrow.getTime() - Date.now()) / 1000 / 60 / 60)
    return err(`Daily contact search limit reached. Try again in ${hoursLeft} hours.`, 429)
  }

  try {
    const contacts = await searchContacts(company, role ?? '')

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({
      contacts,
      message: contacts.length === 0
        ? 'No contacts found. Try a different company name or role.'
        : null,
    })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
