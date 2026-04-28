'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ChatMessage } from './ChatMessage'
import type { RCMessage } from '@/types'

interface ChatWindowProps {
  sessionId: string
  stepId: string
  initialMessages: Pick<RCMessage, 'role' | 'content'>[]
  placeholder?: string
  onStepCompleted?: () => void
}

export function ChatWindow({
  sessionId,
  stepId,
  initialMessages,
  placeholder = 'Répondez ici... (Entrée pour envoyer)',
  onStepCompleted,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<Pick<RCMessage, 'role' | 'content'>[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const autoStarted = useRef(false)

  // Auto-start: trigger Claude to ask first question when no messages
  useEffect(() => {
    if (!autoStarted.current && initialMessages.length === 0) {
      autoStarted.current = true
      sendMessage('__start__', true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus input after Claude responds
  useEffect(() => {
    if (!streaming) {
      inputRef.current?.focus()
    }
  }, [streaming])

  async function sendMessage(text: string, isAutoStart = false) {
    if ((!isAutoStart && !text.trim()) || streaming) return

    if (!isAutoStart) {
      setMessages((prev) => [...prev, { role: 'user', content: text }])
      setInput('')
    }
    setStreaming(true)
    setError(null)

    const history = isAutoStart
      ? []
      : messages.map((m) => ({ role: m.role, content: m.content }))

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          step_id: stepId,
          message: isAutoStart ? '__start__' : text,
          history,
        }),
      })

      if (!res.ok) {
        const body = await res.text()
        throw new Error(`${res.status}: ${body}`)
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: assistantText }
          return updated
        })
      }

      if (assistantText.includes('<data>')) {
        onStepCompleted?.()
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Chat error:', msg)
      setError(msg)
      // Remove the optimistic user message if auto-start failed
      if (!isAutoStart) {
        // keep the user message, just show error
      } else {
        // Remove the empty assistant bubble if it was added
        setMessages((prev) => prev.filter((m) => m.content !== ''))
      }
    } finally {
      setStreaming(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isLoading = streaming && messages[messages.length - 1]?.role === 'assistant' && messages[messages.length - 1]?.content === ''

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {/* Loading first message */}
        {streaming && messages.length === 0 && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">IA</div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              <span className="text-sm text-slate-400">L&apos;assistant prépare votre analyse...</span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}

        {/* Loading bubble while streaming */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">IA</div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-red-700 font-medium">Erreur de connexion</p>
              <p className="text-xs text-red-500 mt-0.5">{error}</p>
            </div>
            <button
              onClick={() => {
                setError(null)
                autoStarted.current = false
                sendMessage('__start__', true)
              }}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Réessayer
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input — only show once Claude has responded */}
      {(messages.some((m) => m.role === 'assistant') || error) && (
        <div className="border-t border-slate-200 p-3 flex gap-2 items-end bg-white">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 min-h-[40px] max-h-[120px] text-sm"
            disabled={streaming}
          />
          <Button
            size="icon"
            onClick={() => sendMessage(input)}
            disabled={streaming || !input.trim()}
            className="shrink-0 h-10 w-10"
          >
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      )}
    </div>
  )
}
