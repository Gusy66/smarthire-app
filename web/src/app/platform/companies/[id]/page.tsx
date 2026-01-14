'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type User = {
  id: string
  email: string
  name: string
  role: string
  created_at: string
}

type CompanyDetails = {
  id: string
  name: string
  created_at: string
  users: User[]
  stats: {
    user_count: number
    job_count: number
    candidate_count: number
  }
}

export default function CompanyDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [company, setCompany] = useState<CompanyDetails | null>(null)
  const [error, setError] = useState('')
  
  // Create Admin Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminName, setAdminName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [createSuccess, setCreateSuccess] = useState('')

  useEffect(() => {
    fetchCompany()
  }, [resolvedParams.id])

  async function fetchCompany() {
    setLoading(true)
    try {
      const res = await fetch(`/api/platform/companies/${resolvedParams.id}`, { credentials: 'same-origin' })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/platform/login')
          return
        }
        if (res.status === 404) {
          setError('Empresa não encontrada')
          return
        }
        throw new Error('Erro ao carregar empresa')
      }
      
      const data = await res.json()
      setCompany(data.company)
    } catch (err) {
      setError('Erro ao carregar empresa')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    setCreateError('')
    setCreateSuccess('')

    if (!adminEmail.trim() || !adminPassword.trim() || !adminName.trim()) {
      setCreateError('Todos os campos são obrigatórios')
      return
    }

    if (adminPassword.length < 6) {
      setCreateError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setCreating(true)
    try {
      const res = await fetch(`/api/platform/companies/${resolvedParams.id}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: adminEmail.trim(),
          password: adminPassword,
          name: adminName.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        setCreateError(data.error?.message || 'Erro ao criar administrador')
        return
      }

      setCreateSuccess(`Administrador ${data.user?.name} criado com sucesso!`)
      setAdminEmail('')
      setAdminPassword('')
      setAdminName('')
      
      // Refresh company data
      fetchCompany()
      
      // Close modal after 2 seconds
      setTimeout(() => {
        setShowCreateModal(false)
        setCreateSuccess('')
      }, 2000)

    } catch {
      setCreateError('Erro de conexão. Tente novamente.')
    } finally {
      setCreating(false)
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  function getRoleBadge(role: string) {
    const styles: Record<string, string> = {
      admin: 'bg-amber-500/20 text-amber-300',
      recruiter: 'bg-blue-500/20 text-blue-300',
      interviewer: 'bg-emerald-500/20 text-emerald-300'
    }
    const labels: Record<string, string> = {
      admin: 'Admin',
      recruiter: 'Recrutador',
      interviewer: 'Entrevistador'
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${styles[role] || 'bg-slate-500/20 text-slate-300'}`}>
        {labels[role] || role}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Carregando...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-400 mb-4">{error}</p>
          <Link
            href="/platform/dashboard"
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
          >
            Voltar ao Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link
            href="/platform/dashboard"
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold">
              {company?.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">{company?.name}</h1>
              <p className="text-xs text-slate-400">Criada em {company && formatDate(company.created_at)}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{company?.stats.user_count || 0}</p>
                <p className="text-sm text-slate-400">Usuários</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-violet-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{company?.stats.job_count || 0}</p>
                <p className="text-sm text-slate-400">Vagas</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{company?.stats.candidate_count || 0}</p>
                <p className="text-sm text-slate-400">Candidatos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Users Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">Usuários da Empresa</h2>
              <p className="text-sm text-slate-400 mt-1">Gerencie os usuários desta empresa</p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Novo Administrador
            </button>
          </div>

          {company?.users.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <p className="text-slate-400">Nenhum usuário cadastrado</p>
              <p className="text-sm text-slate-500 mt-1">Clique em "Novo Administrador" para criar o primeiro</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Usuário</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Email</th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Cargo</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Criado em</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {company?.users.map((user) => (
                    <tr key={user.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-medium">
                            {(user.name || user.email).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{user.name || 'Sem nome'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-300">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {formatDate(user.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Novo Administrador</h3>
              <p className="text-sm text-slate-400 mt-1">Crie um administrador para {company?.name}</p>
            </div>
            
            <form onSubmit={handleCreateAdmin} className="p-6 space-y-4">
              {createError && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {createError}
                </div>
              )}

              {createSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3 text-emerald-400 text-sm">
                  {createSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome
                </label>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="admin@empresa.com"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Senha
                </label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                    setCreateSuccess('')
                  }}
                  className="flex-1 px-4 py-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 transition-all"
                >
                  {creating ? 'Criando...' : 'Criar Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

