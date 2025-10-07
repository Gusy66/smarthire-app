import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: jobId } = await params
  const supabase = getSupabaseAdmin()
  let user
  try {
    user = await requireUser()
  } catch (error) {
    return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
  }

  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, title, description, created_by, company_id')
    .eq('id', jobId)
    .maybeSingle()

  if (error || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.company_id && job.company_id !== user.company_id) {
    return Response.json({ error: { code: 'forbidden', message: 'Sem acesso à vaga' } }, { status: 403 })
  }

  const updates: Record<string, unknown> = {}
  if (!job.company_id) updates.company_id = user.company_id
  if (!job.created_by) updates.created_by = user.id
  if (Object.keys(updates).length) {
    await supabase.from('jobs').update(updates).eq('id', jobId)
  }

  return Response.json({ item: { ...job, ...updates } })
}

