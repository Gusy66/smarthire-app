import { NextRequest } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { audio_path, language } = body || {}
  if (!audio_path) return Response.json({ error: { code: 'validation_error', message: 'audio_path is required' } }, { status: 400 })
  const baseUrl = process.env.NEXT_PUBLIC_AI_BASE_URL || 'http://localhost:8000'
  const res = await fetch(`${baseUrl}/v1/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_path, language }),
  })
  const json = await res.json()
  return Response.json(json, { status: res.status })
}


