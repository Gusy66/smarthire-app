'use client'

import { useEffect, useState } from 'react'
import { getLatestAnalysis, evaluate } from '../_lib/api'
import type { LatestAnalysis } from '../_lib/types'
import { useToast } from '@/components/ToastProvider'
import StageAnalysisPanel from './StageAnalysisPanel'

export default function AnalysisSplitPane({
  stageId,
  selection,
  onRefreshed,
}: {
  stageId: string | null
  selection: { application_id: string; application_stage_id: string; candidate: { id: string; name?: string } } | null
  onRefreshed?: () => void
}) {
  const { notify } = useToast()
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<LatestAnalysis | null>(null)
  const candidateName = selection?.candidate?.name

  useEffect(() => {
    if (!stageId || !selection) { setAnalysis(null); return }
    setLoading(true)
    getLatestAnalysis(stageId, selection.application_stage_id)
      .then(setAnalysis)
      .catch((e)=>notify({ title: 'Erro ao carregar análise', description: e?.message, variant: 'error' }))
      .finally(()=>setLoading(false))
  }, [stageId, selection?.application_stage_id])

  async function handleReevaluate() {
    if (!stageId || !selection) return
    try {
      await evaluate(stageId, { application_id: selection.application_id, application_stage_id: selection.application_stage_id, candidate_id: selection.candidate.id })
      notify({ title: 'Reavaliação iniciada', variant: 'success' })
      const latest = await getLatestAnalysis(stageId, selection.application_stage_id)
      setAnalysis(latest)
      onRefreshed?.()
    } catch (e: any) {
      notify({ title: 'Falha ao reavaliar', description: e?.message, variant: 'error' })
    }
  }

  return (
    <div className="card p-4 sticky top-6">
      {!selection ? (
        <div className="text-sm text-gray-600">Selecione um candidato para visualizar a análise.</div>
      ) : (
        <StageAnalysisPanel
          candidateName={candidateName || selection.candidate.id}
          analysis={analysis as any}
          loading={loading}
          expanded={true}
          onToggle={() => {}}
          onRefresh={handleReevaluate}
        />
      )}
    </div>
  )
}


