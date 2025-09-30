import { getSupabaseAdmin } from '../../_lib/supabaseAdmin'

export async function POST() {
  const supabase = getSupabaseAdmin()
  async function ensureBucket(name: string) {
    const { data: list } = await supabase.storage.listBuckets()
    if (list?.some((b) => b.name === name)) return
    await supabase.storage.createBucket(name, { public: false })
  }
  try {
    await ensureBucket('audios')
    await ensureBucket('resumes')
    await ensureBucket('transcripts')
    await ensureBucket('exports')
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: { code: 'storage_error', message: String(e?.message || e) } }, { status: 500 })
  }
}

export async function GET() {
  // Suporte a GET para facilitar execução via navegador
  return POST()
}


