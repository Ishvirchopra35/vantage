import { requireAuth } from '@/lib/requireAuth'
import { ok, err, serverError } from '@/lib/apiResponse'
import { logRoute } from '@/lib/logger'
import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'

const ROUTE = '/api/stripe/portal'

export async function POST(request: Request): Promise<Response> {
  const start = Date.now()

  const auth = await requireAuth()
  if ('error' in auth) return auth.error
  const { user } = auth

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(new Error('NEXT_PUBLIC_APP_URL is not set'))
  }

  try {
    const supabase = await createClient()
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .single()

    if (!sub?.stripe_customer_id) {
      await logRoute(ROUTE, user.id, Date.now() - start, 400)
      return err('No active subscription found', 400)
    }

    const stripe = getStripe()
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${appUrl}/dashboard`,
    })

    await logRoute(ROUTE, user.id, Date.now() - start, 200)
    return ok({ url: portalSession.url })
  } catch (e) {
    await logRoute(ROUTE, user.id, Date.now() - start, 500)
    return serverError(e)
  }
}
