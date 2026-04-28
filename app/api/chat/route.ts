import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { STEPS } from '@/lib/rc-logic'
import { NextRequest } from 'next/server'

const STEP_ORDER = [
  'eligibility',
  'indemnite_legale',
  'indemnite_conv',
  'negociation',
  'carence',
  'post_signature',
]

export async function POST(req: NextRequest) {
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      console.error('Auth error:', authError)
      return new Response('Unauthorized', { status: 401 })
    }

    const { session_id, step_id, message, history } = await req.json()

    const { data: session, error: sessionError } = await supabase
      .from('rc_sessions')
      .select('*, rc_steps(*)')
      .eq('id', session_id)
      .eq('user_id', user.id)
      .single()

    if (sessionError || !session) {
      console.error('Session error:', sessionError, 'user:', user.id, 'session_id:', session_id)
      return new Response('Session not found', { status: 404 })
    }

    const step = STEPS[step_id as keyof typeof STEPS]
    if (!step) return new Response('Invalid step', { status: 400 })

    if (step.isPremium && !session.is_paid) {
      return new Response('Payment required', { status: 402 })
    }

    // __start__ is a hidden trigger to auto-begin — don't save to DB
    const isAutoStart = message === '__start__'

    if (!isAutoStart) {
      await supabase.from('rc_messages').insert({
        session_id,
        step_id,
        role: 'user',
        content: message,
      })
    }

    const sessionContext = Object.keys(session.data ?? {}).length > 0
      ? `\nDonnées déjà collectées :\n${JSON.stringify(session.data, null, 2)}`
      : ''

    const systemPrompt = `${step.systemPrompt}
${sessionContext}

Réponds toujours en français. Sois chaleureux et professionnel. Pose une question à la fois.
Si le message de l'utilisateur est exactement "__start__", commence directement par poser ta première question de façon naturelle et bienveillante — ne mentionne pas "__start__".
Quand tu as collecté toutes les données nécessaires pour cette étape, termine ton message par :
<data>{"key": "value"}</data>`

    const claudeMessages = isAutoStart
      ? [{ role: 'user' as const, content: '__start__' }]
      : [...history, { role: 'user' as const, content: message }]

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system: systemPrompt,
      messages: claudeMessages,
    })

    let fullResponse = ''

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
              const text = chunk.delta.text
              fullResponse += text
              controller.enqueue(new TextEncoder().encode(text))
            }
          }

          // Save assistant response
          await supabase.from('rc_messages').insert({
            session_id,
            step_id,
            role: 'assistant',
            content: fullResponse,
          })

          // Extract structured data if present
          const dataMatch = fullResponse.match(/<data>([\s\S]*?)<\/data>/)
          if (dataMatch) {
            try {
              const extractedData = JSON.parse(dataMatch[1])
              await supabase
                .from('rc_sessions')
                .update({ data: { ...session.data, ...extractedData } })
                .eq('id', session_id)

              await supabase
                .from('rc_steps')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  extracted_data: extractedData,
                })
                .eq('session_id', session_id)
                .eq('step_id', step_id)

              // Unlock next step
              const currentIndex = STEP_ORDER.indexOf(step_id)
              if (currentIndex >= 0 && currentIndex < STEP_ORDER.length - 1) {
                const nextStepId = STEP_ORDER[currentIndex + 1]
                const nextStep = STEPS[nextStepId as keyof typeof STEPS]
                if (!nextStep.isPremium || session.is_paid) {
                  await supabase
                    .from('rc_steps')
                    .update({ status: 'in_progress' })
                    .eq('session_id', session_id)
                    .eq('step_id', nextStepId)
                    .eq('status', 'locked')
                }
              }
            } catch (e) {
              console.error('Failed to parse extracted data:', e)
            }
          }

          controller.close()
        } catch (e) {
          console.error('Stream error:', e)
          const errMsg = e instanceof Error ? e.message : String(e)
          controller.enqueue(new TextEncoder().encode(`\n\n[Erreur: ${errMsg}]`))
          controller.close()
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (e) {
    console.error('Chat route error:', e)
    return new Response('Internal server error', { status: 500 })
  }
}
