import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'

type Params = { params: Promise<{ token: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  if (!token) {
    return Response.json({ error: { code: 'validation_error', message: 'Token inválido' } }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()
  const { data: job, error } = await supabase
    .from('jobs')
    .select('id, title, description, location, status, department, job_description, responsibilities, requirements_and_skills, public_token, companies(name)')
    .eq('public_token', token)
    .maybeSingle()

  if (error || !job) {
    return Response.json({ error: { code: 'not_found', message: 'Vaga não encontrada' } }, { status: 404 })
  }

  if (job.status !== 'open') {
    return Response.json({ error: { code: 'closed', message: 'Vaga não está aberta para candidaturas' } }, { status: 404 })
  }

  return Response.json({
    item: {
      id: job.id,
      title: job.title,
      description: job.description,
      location: job.location,
      department: job.department,
      job_description: job.job_description,
      responsibilities: job.responsibilities,
      requirements_and_skills: job.requirements_and_skills,
      company_name: (job as any).companies?.name ?? null,
      public_token: job.public_token,
    },
  })
}
