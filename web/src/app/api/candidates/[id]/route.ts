import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  let user
  try {
    user = await requireUser()
  } catch {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  const body = await req.json()
  const { resume_path, resume_bucket } = body || {}

  if (!resume_path || !resume_bucket) {
    return Response.json({
      error: { code: 'validation_error', message: 'resume_path e resume_bucket são obrigatórios' },
    }, { status: 400 })
  }

  const { data: candidate, error: fetchError } = await supabase
    .from('candidates')
    .select('id, company_id')
    .eq('id', candidateId)
    .single()

  if (fetchError) {
    return Response.json({ error: { code: 'db_error', message: fetchError.message } }, { status: 500 })
  }

  if (!candidate) {
    return Response.json({ error: { code: 'not_found', message: 'Candidato não encontrado' } }, { status: 404 })
  }

  if (candidate.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Acesso negado' } }, { status: 403 })
  }

  const { error: updateError } = await supabase
    .from('candidates')
    .update({
      resume_path,
      resume_bucket,
    })
    .eq('id', candidateId)

  if (updateError) {
    return Response.json({ error: { code: 'db_error', message: updateError.message } }, { status: 500 })
  }

  return Response.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: candidateId } = await params
  const supabase = getSupabaseAdmin()

  try {
    await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  try {
    // Deletar todas as aplicações e seus registros associados
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)

    if (appsError) {
      return Response.json({ error: { code: 'db_error', message: appsError.message } }, { status: 500 })
    }

    // Deletar application_stages para cada application
    if (applications && applications.length > 0) {
      const appIds = applications.map(a => a.id)
      const { error: stagesError } = await supabase
        .from('application_stages')
        .delete()
        .in('application_id', appIds)

      if (stagesError) {
        return Response.json({ error: { code: 'db_error', message: stagesError.message } }, { status: 500 })
      }

      // Deletar applications
      const { error: deleteAppsError } = await supabase
        .from('applications')
        .delete()
        .in('id', appIds)

      if (deleteAppsError) {
        return Response.json({ error: { code: 'db_error', message: deleteAppsError.message } }, { status: 500 })
      }
    }

    // Deletar o candidato
    const { error: deleteCandidateError } = await supabase
      .from('candidates')
      .delete()
      .eq('id', candidateId)

    if (deleteCandidateError) {
      return Response.json({ error: { code: 'db_error', message: deleteCandidateError.message } }, { status: 500 })
    }

    return Response.json({ ok: true })
  } catch (error) {
    console.error('Erro ao deletar candidato:', error)
    return Response.json({ error: { code: 'error', message: error instanceof Error ? error.message : 'Erro ao deletar candidato' } }, { status: 500 })
  }
}
