import { requireUser } from "../../_lib/auth"
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin"

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

    // total de vagas
    const { count: totalJobs, error: jobsErr } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
    if (jobsErr) return Response.json({ error: { code: 'db_error', message: jobsErr.message } }, { status: 500 })

    // vagas ativas
    const { count: activeJobs, error: activeErr } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('status', 'open')
    if (activeErr) return Response.json({ error: { code: 'db_error', message: activeErr.message } }, { status: 500 })

    // total de candidatos (todas as vagas da empresa)
    const { count: totalCandidates, error: candErr } = await supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
    if (candErr) return Response.json({ error: { code: 'db_error', message: candErr.message } }, { status: 500 })

    return Response.json({ total_jobs: totalJobs ?? 0, active_jobs: activeJobs ?? 0, total_candidates: totalCandidates ?? 0 })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: error?.message || 'Erro interno do servidor' } }, { status: 500 })
  }
}


