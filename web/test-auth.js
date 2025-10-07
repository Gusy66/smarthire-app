// Script para testar autenticação com Supabase
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMDAsImV4cCI6MjA3NDE0MTIwMH0.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

console.log('Testando autenticação com Supabase...')
console.log('URL:', supabaseUrl)
console.log('Anon Key (primeiros 50 chars):', anonKey.substring(0, 50) + '...')

const supabase = createClient(supabaseUrl, anonKey)

async function testAuth() {
  try {
    // Testar conexão básica
    const { data, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('❌ Erro na autenticação:', error.message)
      return
    }
    
    console.log('✅ Autenticação funcionando!')
    console.log('Sessão atual:', data.session ? 'Usuário logado' : 'Nenhum usuário logado')
    
    // Testar se conseguimos acessar dados públicos
    const { data: testData, error: testError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (testError) {
      console.log('⚠️  Erro ao acessar dados:', testError.message)
      console.log('Isso é normal se não houver tabela users ou RLS estiver ativo')
    } else {
      console.log('✅ Acesso a dados funcionando!')
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
  }
}

testAuth()
