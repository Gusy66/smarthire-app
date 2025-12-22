'use client'

import { useEffect, useState, useCallback } from 'react'

type CandidateDetail = {
  id: string
  name: string
  email?: string
  phone?: string
  city?: string
  state?: string
  address?: string
  gender?: string
  education?: string
  languages?: string[]
  children?: number
  resume_path?: string
  resume_bucket?: string
  created_at: string
}

type StageInfo = {
  id: string
  name: string
  order_index: number
  description?: string
  status: 'not_started' | 'pending' | 'running' | 'succeeded' | 'failed'
  application_stage_id?: string
  decided_at?: string
}

type ApplicationInfo = {
  id: string
  job_id: string
  job_title: string
  job_status: string
  created_at: string
  current_stage: StageInfo | null
  all_stages: StageInfo[]
  final_status: 'pending' | 'approved' | 'rejected'
}

type HistoryItem = {
  date: string
  action: string
  description: string
  type: 'audit' | 'stage'
  job_title?: string
}

type DocumentItem = {
  id: string
  type: string
  storage_path: string
  created_at: string
}

type AIAnalysis = {
  job_title: string
  stage_name: string
  stage_order: number
  score: number | null
  comment: string | null
  analyzed_at: string
  requirements_scores: any[]
  raw_result?: any
}

type CandidateFullData = {
  candidate: CandidateDetail
  applications: ApplicationInfo[]
  history: HistoryItem[]
  documents: DocumentItem[]
  ai_analyses: AIAnalysis[]
}

type Props = {
  candidateId: string
  onClose: () => void
  onUpdate?: () => void
}

type TabType = 'historico' | 'anexos' | 'analise'

