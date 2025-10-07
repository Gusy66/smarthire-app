// Script para testar autenticação no endpoint
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NjUyMDAsImV4cCI6MjA3NDE0MTIwMH0.SKRIk0UeAKODdTstwmXR2BxYRPKzdwC9K5HANG-lz4A'

const supabase = createClient(supabaseUrl, anonKey)

async function testAuth() {
  console.log('🔐 Testando autenticação...')
  
  try {
    // Testar login com usuário existente
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
      email: 'gustavobocci44@gmail.com',
      password: '123456' // Senha comum para teste
    })
    
    if (loginError) {
      console.log('❌ Erro no login:', loginError.message)
      
      // Tentar outros usuários
      const testUsers = [
        'rafamb1993@gmail.com',
        'g.montenegro@outlook.com.br',
        'zedaobocci@hotmail.com',
        'gustavobocci@hotmail.com'
      ]
      
      for (const email of testUsers) {
        console.log(`\n🔑 Tentando login com: ${email}`)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email,
          password: '123456'
        })
        
        if (!error) {
          console.log(`✅ Login bem-sucedido com: ${email}`)
          console.log(`   Token: ${data.session?.access_token?.substring(0, 50)}...`)
          
          // Testar endpoint com token
          await testEndpointWithToken(data.session.access_token)
          break
        } else {
          console.log(`❌ Falhou: ${error.message}`)
        }
      }
      
    } else {
      console.log('✅ Login bem-sucedido!')
      console.log(`   Usuário: ${loginData.user?.email}`)
      console.log(`   Token: ${loginData.session?.access_token?.substring(0, 50)}...`)
      
      // Testar endpoint com token
      await testEndpointWithToken(loginData.session.access_token)
    }
    
  } catch (error) {
    console.log('❌ Erro inesperado:', error.message)
  }
}

async function testEndpointWithToken(token) {
  console.log('\n📡 Testando endpoint com token...')
  
  try {
    const response = await fetch('http://localhost:3001/api/stages/test-stage-id/evaluate', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${token}`
      },
      body: JSON.stringify({
        application_id: 'test-app-id'
      })
    })
    
    console.log(`   Status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.log(`   Erro: ${errorText}`)
    } else {
      const result = await response.json()
      console.log(`   Sucesso: ${JSON.stringify(result)}`)
    }
    
  } catch (error) {
    console.log(`   Erro na requisição: ${error.message}`)
  }
}

testAuth()
