'use client'

import { useEffect, useMemo, useState } from 'react'
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
  analysisType = 'resume',
}: {
  open: boolean
  onClose: () => void
  stageId: string
  applicationId: string
  applicationStageId: string
  candidate: { id: string; name?: string; email?: string }
  analysisType?: 'resume' | 'transcript'
}) {
  const { notify } = useToast()
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<LatestAnalysis | null>(null)
  const [revaluating, setRevaluating] = useState(false)
  const [candidateData, setCandidateData] = useState<any>(null)
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [uploadingTranscript, setUploadingTranscript] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([
      getLatestAnalysis(stageId, { applicationStageId }),
      fetch(`/api/applications/${applicationId}`, { credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (data.item?.candidate) {
            return data.item.candidate
          }
          return fetch(
            `/api/candidates?search=${encodeURIComponent(candidate.email || candidate.id)}`,
            { credentials: 'same-origin' },
          )
            .then((r) => r.json())
            .then((data) => data.items?.[0] || null)
        })
        .catch((error) => {
          console.error('Erro ao carregar dados do candidato:', error)
          return null
        }),
    ])
      .then(([analysisResult, cData]) => {
        setAnalysis(analysisResult)
        setCandidateData(cData)
      })
      .catch((e) => {
        console.error('Erro ao carregar informações:', e)
        notify({
          title: 'Erro ao carregar informações',
          description: e?.message,
          variant: 'error',
        })
      })
      .finally(() => setLoading(false))
  }, [open, stageId, applicationStageId, applicationId, candidate.email, candidate.id, notify])

  async function handleReevaluate() {
    setRevaluating(true)
    try {
      setAnalysis({ status: 'running' } as LatestAnalysis)
      await evaluate(stageId, {
        application_id: applicationId,
        application_stage_id: applicationStageId,
        candidate_id: candidate.id,
      })
      notify({ title: 'Análise iniciada', description: 'A IA está processando o currículo.', variant: 'success' })
      setTimeout(async () => {
        const latest = await getLatestAnalysis(stageId, { applicationStageId })
        setAnalysis(latest)
      }, 2000)
    } catch (e: any) {
      notify({ title: 'Falha na análise', description: e?.message, variant: 'error' })
    } finally {
      setRevaluating(false)
    }
  }

  async function handleAnalyzeTranscript() {
    if (!transcriptFile) {
      notify({ title: 'Arquivo obrigatório', description: 'Anexe a transcrição antes de analisar.', variant: 'error' })
      return
    }
    
    setUploadingTranscript(true)
    try {
      // Upload do arquivo de transcrição
      const contentType = transcriptFile.type || 
        (transcriptFile.name.endsWith('.pdf') ? 'application/pdf' :
        transcriptFile.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
        transcriptFile.name.endsWith('.doc') ? 'application/msword' :
        transcriptFile.name.endsWith('.json') ? 'application/json' : 'application/pdf')
      
      const uploadRes = await fetch('/api/uploads/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: transcriptFile.name, content_type: contentType, for_stage: true }),
      })
      const uploadJson = await uploadRes.json()
      
      // Upload para URL assinada
      await fetch(uploadJson.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType, 'Cache-Control': 'max-age=3600' },
        body: transcriptFile,
      })

      // Iniciar análise com a transcrição
      setAnalysis({ status: 'running' } as LatestAnalysis)
      await evaluate(stageId, {
        application_id: applicationId,
        application_stage_id: applicationStageId,
        candidate_id: candidate.id,
        document_path: uploadJson.path,
        document_signed_url: uploadJson.view_url,
      })
      
      notify({ title: 'Análise iniciada', description: 'A IA está processando a transcrição.', variant: 'success' })
      setTranscriptFile(null)
      
      setTimeout(async () => {
        const latest = await getLatestAnalysis(stageId, { applicationStageId })
        setAnalysis(latest)
      }, 2000)
    } catch (e: any) {
      notify({ title: 'Falha na análise', description: e?.message, variant: 'error' })
    } finally {
      setUploadingTranscript(false)
    }
  }

  const resumeUrl = useMemo(() => {
    if (!candidateData?.resume_path || !candidateData?.resume_bucket) return null
    return `/api/candidates/resume?path=${encodeURIComponent(candidateData.resume_path)}&bucket=${candidateData.resume_bucket}`
  }, [candidateData?.resume_path, candidateData?.resume_bucket])

  const analysisStatus = analysis?.status || null
  const isAnalysisRunning = analysisStatus === 'running'
  const hasResult = Boolean(analysis?.result && analysisStatus === 'succeeded')

  useEffect(() => {
    if (!open) return
    if (analysisStatus !== 'running') return

    const timeout = window.setTimeout(async () => {
      try {
        const latest = await getLatestAnalysis(stageId, { applicationStageId })
        if (latest) {
          setAnalysis(latest)
        } else {
          setAnalysis(null)
        }
      } catch (error) {
        console.error('Erro ao atualizar análise em processamento:', error)
      }
    }, 4000)

    return () => window.clearTimeout(timeout)
  }, [open, analysisStatus, stageId, applicationStageId])

  if (!open) return null

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{candidate.name || candidate.id}</h3>
            {candidate.email && <p className="text-sm text-gray-600">{candidate.email}</p>}
            {candidateData?.phone && <p className="text-sm text-gray-600 mt-1">📞 {candidateData.phone}</p>}
            {candidateData?.city && (
              <p className="text-sm text-gray-600 mt-1">
                📍 {candidateData.city}
                {candidateData?.state ? `, ${candidateData.state}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {analysisType === 'resume' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (resumeUrl) window.open(resumeUrl, '_blank', 'noopener,noreferrer')
                  }}
                  disabled={!resumeUrl}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  📄 Ver currículo
                </button>
                <button
                  type="button"
                  onClick={handleReevaluate}
                  disabled={revaluating}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
                >
                  {revaluating ? 'Analisando...' : '⚡ Analisar com IA'}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100"
            >
              Fechar detalhes
            </button>
          </div>
        </div>

        {/* Upload de Transcrição - apenas para etapas de transcrição */}
        {analysisType === 'transcript' && (
          <div className="mt-6 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50 p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🎤</span>
              <div className="flex-1">
                <h4 className="font-semibold text-purple-900">Análise de Transcrição</h4>
                <p className="text-sm text-purple-700 mt-1">
                  Anexe a transcrição da entrevista para que a IA possa analisá-la.
                </p>
                
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-purple-800 mb-2">
                      Arquivo de transcrição (PDF, DOCX, DOC, JSON)
                    </label>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/json"
                      onChange={(e) => setTranscriptFile(e.target.files?.[0] || null)}
                      className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-purple-600 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-purple-700"
                    />
                    {transcriptFile && (
                      <p className="mt-2 text-sm text-purple-700">
                        ✓ Arquivo selecionado: {transcriptFile.name} ({(transcriptFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    )}
                </div>
                  
                  <button
                    type="button"
                    onClick={handleAnalyzeTranscript}
                    disabled={!transcriptFile || uploadingTranscript}
                    className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploadingTranscript ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Enviando...
                      </>
                    ) : (
                      <>
                        🎤 Analisar Transcrição
                      </>
                    )}
                  </button>
                  </div>
                  </div>
                </div>
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Informações</h4>
            <dl className="mt-3 space-y-2 text-sm text-gray-700">
              <div>
                <dt className="font-medium text-gray-600">Nome completo</dt>
                <dd>{candidateData?.name || candidate.name || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">E-mail</dt>
                <dd>{candidateData?.email || candidate.email || '—'}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">Idiomas</dt>
                <dd>
                  {candidateData?.languages?.length
                    ? candidateData.languages.join(', ')
                    : 'Não informado'}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-gray-600">Formação</dt>
                <dd>{candidateData?.education || 'Não informado'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resumo da análise</h4>
            {loading ? (
              <div className="mt-3 text-sm text-gray-500">Carregando análise do candidato...</div>
            ) : isAnalysisRunning ? (
              <div className="mt-3 space-y-3 rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">Análise em andamento...</p>
                <p className="text-emerald-800/80">
                  Assim que a IA terminar o processamento, o resultado aparecerá aqui automaticamente.
                </p>
              </div>
            ) : hasResult ? (
              <div className="mt-3 space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-bold text-emerald-600">
                    {typeof analysis?.result?.score === 'number' ? analysis.result.score.toFixed(1) : '—'}
                  </span>
                  <span className="text-sm text-gray-500">pontos</span>
                </div>
                <p className="text-xs text-gray-500">
                  Última análise em{' '}
                  {analysis?.created_at
                    ? new Date(analysis.created_at).toLocaleString('pt-BR')
                    : 'data não disponível'}
                </p>
                {analysis?.result?.analysis && (
                  <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-wrap">
                    {analysis.result.analysis}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-500">
                Nenhum relatório da IA encontrado para este candidato nesta etapa.
              </div>
            )}
          </div>
        </div>

        {hasResult && analysis?.result && (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                Pontos fortes
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-emerald-800">
                {analysis.result.strengths && analysis.result.strengths.length > 0 ? (
                  analysis.result.strengths.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 text-lg leading-none">✓</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li>—</li>
            )}
              </ul>
          </div>

            <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                A desenvolver
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-amber-800">
                {analysis.result.weaknesses && analysis.result.weaknesses.length > 0 ? (
                  analysis.result.weaknesses.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-0.5 text-lg leading-none">•</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li>—</li>
                )}
              </ul>
          </div>
        </div>
        )}

        {analysis?.result?.recommendations && analysis.result.recommendations.length > 0 && (
          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-blue-700">Recomendações</h4>
            <ul className="mt-3 space-y-3 text-sm text-blue-900">
              {analysis.result.recommendations.map((rec, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-0.5 text-base leading-none">💡</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
