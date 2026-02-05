import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

const ALLOWED_RESUME_TYPES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
}

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 10
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

function getRateLimitKey(req: NextRequest) {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  const ip = forwarded.split(',')[0]?.trim() || 'unknown'
  return ip
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

function sanitizeFilename(name: string) {
  const base = (name || 'arquivo.pdf')
    .normalize('NFD')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
  return base.length > 0 ? base : 'arquivo.pdf'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { filename = 'resume.pdf', content_type = 'application/pdf', file_size = 0, job_token } = body || {}

    if (!job_token || typeof job_token !== 'string') {
      return Response.json({ error: { code: 'validation_error', message: 'Token inválido' } }, { status: 400 })
    }

    const allowed = ALLOWED_RESUME_TYPES[content_type as keyof typeof ALLOWED_RESUME_TYPES]
    if (!allowed) {
      return Response.json({
        error: {
          code: 'invalid_file_type',
          message: `Tipo de arquivo não permitido. Tipos permitidos: ${Object.keys(ALLOWED_RESUME_TYPES).join(', ')}`,
        },
      }, { status: 400 })
    }

    if (typeof file_size === 'number' && file_size > MAX_FILE_SIZE_BYTES) {
      return Response.json({ error: { code: 'file_too_large', message: 'Arquivo excede o tamanho permitido (8MB)' } }, { status: 400 })
    }

    const rlKey = getRateLimitKey(req)
    if (!checkRateLimit(rlKey)) {
      return Response.json({ error: { code: 'rate_limited', message: 'Muitas tentativas. Tente novamente mais tarde.' } }, { status: 429 })
    }

    const supabase = getSupabaseAdmin()
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('id, status')
      .eq('public_token', job_token)
      .maybeSingle()

    if (jobError || !job) {
      return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
    }
    if (job.status !== 'open') {
      return Response.json({ error: { code: 'closed', message: 'Vaga não está aberta para candidaturas' } }, { status: 404 })
    }

    const bucket = 'resumes'
    const sanitized = sanitizeFilename(filename)
    const path = `public/${job.id}/${Date.now()}-${sanitized}`

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, {
        contentType: content_type,
        upsert: false,
      })

    if (error || !data?.signedUrl) {
      return Response.json({ error: { code: 'storage_error', message: error?.message || 'Erro ao gerar URL de upload' } }, { status: 500 })
    }

    const { data: downloadSignedUrl } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 30)

    return Response.json({
      upload_url: data.signedUrl,
      path,
      bucket,
      view_url: downloadSignedUrl?.signedUrl ?? null,
    })
  } catch (error) {
    console.error('Upload público error:', error)
    return Response.json({
      error: {
        code: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    }, { status: 500 })
  }
}
