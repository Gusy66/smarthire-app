// Script para verificar configurações de IA
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODU2NTIwMCwiZXhwIjoyMDc0MTQxMjAwfQ.KA0NQK-UIRqFcq7JzkLAakVH9exPklar0WH7AcEQito'

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function checkAISettings() {
  console.log('🔍 Verificando configurações de IA...')
  
  try {
    const { data, error } = await supabase.from('ai_settings').select('*')
    if (error) {
      console.log('❌ Erro ao buscar ai_settings:', error.message)
      return
    }
    
    console.log(`✅ ai_settings encontrados: ${data.length}`)
    data.forEach((setting, index) => {
      console.log(`   ${index + 1}. User ID: ${setting.user_id}`)
      console.log(`      Model: ${setting.model}`)
      console.log(`      API Key (primeiros 20 chars): ${setting.openai_api_key.substring(0, 20)}...`)
      console.log(`      Temperature: ${setting.temperature}`)
      console.log(`      Max Tokens: ${setting.max_tokens}`)
      console.log('')
    })
    
    // Testar função RPC
    console.log('🔧 Testando função RPC get_ai_settings_by_user...')
    const userId = data.length > 0 ? data[0].user_id : 'd8342330-8160-4132-8289-187213bbb057'
    
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_ai_settings_by_user', { p_user_id: userId })
    if (rpcError) {
      console.log('❌ Erro na função RPC:', rpcError.message)
    } else {
      console.log('✅ Função RPC funcionando:', rpcData)
    }
    
  } catch (error) {
    console.log('❌ Erro geral:', error.message)
  }
}

checkAISettings()
