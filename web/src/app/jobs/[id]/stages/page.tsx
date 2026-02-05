'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useToast } from '@/components/ToastProvider'
import StageAnalysisPanel from './_components/StageAnalysisPanel'
import JobStageHeader from './_components/JobStageHeader'
import CandidatesTable from './_components/CandidatesTable'
import EditJobModal from '@/components/EditJobModal'

type Stage = { id: string; name: string; description: string | null; order_index: number; threshold: number; stage_weight: number; analysis_type?: 'resume' | 'transcript' }
type Candidate = { id: string; name: string; email?: string }
type PromptTemplate = { id: string; name: string; is_default: boolean }
type StageAnalysisResult = {
  run_id: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  result?: {
    score?: number
    analysis?: string
    matched_requirements?: string[]
    missing_requirements?: string[]
    strengths?: string[]
    weaknesses?: string[]
    recommendations?: string[]
  }
  application_stage_id?: string
  stage_id?: string | null
  application_id?: string | null
  created_at?: string
}

function StagePromptSelector({
  stageId,
  templates,
  selected,
  loading,
  onChange,
}: {
  stageId: string
  templates: PromptTemplate[]
  selected: string | null
  loading: boolean
  onChange: (stageId: string, templateId: string | null) => Promise<void>
}) {
  const defaultTemplate = templates.find((t) => t.is_default) || null

  return (
    <div className="border-t pt-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="font-medium">Prompt desta etapa</h4>
          <p className="text-sm text-gray-600">
            Escolha o template que instruirá a IA para analisar currículos nesta etapa.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selected ?? ''}
            onChange={(e) => onChange(stageId, e.target.value || null)}
            className="border rounded px-3 py-2 min-w-[220px]"
            disabled={loading}
          >
            <option value="">
              {defaultTemplate ? `Usar padrão (${defaultTemplate.name})` : 'Selecione um template'}
            </option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.is_default ? ' (padrão)' : ''}
              </option>
            ))}
          </select>
          <a href="/settings/prompts" className="text-sm text-blue-600 underline">
            Gerenciar templates
          </a>
        </div>
      </div>
    </div>
  )
}

async function fetchPromptTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch('/api/prompt-templates')
  const json = await res.json()
  if (!res.ok) throw new Error(json?.error?.message || 'Erro ao carregar templates')
  return json.items || []
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...(init || {}),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch (error) {
    if (!res.ok) {
      const message = text || res.statusText || 'Erro de API'
      throw new Error(message)
    }
    throw error
  }
  if (!res.ok) {
    const message = json?.error?.message || text || res.statusText || 'Erro de API'
    throw new Error(message)
  }
  return (json ?? {}) as T
}

const ESTIMATED_MINUTES = {
  resume: 10,
  transcript: 20,
  proof: 10,
} as const

const HOURLY_COST_BRL = 30
const PLAN_MONTHLY_COST_BRL = 299

