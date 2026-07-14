// Admin-only campaign sender: emails every opted-in profile via Resend.
// There is no cron - campaigns are written and triggered by hand from the
// /admin dashboard, always after a "send test to me" pass.
import { requireAuth } from '@/lib/requireAuth'
import { validateBody } from '@/lib/validateRequest'
import { ok, err, notFound, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { sendMarketingEmail } from '@/lib/email'
import { createClient as createServiceClient } from '@supabase/supabase-js'

const ROUTE = '/api/admin/send-campaign'

// Batch sends can take a while on Vercel's default 10s budget.
export const maxDuration = 60

interface RecipientRow {
  id: string
  email: string | null
  unsubscribe_token: string
}

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  // Non-admins get a 404, not a 403 - the route's existence is not disclosed.
  if (!process.env.ADMIN_USER_ID || user.id !== process.env.ADMIN_USER_ID) {
    return notFound('Route')
  }

  const body = await request.json().catch(() => null)
  const validation = validateBody<{ subject: string; html: string; testOnly?: boolean }>(
    body,
    ['subject', 'html']
  )
  if (!validation.valid) return err(validation.error, 400)
  const { subject, html, testOnly } = validation.data

  if (!subject.trim() || subject.length > 200) return err('Subject must be 1-200 characters', 400)
  if (!html.trim() || html.length > 100_000) return err('Body must be 1-100000 characters', 400)

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) return serverError(new Error('NEXT_PUBLIC_APP_URL is not set'))

  try {
    const svc = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    let recipients: RecipientRow[]
    if (testOnly) {
      // Test sends go only to the admin's own profile, regardless of opt-in.
      const { data, error } = await svc
        .from('profiles')
        .select('id, email, unsubscribe_token')
        .eq('id', user.id)
        .limit(1)
      if (error) throw new Error(error.message)
      recipients = (data ?? []) as RecipientRow[]
    } else {
      const { data, error } = await svc
        .from('profiles')
        .select('id, email, unsubscribe_token')
        .eq('marketing_emails_enabled', true)
        .not('email', 'is', null)
      if (error) throw new Error(error.message)
      recipients = (data ?? []) as RecipientRow[]
    }

    let sent = 0
    let failed = 0
    const failures: string[] = []

    // Sequential sends: Resend rate-limits at ~2 req/s on the free tier and
    // the audience here is small; parallel bursts would just trigger 429s.
    for (const r of recipients) {
      if (!r.email) continue
      const result = await sendMarketingEmail({
        to: r.email,
        subject,
        html,
        unsubscribeUrl: `${appUrl}/api/unsubscribe?token=${r.unsubscribe_token}`,
      })
      if (result.sent) {
        sent++
      } else {
        failed++
        if (failures.length < 5 && result.error) failures.push(result.error)
      }
    }

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ sent, failed, testOnly: Boolean(testOnly), failures })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
