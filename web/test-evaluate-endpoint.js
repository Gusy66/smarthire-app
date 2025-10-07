// Script para testar o endpoint de avaliação
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function testEndpoint() {
  console.log('🔍 Testando endpoint de avaliação...')
  
  try {
    // Testar conexão com Supabase
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, company_id')
      .limit(1)
    
    if (usersError) {
      console.log('❌ Erro ao conectar com Supabase:', usersError.message)
      return
    }
    
    console.log('✅ Conexão com Supabase OK')
    console.log('   Usuários encontrados:', users.length)
    
    // Testar se existe uma etapa
    const { data: stages, error: stagesError } = await supabase
      .from('job_stages')
      .select('id, name')
      .limit(1)
    
    if (stagesError) {
      console.log('❌ Erro ao buscar etapas:', stagesError.message)
      return
    }
    
    console.log('✅ Etapas encontradas:', stages.length)
    
    // Testar se existe uma aplicação
    const { data: applications, error: appsError } = await supabase
      .from('applications')
      .select('id')
      .limit(1)
    
    if (appsError) {
      console.log('❌ Erro ao buscar aplicações:', appsError.message)
      return
    }
    
    console.log('✅ Aplicações encontradas:', applications.length)
    
    // Testar serviço de IA
    try {
      const aiResponse = await fetch('http://localhost:8000/v1/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage_id: 'test',
          application_id: 'test',
          user_id: 'test',
          stage: { name: 'Teste' },
          requirements: [],
          prompt_template: 'Teste'
        })
      })
      
      if (aiResponse.ok) {
        console.log('✅ Serviço de IA respondendo')
      } else {
        console.log('⚠️  Serviço de IA com erro:', aiResponse.status)
      }
    } catch (aiError) {
      console.log('❌ Erro ao conectar com serviço de IA:', aiError.message)
    }
    
    // Testar endpoint Next.js
    try {
      const nextResponse = await fetch('http://localhost:3001/api/stages/test/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          application_id: 'test'
        })
      })
      
      console.log('📡 Status do endpoint Next.js:', nextResponse.status)
      
      if (!nextResponse.ok) {
        const errorText = await nextResponse.text()
        console.log('❌ Erro do endpoint:', errorText)
      } else {
        console.log('✅ Endpoint Next.js funcionando')
      }
      
    } catch (nextError) {
      console.log('❌ Erro ao conectar com Next.js:', nextError.message)
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message)
  }
}

testEndpoint()
