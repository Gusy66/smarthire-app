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

    // Testar conexão com OpenAI
    const testResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openai_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Teste de conexão. Responda apenas "OK" se recebeu esta mensagem.'
          }
        ],
        max_tokens: 10,
        temperature: 0
      })
    })

    if (!testResponse.ok) {
      const errorData = await testResponse.json()
      return Response.json({ 
        error: { 
          code: 'openai_error', 
          message: errorData.error?.message || 'Erro ao conectar com OpenAI' 
        } 
      }, { status: 400 })
    }

    const testData = await testResponse.json()
    
    return Response.json({ 
      success: true, 
      message: 'Conexão estabelecida com sucesso',
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
