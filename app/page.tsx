'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { STEPS, STEP_ORDER } from '@/lib/rc-logic'
import { StepCard } from '@/components/flow/StepCard'
import { FlowProgress } from '@/components/flow/FlowProgress'
import { PaywallBanner } from '@/components/flow/PaywallBanner'
import type { RCSession, RCStep, RCMessage } from '@/types'
import { ArrowDown, CheckCircle, Shield, Clock, TrendingUp, ChevronDown } from 'lucide-react'

// ─── Data ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '100 000+', label: 'RC signées chaque trimestre' },
  { value: '15 000€', label: 'indemnité moyenne négociée' },
  { value: '15 min', label: 'pour connaître vos droits' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Vérifiez votre éligibilité',
    desc: "L'agent IA analyse votre situation : type de contrat, ancienneté, contexte. Verdict clair en quelques questions.",
  },
  {
    step: '02',
    title: 'Calculez vos indemnités',
    desc: "Uploadez vos bulletins de salaire. Le calcul légal et conventionnel est fait automatiquement, avec comparatif.",
  },
  {
    step: '03',
    title: 'Négociez avec confiance',
    desc: "Script de négociation personnalisé, fourchette cible, pièges à éviter. Vous arrivez préparé à l'entretien.",
  },
]

const FEATURES = [
  { icon: Shield, title: 'Calcul 100% conforme', desc: 'Formule légale Art. L1237-19 + conventions collectives (Syntec, Banque, Assurance, Métallurgie…)' },
  { icon: TrendingUp, title: 'Stratégie de négociation', desc: 'Script personnalisé selon votre levier (restructuration, télétravail refusé, compétences rares…)' },
  { icon: Clock, title: 'Carence France Travail', desc: "Calcul précis de votre délai avant l'ARE : attente fixe + congés + supra-légale (plafonné 150j)" },
]

