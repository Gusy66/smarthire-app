// Script para verificar dados no banco
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function checkDatabase() {
  console.log('🔍 Verificando dados no banco...')
  
  const tables = ['companies', 'users', 'jobs', 'job_stages', 'applications', 'candidates']
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1)
      if (error) {
        console.log(`❌ ${table}: ${error.message}`)
      } else {
        console.log(`✅ ${table}: ${data.length} registros`)
        if (data.length > 0) {
          console.log(`   Primeiro registro: ${JSON.stringify(data[0], null, 2).substring(0, 100)}...`)
        }
      }
    } catch (e) {
      console.log(`❌ ${table}: erro inesperado`)
    }
  }
}

checkDatabase()
