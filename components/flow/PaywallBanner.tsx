'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Lock, Sparkles, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PaywallBannerProps {
  sessionId: string
  isAnonymous: boolean
}

export function PaywallBanner({ sessionId, isAnonymous }: PaywallBannerProps) {
  const [loading, setLoading] = useState(false)

  async function handleStripeCheckout() {
    setLoading(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative my-6 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center">
      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-500 text-white px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1.5">
        <Lock className="w-3 h-3" />
        Accès complet
      </div>

      <Sparkles className="mx-auto mb-3 w-8 h-8 text-amber-500" />
      <h3 className="font-semibold text-slate-900 text-lg mb-1">
        Débloquez les étapes avancées
      </h3>
      <p className="text-slate-700 text-sm mb-4 max-w-md mx-auto">
        Indemnité conventionnelle, stratégie de négociation, calcul de la carence France Travail et checklist post-signature.
      </p>

      <div className="flex items-center justify-center gap-4 mb-5 text-sm text-slate-700 flex-wrap">
        <span className="flex items-center gap-1">✓ Indemnité conventionnelle</span>
        <span className="flex items-center gap-1">✓ Script de négociation</span>
        <span className="flex items-center gap-1">✓ Carence ARE</span>
      </div>

      {isAnonymous ? (
        // Anonymous user — must create account first
        <div className="space-y-3">
          <Link href="/signup">
            <Button className="bg-amber-600 hover:bg-amber-700 text-white px-8 font-semibold gap-2">
              <UserPlus className="w-4 h-4" />
              Créer un compte pour débloquer — 9€
            </Button>
          </Link>
          <p className="text-xs text-slate-600">
            Vos calculs sont sauvegardés automatiquement.{' '}
            <Link href="/login" className="underline hover:text-slate-900">
              Déjà un compte ?
            </Link>
          </p>
        </div>
      ) : (
        // Authenticated user — go straight to Stripe
        <div className="space-y-2">
          <Button
            onClick={handleStripeCheckout}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white px-8 font-semibold"
          >
            {loading ? 'Redirection...' : 'Débloquer pour 9€'}
          </Button>
          <p className="text-xs text-slate-600">Paiement unique — accès à vie</p>
        </div>
      )}
    </div>
  )
}
