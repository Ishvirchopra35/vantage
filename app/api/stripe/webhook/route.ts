import Stripe from 'stripe'
import { createClient as createServerClient } from '@supabase/ssr'

export const runtime = 'nodejs'

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service role env vars not set')
  return createServerClient(url, key, { cookies: { getAll: () => [], setAll: () => {} } })
}

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY

  console.log('[stripe/webhook] received — sig present:', !!sig, 'secret present:', !!secret)

  if (!sig || !secret || !stripeKey) {
    console.error('[stripe/webhook] Missing sig, secret, or stripe key')
    return new Response('Missing configuration', { status: 400 })
  }

  let event: Stripe.Event
  try {
    const stripe = new Stripe(stripeKey)
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    console.log('[stripe/webhook] event type:', event.type)
  } catch (e) {
    console.error('[stripe/webhook] Signature verification failed:', e)
    return new Response(`Webhook signature verification failed: ${String(e)}`, { status: 400 })
  }

  const supabase = getServiceRoleClient()

  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.supabase_user_id
    console.log('[stripe/webhook] subscription event — userId:', userId, 'status:', sub.status)

    if (!userId) {
      console.error('[stripe/webhook] Missing supabase_user_id in subscription metadata')
      return new Response('ok', { status: 200 })
    }

    const periodEnd = sub.items.data[0]?.current_period_end
    const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

    const { error } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: sub.status === 'active' ? 'pro' : 'free',
        status: sub.status,
        stripe_subscription_id: sub.id,
        stripe_customer_id: String(sub.customer),
        current_period_end: currentPeriodEnd,
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('[stripe/webhook] DB upsert failed:', error)
    } else {
      console.log('[stripe/webhook] DB updated — plan:', sub.status === 'active' ? 'pro' : 'free')
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.supabase_user_id
    console.log('[stripe/webhook] subscription deleted — userId:', userId)

    if (!userId) {
      console.error('[stripe/webhook] Missing supabase_user_id in deleted subscription metadata')
      return new Response('ok', { status: 200 })
    }

    const { error } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: 'free',
        status: 'cancelled',
        stripe_subscription_id: sub.id,
        stripe_customer_id: String(sub.customer),
        cancelled_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    )

    if (error) {
      console.error('[stripe/webhook] DB upsert (delete) failed:', error)
    } else {
      console.log('[stripe/webhook] DB updated — plan: free (cancelled)')
    }
  }

  return new Response('ok', { status: 200 })
}
