// Script para verificar candidatos atribuídos à vaga
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function checkApplications() {
  console.log('🔍 Verificando candidatos atribuídos à vaga...')
  
  try {
    const { data: applications, error } = await supabase.from('applications').select('*')
    if (error) {
      console.log('❌ Erro ao buscar aplicações:', error.message)
      return
    }
    
    console.log(`✅ Aplicações encontradas: ${applications.length}`)
    applications.forEach((app, index) => {
      console.log(`   ${index + 1}. Application ID: ${app.id}`)
      console.log(`      Candidate ID: ${app.candidate_id}`)
      console.log(`      Job ID: ${app.job_id}`)
      console.log('')
    })
    
    if (applications.length === 0) {
      console.log('⚠️  Nenhum candidato atribuído à vaga!')
      console.log('   Para usar o botão "Enviar para IA", você precisa:')
      console.log('   1. Ir para a página da vaga')
      console.log('   2. Selecionar um candidato')
      console.log('   3. Clicar em "Atribuir à vaga"')
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message)
  }
}

checkApplications()
