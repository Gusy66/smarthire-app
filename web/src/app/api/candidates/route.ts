import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { requireUser } from '../_lib/auth'
import { requirePermission } from '../_lib/permissions'

export async function GET(req: NextRequest) {
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (err) {
    return Response.json({ error: { code: 'unauthorized', message: 'Sessão inválida' } }, { status: 401 })
  }
  const { searchParams } = new URL(req.url)
  const search = (searchParams.get('search') || '').trim()
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') || '20', 10)))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from('candidates')
    .select('id, name, email, phone, created_at, company_id, created_by, city, state, address, children, gender, languages, education, resume_path, resume_bucket', { count: 'exact' })
    .eq('company_id', user.company_id)
  if (search) {
    const term = `%${search}%`
    query = query.or(
      `name.ilike.${term},email.ilike.${term},phone.ilike.${term}`
    )
  }
  query = query.order('created_at', { ascending: false }).range(from, to)
  const { data, error, count } = await query
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  const filteredCandidates = (data ?? []).filter((c) => (c.created_by ?? user.id) === user.id)
  const candidates = filteredCandidates.map((c) => ({
    ...c,
    resume_path: normalizeStoragePath(c.resume_path, c.resume_bucket),
  }))

  // enriquecer com métricas: vaga mais recente, última atividade e média de score
  const candidateIds = candidates.map((c) => c.id)
  if (candidateIds.length === 0) {
    return Response.json({ items: [], page, page_size: pageSize, total: 0 })
  }

  const { data: apps } = await supabase
    .from('applications')
    .select('id, candidate_id, job_id, created_at, jobs(title)')
    .in('candidate_id', candidateIds)
    .order('created_at', { ascending: false })

  // mapeia última aplicação por candidato
  const latestAppByCandidate = new Map<string, any>()
  ;(apps ?? []).forEach((a) => { if (!latestAppByCandidate.has(a.candidate_id)) latestAppByCandidate.set(a.candidate_id, a) })
  const latestAppIds = Array.from(latestAppByCandidate.values()).map((a: any) => a.id)

  const applicationIds = (apps ?? []).map((a) => a.id)
  const { data: interviews } = applicationIds.length
    ? await supabase
        .from('interviews')
        .select('id, application_id, scheduled_at, created_at, status')
        .in('application_id', applicationIds)
    : { data: [], error: null }

  const interviewIds = (interviews ?? []).map((i) => i.id)
  const { data: scores } = interviewIds.length
    ? await supabase
        .from('scores')
        .select('interview_id, value')
        .in('interview_id', interviewIds)
    : { data: [], error: null }

  // etapa atual (ativa) da última aplicação
  let stageNameByAppId = new Map<string, { id: string; name: string }>()
  if (latestAppIds.length) {
    const { data: appStages } = await supabase
      .from('application_stages')
      .select('application_id, stage_id, decided_at')
      .in('application_id', latestAppIds)
    const active = (appStages ?? []).filter((r) => !r.decided_at)
    const stageIds = Array.from(new Set(active.map((r) => r.stage_id)))
    if (stageIds.length) {
      const { data: stages } = await supabase
        .from('job_stages')
        .select('id, name')
        .in('id', stageIds)
      const stageById = new Map((stages ?? []).map((s) => [s.id, s]))
      active.forEach((r) => {
        const st = stageById.get(r.stage_id)
        if (st) stageNameByAppId.set(r.application_id, { id: st.id, name: st.name })
      })
    }
  }

  const scoreByInterview = new Map<string, number[]>()
  ;(scores ?? []).forEach((s: any) => {
    const arr = scoreByInterview.get(s.interview_id) ?? []
    arr.push(Number(s.value))
    scoreByInterview.set(s.interview_id, arr)
  })

  const interviewsByApplication = new Map<string, any[]>()
  ;(interviews ?? []).forEach((i: any) => {
    const arr = interviewsByApplication.get(i.application_id) ?? []
    arr.push(i)
    interviewsByApplication.set(i.application_id, arr)
  })

  const appsByCandidate = new Map<string, any[]>()
  ;(apps ?? []).forEach((a: any) => {
    const arr = appsByCandidate.get(a.candidate_id) ?? []
    arr.push(a)
    appsByCandidate.set(a.candidate_id, arr)
  })

  const items = candidates.map((c) => {
    const cApps = appsByCandidate.get(c.id) ?? []
    const latestApp = latestAppByCandidate.get(c.id) || cApps[0] || null
    const cInterviews = cApps.flatMap((a) => interviewsByApplication.get(a.id) ?? [])
    const allScores = cInterviews.flatMap((iv) => scoreByInterview.get(iv.id) ?? [])
    const avg_score = allScores.length ? allScores.reduce((s, v) => s + v, 0) / allScores.length : null
    const latestInterviewDate = cInterviews.reduce<Date | null>((acc, iv) => {
      const d = iv.created_at ? new Date(iv.created_at) : null
      return !acc || (d && d > acc) ? d : acc
    }, null)
    const latest_activity_at = (latestInterviewDate?.toISOString()) || latestApp?.created_at || c.created_at
    const latestStage = latestApp ? stageNameByAppId.get(latestApp.id) || null : null
    return {
      ...c,
      latest_job_title: latestApp?.jobs?.title ?? null,
      latest_stage_id: latestStage?.id || null,
      latest_stage_name: latestStage?.name || null,
      latest_activity_at,
      avg_score,
    }
  })

  return Response.json({ items, page, page_size: pageSize, total: count ?? items.length })
}

