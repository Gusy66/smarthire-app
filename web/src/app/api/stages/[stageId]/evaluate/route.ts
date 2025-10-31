import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../../_lib/supabaseAdmin'
import { requireUser } from '../../../_lib/auth'

type Params = { params: Promise<{ stageId: string }> }

// Dispara IA para avaliar candidato numa etapa
export async function POST(req: NextRequest, { params }: Params) {
  console.log('[DEBUG API] Iniciando avaliação...')
  const { stageId } = await params
  console.log('[DEBUG API] stageId:', stageId)
  
  const body = await req.json()
  console.log('[DEBUG API] Body recebido:', body)
  
  const {
    application_id,
    resume_path,
    resume_bucket,
    resume_signed_url,
    audio_path,
    audio_bucket,
    audio_signed_url,
    transcript_path,
    transcript_bucket,
    transcript_signed_url,
    // Novos tipos de documentos de etapa
    document_path,
    document_bucket,
    document_signed_url,
    document_type, // 'pdf', 'docx', 'doc', 'json'
  } = body || {}
  
  if (!application_id) {
    console.log('[DEBUG API] application_id não fornecido')
    return Response.json({ error: { code: 'validation_error', message: 'application_id é obrigatório' } }, { status: 400 })
  }

  console.log('[DEBUG API] Obtendo Supabase admin...')
  const supabase = getSupabaseAdmin()
  
  console.log('[DEBUG API] Verificando usuário...')
  const user = await requireUser()
  console.log('[DEBUG API] Usuário:', user?.id)
  
  // Garante application_stage
  const { data: stage } = await supabase
    .from('job_stages')
    .select('id, name, threshold, stage_weight, description, jobs(description)')
    .eq('id', stageId)
    .single()
  const { data: appStageExisting } = await supabase
    .from('application_stages')
    .select('id, status')
    .eq('application_id', application_id)
    .eq('stage_id', stageId)
    .maybeSingle()
  const applicationStageId = appStageExisting?.id
    ? appStageExisting.id
    : (await supabase
        .from('application_stages')
        .insert({ application_id, stage_id: stageId, status: 'running' })
        .select('id')
        .single()).data!.id

  // Não carrega mais requisitos específicos - usa apenas a descrição da etapa
  const requirements: any[] = []

  // Descobre template vinculado ou padrão do usuário
  const { data: stageTemplate } = await supabase
    .from('stage_prompt_templates')
    .select('prompt_templates(content)')
    .eq('stage_id', stageId)
    .maybeSingle()

  let promptTemplateContent: string | null = stageTemplate?.prompt_templates?.content ?? null

  if (!promptTemplateContent) {
    const { data: defaultTemplate } = await supabase
      .from('prompt_templates')
      .select('content')
      .eq('user_id', user.id)
      .eq('is_default', true)
      .maybeSingle()

    promptTemplateContent = defaultTemplate?.content ?? null
  }

  // Buscar documentos de etapa se document_path não foi fornecido diretamente
  let finalDocumentPath = document_path
  let finalDocumentBucket = document_bucket
  let finalDocumentSignedUrl = document_signed_url
  let finalDocumentType = document_type

  if (!finalDocumentPath) {
    // Buscar documentos anexados à etapa
    const { data: stageDocs } = await supabase
      .from('stage_documents')
      .select('type, storage_path')
      .eq('stage_id', stageId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (stageDocs && stageDocs.length > 0) {
      const doc = stageDocs[0]
      finalDocumentType = doc.type
      const bucketMatch = doc.storage_path.match(/^([^/]+)\/(.+)$/)
      if (bucketMatch) {
        const [, bucket, path] = bucketMatch
        finalDocumentBucket = bucket
        finalDocumentPath = path
        
        // Gerar URL assinada
        const { data: signedUrlData } = await supabase.storage
          .from(bucket)
          .createSignedUrl(path, 60 * 60)
        finalDocumentSignedUrl = signedUrlData?.signedUrl || null
      }
    }
  }

  const payload = {
    stage_id: stageId,
    application_id,
    resume_path,
    resume_bucket,
    resume_signed_url,
    audio_path,
    audio_bucket,
    audio_signed_url,
    transcript_path,
    transcript_bucket,
    transcript_signed_url,
    // Novos campos para documentos de etapa
    document_path: finalDocumentPath,
    document_bucket: finalDocumentBucket,
    document_signed_url: finalDocumentSignedUrl,
    document_type: finalDocumentType,
    user_id: user.id,
    stage: {
      id: stage?.id,
      name: stage?.name,
      threshold: stage?.threshold,
      stage_weight: stage?.stage_weight,
      description: stage?.description ?? null,
      job_description: stage?.jobs?.description ?? null,
    },
    requirements: requirements ?? [],
    prompt_template: promptTemplateContent,
  }

  // Dispara avaliação completa na IA
  console.log('Enviando payload para IA:', JSON.stringify(payload, null, 2))
  
  try {
    const aiUrl = `${process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://127.0.0.1:8000'}/v1/evaluate`
    console.log('[DEBUG API] URL da IA:', aiUrl)
    
    const aiRes = await fetch(aiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    
    console.log('[DEBUG API] Status da resposta da IA:', aiRes.status)
    
    if (!aiRes.ok) {
      const errorText = await aiRes.text()
      console.error('[DEBUG API] AI service error:', errorText)
      return Response.json({ error: { code: 'ai_error', message: 'Erro ao conectar com serviço de IA' } }, { status: 500 })
    }
    
    const aiJson = await aiRes.json()
    console.log('[DEBUG API] Resposta da IA:', aiJson)
    
    const runId = aiJson?.id || 'evaluate-run'
    
    // Registra o run na base
    await supabase
      .from('stage_ai_runs')
      .insert({ 
        application_stage_id: applicationStageId, 
        stage_id: stageId,
        type: 'evaluate', 
        status: 'running',
        run_id: runId
      })
    
    return Response.json({ 
      application_stage_id: applicationStageId, 
      run_id: runId, 
      status: 'running' 
    })
    
  } catch (error) {
    console.error('[DEBUG API] Erro na requisição para IA:', error)
    return Response.json({ error: { code: 'ai_error', message: 'Erro ao conectar com serviço de IA' } }, { status: 500 })
  }
}


