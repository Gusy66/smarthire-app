import { NextRequest } from 'next/server'
import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { filename = 'audio.wav', content_type = 'audio/wav' } = body || {}
  const supabase = getSupabaseAdmin()
  const bucket = 'audios'
  const path = `${Date.now()}-${filename}`
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path, { contentType: content_type })
  if (error || !data) return Response.json({ error: { code: 'storage_error', message: error?.message || 'storage error' } }, { status: 500 })

  const { data: downloadSignedUrl } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 30)

  return Response.json({ upload_url: data.signedUrl, path: `${bucket}/${path}`, bucket, view_url: downloadSignedUrl?.signedUrl ?? null })
}