export default function CandidateDetailModal({ candidateId, onClose, onUpdate }: Props) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<CandidateFullData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('historico')
  const [selectedApp, setSelectedApp] = useState<ApplicationInfo | null>(null)
  const [infoCollapsed, setInfoCollapsed] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/candidates/${candidateId}`, { credentials: 'same-origin' })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData?.error?.message || 'Erro ao carregar dados')
      }
      const json = await res.json()
      setData(json)
      // Selecionar primeira aplicação por padrão
      if (json.applications?.length > 0) {
        setSelectedApp(json.applications[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }, [candidateId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Ação de aprovar/reprovar
  async function handleStatusChange(applicationId: string, stageId: string, newStatus: 'succeeded' | 'failed') {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/applications/stages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          application_id: applicationId,
          stage_id: stageId,
          status: newStatus,
        }),
      })
      if (res.ok) {
        await loadData()
        onUpdate?.()
      }
    } catch (err) {
      console.error('Erro ao atualizar status:', err)
    } finally {
      setActionLoading(false)
    }
  }

  function formatDate(dateStr?: string): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function formatDateShort(dateStr?: string): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr)
    return d.toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dados do candidato...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Erro ao carregar dados'}</p>
          <button onClick={onClose} className="text-blue-600 hover:underline">Voltar</button>
        </div>
      </div>
    )
  }

  const { candidate, applications, history, documents, ai_analyses } = data
  const currentApp = selectedApp || applications[0] || null

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-hidden flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-gray-200 bg-white px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">{candidate.name}</h1>
              {currentApp && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {currentApp.job_title}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    currentApp.final_status === 'approved' ? 'bg-emerald-100 text-emerald-800' :
                    currentApp.final_status === 'rejected' ? 'bg-red-100 text-red-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {currentApp.final_status === 'approved' ? 'Aprovado' :
                     currentApp.final_status === 'rejected' ? 'Reprovado' : 'Em Análise'}
                  </span>
                </div>
              )}
            </div>
          </div>
          
          {/* Ações */}
          {currentApp && currentApp.current_stage && (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => handleStatusChange(currentApp.id, currentApp.current_stage!.id, 'failed')}
                disabled={actionLoading || currentApp.current_stage.status === 'failed'}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Reprovar</span>
              </button>
              <button
                onClick={() => handleStatusChange(currentApp.id, currentApp.current_stage!.id, 'succeeded')}
                disabled={actionLoading || currentApp.current_stage.status === 'succeeded'}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Aprovar</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Pipeline Visual */}
      {currentApp && currentApp.all_stages.length > 0 && (
        <div className="flex-shrink-0 bg-gradient-to-r from-cyan-400 to-teal-400 px-4 sm:px-6 py-3 overflow-x-auto">
          <div className="flex items-center gap-0 min-w-max">
            {currentApp.all_stages.map((stage, index) => {
              const isActive = currentApp.current_stage?.id === stage.id
              const isPast = stage.status === 'succeeded'
              const isFailed = stage.status === 'failed'
              
              return (
                <div key={stage.id} className="flex items-center">
                  <div
                    className={`
                      relative px-4 sm:px-6 py-2 text-xs sm:text-sm font-medium whitespace-nowrap
                      ${isActive ? 'bg-teal-600 text-white' : 
                        isPast ? 'bg-teal-500/80 text-white' :
                        isFailed ? 'bg-red-500/80 text-white' :
                        'bg-cyan-300/60 text-cyan-900'}
                      ${index === 0 ? 'rounded-l-lg' : ''}
                      ${index === currentApp.all_stages.length - 1 ? 'rounded-r-lg' : ''}
                    `}
                  >
                    {stage.name}
                    {isActive && (
                      <span className="ml-1.5 text-[10px] opacity-80">
                        ({getDaysInStage(stage)} dia{getDaysInStage(stage) !== 1 ? 's' : ''})
                      </span>
                    )}
                  </div>
                  {index < currentApp.all_stages.length - 1 && (
                    <div className="text-cyan-200 -mx-1 z-10">
                      <svg className="w-4 h-8" viewBox="0 0 16 32" fill="currentColor">
                        <path d="M0 0 L16 16 L0 32 Z" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            
            {/* Coluna Esquerda - Informações */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border border-gray-200 bg-white">
                <button
                  onClick={() => setInfoCollapsed(!infoCollapsed)}
                  className="w-full flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 text-left"
                >
                  <span className="font-semibold text-gray-900">Informações do Candidato</span>
                  <svg
                    className={`w-5 h-5 text-gray-500 transition-transform ${infoCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                
                {!infoCollapsed && (
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 space-y-3 border-t border-gray-100 pt-3">
                    <InfoRow label="Nome" value={candidate.name} />
                    <InfoRow label="E-mail" value={candidate.email} />
                    <InfoRow label="Telefone" value={candidate.phone} />
                    <InfoRow label="Cidade" value={candidate.city} />
                    <InfoRow label="Estado" value={candidate.state} />
                    {candidate.address && <InfoRow label="Endereço" value={candidate.address} />}
                    {candidate.gender && <InfoRow label="Gênero" value={candidate.gender} />}
                    {candidate.children != null && <InfoRow label="Filhos" value={String(candidate.children)} />}
                    {candidate.education && <InfoRow label="Formação" value={candidate.education} />}
                    {candidate.languages && candidate.languages.length > 0 && (
                      <InfoRow label="Idiomas" value={candidate.languages.join(', ')} />
                    )}
                    <InfoRow label="Cadastrado em" value={formatDateShort(candidate.created_at)} />
                    
                    {candidate.resume_path && (
                      <div className="pt-2 border-t border-gray-100">
                        <a
                          href={`/api/candidates/resume?path=${encodeURIComponent(candidate.resume_path)}&bucket=${encodeURIComponent(candidate.resume_bucket || 'resumes')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          Ver Currículo
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Seletor de Vagas (se houver mais de uma) */}
              {applications.length > 1 && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vaga Selecionada
                  </label>
                  <select
                    value={selectedApp?.id || ''}
                    onChange={(e) => {
                      const app = applications.find((a) => a.id === e.target.value)
                      setSelectedApp(app || null)
                    }}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    {applications.map((app) => (
                      <option key={app.id} value={app.id}>
                        {app.job_title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Coluna Direita - Tabs e Conteúdo */}
            <div className="lg:col-span-2">
              {/* Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="flex gap-6 -mb-px">
                  <TabButton active={activeTab === 'historico'} onClick={() => setActiveTab('historico')}>
                    Histórico
                  </TabButton>
                  <TabButton active={activeTab === 'anexos'} onClick={() => setActiveTab('anexos')}>
                    Anexos
                  </TabButton>
                  <TabButton active={activeTab === 'analise'} onClick={() => setActiveTab('analise')}>
                    Análise IA
                  </TabButton>
                </nav>
              </div>

              {/* Conteúdo das Tabs */}
              <div className="rounded-xl border border-gray-200 bg-white">
                {activeTab === 'historico' && (
                  <HistoryTab history={history} formatDate={formatDate} />
                )}
                {activeTab === 'anexos' && (
                  <AttachmentsTab 
                    documents={documents} 
                    resumePath={candidate.resume_path}
                    resumeBucket={candidate.resume_bucket}
                    formatDate={formatDateShort}
                  />
                )}
                {activeTab === 'analise' && (
                  <AIAnalysisTab 
                    analyses={ai_analyses} 
                    currentApp={currentApp}
                    formatDate={formatDate}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Componentes auxiliares

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-sm text-gray-500 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right break-words">{value || '—'}</span>
    </div>
  )
}

function TabButton({ 
  active, 
  onClick, 
  children 
}: { 
  active: boolean
  onClick: () => void
  children: React.ReactNode 
}) {
  return (
    <button
      onClick={onClick}
      className={`
        pb-3 text-sm font-medium border-b-2 transition-colors
        ${active 
          ? 'border-teal-500 text-teal-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
      `}
    >
      {children}
    </button>
  )
}

function HistoryTab({ 
  history, 
  formatDate 
}: { 
  history: HistoryItem[]
  formatDate: (d?: string) => string 
}) {
  if (history.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p>Nenhum histórico registrado</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {history.map((item, index) => (
        <div key={index} className="px-4 sm:px-6 py-4 flex items-start gap-3">
          <div className={`
            w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5
            ${item.action.includes('approved') || item.action.includes('succeeded') ? 'bg-emerald-100 text-emerald-600' :
              item.action.includes('rejected') || item.action.includes('failed') ? 'bg-red-100 text-red-600' :
              'bg-gray-100 text-gray-600'
            }
          `}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-900">{item.description}</p>
            {item.job_title && (
              <p className="text-xs text-gray-500 mt-0.5">Vaga: {item.job_title}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">{formatDate(item.date)}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function AttachmentsTab({ 
  documents,
  resumePath,
  resumeBucket,
  formatDate 
}: { 
  documents: DocumentItem[]
  resumePath?: string
  resumeBucket?: string
  formatDate: (d?: string) => string 
}) {
  const allDocs = [...documents]
  
  // Adicionar CV se existir e não estiver na lista
  if (resumePath && !documents.some(d => d.storage_path === resumePath)) {
    allDocs.unshift({
      id: 'resume',
      type: 'resume',
      storage_path: resumePath,
      created_at: new Date().toISOString(),
    })
  }

  if (allDocs.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>Nenhum anexo encontrado</p>
      </div>
    )
  }

  // Determinar bucket baseado no tipo do documento
  function getBucket(doc: DocumentItem): string {
    if (doc.type === 'resume') return resumeBucket || 'resumes'
    if (doc.type === 'transcript') return 'transcripts'
    return 'stage-documents'
  }

  return (
    <div className="divide-y divide-gray-100">
      {allDocs.map((doc) => (
        <div key={doc.id} className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {doc.type === 'resume' ? 'Currículo' : 
                 doc.type === 'transcript' ? 'Transcrição' : 
                 doc.type}
              </p>
              <p className="text-xs text-gray-500">{formatDate(doc.created_at)}</p>
            </div>
          </div>
          <a
            href={`/api/candidates/resume?path=${encodeURIComponent(doc.storage_path)}&bucket=${encodeURIComponent(getBucket(doc))}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
        </div>
      ))}
    </div>
  )
}

function AIAnalysisTab({ 
  analyses,
  currentApp,
  formatDate 
}: { 
  analyses: AIAnalysis[]
  currentApp: ApplicationInfo | null
  formatDate: (d?: string) => string 
}) {
  // Filtrar análises da aplicação atual
  const filteredAnalyses = currentApp 
    ? analyses.filter(a => a.job_title === currentApp.job_title)
    : analyses

  if (filteredAnalyses.length === 0) {
    return (
      <div className="p-6 text-center text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p>Nenhuma análise de IA realizada</p>
        <p className="text-sm mt-1">Execute a análise de IA na etapa do candidato para ver os resultados aqui.</p>
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100">
      {filteredAnalyses.map((analysis, index) => (
        <div key={index} className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h4 className="font-medium text-gray-900">{analysis.stage_name}</h4>
              <p className="text-xs text-gray-500 mt-0.5">Analisado em {formatDate(analysis.analyzed_at)}</p>
            </div>
            {analysis.score != null && (
              <div className="text-right">
                <div className={`text-2xl font-bold ${
                  analysis.score >= 7 ? 'text-emerald-600' :
                  analysis.score >= 5 ? 'text-amber-600' :
                  'text-red-600'
                }`}>
                  {typeof analysis.score === 'number' ? analysis.score.toFixed(1) : analysis.score}
                </div>
                <div className="text-xs text-gray-500">Nota</div>
              </div>
            )}
          </div>

          {analysis.comment && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{analysis.comment}</p>
            </div>
          )}

          {analysis.requirements_scores && analysis.requirements_scores.length > 0 && (
            <div className="space-y-3">
              <h5 className="text-sm font-medium text-gray-700">Pontuação por Requisito</h5>
              {analysis.requirements_scores.map((req: any, reqIndex: number) => {
                const score = req.score ?? req.value ?? 0
                const maxScore = 10
                const percentage = (score / maxScore) * 100
                
                return (
                  <div key={reqIndex}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-600">{req.label || req.requirement || req.name || `Requisito ${reqIndex + 1}`}</span>
                      <span className="font-medium text-gray-900">{score.toFixed?.(1) ?? score}</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          score >= 7 ? 'bg-emerald-500' :
                          score >= 5 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function getDaysInStage(stage: StageInfo): number {
  if (!stage.decided_at) return 0
  const start = new Date(stage.decided_at)
  const now = new Date()
  const diffTime = Math.abs(now.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

