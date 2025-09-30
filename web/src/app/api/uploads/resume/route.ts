import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { filename = 'resume.pdf', content_type = 'application/pdf' } = body || {}
    const supabase = getSupabaseAdmin()
    const bucket = 'resumes'
    const path = `${Date.now()}-${filename}`
    
    console.log('Creating signed URL for:', { bucket, path, content_type })
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { 
        contentType: content_type,
        upsert: false // Não sobrescrever arquivos existentes
      })
    
    if (error) {
      console.error('Supabase storage error:', error)
      return Response.json({ 
        error: { 
          code: 'storage_error', 
          message: error.message || 'storage error' 
        } 
      }, { status: 500 })
    }
    
    if (!data?.signedUrl) {
      console.error('No signed URL returned')
      return Response.json({ 
        error: { 
          code: 'no_signed_url', 
          message: 'No signed URL returned from Supabase' 
        } 
      }, { status: 500 })
    }
    
    console.log('Signed URL created successfully')
    return Response.json({ 
      upload_url: data.signedUrl, 
      path: `${bucket}/${path}` 
    })
  } catch (error) {
    console.error('Upload endpoint error:', error)
    return Response.json({ 
      error: { 
        code: 'server_error', 
        message: error instanceof Error ? error.message : 'Unknown error' 
      } 
    }, { status: 500 })
  }
}


