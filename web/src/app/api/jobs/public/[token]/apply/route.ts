import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ token: string }> }

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function getRateLimitKey(req: NextRequest, email: string | null) {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  const emailKey = email ? email.toLowerCase() : 'unknown'
  return `${ip}:${emailKey}`
}

function checkRateLimit(key: string) {
  const now = Date.now()
  const entry = rateLimitStore.get(key)
  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count += 1
  rateLimitStore.set(key, entry)
  return true
}

async function verifyTurnstile(token: string | null, ip: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { ok: false, message: 'CAPTCHA não configurado' }
  }
  if (!token) {
    return { ok: false, message: 'CAPTCHA obrigatório' }
  }
  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.success) {
    return { ok: false, message: 'CAPTCHA inválido' }
  }
  return { ok: true }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params
  if (!token) {
    return Response.json({ error: { code: 'validation_error', message: 'Token inválido' } }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const resume_path = typeof body?.resume_path === 'string' ? body.resume_path.trim() : ''
  const resume_bucket = typeof body?.resume_bucket === 'string' ? body.resume_bucket.trim() : ''
  const captchaToken = typeof body?.captcha_token === 'string' ? body.captcha_token : null

  if (!name || !email || !phone) {
    return Response.json({ error: { code: 'validation_error', message: 'Nome, e-mail e telefone são obrigatórios' } }, { status: 400 })
  }
  if (!resume_path || resume_bucket !== 'resumes') {
    return Response.json({ error: { code: 'validation_error', message: 'Currículo inválido' } }, { status: 400 })
  }

  const forwarded = req.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0]?.trim() || null
  const rlKey = getRateLimitKey(req, email)
  if (!checkRateLimit(rlKey)) {
    return Response.json({ error: { code: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.' } }, { status: 429 })
  }

  const captchaResult = await verifyTurnstile(captchaToken, ip)
  if (!captchaResult.ok) {
    return Response.json({ error: { code: 'captcha_failed', message: captchaResult.message } }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('id, company_id, status')
    .eq('public_token', token)
    .maybeSingle()

  if (jobError || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.status !== 'open') {
    return Response.json({ error: { code: 'closed', message: 'Vaga não está aberta para candidaturas' } }, { status: 404 })
  }

  const { data: firstStage } = await supabase
    .from('job_stages')
    .select('id')
    .eq('job_id', job.id)
    .order('order_index', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!firstStage) {
    return Response.json({ error: { code: 'missing_stage', message: 'Vaga sem etapas configuradas' } }, { status: 400 })
  }

  const { data: existingCandidate } = await supabase
    .from('candidates')
    .select('id')
    .eq('company_id', job.company_id)
    .eq('email', email)
    .maybeSingle()

  let candidateId = existingCandidate?.id
  if (!candidateId) {
    const { data: newCandidate, error: candError } = await supabase
      .from('candidates')
      .insert({
        company_id: job.company_id,
        name,
        email,
        phone,
        resume_path,
        resume_bucket,
      })
      .select('id')
      .single()
    if (candError || !newCandidate) {
      return Response.json({ error: { code: 'db_error', message: candError?.message || 'Erro ao criar candidato' } }, { status: 500 })
    }
    candidateId = newCandidate.id
  } else {
    await supabase
      .from('candidates')
      .update({
        name,
        phone,
        resume_path,
        resume_bucket,
      })
      .eq('id', candidateId)
  }

  const { data: existingApplication } = await supabase
    .from('applications')
    .select('id')
    .eq('job_id', job.id)
    .eq('candidate_id', candidateId)
    .maybeSingle()

  if (existingApplication?.id) {
    return Response.json({ success: true, application_id: existingApplication.id })
  }

  const { data: application, error: appError } = await supabase
    .from('applications')
    .insert({ job_id: job.id, candidate_id: candidateId })
    .select('id')
    .single()
  if (appError || !application) {
    return Response.json({ error: { code: 'db_error', message: appError?.message || 'Erro ao criar candidatura' } }, { status: 500 })
  }

  await supabase
    .from('application_stages')
    .insert({
      application_id: application.id,
      stage_id: firstStage.id,
      status: 'pending',
    })

  return Response.json({ success: true, application_id: application.id })
}