export async function POST(req: NextRequest) {
  // Verificar permissão para cadastrar candidatos
  let user
  try {
    user = await requirePermission('cadastrar_candidatos')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    if (message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Sessão inválida' } }, { status: 401 })
    }
    if (message.startsWith('permission_denied')) {
      return Response.json({ error: { code: 'forbidden', message: 'Você não tem permissão para cadastrar candidatos' } }, { status: 403 })
    }
    return Response.json({ error: { code: 'unauthorized', message: 'Sessão inválida' } }, { status: 401 })
  }

  const body = await req.json()
  const { 
    name, 
    email, 
    phone,
    city,
    state,
    address,
    children,
    gender,
    languages,
    education,
    resume_path,
    resume_bucket,
    job_id,
    stage_id
  } = body || {}
  if (!name) return Response.json({ error: { code: 'validation_error', message: 'name é obrigatório' } }, { status: 400 })
  if (!email) return Response.json({ error: { code: 'validation_error', message: 'email é obrigatório' } }, { status: 400 })
  if (!phone) return Response.json({ error: { code: 'validation_error', message: 'telefone é obrigatório' } }, { status: 400 })
  if (!job_id) return Response.json({ error: { code: 'validation_error', message: 'vaga é obrigatória' } }, { status: 400 })
  if (!stage_id) return Response.json({ error: { code: 'validation_error', message: 'etapa é obrigatória' } }, { status: 400 })
  if (!resume_path) return Response.json({ error: { code: 'validation_error', message: 'CV é obrigatório' } }, { status: 400 })
  const supabase = getSupabaseAdmin()

  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({
      name,
      email,
      phone,
      city,
      state,
      address,
      children: children ? parseInt(String(children)) : null,
      gender,
      languages: languages || [],
      education,
      resume_path: normalizeStoragePath(resume_path, resume_bucket),
      resume_bucket,
      company_id: user.company_id,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }

  // Atribuir à vaga se fornecido
  if (job_id && candidate.id) {
    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert({
        candidate_id: candidate.id,
        job_id: job_id,
      })
      .select('id')
      .single()

    if (appError) {
      console.error('Erro ao criar aplicação:', appError)
    } else if (application && stage_id) {
      // Atribuir à etapa se fornecido
      await supabase
        .from('application_stages')
        .insert({
          application_id: application.id,
          stage_id: stage_id,
          status: 'pending',
        })
    }
  }

  return Response.json({ id: candidate.id })
}

function normalizeStoragePath(path: string | null, bucket: string | null) {
  if (!path) return null
  if (!bucket) return path.replace(/^\/+/, '')
  const prefix = `${bucket}/`
  const cleaned = path.startsWith(prefix) ? path.slice(prefix.length) : path
  return cleaned.replace(/^\/+/, '')
}


