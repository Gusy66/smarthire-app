import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

type CandidateImportData = {
  nome?: string
  email?: string
  telefone?: string
  vaga_titulo?: string
  etapa_nome?: string
  cidade?: string
  estado?: string
  genero?: string
  idiomas?: string
  formacao?: string
  [key: string]: any
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser()
    const supabase = getSupabaseAdmin()
    const { candidates: candidatesList } = await req.json()

    if (!user.company_id) {
      return Response.json(
        { error: { code: 'missing_company', message: 'Usuário não vinculado a nenhuma empresa. Configure uma empresa antes de importar candidatos.' } },
        { status: 400 }
      )
    }

    if (!candidatesList || !Array.isArray(candidatesList)) {
      return Response.json(
        { error: { code: 'invalid_format', message: 'candidates deve ser um array' } },
        { status: 400 }
      )
    }

    const imported: string[] = []
    const errors: { row: number; email: string; error: string }[] = []

    for (let rowIdx = 0; rowIdx < candidatesList.length; rowIdx++) {
      try {
        const row = candidatesList[rowIdx] as CandidateImportData
        const rowNumber = rowIdx + 2 // +1 para linha de cabeçalho, +1 para indexação começar em 1

        // Validar campos obrigatórios
        const nome = row.nome?.trim()
        const email = row.email?.trim()
        const telefone = row.telefone?.trim()
        const vagaTitulo = row.vaga_titulo?.trim()
        const etapaNome = row.etapa_nome?.trim()

        if (!nome || !email || !telefone || !vagaTitulo || !etapaNome) {
          errors.push({
            row: rowNumber,
            email: email || 'N/A',
            error: 'Campos obrigatórios faltando: nome, email, telefone, vaga_titulo, etapa_nome',
          })
          continue
        }

        // Buscar job_id pela titulo da vaga
        const normalize = (value: string) =>
          value
            .normalize('NFD')
            .replace(/\p{M}+/gu, '')
            .trim()
            .toLowerCase()

        const { data: jobData, error: jobError } = await supabase
          .from('jobs')
          .select('id, company_id')
          .eq('company_id', user.company_id)
          .ilike('title', vagaTitulo)
          .limit(1)
          .single()

        if (jobError || !jobData) {
          errors.push({
            row: rowNumber,
            email,
            error: `Vaga "${vagaTitulo}" não encontrada`,
          })
          continue
        }

        // Buscar stage_id pela nome da etapa
        const { data: stageRows, error: stageError } = await supabase
          .from('job_stages')
          .select('id, name')
          .eq('job_id', jobData.id)
          .order('order_index', { ascending: true })

        if (stageError || !stageRows || stageRows.length === 0) {
          errors.push({
            row: rowNumber,
            email,
            error: `Etapa "${etapaNome}" não encontrada para a vaga "${vagaTitulo}"`,
          })
          continue
        }

        const etapaNormalizada = normalize(etapaNome)
        const stageData = stageRows.find((stage) => normalize(stage.name) === etapaNormalizada)

        if (!stageData) {
          errors.push({
            row: rowNumber,
            email,
            error: `Etapa "${etapaNome}" não encontrada para a vaga "${vagaTitulo}"`,
          })
          continue
        }

        // Verificar se candidato já existe
        const { data: existingCandidate } = await supabase
          .from('candidates')
          .select('id')
          .eq('email', email)
          .limit(1)
          .single()

        if (existingCandidate) {
          errors.push({
            row: rowNumber,
            email,
            error: 'Candidato com este email já existe',
          })
          continue
        }

        // Criar candidato
        const { data: candidateData, error: candidateError } = await supabase
          .from('candidates')
          .insert([
            {
              name: nome,
              email,
              phone: telefone,
              city: row.cidade?.trim() || null,
              state: row.estado?.trim() || null,
              address: null,
              children: null,
              gender: row.genero?.trim() || null,
              languages: row.idiomas
                ? row.idiomas
                    .split(/[,;]+/)
                    .map((l: string) => l.trim())
                    .filter((l: string) => l)
                : [],
              education: row.formacao?.trim() || null,
              resume_path: null,
              resume_bucket: null,
              created_by: user.id,
              company_id: user.company_id,
            },
          ])
          .select('id')
          .single()

        if (candidateError || !candidateData) {
          errors.push({
            row: rowNumber,
            email,
            error: candidateError?.message || 'Erro ao criar candidato',
          })
          continue
        }

        // Criar application
        const { data: appData, error: appError } = await supabase
          .from('applications')
          .insert([
            {
              job_id: jobData.id,
              candidate_id: candidateData.id,
              created_by: user.id,
            },
          ])
          .select('id')
          .single()

        if (appError || !appData) {
          errors.push({
            row: rowNumber,
            email,
            error: appError?.message || 'Erro ao criar aplicação',
          })
          continue
        }

        // Criar application_stage
        const { error: appStageError } = await supabase
          .from('application_stages')
          .insert([
            {
              application_id: appData.id,
              stage_id: stageData.id,
            },
          ])

        if (appStageError) {
          errors.push({
            row: rowNumber,
            email,
            error: appStageError.message || 'Erro ao criar stage da aplicação',
          })
          continue
        }

        imported.push(email)
      } catch (error) {
        errors.push({
          row: rowIdx + 2,
          email: 'N/A',
          error: error instanceof Error ? error.message : 'Erro desconhecido',
        })
      }
    }

    return Response.json({
      imported: imported.length,
      errors: errors.length > 0 ? errors : undefined,
      total: candidatesList.length,
    })
  } catch (error) {
    console.error('Erro na importação de candidatos:', error)
    return Response.json(
      { error: { code: 'error', message: error instanceof Error ? error.message : 'Erro ao processar importação' } },
      { status: 500 }
    )
  }
}
