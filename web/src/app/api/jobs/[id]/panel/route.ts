import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
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
    .select('id, created_by, company_id, title')
    .eq('id', jobId)
    .maybeSingle()

  if (jobError || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.company_id && job.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso não autorizado' } }, { status: 403 })
  }

  const updates: Record<string, string> = {}
  if (!job.company_id) {
    updates.company_id = user.company_id
    job.company_id = user.company_id
  }
  if (!job.created_by) {
    updates.created_by = user.id
    job.created_by = user.id
  }
  if (Object.keys(updates).length) {
    const { error: updateError } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
    if (updateError) {
      console.error('[panel] falha ao atualizar metadados da vaga', updateError)
    }
  }

  if (job.created_by !== user.id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso não autorizado' } }, { status: 403 })
  }

  const { data: stages, error: stagesError } = await supabase
    .from('job_stages')
    .select('id, name, threshold, stage_weight, order_index')
    .eq('job_id', jobId)
    .order('order_index', { ascending: true })

  if (stagesError) {
    return Response.json({ error: { code: 'db_error', message: stagesError.message } }, { status: 500 })
  }

  const { data: applications, error: applicationsError } = await supabase
    .from('applications')
    .select('id, candidate_id')
    .eq('job_id', jobId)

  if (applicationsError) {
    return Response.json({ error: { code: 'db_error', message: applicationsError.message } }, { status: 500 })
  }

  const applicationIds = (applications ?? []).map((app) => app.id)

  let applicationStages: { id: string; application_id: string; stage_id: string }[] = []
  if (applicationIds.length > 0) {
    const { data: appStagesData, error: appStagesError } = await supabase
      .from('application_stages')
      .select('id, application_id, stage_id')
      .in('application_id', applicationIds)

    if (appStagesError) {
      return Response.json({ error: { code: 'db_error', message: appStagesError.message } }, { status: 500 })
    }
    applicationStages = appStagesData ?? []
  }

  const applicationStageById = new Map<string, { applicationId: string; stageId: string }>()
  const applicationStageByAppStageKey = new Map<string, string>() // key: `${applicationId}:${stageId}` -> application_stage_id
  applicationStages.forEach((appStage) => {
    applicationStageById.set(appStage.id, {
      applicationId: appStage.application_id,
      stageId: appStage.stage_id,
    })
    applicationStageByAppStageKey.set(`${appStage.application_id}:${appStage.stage_id}`, appStage.id)
  })

  const applicationStageIds = applicationStages.map((as) => as.id)

  let scores: { application_stage_id: string; requirement_id: string; value: number }[] = []
  if (applicationStageIds.length > 0) {
    const { data: scoresData, error: scoresError } = await supabase
      .from('stage_scores')
      .select('application_stage_id, requirement_id, value')
      .in('application_stage_id', applicationStageIds)

    if (scoresError) {
      return Response.json({ error: { code: 'db_error', message: scoresError.message } }, { status: 500 })
    }
    scores = scoresData ?? []
  }

  const stageRequirementsMap = new Map<string, { requirementId: string }[]>()

  if (stages?.length) {
    const { data: reqData, error: reqError } = await supabase
      .from('stage_requirements')
      .select('id, stage_id, weight')
      .in('stage_id', stages.map((s) => s.id))

    if (reqError) {
      return Response.json({ error: { code: 'db_error', message: reqError.message } }, { status: 500 })
    }

    reqData?.forEach((req) => {
      const list = stageRequirementsMap.get(req.stage_id) ?? []
      list.push({ requirementId: req.id })
      stageRequirementsMap.set(req.stage_id, list)
    })
  }

  const stageScoresTotals = new Map<string, { totalScore: number; maxScore: number }>()

  scores.forEach((score) => {
    const appStage = applicationStageById.get(score.application_stage_id)
    if (!appStage) return

    const stageReqs = stageRequirementsMap.get(appStage.stageId)
    if (!stageReqs?.length) return

    const req = stageReqs.find((r) => r.requirementId === score.requirement_id)
    if (!req) return

    const key = `${appStage.applicationId}:${appStage.stageId}`
    const entry = stageScoresTotals.get(key) ?? { totalScore: 0, maxScore: 0 }
    // Os valores em stage_scores já estão ponderados por requisito na inserção automática.
    // Aqui agregamos como média simples entre requisitos para obter nota 0..10.
    entry.totalScore += Number(score.value ?? 0)
    entry.maxScore += 10
    stageScoresTotals.set(key, entry)
  })

  // Fallback: buscar a nota direta da IA quando não houver scores de requisitos
  let runScoresByAppStage = new Map<string, number>()
  if (applicationStageIds.length > 0) {
    const { data: runsData, error: runsError } = await supabase
      .from('stage_ai_runs')
      .select('application_stage_id, status, result, created_at')
      .in('application_stage_id', applicationStageIds)
      .eq('type', 'evaluate')
      .order('created_at', { ascending: false })
    if (!runsError && runsData) {
      for (const r of runsData) {
        if (runScoresByAppStage.has(r.application_stage_id)) continue
        if (r.status === 'succeeded' && r.result && typeof r.result.score === 'number') {
          const scoreNum = Math.max(0, Math.min(10, Number(r.result.score)))
          runScoresByAppStage.set(r.application_stage_id, scoreNum)
        }
      }
    }
  }

  const { data: candidatesData, error: candidatesError } = await supabase
    .from('candidates')
    .select('id, name, email')
    .in('id', applications?.map((app) => app.candidate_id) ?? [])

  if (candidatesError) {
    return Response.json({ error: { code: 'db_error', message: candidatesError.message } }, { status: 500 })
  }

  const candidatesMap = new Map<string, { id: string; name: string | null; email: string | null }>()
  candidatesData?.forEach((candidate) => {
    candidatesMap.set(candidate.id, {
      id: candidate.id,
      name: candidate.name ?? 'Candidato',
      email: candidate.email ?? null,
    })
  })

  const items = (applications ?? []).map((app) => {
    const candidate = candidatesMap.get(app.candidate_id) ?? {
      id: app.candidate_id,
      name: 'Candidato',
      email: null,
    }

    const stageScores = (stages ?? []).map((stage) => {
      const key = `${app.id}:${stage.id}`
      const entry = stageScoresTotals.get(key)
      let score = entry ? (entry.maxScore > 0 ? Math.min(10, (entry.totalScore / entry.maxScore) * 10) : 0) : 0
      if (!entry || entry.maxScore === 0) {
        const appStageId = applicationStageByAppStageKey.get(key)
        if (appStageId && runScoresByAppStage.has(appStageId)) {
          score = runScoresByAppStage.get(appStageId) || 0
        }
      }

      return {
        stage_id: stage.id,
        score,
      }
    })

    return {
      candidate,
      stages: stageScores,
    }
  })

  return Response.json({
    stages: stages ?? [],
    items,
  })
}