function formatCurrencyBRL(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDuration(ms: number | null) {
  if (!ms || ms <= 0) return '—'
  const totalMinutes = Math.round(ms / 60000)
  if (totalMinutes < 60) return `${totalMinutes} min`
  const totalHours = Math.round(totalMinutes / 60)
  if (totalHours < 24) return `${totalHours}h`
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

function formatMinutesToHours(totalMinutes: number) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return '0 min'
  const hours = Math.floor(totalMinutes / 60)
  const minutes = Math.round(totalMinutes % 60)
  if (hours <= 0) return `${minutes} min`
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`
}

function getStageEffortMinutes(stage: Stage) {
  const name = stage.name?.toLowerCase() || ''
  if (stage.analysis_type === 'resume') return ESTIMATED_MINUTES.resume
  if (stage.analysis_type === 'transcript') return ESTIMATED_MINUTES.transcript
  if (name.includes('prova') || name.includes('teste')) return ESTIMATED_MINUTES.proof
  if (name.includes('entrevista')) return ESTIMATED_MINUTES.transcript
  return ESTIMATED_MINUTES.resume
}

export default function JobStagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { notify } = useToast()
  const [jobId, setJobId] = useState<string | null>(null)
  const [stages, setStages] = useState<Stage[]>([])
  const [jobInfo, setJobInfo] = useState<{
    id: string
    title: string
    created_at?: string | null
    status?: string | null
    department?: string | null
    location?: string | null
    salary?: string | null
    job_description?: string | null
    responsibilities?: string | null
    requirements_and_skills?: string | null
    public_token?: string | null
  } | null>(null)
  const [showEditJobModal, setShowEditJobModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [activeMainTab, setActiveMainTab] = useState<'candidatos' | 'etapas' | 'analytics' | 'info'>('candidatos')
  const [board, setBoard] = useState<{
    lanes: Record<
      string,
      {
        application_id: string
        application_stage_id: string
        candidate: any
        score: number | null
        stage_id: string
        evaluation_count?: number
        application_created_at?: string | null
      }[]
    >
    stages: Stage[]
    evaluation_counts_by_stage_id?: Record<string, number>
    latest_scores_by_application_id?: Record<string, number>
    stage_scores_by_stage_id?: Record<string, number[]>
  } | null>(null)
  const [panelData, setPanelData] = useState<{
    stages: { id: string; stage_weight: number }[]
    items: { stages: { stage_id: string; score: number }[] }[]
  } | null>(null)
  const [publicLink, setPublicLink] = useState<string | null>(null)
  const [selectedForBulk, setSelectedForBulk] = useState<Record<string, boolean>>({})
  const [currentItem, setCurrentItem] = useState<{ application_id: string; application_stage_id: string; candidate: { id: string; name?: string } } | null>(null)
  const [stageForm, setStageForm] = useState({ name: '', description: '', threshold: 0, stage_weight: 1 })
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [editingStageForm, setEditingStageForm] = useState<{ name: string; description: string; threshold: number; stage_weight: number; analysis_type: 'resume' | 'transcript' }>({
    name: '',
    description: '',
    threshold: 0,
    stage_weight: 1,
    analysis_type: 'resume',
  })
  const [updatingStage, setUpdatingStage] = useState(false)

  // Candidates assigned to the job (simplificado: todos candidatos do tenant)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [applications, setApplications] = useState<any[]>([])
  
  // Candidato selecionado para cada etapa
  const [stageSelectedCandidates, setStageSelectedCandidates] = useState<Record<string, string | null>>({})
  const [promptTemplates, setPromptTemplates] = useState<PromptTemplate[]>([])
  const [stagePromptMap, setStagePromptMap] = useState<Record<string, string | null>>({})
  const [promptLoadingStage, setPromptLoadingStage] = useState<string | null>(null)
  const [analysisByStage, setAnalysisByStage] = useState<Record<string, StageAnalysisResult | null>>({})
  const [analysisLoading, setAnalysisLoading] = useState<Record<string, boolean>>({})
  const [analysisExpanded, setAnalysisExpanded] = useState<Record<string, boolean>>({})
  const pollingTimeouts = useRef<Record<string, number>>({})
  const [stageEvaluationCounts, setStageEvaluationCounts] = useState<Record<string, number>>({})
  const [latestScoresByApplication, setLatestScoresByApplication] = useState<Record<string, number>>({})
  const refreshBoard = useCallback(async () => {
    if (!jobId) return
    const b = await api<{ lanes: any; stages: Stage[]; evaluation_counts_by_stage_id?: Record<string, number>; latest_scores_by_application_id?: Record<string, number> }>(`/api/jobs/${jobId}/board`).catch(() => null)
    if (b) {
      setBoard(b as any)
      setStageEvaluationCounts((b as any).evaluation_counts_by_stage_id ?? {})
      setLatestScoresByApplication((b as any).latest_scores_by_application_id ?? {})
    }
    const panel = await api<{ stages: { id: string; stage_weight: number }[]; items: { stages: { stage_id: string; score: number }[] }[] }>(`/api/jobs/${jobId}/panel`).catch(() => null)
    if (panel) setPanelData(panel)
  }, [jobId])
  
  // Estado para atribuição de candidatos
  const [candidateSearchQuery, setCandidateSearchQuery] = useState('')
  const [selectedCandidatesToAssign, setSelectedCandidatesToAssign] = useState<Record<string, boolean>>({})
  const [assigningCandidates, setAssigningCandidates] = useState(false)
  const [showCandidateAssignment, setShowCandidateAssignment] = useState(false)
  const [candidatesSort, setCandidatesSort] = useState<'name' | 'score'>('name')
  
  // Estado para modal de adicionar etapa
  const [showAddStageModal, setShowAddStageModal] = useState(false)
  const [newStageForm, setNewStageForm] = useState({
    name: '',
    description: '',
    threshold: 7,
    stage_weight: 1,
    analysis_type: 'resume' as 'resume' | 'transcript',
    prompt_template_id: null as string | null,
  })

  const clearStagePolling = useCallback((stageId: string) => {
    const existing = pollingTimeouts.current[stageId]
    if (existing) {
      window.clearTimeout(existing)
      delete pollingTimeouts.current[stageId]
    }
  }, [])

  useEffect(() => {
    return () => {
      Object.values(pollingTimeouts.current).forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [])

  const defaultPromptTemplate = useMemo(
    () => promptTemplates.find((template) => template.is_default) || null,
    [promptTemplates]
  )

  const orderedStages = useMemo(() => {
    return [...stages].sort((a, b) => a.order_index - b.order_index)
  }, [stages])

  const stageById = useMemo(() => {
    const map: Record<string, Stage> = {}
    stages.forEach((stage) => {
      map[stage.id] = stage
    })
    return map
  }, [stages])

  const laneItemByApplicationId = useMemo(() => {
    const map: Record<string, { stage_id: string; score: number | null; candidate: any; application_stage_id: string }> = {}
    if (board?.lanes) {
      Object.values(board.lanes).forEach((items) => {
        items.forEach((item) => {
          map[item.application_id] = {
            stage_id: item.stage_id,
            score: item.score,
            candidate: item.candidate,
            application_stage_id: item.application_stage_id,
          }
        })
      })
    }
    return map
  }, [board])

  const candidateRows = useMemo(() => {
    return applications.map((app) => {
      const laneItem = laneItemByApplicationId[app.id]
      const stage = laneItem?.stage_id ? stageById[laneItem.stage_id] : null
      const candidateName = app.candidate?.name || laneItem?.candidate?.name || 'Sem nome'
      const candidateEmail = app.candidate?.email || laneItem?.candidate?.email || ''

      const fallbackScore = latestScoresByApplication[app.id] ?? null
      return {
        applicationId: app.id,
        candidateId: app.candidate_id,
        name: candidateName,
        email: candidateEmail,
        stageId: laneItem?.stage_id ?? null,
        stageName: stage?.name ?? null,
        score: laneItem?.score ?? fallbackScore,
        appliedAt: app.created_at,
        status: laneItem ? 'Ativo' : 'Não ativo',
      }
    })
  }, [applications, laneItemByApplicationId, stageById, latestScoresByApplication])

  const sortedCandidateRows = useMemo(() => {
    const list = [...candidateRows]
    list.sort((a, b) => {
      if (candidatesSort === 'score') {
        const aScore = typeof a.score === 'number' ? a.score : -Infinity
        const bScore = typeof b.score === 'number' ? b.score : -Infinity
        if (bScore !== aScore) return bScore - aScore
      }
      const aName = (a.name || '').toLowerCase()
      const bName = (b.name || '').toLowerCase()
      return aName.localeCompare(bName, 'pt-BR')
    })
    return list
  }, [candidateRows, candidatesSort])

  const firstStageId = orderedStages[0]?.id ?? null
  const totalCandidates = candidateRows.length
  const newCandidatesCount = firstStageId ? (board?.lanes?.[firstStageId]?.length ?? 0) : 0
  const advancedCandidatesCount = Math.max(totalCandidates - newCandidatesCount, 0)
  const inactiveCandidatesCount = candidateRows.filter((row) => row.status === 'Não ativo').length

  const analyticsData = useMemo(() => {
    const now = Date.now()
    const stageList = orderedStages
    const approvedCount = applications.filter((app) => app.status === 'approved').length
    const conversionRate = totalCandidates > 0 ? (approvedCount / totalCandidates) * 100 : 0

    const applicationTimes = applications
      .map((app) => (app?.created_at ? new Date(app.created_at).getTime() : null))
      .filter((value): value is number => Boolean(value))
    const earliestApplication = applicationTimes.length ? Math.min(...applicationTimes) : null
    const jobCreatedAt = jobInfo?.created_at ? new Date(jobInfo.created_at).getTime() : earliestApplication
    const timeOpenMs = jobCreatedAt ? now - jobCreatedAt : null

    const approvedApps = applications.filter((app) => app.status === 'approved')
    const approvalDurations = approvedApps
      .map((app) => {
        const approvedAt = app.approved_at ? new Date(app.approved_at).getTime() : null
        if (!approvedAt || !jobCreatedAt) return null
        return Math.max(0, approvedAt - jobCreatedAt)
      })
      .filter((value): value is number => typeof value === 'number')
    const slaMs =
      approvalDurations.length > 0
        ? approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length
        : null

    // --- Índice de aderência por etapa (top 20% de cada etapa)
    const stageScoreSummary = stageList.map((stage) => {
      const stageScores =
        board?.stage_scores_by_stage_id?.[stage.id] ??
        (board?.lanes?.[stage.id] ?? [])
          .map((item) => item.score)
          .filter((score): score is number => typeof score === 'number')
      const avg =
        stageScores.length > 0 ? stageScores.reduce((sum, score) => sum + score, 0) / stageScores.length : null
      const topCount = stageScores.length ? Math.max(1, Math.ceil(stageScores.length * 0.2)) : 0
      const topScores = [...stageScores].sort((a, b) => b - a).slice(0, topCount)
      const adherenceTop20 = topScores.length ? topScores.reduce((s, v) => s + v, 0) / topScores.length : null
      return { stageId: stage.id, stageName: stage.name, averageScore: avg, adherenceScore: adherenceTop20 }
    })

    // --- Índice de aderência total da vaga (top 20% do ranking ponderado por stage_weight)
    const rankingScores = (() => {
      if (panelData?.items?.length && panelData?.stages?.length) {
        const totalWeight = panelData.stages.reduce((sum, stage) => sum + (stage.stage_weight || 0), 0) || 1
        return panelData.items
          .map((row) => {
            const totalScore = panelData.stages.reduce((sum, stage) => {
              const stageData = row.stages.find((x) => x.stage_id === stage.id)
              return sum + (stageData?.score || 0) * stage.stage_weight
            }, 0)
            return totalWeight > 0 ? totalScore / totalWeight : 0
          })
          .filter((score) => Number.isFinite(score))
      }
      const stageWeightTotal = stageList.reduce((sum, stage) => sum + (stage.stage_weight || 0), 0) || 1
      const scoresByApplication = new Map<
        string,
        { sumWeighted: number; totalWeight: number }
      >()
      stageList.forEach((stage) => {
        const items = board?.lanes?.[stage.id] ?? []
        items.forEach((item: any) => {
          if (typeof item.score === 'number') {
            const entry = scoresByApplication.get(item.application_id) || { sumWeighted: 0, totalWeight: stageWeightTotal }
            entry.sumWeighted += item.score * stage.stage_weight
            scoresByApplication.set(item.application_id, entry)
          } else {
            if (!scoresByApplication.has(item.application_id)) {
              scoresByApplication.set(item.application_id, { sumWeighted: 0, totalWeight: stageWeightTotal })
            }
          }
        })
      })
      return Array.from(scoresByApplication.values()).map((entry) =>
        entry.totalWeight > 0 ? entry.sumWeighted / entry.totalWeight : 0
      )
    })()

    const hasScores = rankingScores.length > 0
    const topCountTotal = hasScores ? Math.max(1, Math.ceil(rankingScores.length * 0.2)) : 0
    const topScoresTotal = [...rankingScores].sort((a, b) => b - a).slice(0, topCountTotal)
    const adherenceScore = topScoresTotal.length
      ? topScoresTotal.reduce((sum, score) => sum + score, 0) / topScoresTotal.length
      : 0
    const hasAdherence = topScoresTotal.length > 0
    const averageScore = hasScores
      ? rankingScores.reduce((sum, score) => sum + score, 0) / rankingScores.length
      : 0

    const adherenceLabel =
      adherenceScore < 6.9 ? 'Precisa melhorar' : adherenceScore < 8 ? 'Médio' : 'Top'

    const stageEffortSummary = stageList.map((stage) => {
      const minutesPerCandidate = getStageEffortMinutes(stage)
      const isResumeStage = stage.analysis_type === 'resume' || stage.name?.toLowerCase().includes('curr')
      const evaluations =
        stageEvaluationCounts[stage.id] ??
        (board?.lanes?.[stage.id] ?? []).reduce((sum, item) => {
          const count = item.evaluation_count ?? (item.score != null ? 1 : 0)
          return sum + count
        }, 0)
      const count = isResumeStage ? evaluations : 0
      const totalMinutes = count * minutesPerCandidate
      const totalHours = totalMinutes / 60
      return { stageId: stage.id, stageName: stage.name, count, minutesPerCandidate, totalMinutes, totalHours, isResumeStage }
    })

    const totalMinutesSaved = stageEffortSummary.reduce((sum, entry) => sum + entry.totalMinutes, 0)
    const totalHoursSaved = totalMinutesSaved / 60
    const resumeEvaluations = stageEffortSummary.reduce((sum, entry) => sum + (entry.isResumeStage ? entry.count : 0), 0)
    const costSaved = resumeEvaluations * (ESTIMATED_MINUTES.resume / 60) * HOURLY_COST_BRL

    return {
      conversionRate,
      finalStageCount: approvedCount,
      timeOpenMs,
      slaMs,
      averageScore,
      hasScores,
      adherenceScore,
      hasAdherence,
      adherenceLabel,
      stageScoreSummary,
      stageEffortSummary,
      totalMinutesSaved,
      totalHoursSaved,
      resumeEvaluations,
      costSaved,
    }
  }, [orderedStages, board, totalCandidates, applications, jobInfo, stageEvaluationCounts, panelData])

  // Poll board when there is any analysis running
  useEffect(() => {
    const hasRunning =
      board &&
      Object.values(board.lanes || {}).some((items: any) =>
        (items as any[]).some((it) => it.run_status === 'running')
      )
    if (!hasRunning) return
    const id = window.setInterval(() => {
      refreshBoard()
    }, 4000)
    return () => window.clearInterval(id)
  }, [board, refreshBoard])

  const loadJobInfo = useCallback(async (id: string) => {
    const job = await api<{ item?: { id: string; title: string; created_at?: string | null; status?: string | null; department?: string | null; location?: string | null; salary?: string | null; job_description?: string | null; responsibilities?: string | null; requirements_and_skills?: string | null; public_token?: string | null } }>(
      `/api/jobs/${id}`
    )
    if (!job?.item) {
      notify({ title: 'Vaga não encontrada', variant: 'error' })
      return null
    }
    setJobInfo(job.item)
    return job.item
  }, [notify])

  useEffect(() => {
    if (!jobInfo?.public_token) {
      setPublicLink(null)
      return
    }
    if (typeof window === 'undefined') return
    const base = window.location.origin
    setPublicLink(`${base}/apply/${jobInfo.public_token}`)
  }, [jobInfo?.public_token])


  useEffect(() => {
    ;(async () => {
      const { id } = await params
      setJobId(id)
      const loaded = await loadJobInfo(id)
      if (!loaded) return

      const { items } = await api<{ items: Stage[] }>(`/api/jobs/${id}/stages`)
      setStages(items)
      setActiveTab(items[0]?.id || null)
      setAnalysisByStage((prev) => {
        const next: Record<string, StageAnalysisResult | null> = {}
        items.forEach((stage) => { next[stage.id] = prev[stage.id] ?? null })
        return next
      })
      setAnalysisLoading((prev) => {
        const next: Record<string, boolean> = {}
        items.forEach((stage) => { next[stage.id] = prev[stage.id] ?? false })
        return next
      })
      setAnalysisExpanded((prev) => {
        const next: Record<string, boolean> = {}
        items.forEach((stage) => { next[stage.id] = prev[stage.id] ?? false })
        return next
      })
      // carregar candidatos (somente do usuário)
      const cand = await api<{ items: Candidate[] }>('/api/candidates').catch(() => ({ items: [] }))
      setCandidates(cand.items || [])
      const apps = await api<{ items: any[] }>(`/api/jobs/${id}/applications`).catch(() => ({ items: [] }))
      setApplications(apps.items || [])
      // carregar board inicial
      try {
        const b = await api<{ lanes: any; stages: Stage[]; evaluation_counts_by_stage_id?: Record<string, number>; latest_scores_by_application_id?: Record<string, number> }>(`/api/jobs/${id}/board`)
        setBoard(b as any)
        setStageEvaluationCounts((b as any).evaluation_counts_by_stage_id ?? {})
        setLatestScoresByApplication((b as any).latest_scores_by_application_id ?? {})
      } catch {}
      try {
        const panel = await api<{ stages: { id: string; stage_weight: number }[]; items: { stages: { stage_id: string; score: number }[] }[] }>(
          `/api/jobs/${id}/panel`
        )
        setPanelData(panel)
      } catch {}
      try {
        const pts = await fetchPromptTemplates()
        setPromptTemplates(pts)
      } catch (error: any) {
        notify({ title: 'Erro ao carregar templates', description: error?.message, variant: 'error' })
      }
    })()
  }, [params, loadJobInfo])


  useEffect(() => {
    stages.forEach((s) => {
      if (!stagePromptMap.hasOwnProperty(s.id)) loadPromptForStage(s.id)
    })
     
  }, [stages])

  async function loadPromptForStage(stageId: string) {
    setPromptLoadingStage(stageId)
    try {
      const res = await fetch(`/api/stages/${stageId}/prompt-template`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao buscar template da etapa')
      setStagePromptMap((prev) => ({ ...prev, [stageId]: json.item?.prompt_template_id ?? null }))
    } catch (error: any) {
      notify({ title: 'Erro ao carregar template da etapa', description: error?.message, variant: 'error' })
    } finally {
      setPromptLoadingStage(null)
    }
  }

  async function handleStagePromptChange(stageId: string, templateId: string | null) {
    setPromptLoadingStage(stageId)
    try {
      const res = await fetch(`/api/stages/${stageId}/prompt-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt_template_id: templateId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao definir template da etapa')
      setStagePromptMap((prev) => ({ ...prev, [stageId]: templateId }))
      notify({ title: 'Template da etapa atualizado', variant: 'success' })
    } catch (error: any) {
      notify({ title: 'Erro ao salvar template', description: error?.message, variant: 'error' })
    } finally {
      setPromptLoadingStage(null)
    }
  }

  async function createStage(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) return
    setCreating(true)
    try {
      const res = await api<{ id: string }>(`/api/jobs/${jobId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stageForm),
      })
      const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`)
      setStages(items)
      setStageForm({ name: '', description: '', threshold: 0, stage_weight: 1 })
      notify({ title: 'Etapa criada', variant: 'success' })
    } finally {
      setCreating(false)
    }
  }

  async function handleAddStage(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) return
    if (!newStageForm.name.trim()) {
      notify({ title: 'Nome obrigatório', description: 'Informe um nome para a etapa.', variant: 'error' })
      return
    }
    setCreating(true)
    try {
      const created = await api<{ id: string }>(`/api/jobs/${jobId}/stages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newStageForm,
          order_index: stages.length, // adiciona no final
        }),
      })
      if (created.id && newStageForm.prompt_template_id) {
        await api(`/api/stages/${created.id}/prompt-template`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt_template_id: newStageForm.prompt_template_id }),
        })
      }
      const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`)
      setStages(items)
      setNewStageForm({
        name: '',
        description: '',
        threshold: 7,
        stage_weight: 1,
        analysis_type: 'resume',
        prompt_template_id: null,
      })
      setShowAddStageModal(false)
      notify({ title: 'Etapa criada com sucesso!', variant: 'success' })
    } catch (error: any) {
      notify({ title: 'Erro ao criar etapa', description: error?.message, variant: 'error' })
    } finally {
      setCreating(false)
    }
  }

  function startEditStage(stage: Stage) {
    setEditingStageId(stage.id)
    setEditingStageForm({
      name: stage.name || '',
      description: stage.description || '',
      threshold: stage.threshold ?? 0,
      stage_weight: stage.stage_weight ?? 1,
      analysis_type: stage.analysis_type ?? 'resume',
    })
  }

  async function handleUpdateStage(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId || !editingStageId) return
    if (!editingStageForm.name.trim()) {
      notify({ title: 'Nome obrigatório', description: 'Informe um nome para a etapa.', variant: 'error' })
      return
    }
    setUpdatingStage(true)
    try {
      await api(`/api/stages/${editingStageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingStageForm.name,
          description: editingStageForm.description,
          threshold: editingStageForm.threshold,
          stage_weight: editingStageForm.stage_weight,
          analysis_type: editingStageForm.analysis_type,
        }),
      })
      const { items } = await api<{ items: Stage[] }>(`/api/jobs/${jobId}/stages`)
      setStages(items)
      notify({ title: 'Etapa atualizada', variant: 'success' })
      setEditingStageId(null)
    } catch (error: any) {
      notify({ title: 'Erro ao atualizar etapa', description: error?.message, variant: 'error' })
    } finally {
      setUpdatingStage(false)
    }
  }

  // Função para obter application_id de um candidato específico
  const getApplicationId = useCallback((candidateId: string | null) => {
    if (!candidateId) return null
    const app = applications.find((a) => a.candidate_id === candidateId)
    return app?.id || null
  }, [applications])

  const loadAnalysisForStage = useCallback(async (stageId: string, candidateId: string | null) => {
    clearStagePolling(stageId)
    if (!candidateId) {
      console.log(`[DEBUG] loadAnalysisForStage: candidato não selecionado para etapa ${stageId}`)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      return
    }
    const applicationId = getApplicationId(candidateId)
    if (!applicationId) {
      console.log(`[DEBUG] loadAnalysisForStage: applicationId não encontrado para candidato ${candidateId}`)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      return
    }
    console.log(`[DEBUG] Carregando análise para etapa ${stageId}, candidato ${candidateId}, applicationId ${applicationId}`)
    setAnalysisLoading((prev) => ({ ...prev, [stageId]: true }))
    try {
      const res = await fetch(`/api/stages/${stageId}/analysis/latest?application_id=${encodeURIComponent(applicationId)}`)
      if (res.status === 404) {
        setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error?.message || 'Erro ao buscar análise da IA')
      }
      const json = await res.json()
      console.log(`[DEBUG] Análise carregada para etapa ${stageId}:`, json.item)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: json.item || null }))

      if (json.item?.status === 'running') {
        pollingTimeouts.current[stageId] = window.setTimeout(() => {
          loadAnalysisForStage(stageId, candidateId)
        }, 4000)
      }
    } catch (error: any) {
      console.error('Erro ao carregar análise da etapa', error)
      notify({
        title: 'Erro ao carregar análise',
        description: error?.message || 'Não foi possível carregar o relatório da IA.',
        variant: 'error',
      })
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
    } finally {
      setAnalysisLoading((prev) => ({ ...prev, [stageId]: false }))
    }
  }, [clearStagePolling, getApplicationId, notify])

  // Função para carregar automaticamente a análise mais recente de cada etapa
  const loadLatestAnalysisForStage = useCallback(async (stageId: string) => {
    console.log(`[DEBUG] Carregando análise mais recente para etapa ${stageId}`)
    setAnalysisLoading((prev) => ({ ...prev, [stageId]: true }))
    try {
      console.log(`[DEBUG] Fazendo requisição para: /api/stages/${stageId}/analysis/latest`)
      const res = await fetch(`/api/stages/${stageId}/analysis/latest`)
      console.log(`[DEBUG] Resposta recebida:`, { status: res.status, ok: res.ok })
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.log(`[DEBUG] Erro na resposta:`, err)
        if (err?.error?.code === 'not_found') {
          console.log(`[DEBUG] Nenhuma análise encontrada para etapa ${stageId}`)
          setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
          return
        }
        throw new Error(err?.error?.message || 'Erro ao buscar análise da IA')
      }
      const json = await res.json()
      console.log(`[DEBUG] Análise mais recente carregada para etapa ${stageId}:`, json.item)
      console.log(`[DEBUG] Dados da análise:`, {
        id: json.item?.id,
        run_id: json.item?.run_id,
        result: json.item?.result,
        score: json.item?.result?.score,
        strengths: json.item?.result?.strengths,
        weaknesses: json.item?.result?.weaknesses,
        matched_requirements: json.item?.result?.matched_requirements,
        missing_requirements: json.item?.result?.missing_requirements
      })
      
      if (json.item) {
        setAnalysisByStage((prev) => ({ ...prev, [stageId]: json.item }))
        setAnalysisExpanded((prev) => ({ ...prev, [stageId]: true }))
        // Selecionar automaticamente o candidato da análise
        if (json.item.application_id) {
          const candidate = applications.find(app => app.id === json.item.application_id)?.candidate_id
          if (candidate) {
            console.log(`[DEBUG] Selecionando candidato automaticamente: ${candidate}`)
            setStageSelectedCandidates((prev) => ({ ...prev, [stageId]: candidate }))
          }
        }
      } else {
        console.log(`[DEBUG] Nenhum item retornado para etapa ${stageId}`)
        setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      }
    } catch (error: any) {
      console.error('Erro ao carregar análise mais recente da etapa', error)
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
    } finally {
      setAnalysisLoading((prev) => ({ ...prev, [stageId]: false }))
    }
  }, [applications])

  // Carregar automaticamente a análise mais recente para cada etapa
  useEffect(() => {
    console.log(`[DEBUG] useEffect auto-load: stages=${stages.length}, applications=${applications.length}`)
    if (stages.length > 0 && applications.length > 0) {
      console.log(`[DEBUG] Carregando análises automáticas para ${stages.length} etapas`)
      stages.forEach((stage) => {
        console.log(`[DEBUG] Carregando análise para etapa: ${stage.id} - ${stage.name}`)
        loadLatestAnalysisForStage(stage.id)
      })
    }
  }, [stages, applications, loadLatestAnalysisForStage])

  const handleStageCandidateSelection = useCallback((stageId: string, candidateId: string | null) => {
    clearStagePolling(stageId)
    setStageSelectedCandidates((prev) => ({ ...prev, [stageId]: candidateId }))
    if (!candidateId) {
      setAnalysisByStage((prev) => ({ ...prev, [stageId]: null }))
      setAnalysisExpanded((prev) => ({ ...prev, [stageId]: false }))
      return
    }
    setAnalysisExpanded((prev) => ({ ...prev, [stageId]: prev[stageId] ?? true }))
    loadAnalysisForStage(stageId, candidateId)
  }, [clearStagePolling, loadAnalysisForStage])

  

  // Candidatos filtrados para atribuição (exclui os já atribuídos)
  const assignedCandidateIds = useMemo(() => {
    return new Set(applications.map((app) => app.candidate_id))
  }, [applications])

  const filteredCandidatesForAssignment = useMemo(() => {
    return candidates.filter((c) => {
      // Excluir candidatos já atribuídos
      if (assignedCandidateIds.has(c.id)) return false
      // Filtrar por pesquisa
      if (candidateSearchQuery.trim()) {
        const q = candidateSearchQuery.toLowerCase()
        const nameMatch = c.name?.toLowerCase().includes(q)
        const emailMatch = c.email?.toLowerCase().includes(q)
        return nameMatch || emailMatch
      }
      return true
    })
  }, [candidates, assignedCandidateIds, candidateSearchQuery])

  const selectedCandidateCount = useMemo(() => {
    return Object.values(selectedCandidatesToAssign).filter(Boolean).length
  }, [selectedCandidatesToAssign])

  const assignCandidatesToJob = useCallback(async () => {
    if (!jobId || selectedCandidateCount === 0) return
    
    const candidateIds = Object.keys(selectedCandidatesToAssign).filter(
      (id) => selectedCandidatesToAssign[id]
    )
    
    setAssigningCandidates(true)
    try {
      // Criar applications para cada candidato selecionado
      const results = await Promise.allSettled(
        candidateIds.map((candidateId) =>
          fetch('/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_id: jobId, candidate_id: candidateId }),
          }).then((res) => res.json())
        )
      )

      const successCount = results.filter((r) => r.status === 'fulfilled').length
      const failCount = results.filter((r) => r.status === 'rejected').length

      // Recarregar applications e board
      const apps = await api<{ items: any[] }>(`/api/jobs/${jobId}/applications`).catch(() => ({ items: [] }))
      setApplications(apps.items || [])
      const b = await api<{ lanes: any; stages: Stage[] }>(`/api/jobs/${jobId}/board`).catch(() => null)
      if (b) setBoard(b as any)

      // Limpar seleção
      setSelectedCandidatesToAssign({})
      setCandidateSearchQuery('')
      setShowCandidateAssignment(false)

      if (failCount > 0) {
        notify({
          title: 'Atribuição parcial',
          description: `${successCount} candidato(s) atribuído(s), ${failCount} erro(s).`,
          variant: 'warning',
        })
      } else {
        notify({
          title: 'Candidatos atribuídos',
          description: `${successCount} candidato(s) adicionado(s) à vaga.`,
          variant: 'success',
        })
      }
    } catch (error: any) {
      notify({
        title: 'Erro ao atribuir candidatos',
        description: error?.message || 'Falha ao atribuir candidatos à vaga.',
        variant: 'error',
      })
    } finally {
      setAssigningCandidates(false)
    }
  }, [jobId, selectedCandidatesToAssign, selectedCandidateCount, notify])

  const removeApplication = useCallback(
    async (applicationId: string) => {
      if (!jobId) return
      const confirmed = confirm('Remover candidato desta vaga?')
      if (!confirmed) return
      try {
        const res = await fetch(`/api/applications/${applicationId}`, { method: 'DELETE' })
        if (!res.ok) {
          const text = await res.text()
          let message = 'Não foi possível remover o candidato da vaga.'
          try {
            const json = text ? JSON.parse(text) : null
            message = json?.error?.message || message
          } catch {}
          notify({ title: 'Erro ao remover candidato', description: message, variant: 'error' })
          return
        }
        const apps = await fetch(`/api/jobs/${jobId}/applications`).then((r) => r.json()).catch(() => ({ items: [] }))
    setApplications(apps.items || [])
        const b = await api<{ lanes: any; stages: Stage[] }>(`/api/jobs/${jobId}/board`).catch(() => null)
        if (b) {
          setBoard(b as any)
        }
        notify({ title: 'Candidato removido', variant: 'success' })
      } catch (error: any) {
        notify({
          title: 'Erro ao remover candidato',
          description: error?.message || 'Falha inesperada ao remover o candidato da vaga.',
          variant: 'error',
        })
      }
    },
    [jobId, notify],
  )

  const handleNavigateToStage = useCallback(
    (stageId: string | null, candidateId: string) => {
      setActiveMainTab('etapas')
      if (stageId) {
        setActiveTab(stageId)
        setStageSelectedCandidates((prev) => ({ ...prev, [stageId]: candidateId }))
        const url = new URL(window.location.href)
        url.searchParams.set('stageId', stageId)
        url.searchParams.set('candidateId', candidateId)
        window.history.replaceState({}, '', url.toString())
      }
    },
    [],
  )

  const formatDate = useCallback((value?: string | null) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '-'
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
  }, [])

  return (
    <div className="min-h-screen bg-[#f7f7f7] pb-12">
      <div className="bg-white border-b border-gray-200 shadow-sm -mx-4 md:-mx-8 px-4 md:px-8 mb-8">
        <div className="flex w-full flex-col gap-4 py-6 md:flex-row md:items-center md:justify-between">
        <div>
            <div className="text-sm text-gray-500">Vagas / {jobInfo?.title || 'Processo seletivo'}</div>
            <h1 className="mt-2 text-2xl font-semibold text-gray-900">{jobInfo?.title || 'Processo seletivo'}</h1>
            <p className="text-sm text-gray-600">Gerencie as etapas do processo seletivo e analise candidatos</p>
        </div>
        {jobId && (
          <button
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 whitespace-nowrap"
              onClick={async () => {
                if (!confirm('Excluir esta vaga e todas as etapas/candidaturas relacionadas?')) return
              const res = await fetch(`/api/jobs/${jobId}`, { method: 'DELETE' })
                if (!res.ok) {
                  const t = await res.text()
                let msg = 'Falha ao excluir a vaga'
                  try {
                    const j = t ? JSON.parse(t) : null
                    msg = j?.error?.message || msg
                  } catch {}
                notify({ title: 'Erro', description: msg, variant: 'error' })
                return
              }
              notify({ title: 'Vaga excluída', variant: 'success' })
              window.location.href = '/jobs'
            }}
          >
            🗑️ Excluir vaga
          </button>
        )}
        </div>
      </div>

      <div className="space-y-8 px-4 md:px-8">
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-1 inline-flex">
          <button
            type="button"
            onClick={() => setActiveMainTab('info')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeMainTab === 'info'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Informações da vaga
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('candidatos')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeMainTab === 'candidatos'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Candidatos
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('etapas')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeMainTab === 'etapas'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Etapas & IA
          </button>
          <button
            type="button"
            onClick={() => setActiveMainTab('analytics')}
            className={`px-5 py-2 text-sm font-semibold rounded-xl transition-colors ${
              activeMainTab === 'analytics'
                ? 'bg-gray-900 text-white shadow'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Analytics
          </button>
            </div>

        {activeMainTab === 'candidatos' && (
          <div className="space-y-8">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Lista de Candidatos</h3>
                  <p className="text-sm text-gray-600">Visualize o status de cada candidato e navegue para a etapa correspondente.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>Ordenar:</span>
                    <select
                      value={candidatesSort}
                      onChange={(e) => setCandidatesSort(e.target.value as 'name' | 'score')}
                      className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700"
                    >
                      <option value="name">A-Z</option>
                      <option value="score">Nota IA</option>
                    </select>
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total: {totalCandidates}</span>
                  <button
                    type="button"
                    onClick={() => setShowCandidateAssignment(!showCandidateAssignment)}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    + Atribuir candidatos
                  </button>
                </div>
              </div>

              {/* Painel de atribuição de candidatos */}
              {showCandidateAssignment && (
                <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-gray-900">Atribuir candidatos à vaga</h4>
                        <p className="text-sm text-gray-600">Pesquise e selecione os candidatos que deseja adicionar.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCandidateAssignment(false)
                          setSelectedCandidatesToAssign({})
                          setCandidateSearchQuery('')
                        }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>

                    {/* Barra de pesquisa */}
                    <div className="relative">
                <input
                        type="text"
                        placeholder="Pesquisar candidatos por nome ou email..."
                        value={candidateSearchQuery}
                        onChange={(e) => setCandidateSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pl-10 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                      />
                      <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
              </div>

                    {/* Lista de candidatos com checkboxes */}
                    <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white">
                      {filteredCandidatesForAssignment.length === 0 ? (
                        <div className="p-4 text-center text-sm text-gray-500">
                          {candidates.length === 0
                            ? 'Nenhum candidato cadastrado. Cadastre candidatos em "Candidatos".'
                            : candidateSearchQuery
                            ? 'Nenhum candidato encontrado para a pesquisa.'
                            : 'Todos os candidatos já estão atribuídos a esta vaga.'}
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100">
                          {filteredCandidatesForAssignment.map((candidate) => {
                            const isSelected = selectedCandidatesToAssign[candidate.id] || false
                            const initials = candidate.name
                              ? candidate.name.split(' ').map((p) => p.charAt(0)).join('').slice(0, 2).toUpperCase()
                              : candidate.id.slice(0, 2).toUpperCase()
                            return (
                              <label
                                key={candidate.id}
                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                  isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
                                }`}
                              >
                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    setSelectedCandidatesToAssign((prev) => ({
                                      ...prev,
                                      [candidate.id]: e.target.checked,
                                    }))
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                                />
                                <div className="h-8 w-8 flex items-center justify-center rounded-full bg-gray-900/5 text-xs font-semibold text-gray-700">
                                  {initials}
              </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium text-gray-900 truncate">{candidate.name || 'Sem nome'}</div>
                                  {candidate.email && <div className="text-xs text-gray-500 truncate">{candidate.email}</div>}
            </div>
                              </label>
                            )
                          })}
          </div>
                      )}
          </div>

                    {/* Botões de ação */}
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-sm text-gray-600">
                        {selectedCandidateCount > 0
                          ? `${selectedCandidateCount} candidato(s) selecionado(s)`
                          : 'Nenhum candidato selecionado'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCandidatesToAssign({})
                          }}
                          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                          disabled={selectedCandidateCount === 0}
                        >
                          Limpar seleção
                </button>
                <button 
                          type="button"
                          onClick={assignCandidatesToJob}
                          disabled={selectedCandidateCount === 0 || assigningCandidates}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {assigningCandidates ? 'Atribuindo...' : `Atribuir ${selectedCandidateCount > 0 ? `(${selectedCandidateCount})` : ''}`}
                </button>
              </div>
            </div>
          </div>
            </div>
              )}

              {candidateRows.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-600">Nenhum candidato atribuído à vaga ainda.</p>
                  <p className="text-xs text-gray-500 mt-1">Atribua candidatos acima para acompanhar o pipeline.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        <th className="px-4 py-3">Candidato</th>
                        <th className="px-4 py-3">Etapa</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Score IA</th>
                        <th className="px-4 py-3">Aplicado em</th>
                        <th className="px-4 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sortedCandidateRows.map((row) => {
                        const initials =
                          row.name && row.name.trim().length > 0
                            ? row.name
                                .split(' ')
                                .map((part) => part.charAt(0))
                                .join('')
                                .slice(0, 2)
                                .toUpperCase()
                            : row.candidateId.slice(0, 2).toUpperCase()
                        const badgeClasses =
                          row.status === 'Ativo'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-red-100 text-red-700'
                        const score =
                          typeof row.score === 'number'
                            ? `${row.score.toFixed(1)} pts`
                            : 'Sem pontuação'
                return (
                          <tr key={row.applicationId} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 flex items-center justify-center rounded-full bg-gray-900/5 text-sm font-semibold text-gray-700">
                                  {initials}
                        </div>
                        <div className="min-w-0">
                                <Link
                                  href={`/candidates?candidateId=${row.candidateId}`}
                                  className="font-medium text-blue-700 hover:text-blue-800 hover:underline truncate"
                                  title="Ver detalhes do candidato"
                                >
                                  {row.name}
                                </Link>
                                  {row.email && <div className="text-xs text-gray-500 truncate">{row.email}</div>}
                        </div>
                      </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm font-medium text-gray-700">{row.stageName ?? 'Sem etapa'}</span>
                            </td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses}`}>
                                {row.status}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="font-medium text-gray-900">{score}</span>
                              {row.stageName && (
                                <div className="text-xs text-gray-500">Etapa atual</div>
                              )}
                            </td>
                            <td className="px-4 py-4 text-gray-600">{formatDate(row.appliedAt)}</td>
                            <td className="px-4 py-4 text-right">
                              <div className="flex justify-end gap-2">
                      <button 
                                  type="button"
                                  onClick={() => handleNavigateToStage(row.stageId ?? orderedStages[0]?.id ?? null, row.candidateId)}
                                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition-colors"
                                >
                                  Ver etapa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeApplication(row.applicationId)}
                                  className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
            </div>
              )}
          </div>
        </div>
        )}

        {activeMainTab === 'analytics' && (
          <div className="space-y-8">
            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">Analytics & Relatórios</div>
                  <h2 className="mt-2 text-2xl font-semibold text-gray-900">Resumo da Vaga</h2>
                  <p className="text-sm text-gray-600">
                    Indicadores principais do pipeline e desempenho da vaga.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled
                    title="Função disponível em breve"
                    className="rounded-lg bg-gray-900/70 px-4 py-2 text-sm font-semibold text-white opacity-60 cursor-not-allowed"
                  >
                    Exportar
                  </button>
                  <button
                    type="button"
                    disabled
                    title="Função disponível em breve"
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-600 opacity-60 cursor-not-allowed"
                  >
                    Filtros
                  </button>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 md:p-5">
                <div className="text-sm font-medium text-gray-900">Link público da vaga</div>
                <p className="text-xs text-gray-500">Compartilhe este link com candidatos para inscrição direta.</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    value={publicLink || 'Link indisponível'}
                    readOnly
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!publicLink || !navigator?.clipboard) return
                      try {
                        await navigator.clipboard.writeText(publicLink)
                        notify({ title: 'Link copiado', variant: 'success' })
                      } catch {
                        notify({ title: 'Falha ao copiar link', variant: 'error' })
                      }
                    }}
                    disabled={!publicLink}
                    className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Copiar link
                  </button>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Conversão da vaga</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-indigo-700">
                      {analyticsData.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {analyticsData.finalStageCount} de {totalCandidates} candidatos na etapa final
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Tempo em aberto</div>
                  <div className="mt-2 text-3xl font-semibold text-sky-700">{formatDuration(analyticsData.timeOpenMs)}</div>
                  <div className="text-xs text-gray-500 mt-2">
                    {jobInfo?.created_at ? 'Desde a criação da vaga' : 'Desde a primeira candidatura'}
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">SLA médio de contratação</div>
                  <div className="mt-2 text-3xl font-semibold text-emerald-700">{formatDuration(analyticsData.slaMs)}</div>
                  <div className="text-xs text-gray-500 mt-2">Tempo médio até a aprovação</div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Nota média da vaga</div>
                  <div className="mt-2 text-3xl font-semibold text-amber-700">
                    {analyticsData.hasScores ? analyticsData.averageScore.toFixed(1) : '—'}
                  </div>
                  <div className="text-xs text-gray-500 mt-2">Média geral dos scores IA</div>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Total</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-gray-900">{totalCandidates}</span>
                    <span className="text-xs text-gray-500 uppercase tracking-wide">candidatos</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-indigo-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Novos</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-indigo-600">{newCandidatesCount}</span>
                    <span className="text-xs text-indigo-600 uppercase tracking-wide">na etapa inicial</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Em processo</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-emerald-600">{advancedCandidatesCount}</span>
                    <span className="text-xs text-emerald-600 uppercase tracking-wide">etapas avançadas</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-amber-50 to-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Inativos</div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-amber-600">{inactiveCandidatesCount}</span>
                    <span className="text-xs text-amber-600 uppercase tracking-wide">candidatos inativos</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Calculadora de ROI</h3>
                  <p className="text-sm text-gray-600">
                    Estimativas baseadas em parâmetros internos configurados.
                  </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-4">
                    <div className="text-sm text-emerald-700">Tempo total economizado</div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-700">
                      {formatMinutesToHours(analyticsData.totalMinutesSaved)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
                    <div className="text-sm text-indigo-700">Custo evitado</div>
                    <div className="mt-2 text-2xl font-semibold text-indigo-700">
                      {formatCurrencyBRL(analyticsData.costSaved)}
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-900">Horas economizadas por etapa</h4>
                    <div className="text-xs text-gray-500">Base por avaliação</div>
                  </div>
                  <div className="mt-4 space-y-3">
                    {analyticsData.stageEffortSummary.map((entry) => (
                      <div key={entry.stageId} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{entry.stageName}</div>
                            <div className="text-xs text-gray-500">
                              {entry.count} avaliações · {entry.minutesPerCandidate} min cada
                            </div>
                          </div>
                          <div className="text-sm font-semibold text-gray-900">
                            {formatMinutesToHours(entry.totalMinutes)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {analyticsData.stageEffortSummary.length === 0 && (
                      <div className="text-sm text-gray-500">Nenhuma etapa cadastrada.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900">Índice de aderência</h3>
                <p className="text-sm text-gray-600">
                  Média do top 20% melhores candidatos (score ponderado no ranking).
                </p>
                <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5">
                  <div className="text-sm text-emerald-700">Aderência da vaga</div>
                  <div className="mt-2 text-3xl font-semibold text-emerald-700">
                    {analyticsData.hasAdherence ? analyticsData.adherenceScore.toFixed(1) : '—'}
                  </div>
                  <div className="mt-1 text-xs text-emerald-700">{analyticsData.adherenceLabel}</div>
                </div>
                <div className="mt-6 space-y-2 text-xs text-gray-500">
                  <div>0 a 6: precisa melhorar</div>
                  <div>6.9 a 7.9: médio</div>
                  <div>8 a 10: top</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Indice de aderencia por etapa</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {analyticsData.stageScoreSummary.map((stage) => (
                  <div key={stage.stageId} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{stage.stageName}</div>
                    <div className="text-xs text-gray-500">Média dos top 20% da etapa</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">
                      {stage.adherenceScore !== null ? stage.adherenceScore.toFixed(1) : '—'}
                    </div>
                  </div>
                ))}
                {analyticsData.stageScoreSummary.length === 0 && (
                  <div className="text-sm text-gray-500">Nenhuma etapa cadastrada.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Media por etapa</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {analyticsData.stageScoreSummary.map((stage) => (
                  <div key={stage.stageId} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{stage.stageName}</div>
                    <div className="text-xs text-gray-500">Média total da etapa</div>
                    <div className="mt-2 text-lg font-semibold text-gray-900">
                      {stage.averageScore !== null ? stage.averageScore.toFixed(1) : '—'}
                    </div>
                  </div>
                ))}
                {analyticsData.stageScoreSummary.length === 0 && (
                  <div className="text-sm text-gray-500">Nenhuma etapa cadastrada.</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <Panel jobId={jobId} />
            </div>
          </div>
        )}

        {activeMainTab === 'etapas' && (
          <div className="space-y-8">
            {board && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Total de Candidatos</div>
                  <div className="mt-2 text-3xl font-semibold text-gray-900">{applications.length}</div>
                  <div className="text-xs text-gray-400 mt-1">Atribuídos à vaga</div>
                        </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Etapas</div>
                  <div className="mt-2 text-3xl font-semibold text-gray-900">{stages.length}</div>
                  <div className="text-xs text-gray-400 mt-1">No processo seletivo</div>
                      </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Análises Concluídas</div>
                  <div className="mt-2 text-3xl font-semibold text-green-600">
                    {Object.values(analysisByStage).filter((a) => a?.status === 'succeeded').length}
                          </div>
                  <div className="text-xs text-green-600 mt-1">Candidatos avaliados</div>
                        </div>
                <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                  <div className="text-sm text-gray-500">Próximas Ações</div>
                  <div className="mt-2 text-3xl font-semibold text-gray-900">
                    {stages.filter((s) => !stagePromptMap[s.id]).length}
                  </div>
                  <div className="text-xs text-yellow-600 mt-1">Sem prompt definido</div>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Etapas do Processo</h2>
                  <p className="text-sm text-gray-600">Gerencie as etapas e acompanhe o pipeline de candidatos.</p>
                  </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const stage = stages.find((s) => s.id === activeTab)
                      if (stage) startEditStage(stage)
                    }}
                    disabled={!activeTab}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    ✏️ Editar etapa
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowAddStageModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Adicionar Etapa
                  </button>
                </div>
              </div>

              {stages.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                  <p className="text-sm text-gray-600">Nenhuma etapa cadastrada.</p>
                    </div>
                  ) : (
                <div className="space-y-4">
                  <JobStageHeader
                    stages={stages}
                    lanes={board?.lanes || {}}
                    activeStageId={activeTab}
                    onChange={(id) => {
                      setActiveTab(id)
                      const url = new URL(window.location.href)
                      url.searchParams.set('stageId', id)
                      window.history.replaceState({}, '', url.toString())
                    }}
                  />

                  {activeTab && (
                    <div className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="text-sm flex-1">
                            <div className="text-xs uppercase tracking-wide text-gray-500">Etapa ativa</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-semibold text-gray-900">
                                {stages.find((s) => s.id === activeTab)?.name}
                              </span>
                              {(() => {
                                const analysisType = stages.find((s) => s.id === activeTab)?.analysis_type
                                return (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    analysisType === 'transcript' 
                                      ? 'bg-purple-100 text-purple-700' 
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {analysisType === 'transcript' ? '🎤 Transcrição' : '📄 Currículo'}
                                  </span>
                                )
                              })()}
                    </div>
                          </div>
                </div>
              </div>

                <StagePromptSelector
                        stageId={activeTab}
                  templates={promptTemplates}
                        selected={stagePromptMap[activeTab] ?? null}
                        loading={promptLoadingStage === activeTab}
                  onChange={handleStagePromptChange}
                />

                      <div>
                        <CandidatesTable
                          stage={stages.find((s) => s.id === activeTab)!}
                          items={(board?.lanes?.[activeTab] || []) as any}
                          selectedMap={selectedForBulk}
                          setSelectedMap={setSelectedForBulk}
                          stages={stages}
                          jobId={jobId!}
                          analysisType={stages.find((s) => s.id === activeTab)?.analysis_type || 'resume'}
                          onMoved={async () => {
                            await refreshBoard()
                            setSelectedForBulk({})
                          }}
                          onRefresh={refreshBoard}
                          onSelect={(it) => {
                            setCurrentItem({
                              application_id: it.application_id,
                              application_stage_id: it.application_stage_id,
                              candidate: { id: it.candidate.id, name: it.candidate.name },
                            })
                            const url = new URL(window.location.href)
                            url.searchParams.set('candidateId', it.candidate.id)
                            window.history.replaceState({}, '', url.toString())
                          }}
                        />
                </div>
              </div>
                  )}
            </div>
              )}
          </div>

          </div>
        )}

        {activeMainTab === 'info' && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Informações da vaga</h3>
                  <p className="text-sm text-gray-600">
                    Dados cadastrados no momento da criação da vaga.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditJobModal(true)}
                  disabled={!jobId}
                  className="text-sm font-semibold text-blue-600 hover:text-blue-700 hover:underline disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Editar vaga
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Departamento</h4>
                <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap">
                  {jobInfo?.department?.trim() || 'Não informado.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Localização</h4>
                <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap">
                  {jobInfo?.location?.trim() || 'Não informado.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Faixa Salarial</h4>
                <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap">
                  {jobInfo?.salary?.trim() || 'Não informado.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Descrição do Cargo</h4>
                <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap">
                  {jobInfo?.job_description?.trim() || 'Não informado.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Responsabilidades e Atribuições</h4>
                <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap">
                  {jobInfo?.responsibilities?.trim() || 'Não informado.'}
                </p>
              </div>

              <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <h4 className="text-base font-semibold text-gray-900">Requisitos e Habilidades</h4>
                <p className="mt-3 text-base text-gray-700 whitespace-pre-wrap">
                  {jobInfo?.requirements_and_skills?.trim() || 'Não informado.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEditJobModal && (
        <EditJobModal
          jobId={jobId}
          onClose={() => setShowEditJobModal(false)}
          onSaved={() => {
            if (jobId) {
              loadJobInfo(jobId)
            }
          }}
        />
      )}

      {/* Modal para adicionar nova etapa */}
      {showAddStageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Adicionar Nova Etapa</h3>
              <button
                type="button"
                onClick={() => setShowAddStageModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddStage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da Etapa *</label>
                <input
                  type="text"
                  value={newStageForm.name}
                  onChange={(e) => setNewStageForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Triagem de Currículos, Entrevista Técnica..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-sm font-medium text-gray-700">Template da etapa</label>
                  <a href="/settings/prompts" className="text-xs text-blue-600 underline">
                    Gerenciar templates
                  </a>
                </div>
                <select
                  value={newStageForm.prompt_template_id ?? ''}
                  onChange={(e) => setNewStageForm((f) => ({ ...f, prompt_template_id: e.target.value || null }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">
                    {defaultPromptTemplate ? `Usar padrão (${defaultPromptTemplate.name})` : 'Selecione um template'}
                  </option>
                  {promptTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.is_default ? ' (padrão)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  O template define as instruções que a IA usará para avaliar candidatos.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nota Mínima (Threshold)</label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={newStageForm.threshold}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, threshold: parseFloat(e.target.value) || 0 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Nota mínima para aprovação (0-10)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={newStageForm.stage_weight}
                    onChange={(e) => setNewStageForm((f) => ({ ...f, stage_weight: parseInt(e.target.value) || 1 }))}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Peso da etapa no cálculo final</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Análise</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="analysis_type"
                      value="resume"
                      checked={newStageForm.analysis_type === 'resume'}
                      onChange={() => setNewStageForm((f) => ({ ...f, analysis_type: 'resume' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">📄 Análise de Currículo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="analysis_type"
                      value="transcript"
                      checked={newStageForm.analysis_type === 'transcript'}
                      onChange={() => setNewStageForm((f) => ({ ...f, analysis_type: 'transcript' }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">🎤 Análise de Transcrição</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {newStageForm.analysis_type === 'resume' 
                    ? 'A IA analisará currículos dos candidatos nesta etapa.'
                    : 'A IA analisará transcrições de entrevistas nesta etapa.'}
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowAddStageModal(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || !newStageForm.name.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Etapa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar etapa */}
      {editingStageId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Editar etapa</h3>
              <button
                type="button"
                onClick={() => setEditingStageId(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleUpdateStage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome da etapa</label>
                <input
                  value={editingStageForm.name}
                  onChange={(e) => setEditingStageForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: Triagem de currículo"
                />
              </div>

              <div>
                <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <label className="block text-sm font-medium text-gray-700">Template da etapa</label>
                  <a href="/settings/prompts" className="text-xs text-blue-600 underline">
                    Gerenciar templates
                  </a>
                </div>
                <select
                  value={editingStageId ? stagePromptMap[editingStageId] ?? '' : ''}
                  onChange={(e) => {
                    if (editingStageId) {
                      handleStagePromptChange(editingStageId, e.target.value || null)
                    }
                  }}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  disabled={editingStageId ? promptLoadingStage === editingStageId : true}
                >
                  <option value="">
                    {defaultPromptTemplate ? `Usar padrão (${defaultPromptTemplate.name})` : 'Selecione um template'}
                  </option>
                  {promptTemplates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                      {template.is_default ? ' (padrão)' : ''}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  O template define as instruções que a IA usará para avaliar candidatos.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Threshold</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingStageForm.threshold}
                    onChange={(e) =>
                      setEditingStageForm((prev) => ({ ...prev, threshold: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Peso</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editingStageForm.stage_weight}
                    onChange={(e) =>
                      setEditingStageForm((prev) => ({ ...prev, stage_weight: Number(e.target.value) }))
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de Análise</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editing_analysis_type"
                      value="resume"
                      checked={editingStageForm.analysis_type === 'resume'}
                      onChange={() => setEditingStageForm((prev) => ({ ...prev, analysis_type: 'resume' }))}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">📄 Análise de Currículo</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="editing_analysis_type"
                      value="transcript"
                      checked={editingStageForm.analysis_type === 'transcript'}
                      onChange={() => setEditingStageForm((prev) => ({ ...prev, analysis_type: 'transcript' }))}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">🎤 Análise de Transcrição</span>
                  </label>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {editingStageForm.analysis_type === 'resume'
                    ? 'A IA analisará currículos dos candidatos nesta etapa.'
                    : 'A IA analisará transcrições de entrevistas nesta etapa.'}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStageId(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={updatingStage}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {updatingStage ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function UploadAndEvaluate({ stageId, applicationId, candidateName, analysisType = 'resume', onRunFinished }: { stageId: string; applicationId: string | null; candidateName?: string; analysisType?: 'resume' | 'transcript'; onRunFinished?: (stageId: string, runId: string, applicationStageId: string) => void }) {
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [stageDocumentFile, setStageDocumentFile] = useState<File | null>(null)
  const [selectedResume, setSelectedResume] = useState<{ resume_path: string; resume_bucket: string } | null>(null)
  const [availableResumes, setAvailableResumes] = useState<any[]>([])
  const [loadingResumes, setLoadingResumes] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [polling, setPolling] = useState(false)
  const [appStageIdForPoller, setAppStageIdForPoller] = useState<string | null>(null)

  // Carregar currículos do candidato quando applicationId mudar
  useEffect(() => {
    if (applicationId) {
      setLoadingResumes(true)
      fetch(`/api/applications/${applicationId}/resumes`)
        .then(r => r.json())
        .then(j => {
          setAvailableResumes(j.items || [])
          if (j.items && j.items.length > 0) {
            // Selecionar o primeiro currículo automaticamente
            setSelectedResume({
              resume_path: j.items[0].resume_path,
              resume_bucket: j.items[0].resume_bucket,
            })
          }
        })
        .catch(err => {
          console.error('Erro ao carregar currículos:', err)
          setAvailableResumes([])
        })
        .finally(() => setLoadingResumes(false))
    } else {
      setAvailableResumes([])
      setSelectedResume(null)
    }
  }, [applicationId])

  async function uploadToSignedUrl(uploadUrl: string, file: File, contentType: string) {
    const r = await fetch(uploadUrl, { 
      method: 'PUT', 
      headers: { 
        'Content-Type': contentType,
        'Cache-Control': 'max-age=3600'
      }, 
      body: file 
    })
    if (!r.ok) {
      const errorText = await r.text()
      console.error('Upload error:', r.status, errorText)
      throw new Error(`Falha no upload: ${r.status} - ${errorText}`)
    }
  }

  async function handleSubmit() {
    console.log('[DEBUG] handleSubmit chamado')
    console.log('[DEBUG] applicationId:', applicationId)
    console.log('[DEBUG] stageId:', stageId)
    setSubmitting(true)
    try {
      if (!applicationId) {
        console.log('[DEBUG] applicationId é null - exibindo erro')
        try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Selecione um candidato', description: 'Atribua um candidato à vaga antes de avaliar a etapa.', variant: 'error' }) } catch {}
        return
      }
      setPolling(true)
      let resumePath: string | undefined
      let resumeBucket: string | undefined
      let resumeSignedUrl: string | undefined
      if (resumeFile) {
        const r = await fetch('/api/uploads/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: resumeFile.name, content_type: resumeFile.type || 'application/pdf' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, resumeFile, resumeFile.type || 'application/pdf')
        resumePath = j.path
        resumeBucket = j.bucket
        resumeSignedUrl = j.view_url || undefined
      }
      let audioPath: string | undefined
      let audioBucket: string | undefined
      let audioSignedUrl: string | undefined
      if (audioFile) {
        const r = await fetch('/api/uploads/audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: audioFile.name, content_type: audioFile.type || 'audio/wav' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, audioFile, audioFile.type || 'audio/wav')
        audioPath = j.path
        audioBucket = j.bucket
        audioSignedUrl = j.view_url || undefined
      }

      let transcriptPath: string | undefined
      let transcriptBucket: string | undefined
      let transcriptSignedUrl: string | undefined
      if (transcriptFile) {
        const r = await fetch('/api/uploads/transcript', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: transcriptFile.name, content_type: transcriptFile.type || 'application/json' }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, transcriptFile, transcriptFile.type || 'application/json')
        transcriptPath = j.path
        transcriptBucket = j.bucket
        transcriptSignedUrl = j.view_url || undefined
      }

      // Upload de documento de etapa se fornecido
      let documentPath: string | undefined
      let documentBucket: string | undefined
      let documentSignedUrl: string | undefined
      let documentType: string | undefined
      
      if (stageDocumentFile) {
        const contentType = stageDocumentFile.type || 
          (stageDocumentFile.name.endsWith('.pdf') ? 'application/pdf' :
          stageDocumentFile.name.endsWith('.docx') ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
          stageDocumentFile.name.endsWith('.doc') ? 'application/msword' :
          stageDocumentFile.name.endsWith('.json') ? 'application/json' : 'application/pdf')
        
        const docType = contentType.includes('pdf') ? 'pdf' :
          contentType.includes('docx') ? 'docx' :
          contentType.includes('msword') ? 'doc' :
          contentType.includes('json') ? 'json' : 'pdf'
        
        const r = await fetch('/api/uploads/resume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: stageDocumentFile.name, content_type: contentType, for_stage: true }),
        })
        const j = await r.json()
        await uploadToSignedUrl(j.upload_url, stageDocumentFile, contentType)
        
        const bucketMatch = j.path.match(/^([^/]+)\/(.+)$/)
        if (bucketMatch) {
          documentBucket = bucketMatch[1]
          documentPath = bucketMatch[2]
          
          // Registrar documento na etapa
          await fetch(`/api/stages/${stageId}/documents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: docType, storage_path: j.path }),
          })
          
          documentSignedUrl = j.view_url || undefined
          documentType = docType
        }
      }
      
      // Usar currículo selecionado se não houver upload novo
      const finalResumePath = resumePath || selectedResume?.resume_path
      const finalResumeBucket = resumeBucket || selectedResume?.resume_bucket
      const finalResumeSignedUrl = resumeSignedUrl || undefined

      const payload: any = {
        application_id: applicationId,
        resume_path: finalResumePath,
        resume_bucket: finalResumeBucket,
        resume_signed_url: finalResumeSignedUrl,
        audio_path: audioPath,
        audio_bucket: audioBucket,
        audio_signed_url: audioSignedUrl,
        transcript_path: transcriptPath,
        transcript_bucket: transcriptBucket,
        transcript_signed_url: transcriptSignedUrl,
        document_path: documentPath,
        document_bucket: documentBucket,
        document_signed_url: documentSignedUrl,
        document_type: documentType,
      }

      console.log('[DEBUG] Enviando payload para avaliação:', payload)
      const evalRes = await fetch(`/api/stages/${stageId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      console.log('[DEBUG] Resposta da avaliação:', evalRes.status)
      const evalJson = await evalRes.json()
      console.log('[DEBUG] JSON da resposta:', evalJson)
      setRunId(evalJson.run_id || null)
      if (evalJson.application_stage_id) setAppStageIdForPoller(evalJson.application_stage_id)
    } catch (e: any) {
      try { const { useToast } = require('@/components/ToastProvider'); const { notify } = useToast(); notify({ title: 'Erro ao avaliar', description: e?.message, variant: 'error' }) } catch {}
    } finally {
      setSubmitting(false)
      if (!runId) setPolling(false)
    }
  }

  return (
    <div className="space-y-4">
      {candidateName && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
          <strong>Avaliando:</strong> {candidateName}
        </div>
      )}
      
      {/* Badge indicando tipo de análise */}
      <div className={`rounded-lg p-3 border ${analysisType === 'transcript' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center gap-2">
          <span className={`text-lg ${analysisType === 'transcript' ? 'text-purple-600' : 'text-blue-600'}`}>
            {analysisType === 'transcript' ? '🎤' : '📄'}
          </span>
          <div>
            <div className={`font-medium text-sm ${analysisType === 'transcript' ? 'text-purple-900' : 'text-blue-900'}`}>
              {analysisType === 'transcript' ? 'Análise de Transcrição' : 'Análise de Currículo'}
            </div>
            <div className={`text-xs ${analysisType === 'transcript' ? 'text-purple-700' : 'text-blue-700'}`}>
              {analysisType === 'transcript' 
                ? 'Anexe a transcrição de uma entrevista para análise pela IA'
                : 'A IA analisará o currículo do candidato'}
            </div>
          </div>
        </div>
      </div>
      
      {/* Campos para análise de CURRÍCULO */}
      {analysisType === 'resume' && (
        <>
      {/* Seleção de currículo já anexado */}
      {applicationId && (
        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <label className="block text-xs font-medium text-gray-700 mb-2">
            Currículo do candidato (já anexado)
          </label>
          {loadingResumes ? (
            <div className="text-sm text-gray-500">Carregando currículos...</div>
          ) : availableResumes.length > 0 ? (
            <select
              value={selectedResume ? `${selectedResume.resume_path}:${selectedResume.resume_bucket}` : ''}
              onChange={(e) => {
                const value = e.target.value
                if (value) {
                  const [path, bucket] = value.split(':')
                  setSelectedResume({ resume_path: path, resume_bucket: bucket })
                  setResumeFile(null)
                } else {
                  setSelectedResume(null)
                }
              }}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Selecione um currículo anexado</option>
                  {availableResumes.map((resume, idx) => {
                    const pathParts = resume.resume_path.split('/')
                    const filename = pathParts[pathParts.length - 1]
                    const displayName = filename.replace(/^\d+-/, '')
                    return (
                <option key={idx} value={`${resume.resume_path}:${resume.resume_bucket}`}>
                        {displayName || `Currículo ${idx + 1}`} {resume.created_at ? `(${new Date(resume.created_at).toLocaleDateString('pt-BR')})` : ''}
                </option>
                    )
                  })}
            </select>
          ) : (
            <div className="text-sm text-gray-500">Nenhum currículo anexado ao candidato. Faça upload de um novo abaixo.</div>
          )}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Novo Currículo (PDF, DOCX, DOC) {selectedResume ? '(opcional - sobrescreve seleção acima)' : '(opcional)'}
          </label>
          <input 
            type="file" 
            accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword" 
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                    const maxSize = 10 * 1024 * 1024
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                    notify({ title: 'Arquivo muito grande', description: `O arquivo deve ter no máximo 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
                setSelectedResume(null)
              }
              setResumeFile(file)
            }} 
          />
          <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 10MB</p>
        </div>
        </div>
        </>
      )}

      {/* Campos para análise de TRANSCRIÇÃO */}
      {analysisType === 'transcript' && (
        <div className="space-y-3">
          <div className="rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 p-4">
            <label className="block text-sm font-medium text-purple-900 mb-2">
              📝 Transcrição da Entrevista (Obrigatório)
            </label>
            <p className="text-xs text-purple-700 mb-3">
              Anexe a transcrição da entrevista em PDF, DOCX, DOC ou JSON
            </p>
          <input 
            type="file" 
              accept=".pdf,.doc,.docx,.json,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/json" 
              className="w-full border border-purple-300 rounded-md px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                  const maxSize = 10 * 1024 * 1024
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                      notify({ title: 'Arquivo muito grande', description: `O arquivo deve ter no máximo 10MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
              }
                setStageDocumentFile(file)
              }} 
            />
            {stageDocumentFile && (
              <p className="text-xs text-purple-600 mt-2">
                ✓ Arquivo selecionado: {stageDocumentFile.name} ({(stageDocumentFile.size / 1024 / 1024).toFixed(2)}MB)
              </p>
            )}
            <p className="text-xs text-purple-600 mt-1">Formatos aceitos: PDF, DOCX, DOC, JSON | Tamanho máximo: 10MB</p>
        </div>

        <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">🎵 Áudio da Entrevista (Opcional)</label>
            <p className="text-xs text-gray-500 mb-2">Se desejar, anexe o áudio original da entrevista</p>
          <input 
            type="file" 
              accept="audio/*" 
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500" 
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              if (file) {
                  const maxSize = 50 * 1024 * 1024
                if (file.size > maxSize) {
                  try { 
                    const { useToast } = require('@/components/ToastProvider')
                    const { notify } = useToast()
                      notify({ title: 'Arquivo muito grande', description: `O arquivo de áudio deve ter no máximo 50MB. Tamanho atual: ${(file.size / 1024 / 1024).toFixed(2)}MB`, variant: 'error' })
                  } catch {}
                  e.target.value = ''
                  return
                }
              }
                setAudioFile(file)
              }} 
            />
            <p className="text-xs text-gray-500 mt-1">Tamanho máximo: 50MB</p>
        </div>
      </div>
      )}
      
      <button 
        disabled={submitting || !applicationId || (analysisType === 'transcript' && !stageDocumentFile)} 
        onClick={() => {
          console.log('[DEBUG] Botão Enviar para IA clicado')
          handleSubmit()
        }} 
        className={`w-full rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 ${
          analysisType === 'transcript' 
            ? 'bg-purple-600 hover:bg-purple-700 text-white' 
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
        title={
          !applicationId 
            ? 'Selecione um candidato na etapa para habilitar' 
            : analysisType === 'transcript' && !stageDocumentFile 
              ? 'Anexe a transcrição da entrevista para continuar'
              : undefined
        }
      >
        {submitting 
          ? 'Enviando...' 
          : analysisType === 'transcript' 
            ? '🎤 Analisar Transcrição com IA' 
            : '📄 Analisar Currículo com IA'}
      </button>
      {runId && appStageIdForPoller && (
        <RunPoller
          runId={runId}
          stageId={stageId}
          applicationStageId={appStageIdForPoller}
          onFinished={(completedRunId) => {
            if (onRunFinished) {
              onRunFinished(stageId, completedRunId, appStageIdForPoller)
            }
            setRunId(null)
            setAppStageIdForPoller(null)
            setPolling(false)
          }}
        />
      )}
    </div>
  )
}


function RunPoller({ runId, stageId, applicationStageId, onFinished }: { runId: string; stageId: string; applicationStageId: string; onFinished: (runId: string) => void }) {
  const [status, setStatus] = useState<'pending'|'running'|'succeeded'|'failed'>('running')
  const [lastScore, setLastScore] = useState<number | null>(null)
  useEffect(() => {
    let timer: any
    async function tick() {
      try {
        console.log(`[DEBUG] RunPoller fazendo polling para runId: ${runId}`)
        const r = await fetch(`/api/ai/runs/${runId}`)
        const j = await r.json()
        console.log(`[DEBUG] RunPoller resposta:`, j)
        if (j.status === 'succeeded') {
          console.log(`[DEBUG] RunPoller análise concluída, chamando onFinished`)
          setStatus('succeeded')
          const scoreValue = typeof j.result?.score === 'number' ? Number(j.result.score) : null
          setLastScore(scoreValue)
          await fetch(`/api/stages/${stageId}/scores/auto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ application_stage_id: applicationStageId, run_id: runId }),
          })
          onFinished(runId)
          return
        }
        if (j.status === 'failed') { 
          console.log(`[DEBUG] RunPoller análise falhou`)
          setStatus('failed'); 
          return 
        }
      } catch (error) {
        console.error(`[DEBUG] RunPoller erro:`, error)
      }
      timer = setTimeout(tick, 2000)
    }
    tick()
    return () => timer && clearTimeout(timer)
  }, [runId, stageId, applicationStageId, onFinished])
  return (
    <div className="text-sm text-gray-600 flex items-center gap-2">
      <span>Status da IA: {status}</span>
      {lastScore !== null && <span className="text-gray-500">| Score: {lastScore.toFixed(1)}</span>}
    </div>
  )
}


function Panel({ jobId }: { jobId: string | null }) {
  const [data, setData] = useState<any | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const refreshData = async () => {
    if (!jobId) return
    setRefreshing(true)
    try {
      const response = await fetch(`/api/jobs/${jobId}/panel`)
      if (!response.ok) {
        const result = await response.json().catch(() => null)
        setError(result?.error?.message || 'Erro ao carregar painel')
        setData(null)
        return
      }
      const result = await response.json()
      setData(result || { stages: [], items: [] })
      setError(null)
    } catch (error) {
      console.error('Erro ao carregar painel:', error)
      setError('Falha ao carregar painel de candidatos')
      setData(null)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    refreshData()
  }, [jobId])

  // Calcular ranking dos candidatos - DEVE estar antes de qualquer return condicional
  const rankedCandidates = useMemo(() => {
    if (!data?.items) return []
    
    return data.items.map((row: any) => {
      const totalScore = data.stages.reduce((sum: number, stage: any) => {
        const stageData = row.stages.find((x: any) => x.stage_id === stage.id)
        return sum + (stageData?.score || 0) * stage.stage_weight
      }, 0)
      const totalWeight = data.stages.reduce((sum: number, stage: any) => sum + stage.stage_weight, 0)
      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0
      
      // Encontrar a etapa atual do candidato (a última com score)
      const currentStage = [...data.stages].reverse().find((s: any) => {
        const stageData = row.stages.find((x: any) => x.stage_id === s.id)
        return stageData?.score != null
      })
      
      return {
        ...row,
        averageScore,
        currentStageName: currentStage?.name || data.stages[0]?.name || 'Triagem',
      }
    }).sort((a: any, b: any) => b.averageScore - a.averageScore)
  }, [data])

  if (!jobId) return null
  if (!data) {
    if (error) {
      return (
        <div className="card p-6 text-sm text-red-600">
          {error}
        </div>
      )
    }
    return <div className="text-sm text-gray-600">Carregando...</div>
  }
  
  function exportToCSV() {
    if (!data || data.items.length === 0) return
    
    // Cabeçalhos
    const headers = ['Candidato', 'E-mail']
    data.stages.forEach((s: any) => {
      headers.push(`${s.name} (Nota)`)
      headers.push(`${s.name} (Status)`)
    })
    headers.push('Média Ponderada')
    
    // Linhas de dados
    const rows = data.items.map((row: any) => {
      const totalScore = data.stages.reduce((sum: number, stage: any) => {
        const stageData = row.stages.find((x: any) => x.stage_id === stage.id)
        return sum + (stageData?.score || 0) * stage.stage_weight
      }, 0)
      const totalWeight = data.stages.reduce((sum: number, stage: any) => sum + stage.stage_weight, 0)
      const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0
      
      const rowData: string[] = [
        row.candidate.name || '',
        row.candidate.email || '',
      ]
      
      data.stages.forEach((s: any) => {
        const stage = row.stages.find((x: any) => x.stage_id === s.id)
        const score = stage?.score ?? 0
        const passed = score >= s.threshold
        rowData.push(score.toFixed(1))
        rowData.push(passed ? 'Aprovado' : 'Reprovado')
      })
      
      rowData.push(averageScore.toFixed(1))
      return rowData
    })
    
    // Montar CSV
    const csvContent = [
      headers.join(';'),
      ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n')
    
    // Criar e baixar arquivo
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `painel_candidatos_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Cores para posições do ranking
  const getRankBadgeStyle = (position: number) => {
    if (position === 1) return 'bg-yellow-400 text-yellow-900' // Ouro
    if (position === 2) return 'bg-gray-400 text-gray-900' // Prata
    if (position === 3) return 'bg-orange-400 text-orange-900' // Bronze
    return 'bg-gray-200 text-gray-600' // Outros
  }
  
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Ranking de Candidatos</h3>
        <div className="flex items-center gap-2">
        <button 
          onClick={refreshData} 
          disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          {refreshing ? 'Atualizando...' : 'Atualizar'}
        </button>
        </div>
      </div>
      
      {rankedCandidates.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>Nenhum candidato atribuído à vaga ainda.</p>
          <p className="text-sm">Atribua candidatos na seção acima para ver o ranking aqui.</p>
                  </div>
      ) : (
        <div className="space-y-3">
          {rankedCandidates.map((row: any, index: number) => {
            const position = index + 1
            const scorePercent = Math.min((row.averageScore / 10) * 100, 100)
              
              return (
              <div 
                key={row.candidate.id} 
                className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-4">
                  {/* Badge de posição */}
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full text-lg font-bold ${getRankBadgeStyle(position)}`}>
                    {position}
                    </div>
                  
                  {/* Informações do candidato */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">{row.candidate.name || 'Sem nome'}</div>
                    <div className="text-sm text-gray-500">{row.currentStageName}</div>
                        </div>
                  
                  {/* Score e barra de progresso */}
                  <div className="flex flex-col items-end gap-1 w-32">
                    <span className="text-2xl font-bold text-blue-600">
                      {row.averageScore.toFixed(1)}
                      </span>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gray-800 rounded-full transition-all duration-500"
                        style={{ width: `${scorePercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              )
            })}
      </div>
      )}
      
      {rankedCandidates.length > 0 && (
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Extrair para CSV
          </button>
        </div>
      )}
    </div>
  )
}




