import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { stripe } from '@/lib/stripe'

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return new Response('Webhook signature invalid', { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const rc_session_id = session.metadata?.rc_session_id

    if (rc_session_id) {
      await supabase
        .from('rc_sessions')
        .update({
          is_paid: true,
          stripe_payment_intent_id: session.payment_intent as string,
        })
        .eq('id', rc_session_id)

      const premiumSteps = [
        'indemnite_conv',
        'negociation',
        'carence',
        'post_signature',
      ]
      for (const step_id of premiumSteps) {
        await supabase
          .from('rc_steps')
          .update({ status: 'in_progress' })
          .eq('session_id', rc_session_id)
          .eq('step_id', step_id)
          .eq('status', 'locked')
      }
    }
  }

  return Response.json({ received: true })
}
