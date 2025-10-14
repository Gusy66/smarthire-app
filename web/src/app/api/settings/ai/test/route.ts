import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdmin()
    await requireUser()

    const body = await req.json()
    const { openai_api_key, model } = body

    if (!openai_api_key || !model) {
      return Response.json({ error: { code: 'validation_error', message: 'API key e modelo são obrigatórios' } }, { status: 400 })
    }

    // Testar conexão via Serviço de IA (executa no mesmo ambiente da IA em produção)
    const aiBaseUrl = process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://localhost:8000'
    const testResponse = await fetch(`${aiBaseUrl}/v1/test-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openai_api_key,
        model,
        temperature: 0,
        max_tokens: 10,
      }),
    })

    if (!testResponse.ok) {
      const errorData = await testResponse.json().catch(() => null)
      return Response.json(
        {
          error: {
            code: 'ai_service_error',
            message: errorData?.error?.message || 'Erro ao validar configuração no serviço de IA',
          },
        },
        { status: testResponse.status }
      )
    }

    const testData = await testResponse.json()
    
    return Response.json({ 
      success: true, 
      message: 'Conexão estabelecida com sucesso (serviço de IA)',
      model: testData.model,
      usage: testData.usage
    })
  } catch (error) {
    console.error('Erro ao testar conexão com OpenAI:', error)
    return Response.json({ 
      error: { 
        code: 'internal_error', 
        message: 'Erro interno do servidor' 
      } 
    }, { status: 500 })
  }
}
