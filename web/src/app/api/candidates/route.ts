import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../_lib/supabaseAdmin'
import { requireUser } from '../_lib/auth'

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
    .select('id, name, email, phone, created_at, company_id, created_by', { count: 'exact' })
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
  const candidates = (data ?? []).filter((c) => (c.created_by ?? user.id) === user.id)

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
    const latestApp = cApps[0] || null
    const cInterviews = cApps.flatMap((a) => interviewsByApplication.get(a.id) ?? [])
    const allScores = cInterviews.flatMap((iv) => scoreByInterview.get(iv.id) ?? [])
    const avg_score = allScores.length ? allScores.reduce((s, v) => s + v, 0) / allScores.length : null
    const latestInterviewDate = cInterviews.reduce<Date | null>((acc, iv) => {
      const d = iv.created_at ? new Date(iv.created_at) : null
      return !acc || (d && d > acc) ? d : acc
    }, null)
    const latest_activity_at = (latestInterviewDate?.toISOString()) || latestApp?.created_at || c.created_at
    return {
      ...c,
      latest_job_title: latestApp?.jobs?.title ?? null,
      latest_activity_at,
      avg_score,
    }
  })

  return Response.json({ items, page, page_size: pageSize, total: count ?? items.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, phone } = body || {}
  if (!name) return Response.json({ error: { code: 'validation_error', message: 'name is required' } }, { status: 400 })
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (err) {
    return Response.json({ error: { code: 'unauthorized', message: 'Sessão inválida' } }, { status: 401 })
  }

  const { data: candidate, error } = await supabase
    .from('candidates')
    .insert({
      name,
      email,
      phone,
      company_id: user.company_id,
      created_by: user.id,
    })
    .select('id')
    .single()
  if (error) {
    return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  }
  return Response.json({ id: candidate.id })
}


