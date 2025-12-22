import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

export async function GET(req: NextRequest) {
  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  // Buscar todas as vagas do usuário
  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, title')
    .eq('company_id', user.company_id)
    .eq('created_by', user.id)

  if (jobsError) {
    return Response.json({ error: { code: 'db_error', message: jobsError.message } }, { status: 500 })
  }

  if (!jobs || jobs.length === 0) {
    return Response.json({ items: [] })
  }

  const jobIds = jobs.map((j) => j.id)
  const jobById = new Map(jobs.map((j) => [j.id, j]))

  // Buscar applications para essas vagas
  const { data: applications, error: appsError } = await supabase
    .from('applications')
    .select('id, candidate_id, job_id')
    .in('job_id', jobIds)

  if (appsError) {
    return Response.json({ error: { code: 'db_error', message: appsError.message } }, { status: 500 })
  }

  if (!applications || applications.length === 0) {
    return Response.json({ items: [] })
  }

  const applicationIds = applications.map((a) => a.id)
  const candidateIds = [...new Set(applications.map((a) => a.candidate_id))]

  // Buscar candidatos
  const { data: candidates, error: candError } = await supabase
    .from('candidates')
    .select('id, name, email')
    .in('id', candidateIds)

  if (candError) {
    return Response.json({ error: { code: 'db_error', message: candError.message } }, { status: 500 })
  }

  const candidateById = new Map((candidates || []).map((c) => [c.id, c]))

  // Buscar etapas de todas as vagas
  const { data: allStages, error: stagesError } = await supabase
    .from('job_stages')
    .select('id, job_id, name, order_index, threshold, stage_weight')
    .in('job_id', jobIds)
    .order('order_index', { ascending: true })

  if (stagesError) {
    return Response.json({ error: { code: 'db_error', message: stagesError.message } }, { status: 500 })
  }

  const stagesByJobId = new Map<string, typeof allStages>()
  ;(allStages || []).forEach((s) => {
    if (!stagesByJobId.has(s.job_id)) stagesByJobId.set(s.job_id, [])
    stagesByJobId.get(s.job_id)!.push(s)
  })

  // Buscar application_stages
  const { data: appStages, error: appStagesError } = await supabase
    .from('application_stages')
    .select('id, application_id, stage_id, status')
    .in('application_id', applicationIds)

  if (appStagesError) {
    return Response.json({ error: { code: 'db_error', message: appStagesError.message } }, { status: 500 })
  }

  const appStageIds = (appStages || []).map((as) => as.id)

  // Buscar stage_ai_runs com scores
  const { data: aiRuns, error: aiRunsError } = await supabase
    .from('stage_ai_runs')
    .select('application_stage_id, result, status')
    .in('application_stage_id', appStageIds)
    .eq('status', 'succeeded')
    .order('started_at', { ascending: false })

  if (aiRunsError) {
    return Response.json({ error: { code: 'db_error', message: aiRunsError.message } }, { status: 500 })
  }

  // Mapear scores por application_stage_id (pegar o mais recente)
  const scoreByAppStageId = new Map<string, number>()
  ;(aiRuns || []).forEach((run) => {
    if (!scoreByAppStageId.has(run.application_stage_id)) {
      const score = typeof run.result?.score === 'number' ? run.result.score : null
      if (score !== null) {
        scoreByAppStageId.set(run.application_stage_id, score)
      }
    }
  })

  // Mapear application_stage por application_id
  const appStagesByAppId = new Map<string, typeof appStages>()
  ;(appStages || []).forEach((as) => {
    if (!appStagesByAppId.has(as.application_id)) appStagesByAppId.set(as.application_id, [])
    appStagesByAppId.get(as.application_id)!.push(as)
  })

  // Calcular ranking para cada candidato
  const rankingItems: {
    candidate: { id: string; name: string; email?: string }
    job: { id: string; title: string }
    currentStage: string
    averageScore: number
  }[] = []

  applications.forEach((app) => {
    const candidate = candidateById.get(app.candidate_id)
    const job = jobById.get(app.job_id)
    const stages = stagesByJobId.get(app.job_id) || []
    const appStagesForApp = appStagesByAppId.get(app.id) || []

    if (!candidate || !job) return

    let totalScore = 0
    let totalWeight = 0
    let currentStageName = stages[0]?.name || 'Triagem'

    stages.forEach((stage) => {
      const appStage = appStagesForApp.find((as) => as.stage_id === stage.id)
      if (appStage) {
        const score = scoreByAppStageId.get(appStage.id) ?? 0
        if (score > 0) {
          currentStageName = stage.name
        }
        totalScore += score * stage.stage_weight
        totalWeight += stage.stage_weight
      }
    })

    const averageScore = totalWeight > 0 ? totalScore / totalWeight : 0

    // Apenas incluir candidatos com algum score
    if (averageScore > 0) {
      rankingItems.push({
        candidate: { id: candidate.id, name: candidate.name || 'Sem nome', email: candidate.email },
        job: { id: job.id, title: job.title },
        currentStage: currentStageName,
        averageScore,
      })
    }
  })

  // Ordenar por score (maior primeiro)
  rankingItems.sort((a, b) => b.averageScore - a.averageScore)

  // Limitar a 20 itens
  return Response.json({ items: rankingItems.slice(0, 20) })
}

