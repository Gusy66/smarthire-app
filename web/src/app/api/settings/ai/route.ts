import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'
import { requireUser } from '../../_lib/auth'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

    if (!user.company_id) {
      return Response.json({ error: { code: 'missing_company', message: 'Usuário sem empresa vinculada' } }, { status: 400 })
    }

    // Buscar configurações da empresa
    const { data, error } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('company_id', user.company_id)
      .single()

    if (error && error.code !== 'PGRST116') {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    // Retornar configurações padrão se não existir
    const defaultConfig = {
      openai_api_key: '',
      model: 'gpt-4o-mini',
      temperature: 0.3,
      max_tokens: 2000,
      company_id: user.company_id,
    }

    // Decodificar chave antes de enviar ao front (armazenada em base64)
    const openai_api_key =
      data?.openai_api_key ? Buffer.from(data.openai_api_key, 'base64').toString('utf-8') : ''

    return Response.json(
      data
        ? { ...data, openai_api_key }
        : { ...defaultConfig, openai_api_key: '' }
    )
  } catch (error) {
    console.error('Erro ao buscar configurações da IA:', error)
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    const user = await requireUser()

    if (!user.company_id) {
      return Response.json({ error: { code: 'missing_company', message: 'Usuário sem empresa vinculada' } }, { status: 400 })
    }

    const body = await req.json()
    const { openai_api_key, model, temperature, max_tokens } = body

    // Validar dados
    if (!openai_api_key || !model) {
      return Response.json({ error: { code: 'validation_error', message: 'API key e modelo são obrigatórios' } }, { status: 400 })
    }

    if (temperature < 0 || temperature > 1) {
      return Response.json({ error: { code: 'validation_error', message: 'Temperatura deve estar entre 0 e 1' } }, { status: 400 })
    }

    if (max_tokens < 100 || max_tokens > 4000) {
      return Response.json({ error: { code: 'validation_error', message: 'Max tokens deve estar entre 100 e 4000' } }, { status: 400 })
    }

    // Criptografar a API key (em produção, usar uma biblioteca de criptografia adequada)
    const encryptedApiKey = Buffer.from(openai_api_key).toString('base64')

    const upsertPayload = {
      user_id: user.id, // mantém quem salvou
      company_id: user.company_id,
      openai_api_key: encryptedApiKey,
      model,
      temperature,
      max_tokens,
      updated_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('ai_settings')
      .upsert(upsertPayload, { onConflict: 'company_id' })

    if (error) {
      return Response.json({ error: { code: 'db_error', message: error.message } }, { status: 500 })
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Erro ao salvar configurações da IA:', error)
    return Response.json({ error: { code: 'internal_error', message: 'Erro interno do servidor' } }, { status: 500 })
  }
}
