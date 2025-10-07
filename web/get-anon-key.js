// Script para obter a chave anônima do Supabase
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

console.log('Testando conexão com Supabase...')

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function testConnection() {
  try {
    // Testar conexão básica
    const { data, error } = await supabase.from('users').select('count').limit(1)
    
    if (error) {
      console.error('Erro na conexão:', error)
      return
    }
    
    console.log('✅ Conexão com Supabase funcionando!')
    console.log('URL:', supabaseUrl)
    console.log('Service Role Key (primeiros 20 chars):', serviceRoleKey.substring(0, 20) + '...')
    
    // A chave anônima geralmente é similar, mas com role 'anon'
    // Vamos tentar algumas variações comuns
    const possibleAnonKeys = [
      serviceRoleKey.replace('service_role', 'anon'),
      serviceRoleKey.replace('InR5cCI6IkpXVCJ9', 'InR5cCI6IkpXVCJ9').replace('service_role', 'anon')
    ]
    
    console.log('\nChaves anônimas possíveis:')
    possibleAnonKeys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.substring(0, 50)}...`)
    })
    
  } catch (error) {
    console.error('Erro inesperado:', error)
  }
}

testConnection()
