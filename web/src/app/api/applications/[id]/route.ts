import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  
  try {
    await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Não autenticado' } }, { status: 401 })
  }

  // Buscar a aplicação com os dados do candidato
  const { data, error } = await supabase
    .from('applications')
    .select(`
      id,
      job_id,
      candidate_id,
      created_at,
      candidate:candidates(
        id,
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
        resume_bucket
      )
    `)
    .eq('id', id)
    .single()

  if (error) {
    return Response.json({ error: { code: 'not_found', message: 'Aplicação não encontrada' } }, { status: 404 })
  }

  return Response.json({ item: data })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { error } = await supabase.from('applications').delete().eq('id', id)
  if (error) return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
  return Response.json({ ok: true })
}


