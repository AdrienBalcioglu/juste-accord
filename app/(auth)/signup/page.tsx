'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    let authError: { message: string } | null = null

    if (user?.is_anonymous) {
      // Upgrade anonymous session → preserves all existing data (RC sessions, steps, messages)
      const { error } = await supabase.auth.updateUser({ email, password })
      authError = error
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/dashboard` },
      })
      authError = error
    }

    if (authError) {
      setError(authError.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      setTimeout(() => router.push('/dashboard'), 1000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Juste Accord</h1>
          <p className="text-slate-600 text-sm mt-1">Créez votre compte gratuit</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-900">Créer un compte</h2>

          {success ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
              Compte créé ! Redirection vers votre espace...
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1" htmlFor="email">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="vous@exemple.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1" htmlFor="password">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  placeholder="6 caractères minimum"
                />
              </div>

              {error && (
                <p className="text-red-600 text-xs">{error}</p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Création...' : 'Commencer gratuitement'}
              </Button>
            </form>
          )}

          <p className="text-center text-sm text-slate-600">
            Déjà un compte ?{' '}
            <Link href="/login" className="text-slate-900 font-medium hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
