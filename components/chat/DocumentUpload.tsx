'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, Loader2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DocumentDef {
  key: string
  label: string
  required: boolean
}

interface DocumentUploadProps {
  sessionId: string
  stepId: string
  documents: DocumentDef[]
  onDocumentExtracted?: (docType: string, data: Record<string, unknown>) => void
}

export function DocumentUpload({
  sessionId,
  stepId,
  documents,
  onDocumentExtracted,
}: DocumentUploadProps) {
  const [uploading, setUploading] = useState<string | null>(null)
  const [uploaded, setUploaded] = useState<Record<string, Record<string, unknown>>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleUpload(file: File, docType: string) {
    setUploading(docType)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('session_id', sessionId)
      formData.append('step_id', stepId)
      formData.append('document_type', docType)

      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) throw new Error('Upload failed')

      const data = await res.json()
      setUploaded((prev) => ({ ...prev, [docType]: data.extracted_data }))
      onDocumentExtracted?.(docType, data.extracted_data)
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
        Documents
      </p>
      {documents.map((doc) => {
        const isUploaded = !!uploaded[doc.key]
        const isUploading = uploading === doc.key

        return (
          <div
            key={doc.key}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              isUploaded ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-slate-50'
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {isUploaded ? (
                <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              )}
              <span className="text-sm text-slate-700 truncate">{doc.label}</span>
              {doc.required && !isUploaded && (
                <Badge variant="warning" className="text-xs shrink-0">requis</Badge>
              )}
              {isUploaded && (
                <Badge variant="success" className="text-xs shrink-0">✓ Extrait</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              {isUploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
              ) : (
                <>
                  <input
                    ref={(el) => { fileInputRefs.current[doc.key] = el }}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleUpload(file, doc.key)
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRefs.current[doc.key]?.click()}
                    className="text-xs h-7"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {isUploaded ? 'Remplacer' : 'Uploader'}
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
