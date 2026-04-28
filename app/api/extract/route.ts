import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

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

  if (!file) return new Response('No file', { status: 400 })

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
