import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

// Lista currículos do candidato vinculado a uma aplicação
export async function GET(_: NextRequest, { params }: Params) {
  const { id: applicationId } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  // Buscar aplicação
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select('id, candidate_id, jobs(company_id, created_by)')
    .eq('id', applicationId)
    .maybeSingle()

  if (appError || !application) {
    return Response.json({ error: { code: 'not_found', message: 'Aplicação não encontrada' } }, { status: 404 })
  }

  const job = application.jobs as any
  if (job.company_id !== user.company_id || job.created_by !== user.id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso a esta aplicação' } }, { status: 403 })
  }

  // Buscar currículo do candidato (armazenado diretamente na tabela candidates)
  const { data: candidate, error: candError } = await supabase
    .from('candidates')
    .select('id, name, resume_path, resume_bucket')
    .eq('id', application.candidate_id)
    .maybeSingle()

  if (candError || !candidate) {
    return Response.json({ error: { code: 'not_found', message: 'Candidato não encontrado' } }, { status: 404 })
  }

  const resumes = []
  if (candidate.resume_path && candidate.resume_bucket) {
    const normalizedPath = normalizeStoragePath(candidate.resume_path, candidate.resume_bucket)

    // Gerar URL assinada para download
    const { data: signedUrlData } = await supabase.storage
      .from(candidate.resume_bucket)
      .createSignedUrl(normalizedPath, 60 * 60) // 1 hora

    resumes.push({
      id: candidate.id,
      candidate_name: candidate.name,
      resume_path: normalizedPath,
      resume_bucket: candidate.resume_bucket,
      storage_path: `${candidate.resume_bucket}/${normalizedPath}`,
      signed_url: signedUrlData?.signedUrl || null,
      created_at: null, // não temos data de criação do CV, mas podemos usar created_at do candidato
    })
  }

  // Também buscar documentos da tabela documents se houver
  const { data: documents } = await supabase
    .from('documents')
    .select('id, type, storage_path, created_at')
    .eq('owner_type', 'candidate')
    .eq('owner_id', candidate.id)
    .eq('type', 'resume')

  if (documents && documents.length > 0) {
    for (const doc of documents) {
      const bucketMatch = doc.storage_path.match(/^([^/]+)\/(.+)$/)
      if (bucketMatch) {
        const [, bucket, path] = bucketMatch
        const { data: signedUrlData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60)

        resumes.push({
          id: doc.id,
          candidate_name: candidate.name,
          resume_path: path,
          resume_bucket: bucket,
          storage_path: doc.storage_path,
          signed_url: signedUrlData?.signedUrl || null,
          created_at: doc.created_at,
        })
      }
    }
  }

  return Response.json({ items: resumes })
}

function normalizeStoragePath(path: string, bucket: string) {
  if (!path) return path
  const prefix = `${bucket}/`
  const cleaned = path.startsWith(prefix) ? path.slice(prefix.length) : path
  return cleaned.replace(/^\/+/, '')
}

