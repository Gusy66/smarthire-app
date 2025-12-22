import { requireUser } from "../../_lib/auth"
import { getSupabaseAdmin } from "../../_lib/supabaseAdmin"

export async function GET() {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

    // Contagem de vagas ativas (status = 'open')
    const { count: activeJobs } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)
      .eq('status', 'open')

    // Total de candidatos
    const { count: totalCandidates } = await supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)

    // Vagas criadas esta semana
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const { count: jobsThisWeek } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)
      .gte('created_at', oneWeekAgo.toISOString())

    // Candidatos cadastrados hoje
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const { count: candidatesToday } = await supabase
      .from('candidates')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)
      .gte('created_at', today.toISOString())

    // Buscar vagas fechadas para calcular tempo médio e taxa de sucesso
    const { data: closedJobs } = await supabase
      .from('jobs')
      .select('id, created_at, updated_at, status')
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)
      .eq('status', 'closed')

    // Todas as vagas para calcular taxa de sucesso
    const { count: totalJobs } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)

    // Calcular tempo médio de preenchimento (dias entre criação e fechamento)
    let avgTimeDays = 0
    if (closedJobs && closedJobs.length > 0) {
      const totalDays = closedJobs.reduce((sum, job) => {
        const created = new Date(job.created_at)
        const closed = new Date(job.updated_at || job.created_at)
        const diffDays = Math.ceil((closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return sum + Math.max(diffDays, 1)
      }, 0)
      avgTimeDays = Math.round(totalDays / closedJobs.length)
    }

    // Taxa de sucesso: vagas fechadas / total de vagas
    const successRate = totalJobs && totalJobs > 0 
      ? Math.round(((closedJobs?.length || 0) / totalJobs) * 100) 
      : 0

    // Vagas recentes com contagem de candidatos
    const { data: recentJobs } = await supabase
      .from('jobs')
      .select('id, title, status, created_at')
      .eq('company_id', user.company_id)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Buscar contagem de candidatos por vaga
    const recentJobsWithCandidates = await Promise.all(
      (recentJobs || []).map(async (job) => {
        const { count } = await supabase
          .from('applications')
          .select('id', { count: 'exact', head: true })
          .eq('job_id', job.id)
        
        return {
          ...job,
          candidate_count: count || 0
        }
      })
    )

    return Response.json({
      // Métricas principais
      active_jobs: activeJobs ?? 0,
      total_candidates: totalCandidates ?? 0,
      avg_time_days: avgTimeDays,
      success_rate: successRate,
      
      // Variações
      jobs_this_week: jobsThisWeek ?? 0,
      candidates_today: candidatesToday ?? 0,
      
      // Dados legados (manter compatibilidade)
      jobs_created_by_user: totalJobs ?? 0,
      candidates_created_by_user: totalCandidates ?? 0,
      
      // Vagas recentes com contagem de candidatos
      recent_jobs: recentJobsWithCandidates,
    })
  } catch (error: any) {
    if (error?.message === 'unauthorized') {
      return Response.json({ error: { code: 'unauthorized', message: 'Usuário não autenticado' } }, { status: 401 })
    }
    return Response.json({ error: { code: 'internal_error', message: error?.message || 'Erro interno do servidor' } }, { status: 500 })
  }
}
