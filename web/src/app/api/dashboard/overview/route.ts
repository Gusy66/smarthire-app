import { requireUser } from "../../_lib/auth"
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin"

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

    // Contagem de vagas criadas pelo usuário
    const { count: jobsByUser } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)

    // Contagem de candidatos criados pelo usuário
    const { count: candidatesByUser } = await supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)

    // Vagas recentes (mais ativas/publicadas) - últimas 3
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('id, title, status, created_at')
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(3)

    return Response.json({
      jobs_created_by_user: jobsByUser ?? 0,
      candidates_created_by_user: candidatesByUser ?? 0,
      recent_jobs: recentJobs ?? [],
    })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: error?.message || 'Erro interno do servidor' } }, { status: 500 })
  }
}


