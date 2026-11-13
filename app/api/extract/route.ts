import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { STEPS } from '@/lib/rc-logic'
import { MAX_DOCUMENT_BYTES, isOverDocumentLimit } from '@/lib/limits'

const EXTRACTION_PROMPTS: Record<string, string> = {
  bulletin_salaire: `Extrais les informations suivantes de ce bulletin de salaire et retourne UNIQUEMENT un JSON valide :
{
  "salary_brut": number,
  "salary_net": number,
  "month": "YYYY-MM",
  "convention_collective": string,
  "company_name": string,
  "employee_name": string,
  "primes": number
}`,
  contrat_travail: `Extrais les informations suivantes de ce contrat de travail et retourne UNIQUEMENT un JSON valide :
{
  "start_date": "YYYY-MM-DD",
  "contract_type": "CDI ou CDD ou autre",
  "job_title": string,
  "salary_brut": number,
  "convention_collective": string,
  "company_name": string,
  "trial_period_months": number
}`,
  convention_rc: `Extrais les informations suivantes de cette convention de rupture conventionnelle et retourne UNIQUEMENT un JSON valide :
{
  "end_date": "YYYY-MM-DD",
  "indemnite_rc": number,
  "signature_date": "YYYY-MM-DD",
  "retractation_deadline": "YYYY-MM-DD",
  "company_name": string,
  "employee_name": string
}`,
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File
  const session_id = formData.get('session_id') as string
  const step_id = formData.get('step_id') as string
  const document_type = formData.get('document_type') as string

  if (!file || typeof file === 'string') return new Response('No file', { status: 400 })
  if (file.type !== 'application/pdf') return new Response('PDF only', { status: 415 })
  if (file.size > MAX_DOCUMENT_BYTES) return new Response('File too large', { status: 413 })
  if (!/^[a-z_]{1,40}$/.test(document_type ?? '')) {
    return new Response('Invalid document type', { status: 400 })
  }

  // The session must belong to the signed-in user before anything is stored or sent to Claude.
  const { data: ownedSession } = await supabase
    .from('rc_sessions')
    .select('id, is_paid')
    .eq('id', session_id)
    .eq('user_id', user.id)
    .single()
  if (!ownedSession) return new Response('Session not found', { status: 404 })

  const step = STEPS[step_id as keyof typeof STEPS]
  if (!step) return new Response('Invalid step', { status: 400 })
  if (step.isPremium && !ownedSession.is_paid) {
    return new Response('Payment required', { status: 402 })
  }

  if (await isOverDocumentLimit(supabase)) {
    return new Response('Daily limit reached', { status: 429 })
  }

  const fileBuffer = await file.arrayBuffer()
  const storagePath = `${user.id}/${session_id}/${document_type}_${Date.now()}.pdf`

  const { error: uploadError } = await supabase.storage
    .from('rc-documents')
    .upload(storagePath, fileBuffer, { contentType: file.type })

  if (uploadError) {
    console.error('Upload error:', uploadError)
    return new Response('Upload failed', { status: 500 })
  }

  const base64 = Buffer.from(fileBuffer).toString('base64')

  let extractedData: Record<string, unknown> = {}
  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text:
                EXTRACTION_PROMPTS[document_type] ||
                'Extrais les informations clés de ce document en JSON.',
            },
          ],
        },
      ],
    })

    const text =
      response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    extractedData = JSON.parse(clean)
  } catch (e) {
    console.error('Extraction failed', e)
  }

  await supabase.from('rc_documents').insert({
    session_id,
    step_id,
    file_name: file.name,
    storage_path: storagePath,
    extracted_data: extractedData,
  })

  const { data: session } = await supabase
    .from('rc_sessions')
    .select('data')
    .eq('id', session_id)
    .single()

  if (session) {
    await supabase
      .from('rc_sessions')
      .update({ data: { ...session.data, ...extractedData } })
      .eq('id', session_id)
  }

  return Response.json({ success: true, extracted_data: extractedData })
}
