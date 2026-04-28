import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { session_id } = await req.json()

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: 'Juste Accord — Accès complet',
            description:
              'Indemnité conventionnelle, stratégie de négociation, calcul carence, checklist post-signature',
          },
          unit_amount: 900,
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payment=success&session_id=${session_id}`,
    cancel_url: `${process.env.NEXT_PUBLIC_URL}/dashboard?payment=cancelled`,
    metadata: {
      rc_session_id: session_id,
      user_id: user.id,
    },
  })

  return Response.json({ url: checkoutSession.url })
}
