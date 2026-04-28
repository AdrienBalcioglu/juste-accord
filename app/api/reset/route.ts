import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  // Delete all sessions for this user — cascades to steps, messages, documents
  await supabase.from('rc_sessions').delete().eq('user_id', user.id)

  return NextResponse.redirect(new URL('/', req.url))
}
