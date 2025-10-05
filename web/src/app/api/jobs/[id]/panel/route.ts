import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

// Painel agregado: candidatos atribuídos à vaga e pontuações por etapa
export async function GET(_: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  const user = await requireUser()

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job || job.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  const [{ data: apps }, { data: stages }] = await Promise.all([
    supabase.from('applications').select('id, candidate_id').eq('job_id', jobId),
    supabase.from('job_stages').select('id, name, order_index').eq('job_id', jobId).order('order_index', { ascending: true }),
  ])

  const candidateIds = [...new Set((apps ?? []).map((a) => a.candidate_id))]
  const { data: candidates } = await supabase.from('candidates').select('id, name, email').in('id', candidateIds)

  const appIds = (apps ?? []).map((a) => a.id)
  const { data: appStages } = await supabase
    .from('application_stages')
    .select('id, application_id, stage_id')
    .in('application_id', appIds)

  const appStageIds = (appStages ?? []).map((as) => as.id)
  const { data: scores } = await supabase
    .from('stage_scores')
    .select('application_stage_id, value')
    .in('id', appStageIds.length ? appStageIds : ['00000000-0000-0000-0000-000000000000'])

  const byAppStage = new Map<string, number>()
  ;(scores ?? []).forEach((s) => {
    // Para MVP, usamos última pontuação por application_stage
    byAppStage.set(s.application_stage_id, s.value)
  })

  const stageById = new Map((stages ?? []).map((s) => [s.id, s]))
  const appsByCandidate = new Map<string, { appId: string }>()
  ;(apps ?? []).forEach((a) => appsByCandidate.set(a.candidate_id, { appId: a.id }))

  const stageScoreByApp: Record<string, Record<string, number>> = {}
  ;(appStages ?? []).forEach((as) => {
    const score = byAppStage.get(as.id) ?? 0
    stageScoreByApp[as.application_id] ||= {}
    stageScoreByApp[as.application_id][as.stage_id] = score
  })

  const items = (candidates ?? []).map((c) => {
    const appId = appsByCandidate.get(c.id)?.appId
    const perStage = (stages ?? []).map((s) => ({ stage_id: s.id, stage_name: s.name, score: appId ? (stageScoreByApp[appId]?.[s.id] ?? 0) : 0 }))
    return { candidate: c, stages: perStage }
  })

  return Response.json({ items, stages })
}


