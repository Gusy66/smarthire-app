// Script para testar configuração do Supabase Storage
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Variáveis de ambiente não configuradas')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testStorage() {
  try {
    console.log('Testando configuração do Supabase Storage...')
    
    // Listar buckets
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets()
    
    if (bucketsError) {
      console.error('Erro ao listar buckets:', bucketsError)
      return
    }
    
    console.log('Buckets encontrados:', buckets.map(b => b.name))
    
    // Verificar se bucket 'resumes' existe
    const resumesBucket = buckets.find(b => b.name === 'resumes')
    
    if (!resumesBucket) {
      console.log('Bucket "resumes" não encontrado. Criando...')
      
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('resumes', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['application/pdf']
      })
      
      if (createError) {
        console.error('Erro ao criar bucket:', createError)
        return
      }
      
      console.log('Bucket "resumes" criado com sucesso:', newBucket)
    } else {
      console.log('Bucket "resumes" já existe:', resumesBucket)
    }
    
    // Testar criação de signed URL
    const testPath = `test-${Date.now()}.pdf`
    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('resumes')
      .createSignedUploadUrl(testPath, {
        contentType: 'application/pdf',
        upsert: false
      })
    
    if (urlError) {
      console.error('Erro ao criar signed URL:', urlError)
      return
    }
    
    console.log('Signed URL criada com sucesso:', signedUrl)
    
  } catch (error) {
    console.error('Erro inesperado:', error)
  }
}

testStorage()
