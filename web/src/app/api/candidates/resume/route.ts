import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser()
    const supabase = getSupabaseAdmin()

    const { searchParams } = new URL(req.url)
    const path = searchParams.get('path')
    const bucket = searchParams.get('bucket')

    if (!path || !bucket) {
      return Response.json({ error: { code: 'missing_params', message: 'path e bucket são obrigatórios' } }, { status: 400 })
    }

    // Validar que o bucket é um dos permitidos
    const allowedBuckets = ['resumes', 'stage-documents', 'audios', 'transcripts']
    if (!allowedBuckets.includes(bucket)) {
      return Response.json({ error: { code: 'invalid_bucket', message: 'Bucket inválido' } }, { status: 400 })
    }

    const normalizedPath = normalizeStoragePath(path, bucket)

    // Gerar URL assinada do Supabase
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(normalizedPath, 60 * 60) // 1 hora

    if (error) {
      return Response.json({ error: { code: 'storage_error', message: error.message } }, { status: 500 })
    }

    // Redirecionar para a URL assinada
    return Response.redirect(data.signedUrl)
  } catch (error) {
    return Response.json({ error: { code: 'error', message: error instanceof Error ? error.message : 'Erro ao processar requisição' } }, { status: 500 })
  }
}

function normalizeStoragePath(path: string, bucket: string) {
  if (!path) return path
  const prefix = `${bucket}/`
  const cleaned = path.startsWith(prefix) ? path.slice(prefix.length) : path
  return cleaned.replace(/^\/+/, '')
}
