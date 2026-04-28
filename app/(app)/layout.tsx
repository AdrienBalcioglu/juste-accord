import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isRealUser = !!user && !user.is_anonymous

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="font-bold text-slate-900 text-lg">
            Juste Accord
          </Link>
          <div className="flex items-center gap-3">
            {isRealUser ? (
              <form action="/api/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  Se déconnecter
                </button>
              </form>
            ) : (
              <>
                <Link href="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
                  Se connecter
                </Link>
                <Link
                  href="/signup"
                  className="text-sm bg-slate-900 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
