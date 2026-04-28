export type StepId =
  | 'eligibility'
  | 'indemnite_legale'
  | 'indemnite_conv'
  | 'negociation'
  | 'carence'
  | 'post_signature'

export type StepStatus = 'locked' | 'in_progress' | 'completed'

export interface RCSession {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  is_paid: boolean
  stripe_payment_intent_id: string | null
  data: Record<string, unknown>
}

export interface RCStep {
  id: string
  session_id: string
  step_id: StepId
  status: StepStatus
  completed_at: string | null
  extracted_data: Record<string, unknown>
}

export interface RCDocument {
  id: string
  session_id: string
  step_id: string
  file_name: string
  storage_path: string
  extracted_data: Record<string, unknown>
  uploaded_at: string
}

export interface RCMessage {
  id: string
  session_id: string
  step_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface StepConfig {
  id: StepId
  title: string
  description: string
  isPremium: boolean
  requiredDocuments: { key: string; label: string; required: boolean }[]
  systemPrompt: string
}
