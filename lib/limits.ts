import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Usage limits. Sign-in is anonymous, so every call to the Claude API is
 * capped per user and per day to keep the bill under control.
 */
export const MAX_MESSAGE_CHARS = 4_000
export const MAX_HISTORY_MESSAGES = 40
export const DAILY_MESSAGE_LIMIT = 200 // user + assistant messages
export const DAILY_DOCUMENT_LIMIT = 15
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024 // 5 MB

const DAY_MS = 24 * 60 * 60 * 1000

function since() {
  return new Date(Date.now() - DAY_MS).toISOString()
}

/** Row level security restricts both counts to the signed-in user. */
export async function isOverMessageLimit(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from('rc_messages')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since())
  if (error) return true // fail closed: no count, no API call
  return (count ?? 0) >= DAILY_MESSAGE_LIMIT
}

export async function isOverDocumentLimit(supabase: SupabaseClient) {
  const { count, error } = await supabase
    .from('rc_documents')
    .select('id', { count: 'exact', head: true })
    .gte('uploaded_at', since())
  if (error) return true
  return (count ?? 0) >= DAILY_DOCUMENT_LIMIT
}

type ChatTurn = { role: 'user' | 'assistant'; content: string }

/** Keeps only well-formed turns, bounded in number and size. */
export function sanitizeHistory(history: unknown): ChatTurn[] {
  if (!Array.isArray(history)) return []
  return history
    .filter(
      (m): m is ChatTurn =>
        !!m &&
        typeof m === 'object' &&
        ((m as ChatTurn).role === 'user' || (m as ChatTurn).role === 'assistant') &&
        typeof (m as ChatTurn).content === 'string' &&
        (m as ChatTurn).content.length > 0
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_CHARS * 2) }))
}
