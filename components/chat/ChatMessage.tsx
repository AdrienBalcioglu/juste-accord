import { cn } from '@/lib/utils'
import type { RCMessage } from '@/types'

interface ChatMessageProps {
  message: Pick<RCMessage, 'role' | 'content'>
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  // Strip <data>...</data> tags from display
  const displayContent = message.content.replace(/<data>[\s\S]*?<\/data>/g, '').trim()

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5',
          isUser ? 'bg-slate-900 text-white' : 'bg-blue-100 text-blue-700'
        )}
      >
        {isUser ? 'M' : 'IA'}
      </div>
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
          isUser
            ? 'bg-slate-900 text-white rounded-tr-sm'
            : 'bg-slate-100 text-slate-900 rounded-tl-sm'
        )}
      >
        {displayContent}
      </div>
    </div>
  )
}