const FAQ = [
  {
    q: 'Mes données sont-elles confidentielles ?',
    a: "Oui. Vos données sont chiffrées et stockées sur des serveurs sécurisés (Supabase, hébergé en UE). Elles ne sont jamais partagées avec des tiers.",
  },
  {
    q: 'Le calcul remplace-t-il un avocat ?',
    a: "Non. Juste Accord fournit une information juridique à titre indicatif. Pour une RC complexe (inaptitude, procédure disciplinaire en cours), consultez un avocat en droit social.",
  },
  {
    q: 'Que se passe-t-il si je ferme la page ?',
    a: "Créez un compte gratuit pour sauvegarder votre progression. Sans compte, vos calculs sont perdus à la fermeture.",
  },
  {
    q: "À quoi sert l'accès à 9€ ?",
    a: "Il débloque 4 étapes avancées : indemnité conventionnelle, stratégie de négociation, calcul de la carence ARE, et checklist post-signature. Paiement unique, accès à vie.",
  },
]

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-slate-200 last:border-0">
      <button
        className="w-full flex items-center justify-between py-4 text-left gap-4"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-medium text-slate-900 text-sm">{q}</span>
        <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="pb-4 text-sm text-slate-600 leading-relaxed">{a}</p>}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HomePage() {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<RCSession | null>(null)
  const [steps, setSteps] = useState<RCStep[]>([])
  const [messages, setMessages] = useState<RCMessage[]>([])
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isRealUser, setIsRealUser] = useState(false)
  const calculatorRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    let { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const { data } = await supabase.auth.signInAnonymously()
      user = data.user
    }
    if (!user) return

    const anonymous = user.is_anonymous ?? false
    setIsAnonymous(anonymous)
    setIsRealUser(!anonymous)

    let { data: existing } = await supabase
      .from('rc_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!existing) {
      const { data: created } = await supabase
        .from('rc_sessions')
        .insert({ user_id: user.id })
        .select()
        .single()
      if (created) {
        await supabase.from('rc_steps').insert(
          STEP_ORDER.map((stepId, i) => ({
            session_id: created.id,
            step_id: stepId,
            status: i === 0 ? 'in_progress' : 'locked',
          }))
        )
        existing = created
      }
    }

    if (!existing) return
    setSession(existing as RCSession)

    const [{ data: stepsData }, { data: msgsData }] = await Promise.all([
      supabase.from('rc_steps').select('*').eq('session_id', existing.id),
      supabase.from('rc_messages').select('*').eq('session_id', existing.id).order('created_at', { ascending: true }),
    ])

    setSteps((stepsData ?? []) as RCStep[])
    setMessages((msgsData ?? []) as RCMessage[])
    setReady(true)
  }, [])

  useEffect(() => { load() }, [load])

  const completedFreeSteps = steps.filter(
    (s) => !STEPS[s.step_id as keyof typeof STEPS]?.isPremium && s.status === 'completed'
  ).length
  const allFreeCompleted = completedFreeSteps >= STEP_ORDER.filter((id) => !STEPS[id].isPremium).length

  return (
    <div className="min-h-screen bg-white">

      {/* ── Nav ── */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-bold text-slate-900 text-lg tracking-tight">Juste Accord</span>
          <nav className="flex items-center gap-4">
            <a href="#comment-ca-marche" className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Comment ça marche
            </a>
            <a href="#tarifs" className="text-sm text-slate-600 hover:text-slate-900 transition-colors hidden sm:block">
              Tarifs
            </a>
            {ready && (
              <form action="/api/reset" method="post">
                <button type="submit" className="text-sm text-slate-400 hover:text-slate-700 transition-colors">
                  Recommencer
                </button>
              </form>
            )}
            {isRealUser ? (
              <form action="/api/auth/signout" method="post">
                <button type="submit" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  Se déconnecter
                </button>
              </form>
            ) : (
              <>
                <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  Se connecter
                </Link>
                <Link href="/signup" className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors font-medium">
                  Créer un compte
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-3xl mx-auto px-4 pt-16 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-white/80 text-xs font-medium px-3 py-1.5 rounded-full mb-6 border border-white/10">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Gratuit pour commencer — sans inscription
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-4">
            Négociez votre rupture
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              conventionnelle
            </span>{' '}
            avec un expert IA
          </h1>

          <p className="text-slate-300 text-lg max-w-xl mx-auto mb-10">
            Calculez vos indemnités légales et conventionnelles, préparez votre négociation, anticipez la carence France Travail.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mb-10">
            {STATS.map((s) => (
              <div key={s.label} className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-tight">{s.label}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors animate-bounce"
          >
            <ArrowDown className="w-4 h-4" />
            Commencer votre analyse
          </button>
        </div>
      </section>

      {/* ── Calculator ── */}
      <section ref={calculatorRef} className="bg-slate-50 py-12">
        <div className="max-w-2xl mx-auto px-4 space-y-6">

          <div className="text-center mb-8">
            <h2 className="text-xl font-bold text-slate-900">Votre analyse personnalisée</h2>
            <p className="text-slate-500 text-sm mt-1">Répondez aux questions de l&apos;agent IA — vos résultats s&apos;affinent à chaque étape.</p>
          </div>

          {/* Loading */}
          {!ready && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <div className="w-7 h-7 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
              <p className="text-slate-500 text-sm">Initialisation de votre espace...</p>
            </div>
          )}

          {ready && session && (
            <>
              {/* Anonymous save nudge */}
              {isAnonymous && allFreeCompleted && !session.is_paid && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
                  <span className="text-lg">💾</span>
                  <div className="flex-1">
                    <p className="text-blue-900 font-medium text-sm">Sauvegardez votre progression</p>
                    <p className="text-blue-700 text-xs mt-0.5">Créez un compte gratuit pour ne pas perdre vos résultats.</p>
                  </div>
                  <Link href="/signup" className="shrink-0 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
                    Créer un compte
                  </Link>
                </div>
              )}

              {/* Progress */}
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <FlowProgress steps={steps} />
              </div>

              {/* Step cards */}
              <div className="space-y-3">
                {STEP_ORDER.map((stepId, index) => {
                  const config = STEPS[stepId]
                  const stepData = steps.find((s) => s.step_id === stepId)
                  const stepMessages = messages
                    .filter((m) => m.step_id === stepId)
                    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

                  const showPaywall =
                    !session.is_paid &&
                    config.isPremium &&
                    index === STEP_ORDER.findIndex((id) => STEPS[id].isPremium)

                  return (
                    <div key={stepId}>
                      {showPaywall && (
                        <PaywallBanner sessionId={session.id} isAnonymous={isAnonymous} />
                      )}
                      <StepCard
                        stepConfig={config}
                        stepData={stepData}
                        sessionId={session.id}
                        isPaid={session.is_paid}
                        messages={stepMessages}
                        stepNumber={index + 1}
                        onStepCompleted={load}
                      />
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="comment-ca-marche" className="bg-white py-16 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-slate-900">Comment ça marche</h2>
            <p className="text-slate-500 text-sm mt-2">6 étapes guidées par l&apos;IA pour maîtriser votre RC de A à Z</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.step} className="relative">
                <div className="text-4xl font-black text-slate-100 mb-2 leading-none">{item.step}</div>
                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Feature pills */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <f.icon className="w-5 h-5 text-slate-700 mb-2" />
                <p className="font-medium text-slate-900 text-sm mb-1">{f.title}</p>
                <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="tarifs" className="bg-slate-50 py-16 border-t border-slate-100">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900">Tarif simple</h2>
            <p className="text-slate-500 text-sm mt-2">Commencez gratuitement, débloquez l&apos;accès complet quand vous en avez besoin.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-xl mx-auto">
            {/* Free */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Gratuit</p>
                <p className="text-3xl font-bold text-slate-900">0€</p>
                <p className="text-slate-500 text-sm mt-0.5">Sans inscription</p>
              </div>
              <ul className="space-y-2">
                {['Vérification éligibilité', 'Calcul indemnité légale', 'Upload bulletins de salaire', 'Résultats immédiats'].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => calculatorRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full border border-slate-300 text-slate-700 rounded-lg py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Commencer maintenant
              </button>
            </div>

            {/* Premium */}
            <div className="bg-slate-900 rounded-2xl p-6 space-y-4 relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-blue-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                Recommandé
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Accès complet</p>
                <p className="text-3xl font-bold text-white">9€ <span className="text-base font-normal text-slate-400">unique</span></p>
                <p className="text-slate-400 text-sm mt-0.5">Accès à vie</p>
              </div>
              <ul className="space-y-2">
                {[
                  'Tout le plan gratuit',
                  'Indemnité conventionnelle',
                  'Stratégie de négociation',
                  'Carence ARE calculée',
                  'Checklist post-signature',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => calculatorRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full bg-white text-slate-900 rounded-lg py-2 text-sm font-semibold hover:bg-slate-100 transition-colors"
              >
                Commencer — 9€ après étape 2
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="bg-white py-16 border-t border-slate-100">
        <div className="max-w-xl mx-auto px-4">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">Questions fréquentes</h2>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-2xl px-5">
            {FAQ.map((item) => (
              <FaqItem key={item.q} {...item} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-8">
        <div className="max-w-3xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="font-semibold text-white">Juste Accord</span>
          <span>Information juridique à titre indicatif — non substituable à un conseil d&apos;avocat.</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-white transition-colors">Connexion</Link>
            <Link href="/signup" className="hover:text-white transition-colors">Créer un compte</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
