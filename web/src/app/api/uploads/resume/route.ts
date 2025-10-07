import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    console.log('[DEBUG] Upload resume request body:', body)
    const { filename = 'resume.pdf', content_type = 'application/pdf' } = body || {}
    console.log('[DEBUG] Upload resume params:', { filename, content_type })
    const supabase = getSupabaseAdmin()
    const bucket = 'resumes'
    const sanitized = sanitizeFilename(filename)
    const path = `${Date.now()}-${sanitized}`
    
    console.log('[DEBUG] Creating signed upload URL for:', { bucket, path, contentType: content_type })
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { 
        contentType: content_type,
        upsert: false // Não sobrescrever arquivos existentes
      })
    
    console.log('[DEBUG] Supabase storage response:', { data, error })
    
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

    const { data: downloadSignedUrl } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 30)

    return Response.json({
      upload_url: data.signedUrl,
      path: `${bucket}/${path}`,
      bucket,
      view_url: downloadSignedUrl?.signedUrl ?? null,
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

function sanitizeFilename(name: string) {
  const base = (name || 'arquivo.pdf')
    .normalize('NFD')
    .replace(/[^\w.\-]/g, '_')
    .replace(/_+/g, '_')
  return base.length > 0 ? base : 'arquivo.pdf'
}


