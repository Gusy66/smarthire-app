import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id, created_by')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job) return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  if (job.company_id !== user.company_id || job.created_by !== user.id) return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })

  const { data: stages, error: stagesError } = await supabase
    .from('job_stages')
    .select('id, name, order_index, threshold, stage_weight')
    .eq('job_id', jobId)
    .order('order_index', { ascending: true })
  if (stagesError) return Response.json({ error: { code: 'db_error', message: stagesError.message } }, { status: 500 })

  const { data: applications, error: appsError } = await supabase
    .from('applications')
    .select('id, candidate_id, created_at')
    .eq('job_id', jobId)
  if (appsError) return Response.json({ error: { code: 'db_error', message: appsError.message } }, { status: 500 })

  const applicationIds = (applications ?? []).map((a) => a.id)
  let appStages: { id: string; application_id: string; stage_id: string; decided_at: string | null }[] = []
  if (applicationIds.length) {
    const { data, error } = await supabase
      .from('application_stages')
      .select('id, application_id, stage_id, decided_at')
      .in('application_id', applicationIds)
    if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    // considerar apenas etapas ativas (não decididas)
    appStages = (data ?? []).filter((x) => x.decided_at == null)
  }

  const candidateIds = [...new Set((applications ?? []).map((a) => a.candidate_id))]
  const { data: candidates, error: candError } = await supabase
    .from('candidates')
    .select('id, name, email')
    .in('id', candidateIds)
  if (candError) return Response.json({ error: { code: 'db_error', message: candError.message } }, { status: 500 })
  const candidateById = new Map((candidates ?? []).map((c) => [c.id, c]))

  // Map de score direto por app_stage (fallback) a partir de última run
  const appStageIds = appStages.map((as) => as.id)
  const latestRunScoreByAppStage = new Map<string, number>()
  if (appStageIds.length) {
    const { data: runs, error: runsError } = await supabase
      .from('stage_ai_runs')
      .select('application_stage_id, status, result, created_at')
      .in('application_stage_id', appStageIds)
      .eq('type', 'evaluate')
      .order('created_at', { ascending: false })
    if (!runsError && runs) {
      for (const r of runs) {
        if (latestRunScoreByAppStage.has(r.application_stage_id)) continue
        if (r.status === 'succeeded' && r.result && typeof r.result.score === 'number') {
          latestRunScoreByAppStage.set(r.application_stage_id, Math.max(0, Math.min(10, Number(r.result.score))))
        }
      }
    }
  }

  // Agrupar candidatos por etapa
  const stageIdToItems: Record<string, any[]> = {}
  stages?.forEach((s) => { stageIdToItems[s.id] = [] })

  const appStageIdByAppStageKey = new Map<string, string>()
  appStages.forEach((x) => appStageIdByAppStageKey.set(`${x.application_id}:${x.stage_id}`, x.id))

  for (const app of (applications ?? [])) {
    for (const stage of (stages ?? [])) {
      const key = `${app.id}:${stage.id}`
      const appStageId = appStageIdByAppStageKey.get(key)
      if (!appStageId) continue
      const candidate = candidateById.get(app.candidate_id)
      stageIdToItems[stage.id].push({
        application_id: app.id,
        application_stage_id: appStageId,
        candidate: candidate || { id: app.candidate_id },
        stage_id: stage.id,
        score: latestRunScoreByAppStage.get(appStageId) ?? null,
        application_created_at: app.created_at,
      })
    }
  }

  return Response.json({ stages: stages ?? [], lanes: stageIdToItems })
}


