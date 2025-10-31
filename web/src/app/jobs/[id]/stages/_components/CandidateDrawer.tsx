'use client'

import { useEffect, useState } from 'react'
import { getLatestAnalysis, evaluate } from '../_lib/api'
import type { LatestAnalysis } from '../_lib/types'
import { useToast } from '@/components/ToastProvider'

export default function CandidateDrawer({
  open,
  onClose,
  stageId,
  applicationId,
  applicationStageId,
  candidate,
}: {
  open: boolean
  onClose: () => void
  stageId: string
  applicationId: string
  applicationStageId: string
  candidate: { id: string; name?: string; email?: string }
}) {
  const { notify } = useToast()
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<LatestAnalysis | null>(null)
  const [revaluating, setRevaluating] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getLatestAnalysis(stageId, applicationStageId)
      .then(setAnalysis)
      .catch((e) => notify({ title: 'Erro ao carregar análise', description: e?.message, variant: 'error' }))
      .finally(() => setLoading(false))
  }, [open, stageId, applicationStageId, notify])

  async function handleReevaluate() {
    setRevaluating(true)
    try {
      await evaluate(stageId, { application_id: applicationId, application_stage_id: applicationStageId, candidate_id: candidate.id })
      notify({ title: 'Reavaliação iniciada', variant: 'success' })
      // recarrega depois de pequeno delay
      setTimeout(async () => {
        const latest = await getLatestAnalysis(stageId, applicationStageId)
        setAnalysis(latest)
      }, 2000)
    } catch (e: any) {
      notify({ title: 'Falha ao reavaliar', description: e?.message, variant: 'error' })
    } finally {
      setRevaluating(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-30">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl p-6 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold">{candidate.name || candidate.id}</h3>
            {candidate.email && <div className="text-sm text-gray-600">{candidate.email}</div>}
          </div>
          <button className="btn btn-outline" onClick={onClose}>Fechar</button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="card p-4">
            <div className="text-sm text-gray-600">Última análise da etapa</div>
            {loading ? (
              <div className="text-sm text-gray-600">Carregando...</div>
            ) : analysis ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-3xl font-bold">{typeof analysis.result?.score === 'number' ? analysis.result.score.toFixed(1) : '—'}</span>
                  <span className="text-xs text-gray-500">{analysis.created_at ? new Date(analysis.created_at).toLocaleString('pt-BR') : ''}</span>
                </div>
                {analysis.result?.analysis && <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis.result.analysis}</p>}
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <div className="font-medium text-sm mb-1">Pontos fortes</div>
                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                      {analysis.result?.strengths?.map((s, i)=> <li key={i}>{s}</li>) || <li>—</li>}
                    </ul>
                  </div>
                  <div>
                    <div className="font-medium text-sm mb-1">A melhorar</div>
                    <ul className="list-disc pl-5 text-sm text-gray-700 space-y-1">
                      {analysis.result?.weaknesses?.map((s, i)=> <li key={i}>{s}</li>) || <li>—</li>}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">Nenhuma análise encontrada para esta etapa.</div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button className="btn btn-primary" onClick={handleReevaluate} disabled={revaluating}>{revaluating ? 'Reavaliando...' : 'Reavaliar nesta etapa'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}


