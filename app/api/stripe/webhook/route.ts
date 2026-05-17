import { getStripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !secret) {
    return new Response('Missing signature or secret', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret)
  } catch (e) {
    return new Response(`Webhook signature verification failed: ${String(e)}`, { status: 400 })
  }

  const supabase = await createClient()

  try {
    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      const supabaseUserId = sub.metadata?.supabase_user_id
      if (!supabaseUserId) {
        return new Response('Missing supabase_user_id in metadata', { status: 200 })
      }

      const periodEnd = sub.items.data[0]?.current_period_end
      const currentPeriodEnd = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

      await supabase.from('subscriptions').upsert(
        {
          user_id: supabaseUserId,
          plan: sub.status === 'active' ? 'pro' : 'free',
          status: sub.status,
          stripe_subscription_id: sub.id,
          stripe_customer_id: String(sub.customer),
          current_period_end: currentPeriodEnd,
        },
        { onConflict: 'user_id' }
      )
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      const supabaseUserId = sub.metadata?.supabase_user_id
      if (!supabaseUserId) {
        return new Response('Missing supabase_user_id in metadata', { status: 200 })
      }

      await supabase.from('subscriptions').upsert(
        {
          user_id: supabaseUserId,
          plan: 'free',
          status: 'cancelled',
          stripe_subscription_id: sub.id,
          stripe_customer_id: String(sub.customer),
          cancelled_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    }
  } catch (e) {
    console.error('[stripe/webhook] DB update failed:', e)
    // Still return 200 so Stripe doesn't retry — DB errors shouldn't cause retries
  }

  return new Response('ok', { status: 200 })
}
