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
  const [candidateData, setCandidateData] = useState<any>(null)
  const [showResumeModal, setShowResumeModal] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getLatestAnalysis(stageId, applicationStageId),
      fetch(`/api/applications/${applicationId}`, { credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => {
          // Retorna a aplicação com os dados do candidato (que devem incluir resume_path e resume_bucket)
          if (data.item?.candidate) {
            return data.item.candidate
          }
          // Fallback: procurar por email se a primeira opção não funcionar
          return fetch(`/api/candidates?search=${encodeURIComponent(candidate.email || candidate.id)}`, { credentials: 'same-origin' })
            .then(r => r.json())
            .then(data => data.items?.[0] || null)
        })
        .catch(error => {
          console.error('Erro ao carregar dados do candidato:', error)
          return null
        })
    ])
      .then(([analysis, cData]) => {
        setAnalysis(analysis)
        setCandidateData(cData)
      })
      .catch((e) => {
        console.error('Erro ao carregar informações:', e)
        notify({ title: 'Erro ao carregar informações', description: e?.message, variant: 'error' })
      })
      .finally(() => setLoading(false))
  }, [open, stageId, applicationStageId, applicationId, candidate.email, candidate.id, notify])

  async function handleReevaluate() {
    setRevaluating(true)
    try {
      await evaluate(stageId, { application_id: applicationId, application_stage_id: applicationStageId, candidate_id: candidate.id })
      notify({ title: 'Reavaliação iniciada', variant: 'success' })
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

  function getResumeUrl() {
    if (!candidateData?.resume_path || !candidateData?.resume_bucket) return null
    return `/api/candidates/resume?path=${encodeURIComponent(candidateData.resume_path)}&bucket=${candidateData.resume_bucket}`
  }

  if (!open) return null
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 sticky top-0 bg-white">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{candidate.name || candidate.id}</h2>
              {candidate.email && <p className="text-sm text-gray-600">{candidate.email}</p>}
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Candidate Info Card */}
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Informações do Candidato</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-600">Nome</div>
                  <div className="mt-1 text-sm text-gray-900">{candidate.name || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-600">E-mail</div>
                  <div className="mt-1 text-sm text-gray-900">{candidate.email || '—'}</div>
                </div>
                {candidateData?.phone && (
                  <div>
                    <div className="text-xs font-medium text-gray-600">Telefone</div>
                    <div className="mt-1 text-sm text-gray-900">{candidateData.phone}</div>
                  </div>
                )}
                {candidateData?.city && (
                  <div>
                    <div className="text-xs font-medium text-gray-600">Localização</div>
                    <div className="mt-1 text-sm text-gray-900">{candidateData.city}, {candidateData.state}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Score Card */}
            {loading ? (
              <div className="rounded-lg border border-gray-200 p-5 text-center">
                <div className="text-sm text-gray-600">Carregando análise...</div>
              </div>
            ) : analysis ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Análise da Etapa</h3>
                <div className="flex items-baseline gap-4 mb-4">
                  <div>
                    <div className="text-xs font-medium text-gray-600">Pontuação</div>
                    <div className="mt-2 flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-green-700">
                        {typeof analysis.result?.score === 'number' ? analysis.result.score.toFixed(1) : '—'}
                      </span>
                      <span className="text-sm text-gray-600">pontos</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600">Data da Análise</div>
                    <div className="mt-2 text-sm text-gray-700">
                      {analysis.created_at ? new Date(analysis.created_at).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                </div>

                {analysis.result?.analysis && (
                  <div className="mb-4">
                    <div className="text-xs font-medium text-gray-600 mb-2">Análise</div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis.result.analysis}</p>
                  </div>
                )}

                {/* Strengths and Weaknesses */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-2">Pontos Fortes</div>
                    <ul className="space-y-1">
                      {analysis.result?.strengths && analysis.result.strengths.length > 0 ? (
                        analysis.result.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-green-600 mt-0.5">✓</span>
                            <span>{s}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-600">—</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-gray-600 mb-2">A Melhorar</div>
                    <ul className="space-y-1">
                      {analysis.result?.weaknesses && analysis.result.weaknesses.length > 0 ? (
                        analysis.result.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                            <span className="text-amber-600 mt-0.5">!</span>
                            <span>{w}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-sm text-gray-600">—</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-gray-200 p-5 text-center">
                <div className="text-sm text-gray-600">Nenhuma análise encontrada para esta etapa.</div>
              </div>
            )}

            {/* Recommendations */}
            {analysis?.result?.recommendations && analysis.result.recommendations.length > 0 && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Recomendações</h3>
                <ul className="space-y-2">
                  {analysis.result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                      <span className="text-blue-600 mt-0.5">💡</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3 sticky bottom-0 bg-white">
            <button
              onClick={() => setShowResumeModal(true)}
              disabled={!getResumeUrl()}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              📄 Visualizar Currículo
            </button>
            <button
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
              onClick={handleReevaluate}
              disabled={revaluating}
            >
              {revaluating ? 'Reavaliando...' : '🔄 Reavaliar'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* Resume Modal */}
      {showResumeModal && getResumeUrl() && (
        <div className="fixed inset-0 z-51 flex items-center justify-center bg-black/50 px-4">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Currículo - {candidate.name || candidate.id}</h2>
              <button
                onClick={() => setShowResumeModal(false)}
                className="text-gray-500 hover:text-gray-800"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-auto">
              <iframe
                src={getResumeUrl() || ''}
                className="w-full h-full border-none"
                title="Currículo"
              />
            </div>
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3">
              <a
                href={getResumeUrl() || '#'}
                download
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ⬇️ Baixar
              </a>
              <button
                onClick={() => setShowResumeModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}


