// Script para configurar buckets do Supabase Storage
const { createClient } = require('@supabase/supabase-js')

// Usar variáveis de ambiente do sistema ou valores padrão para teste
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pzsnsadqxxxpxaiaavmk.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6c25zYWRxeHh4cHhhaWFhdm1rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczMDU3NTU3MiwiZXhwIjoyMDQ2MTUxNTcyfQ.2YQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ'

console.log('Configurando buckets do Supabase Storage...')
console.log('URL:', supabaseUrl)
console.log('Key (primeiros 20 chars):', supabaseKey.substring(0, 20) + '...')

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupBuckets() {
  try {
    // Listar buckets existentes
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Erro ao listar buckets:', listError)
      return
    }
    
    console.log('Buckets existentes:', buckets.map(b => b.name))
    
    // Buckets necessários
    const requiredBuckets = ['resumes', 'audios', 'transcripts', 'exports']
    
    for (const bucketName of requiredBuckets) {
      const exists = buckets.some(b => b.name === bucketName)
      
      if (exists) {
        console.log(`✅ Bucket "${bucketName}" já existe`)
      } else {
        console.log(`📦 Criando bucket "${bucketName}"...`)
        
        const { data: newBucket, error: createError } = await supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 10 * 1024 * 1024, // 10MB
          allowedMimeTypes: bucketName === 'resumes' ? ['application/pdf'] : undefined
        })
        
        if (createError) {
          console.error(`❌ Erro ao criar bucket "${bucketName}":`, createError)
        } else {
          console.log(`✅ Bucket "${bucketName}" criado com sucesso`)
        }
      }
    }
    
    // Testar criação de signed URL para o bucket resumes
    console.log('\n🧪 Testando criação de signed URL...')
    const testPath = `test-${Date.now()}.pdf`
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('resumes')
      .createSignedUploadUrl(testPath, {
        contentType: 'application/pdf',
        upsert: false
      })
    
    if (urlError) {
      console.error('❌ Erro ao criar signed URL:', urlError)
    } else {
      console.log('✅ Signed URL criada com sucesso')
      console.log('URL (primeiros 50 chars):', signedUrl.signedUrl.substring(0, 50) + '...')
    }
    
  } catch (error) {
    console.error('❌ Erro inesperado:', error)
  }
}

setupBuckets()
