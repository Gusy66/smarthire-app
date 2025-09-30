'use client'

import { useState } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'

export default function SignupPage() {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  const { notify } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, company } } })
    setLoading(false)
    if (error) { notify({ title: 'Erro no cadastro', description: error.message, variant: 'error' }); return }
    notify({ title: 'Cadastro realizado', description: 'Verifique seu e-mail para confirmar', variant: 'success' })
    router.replace('/login')
  }

  return (
    <div className="mx-auto max-w-md card p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Cadastro</h1>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <input className="border rounded px-3 py-2" placeholder="Nome" value={name} onChange={(e)=>setName(e.target.value)} required />
        <input className="border rounded px-3 py-2" placeholder="Empresa" value={company} onChange={(e)=>setCompany(e.target.value)} required />
        <input className="border rounded px-3 py-2" type="email" placeholder="E-mail" value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <input className="border rounded px-3 py-2" type="password" placeholder="Senha" value={password} onChange={(e)=>setPassword(e.target.value)} required />
        <button className="btn btn-primary" disabled={loading}>{loading ? 'Enviando...' : 'Cadastrar'}</button>
      </form>
      <div className="text-sm">Já tem conta? <a className="underline" href="/login">Entrar</a></div>
    </div>
  )
}


