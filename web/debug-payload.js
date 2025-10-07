// Script para debugar o payload enviado para IA
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function debugPayload() {
  console.log('🔍 Debugando payload para IA...')
  
  try {
    // Buscar dados reais do banco
    const { data: stages, error: stagesError } = await supabase
      .from('job_stages')
      .select('id, name, threshold, stage_weight, description, jobs(description)')
      .limit(1)
    
    if (stagesError) {
      console.log('❌ Erro ao buscar etapas:', stagesError.message)
      return
    }
    
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id')
      .limit(1)
    
    if (appsError) {
      console.log('❌ Erro ao buscar aplicações:', appsError.message)
      return
    }
    
    if (!stages.length || !applications.length) {
      console.log('❌ Não há etapas ou aplicações no banco')
      return
    }
    
    const stage = stages[0]
    const application = applications[0]
    
    console.log('✅ Dados encontrados:')
    console.log('   Etapa:', stage.id, '-', stage.name)
    console.log('   Aplicação:', application.id)
    
    // Criar payload como o frontend faz
    const payload = {
      stage_id: stage.id,
      application_id: application.id,
      resume_path: null,
      resume_bucket: null,
      resume_signed_url: null,
      audio_path: null,
      audio_bucket: null,
      audio_signed_url: null,
      transcript_path: null,
      transcript_bucket: null,
      transcript_signed_url: null,
      user_id: 'test-user-id',
      stage: {
        id: stage.id,
        name: stage.name,
        threshold: stage.threshold,
        stage_weight: stage.stage_weight,
        description: stage.description || null,
        job_description: stage.jobs?.description || null,
      },
      requirements: [],
      prompt_template: 'Analise o candidato baseado nos critérios da etapa.',
    }
    
    console.log('\n📦 Payload que será enviado:')
    console.log(JSON.stringify(payload, null, 2))
    
    // Testar validação do payload
    console.log('\n🔍 Verificando campos obrigatórios:')
    console.log('   stage_id:', payload.stage_id ? '✅' : '❌')
    console.log('   application_id:', payload.application_id ? '✅' : '❌')
    
    // Testar com serviço de IA
    console.log('\n🤖 Testando com serviço de IA...')
    try {
      const response = await fetch('http://localhost:8000/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      console.log('   Status:', response.status)
      
      if (response.ok) {
        const result = await response.json()
        console.log('   ✅ Sucesso:', result)
      } else {
        const error = await response.text()
        console.log('   ❌ Erro:', error)
      }
      
    } catch (error) {
      console.log('   ❌ Erro na requisição:', error.message)
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message)
  }
}

debugPayload()
