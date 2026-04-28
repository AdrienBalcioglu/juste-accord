'use client'

import { Progress } from '@/components/ui/progress'
import { STEPS, STEP_ORDER } from '@/lib/rc-logic'
import type { RCStep } from '@/types'

interface FlowProgressProps {
  steps: RCStep[]
}

export function FlowProgress({ steps }: FlowProgressProps) {
  const completed = steps.filter((s) => s.status === 'completed').length
  const total = STEP_ORDER.length
  const pct = Math.round((completed / total) * 100)

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm text-slate-600">
        <span>{completed} / {total} étapes complétées</span>
        <span>{pct}%</span>
      </div>
      <Progress value={pct} className="h-2" />
      <div className="flex gap-1 mt-2">
        {STEP_ORDER.map((stepId) => {
          const stepData = steps.find((s) => s.step_id === stepId)
          const config = STEPS[stepId]
          const status = stepData?.status ?? 'locked'
          return (
            <div
              key={stepId}
              title={config.title}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                status === 'completed'
                  ? 'bg-green-500'
                  : status === 'in_progress'
                  ? 'bg-blue-500'
                  : 'bg-slate-200'
              }`}
            />
          )
        })}
      </div>
    </div>
  )
}
