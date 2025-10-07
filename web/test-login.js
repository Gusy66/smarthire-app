// Script para testar login específico
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMDAsImV4cCI6MjA3NDE0MTIwMH0.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

const supabase = createClient(supabaseUrl, anonKey)

async function testLogin(email, password) {
  console.log(`\n🔐 Testando login para: ${email}`)
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password
    })
    
    if (error) {
      console.log(`❌ Erro no login: ${error.message}`)
      console.log(`   Código: ${error.status}`)
      console.log(`   Detalhes: ${JSON.stringify(error, null, 2)}`)
      return false
    }
    
    console.log(`✅ Login bem-sucedido!`)
    console.log(`   Usuário: ${data.user?.email}`)
    console.log(`   ID: ${data.user?.id}`)
    return true
    
  } catch (error) {
    console.log(`❌ Erro inesperado: ${error.message}`)
    return false
  }
}

async function testSignUp(email, password) {
  console.log(`\n📝 Testando cadastro para: ${email}`)
  
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password
    })
    
    if (error) {
      console.log(`❌ Erro no cadastro: ${error.message}`)
      console.log(`   Detalhes: ${JSON.stringify(error, null, 2)}`)
      return false
    }
    
    console.log(`✅ Cadastro bem-sucedido!`)
    console.log(`   Usuário: ${data.user?.email}`)
    console.log(`   Confirmação necessária: ${data.user?.email_confirmed_at ? 'Não' : 'Sim'}`)
    return true
    
  } catch (error) {
    console.log(`❌ Erro inesperado: ${error.message}`)
    return false
  }
}

async function listUsers() {
  console.log(`\n👥 Tentando listar usuários...`)
  
  try {
    // Isso só funciona com service role key
    const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey)
    
    const { data, error } = await adminSupabase.auth.admin.listUsers()
    
    if (error) {
      console.log(`❌ Erro ao listar usuários: ${error.message}`)
      return
    }
    
    console.log(`✅ Usuários encontrados: ${data.users.length}`)
    data.users.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.id})`)
    })
    
  } catch (error) {
    console.log(`❌ Erro inesperado: ${error.message}`)
  }
}

async function main() {
  console.log('🔍 Diagnóstico de Autenticação Supabase')
  console.log('=====================================')
  
  // Testar credenciais comuns
  const testCredentials = [
    { email: 'admin@test.com', password: '123456' },
    { email: 'test@test.com', password: '123456' },
    { email: 'user@test.com', password: 'password' },
    { email: 'gustavo@test.com', password: '123456' }
  ]
  
  // Listar usuários existentes
  await listUsers()
  
  // Testar logins
  for (const cred of testCredentials) {
    await testLogin(cred.email, cred.password)
  }
  
  // Testar cadastro de novo usuário
  const newEmail = `test${Date.now()}@test.com`
  await testSignUp(newEmail, '123456')
  
  // Tentar login com o novo usuário
  await testLogin(newEmail, '123456')
}

main()
