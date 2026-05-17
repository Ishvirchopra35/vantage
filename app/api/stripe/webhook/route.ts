import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text()
  const sig = request.headers.get('stripe-signature')
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  const stripeKey = process.env.STRIPE_SECRET_KEY

  console.log('[stripe/webhook] received — sig:', !!sig, 'secret:', !!secret, 'key:', !!stripeKey)

  if (!sig || !secret || !stripeKey) {
    console.error('[stripe/webhook] Missing configuration')
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

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.supabase_user_id
      const subscriptionId = session.subscription as string
      const customerId = session.customer as string

      console.log('[stripe/webhook] checkout.session.completed — userId:', userId, 'subId:', subscriptionId)

      if (!userId) {
        console.error('[stripe/webhook] No supabase_user_id in session metadata')
        break
      }

      let sub: Stripe.Subscription
      try {
        sub = await stripe.subscriptions.retrieve(subscriptionId)
      } catch (e) {
        console.error('[stripe/webhook] Failed to retrieve subscription:', e)
        break
      }

      const periodEnd = sub.items.data[0]?.current_period_end

      const { error } = await supabaseAdmin.from('subscriptions').upsert(
        {
          user_id: userId,
          plan: 'pro',
          status: 'active',
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: customerId,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
        },
        { onConflict: 'user_id' }
      )

      if (error) console.error('[stripe/webhook] Supabase upsert error:', error)
      else console.log('[stripe/webhook] Successfully upgraded user to pro:', userId)
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id
      const periodEnd = sub.items.data[0]?.current_period_end
      const plan = sub.status === 'active' ? 'pro' : 'free'

      console.log('[stripe/webhook] subscription.updated — userId:', userId, 'customer:', sub.customer, 'status:', sub.status)

      if (userId) {
        const { error } = await supabaseAdmin.from('subscriptions').upsert(
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
        if (error) console.error('[stripe/webhook] upsert error (updated, userId):', error)
        else console.log('[stripe/webhook] subscription updated for user:', userId)
      } else {
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            plan,
            status: sub.status,
            stripe_subscription_id: sub.id,
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          })
          .eq('stripe_customer_id', String(sub.customer))
        if (error) console.error('[stripe/webhook] update error (updated, customer fallback):', error)
        else console.log('[stripe/webhook] subscription updated by customer:', sub.customer)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const userId = sub.metadata?.supabase_user_id

      console.log('[stripe/webhook] subscription.deleted — userId:', userId, 'customer:', sub.customer)

      if (userId) {
        const { error } = await supabaseAdmin.from('subscriptions').upsert(
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
        if (error) console.error('[stripe/webhook] upsert error (deleted, userId):', error)
        else console.log('[stripe/webhook] plan reset to free for user:', userId)
      } else {
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({ plan: 'free', status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('stripe_customer_id', String(sub.customer))
        if (error) console.error('[stripe/webhook] update error (deleted, customer fallback):', error)
        else console.log('[stripe/webhook] plan reset to free by customer:', sub.customer)
      }
      break
    }

    default:
      console.log('[stripe/webhook] unhandled event type:', event.type)
  }

  return new Response('ok', { status: 200 })
}
