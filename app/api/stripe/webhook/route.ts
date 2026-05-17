import Stripe from 'stripe'
import { createServerClient } from '@supabase/ssr'

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

  console.log('[stripe/webhook] received — sig:', !!sig, 'secret:', !!secret, 'key:', !!stripeKey)

  if (!sig || !secret || !stripeKey) {
    console.error('[stripe/webhook] Missing config')
    return new Response('Missing configuration', { status: 400 })
  }

  const stripe = new Stripe(stripeKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (e) {
    console.error('[stripe/webhook] Signature verification failed:', e)
    return new Response(`Signature verification failed: ${String(e)}`, { status: 400 })
  }

  console.log('[stripe/webhook] event:', event.type, JSON.stringify(event.data.object, null, 2))

  const supabase = getServiceRoleClient()

  // ── checkout.session.completed ────────────────────────────────────────────
  // Primary event: metadata.supabase_user_id is on the session directly
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.supabase_user_id
    const subscriptionId = session.subscription as string | null

    console.log('[stripe/webhook] checkout.session.completed — userId:', userId, 'subId:', subscriptionId)

    if (!userId || !subscriptionId) {
      console.error('[stripe/webhook] Missing userId or subscriptionId on session')
      return new Response('ok', { status: 200 })
    }

    let sub: Stripe.Subscription
    try {
      sub = await stripe.subscriptions.retrieve(subscriptionId)
    } catch (e) {
      console.error('[stripe/webhook] Failed to retrieve subscription:', e)
      return new Response('ok', { status: 200 })
    }

    const periodEnd = sub.items.data[0]?.current_period_end
    const { error } = await supabase.from('subscriptions').upsert(
      {
        user_id: userId,
        plan: 'pro',
        status: sub.status,
        stripe_subscription_id: sub.id,
        stripe_customer_id: String(sub.customer),
        current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      },
      { onConflict: 'user_id' }
    )

    if (error) console.error('[stripe/webhook] upsert failed (checkout.session.completed):', error)
    else console.log('[stripe/webhook] plan set to pro for user:', userId)
  }

  // ── customer.subscription.created / updated ───────────────────────────────
  // Subscription metadata has supabase_user_id if set via subscription_data.metadata.
  // If missing, fall back to matching by stripe_customer_id from a prior checkout.session.completed.
  if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.supabase_user_id
    const periodEnd = sub.items.data[0]?.current_period_end
    const plan = sub.status === 'active' ? 'pro' : 'free'

    console.log('[stripe/webhook] subscription event — userId:', userId, 'customer:', sub.customer, 'status:', sub.status)

    if (userId) {
      const { error } = await supabase.from('subscriptions').upsert(
        {
          user_id: userId,
          plan,
          status: sub.status,
          stripe_subscription_id: sub.id,
          stripe_customer_id: String(sub.customer),
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        },
        { onConflict: 'user_id' }
      )
      if (error) console.error('[stripe/webhook] upsert failed (subscription event, userId path):', error)
      else console.log('[stripe/webhook] updated by userId:', userId, '— plan:', plan)
    } else {
      // Fall back: match by stripe_customer_id set during checkout.session.completed
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan,
          status: sub.status,
          stripe_subscription_id: sub.id,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        })
        .eq('stripe_customer_id', String(sub.customer))
      if (error) console.error('[stripe/webhook] update failed (subscription event, customer fallback):', error)
      else console.log('[stripe/webhook] updated by stripe_customer_id:', sub.customer, '— plan:', plan)
    }
  }

  // ── customer.subscription.deleted ────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.supabase_user_id

    console.log('[stripe/webhook] subscription deleted — userId:', userId, 'customer:', sub.customer)

    if (userId) {
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
      if (error) console.error('[stripe/webhook] upsert failed (deleted, userId path):', error)
      else console.log('[stripe/webhook] plan reset to free for user:', userId)
    } else {
      const { error } = await supabase
        .from('subscriptions')
        .update({ plan: 'free', status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('stripe_customer_id', String(sub.customer))
      if (error) console.error('[stripe/webhook] update failed (deleted, customer fallback):', error)
      else console.log('[stripe/webhook] plan reset to free by stripe_customer_id:', sub.customer)
    }
  }

  return new Response('ok', { status: 200 })
}
