// Script para encontrar a chave anônima correta
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'

// Possíveis variações da chave anônima baseadas na service role
const possibleKeys = [
  // Chave atual (provavelmente incorreta)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMDAsImV4cCI6MjA3NDE0MTIwMH0.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito',
  
  // Variações comuns
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMDAsImV4cCI6MjA3NDE0MTIwMH0.7YQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ',
  
  // Outras possibilidades
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMDAsImV4cCI6MjA3NDE0MTIwMH0.INVALID_SIGNATURE',
]

async function testKey(key, index) {
  console.log(`\n🔑 Testando chave ${index + 1}:`)
  console.log(`   ${key.substring(0, 50)}...`)
  
  try {
    const supabase = createClient(supabaseUrl, key)
    
    // Testar autenticação básica
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.log(`   ❌ Erro: ${error.message}`)
      return false
    }
    
    console.log(`   ✅ Chave válida! Sessão: ${data.session ? 'Ativa' : 'Nenhuma'}`)
    
    // Testar login com usuário existente
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'gustavobocci44@gmail.com',
      password: '123456' // Senha comum para teste
    })
    
    if (loginError) {
      console.log(`   ⚠️  Login falhou: ${loginError.message}`)
    } else {
      console.log(`   🎉 LOGIN FUNCIONOU! Usuário: ${loginData.user?.email}`)
      return true
    }
    
  } catch (error) {
    console.log(`   ❌ Erro inesperado: ${error.message}`)
  }
  
  return false
}

async function main() {
  console.log('🔍 Procurando chave anônima correta...')
  console.log('=====================================')
  
  for (let i = 0; i < possibleKeys.length; i++) {
    const isValid = await testKey(possibleKeys[i], i)
    if (isValid) {
      console.log(`\n🎯 CHAVE CORRETA ENCONTRADA!`)
      console.log(`   Use esta chave no .env.local:`)
      console.log(`   NEXT_PUBLIC_SUPABASE_ANON_KEY=${possibleKeys[i]}`)
      break
    }
  }
  
  console.log(`\n💡 Se nenhuma chave funcionou, você precisa:`)
  console.log(`   1. Acessar o painel do Supabase`)
  console.log(`   2. Ir em Settings → API`)
  console.log(`   3. Copiar a chave "anon public"`)
  console.log(`   4. Substituir no arquivo .env.local`)
}

main()
