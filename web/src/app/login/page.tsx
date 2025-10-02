'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'

export default function LoginPage() {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const { notify } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)

  async function signInEmailPass(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      notify({ title: 'Informe login e senha', variant: 'error' })
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        notify({ title: 'Erro no login', description: error.message, variant: 'error' })
        return
      }
      if (!data?.session) {
        notify({ title: 'Login falhou', description: 'Sessão não criada', variant: 'error' })
        return
      }
      const syncRes = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ event: 'SIGNED_IN', session: data.session }),
      })
      if (!syncRes.ok) {
        const payload = await syncRes.json().catch(() => null)
        console.error('Falha ao sincronizar sessão via login:', payload)
        notify({
          title: 'Erro ao sincronizar sessão',
          description: payload?.error?.message || 'Tente novamente',
          variant: 'error',
        })
        return
      }
      console.log('Login bem-sucedido, redirecionando...')
      notify({ title: 'Login efetuado', variant: 'success' })
      router.replace('/jobs')
    } catch (err: any) {
      notify({ title: 'Erro inesperado', description: String(err?.message ?? err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setMagicLoading(true)
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/jobs` } })
    setMagicLoading(false)
    if (error) { notify({ title: 'Erro ao enviar link', description: error.message, variant: 'error' }); return }
    notify({ title: 'Link enviado', description: 'Verifique seu e-mail', variant: 'success' })
  }

  return (
    <div className="mx-auto max-w-md card p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form className="grid gap-3" onSubmit={signInEmailPass}>
        <input className="border rounded px-3 py-2" type="email" placeholder="E-mail" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <input className="border rounded px-3 py-2" type="password" placeholder="Senha" value={password} onChange={(e)=>setPassword(e.target.value)} />
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
      </form>
      <form className="grid gap-3" onSubmit={sendMagicLink}>
        <div className="text-sm">Ou entre com link mágico</div>
        <input className="border rounded px-3 py-2" type="email" placeholder="E-mail" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <button className="btn btn-outline" disabled={magicLoading}>{magicLoading ? 'Enviando...' : 'Enviar link por e-mail'}</button>
      </form>
      <div className="text-sm">Não tem conta? <a className="underline" href="/signup">Cadastre-se</a></div>
    </div>
  )
}


