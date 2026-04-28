'use client'

import { useState } from 'react'
import { Lock, CheckCircle, ChevronRight, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatWindow } from '@/components/chat/ChatWindow'
import { DocumentUpload } from '@/components/chat/DocumentUpload'
import { cn } from '@/lib/utils'
import type { RCStep, RCMessage, StepConfig } from '@/types'

interface StepCardProps {
  stepConfig: StepConfig
  stepData: RCStep | undefined
  sessionId: string
  isPaid: boolean
  messages: Pick<RCMessage, 'role' | 'content'>[]
  stepNumber: number
  onStepCompleted?: () => void
}

export function StepCard({
  stepConfig,
  stepData,
  sessionId,
  isPaid,
  messages,
  stepNumber,
  onStepCompleted,
}: StepCardProps) {
  const status = stepData?.status ?? 'locked'
  const isLocked = status === 'locked'
  const isCompleted = status === 'completed'
  const isActive = status === 'in_progress'
  const [expanded, setExpanded] = useState(isActive)

  const PLACEHOLDERS: Record<string, string> = {
    eligibility: 'Ex : "Je suis en CDI depuis 3 ans, je voudrais savoir si je suis éligible..."',
    indemnite_legale: 'Ex : "Mon salaire brut est de 3 200€, j\'ai 5 ans d\'ancienneté..."',
    indemnite_conv: 'Ex : "Ma convention collective est Syntec..."',
    negociation: 'Ex : "C\'est moi qui ai initié la démarche, mon employeur..."',
    carence: 'Ex : "L\'indemnité négociée est 15 000€, il me reste 12 jours de congés..."',
    post_signature: 'Ex : "J\'ai signé hier, quelle est ma prochaine étape ?"',
  }

  return (
    <Card
      className={cn(
        'transition-all',
        isCompleted && 'border-green-300 bg-green-50',
        isActive && 'border-blue-300 ring-2 ring-blue-100',
        isLocked && 'opacity-50'
      )}
    >
      <CardHeader className="pb-3">
        <button
          className="flex items-center gap-3 w-full text-left"
          onClick={() => !isLocked && setExpanded((e) => !e)}
          disabled={isLocked}
        >
          {/* Step number / status icon */}
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
              isCompleted ? 'bg-green-600 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
            )}
          >
            {isCompleted ? (
              <CheckCircle className="w-4 h-4" />
            ) : isLocked ? (
              <Lock className="w-3.5 h-3.5" />
            ) : (
              stepNumber
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 text-base">{stepConfig.title}</h3>
              {stepConfig.isPremium && (
                <Badge variant={isPaid ? 'success' : 'warning'} className="text-xs">
                  {isPaid ? '✓ Débloqué' : 'Premium'}
                </Badge>
              )}
              {isCompleted && (
                <Badge variant="success" className="text-xs">Complété</Badge>
              )}
            </div>
            <p className="text-sm text-slate-600 truncate">{stepConfig.description}</p>
          </div>

          {!isLocked && (
            <div className="shrink-0 text-slate-400">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          )}
        </button>
      </CardHeader>

      {expanded && !isLocked && (
        <CardContent className="pt-0 space-y-4">
          {/* Extracted data summary if completed */}
          {isCompleted && stepData?.extracted_data && Object.keys(stepData.extracted_data).length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-700 mb-2">Données collectées</p>
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(stepData.extracted_data).map(([k, v]) => (
                  <div key={k} className="text-xs">
                    <span className="text-slate-500">{k}:</span>{' '}
                    <span className="font-medium text-slate-800">{String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document upload */}
          {stepConfig.requiredDocuments.length > 0 && (
            <DocumentUpload
              sessionId={sessionId}
              stepId={stepConfig.id}
              documents={stepConfig.requiredDocuments}
            />
          )}

          {/* Chat window */}
          <div className="h-[440px] flex flex-col border border-slate-200 rounded-xl overflow-hidden bg-white">
            <ChatWindow
              sessionId={sessionId}
              stepId={stepConfig.id}
              initialMessages={messages}
              placeholder={PLACEHOLDERS[stepConfig.id]}
              onStepCompleted={onStepCompleted}
            />
          </div>

          {isCompleted && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setExpanded(false)}>
                Réduire
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
