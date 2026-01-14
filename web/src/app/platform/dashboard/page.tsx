'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Company = {
  id: string
  name: string
  created_at: string
  user_count: number
  job_count: number
}

type PaginationInfo = {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function PlatformDashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [companies, setCompanies] = useState<Company[]>([])
  const [pagination, setPagination] = useState<PaginationInfo | null>(null)
  const [search, setSearch] = useState('')
  const [adminName, setAdminName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCompanyName, setNewCompanyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchCompanies()
    }, 300)
    return () => clearTimeout(debounce)
  }, [search])

  async function checkAuth() {
    try {
      const res = await fetch('/api/platform/auth', { credentials: 'same-origin' })
      if (!res.ok) {
        router.push('/platform/login')
        return
      }
      const data = await res.json()
      setAdminName(data.user?.name || data.user?.email || 'Admin')
      fetchCompanies()
    } catch {
      router.push('/platform/login')
    }
  }

  async function fetchCompanies(page = 1) {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.set('search', search)
      
      const res = await fetch(`/api/platform/companies?${params}`, { credentials: 'same-origin' })
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/platform/login')
          return
        }
        throw new Error('Erro ao carregar empresas')
      }
      
      const data = await res.json()
      setCompanies(data.companies || [])
      setPagination(data.pagination)
    } catch (err) {
      setError('Erro ao carregar empresas')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateCompany(e: React.FormEvent) {
    e.preventDefault()
    if (!newCompanyName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/platform/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ name: newCompanyName.trim() })
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error?.message || 'Erro ao criar empresa')
        return
      }

      setShowCreateModal(false)
      setNewCompanyName('')
      fetchCompanies()
    } catch {
      setError('Erro ao criar empresa')
    } finally {
      setCreating(false)
    }
  }

  async function handleLogout() {
    await fetch('/api/platform/auth', { method: 'DELETE', credentials: 'same-origin' })
    router.push('/platform/login')
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">SmartHire Platform</h1>
              <p className="text-xs text-slate-400">Painel de Administração</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-300">{adminName}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{pagination?.total || 0}</p>
                <p className="text-sm text-slate-400">Empresas</p>
              </div>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <svg className="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {companies.reduce((acc, c) => acc + c.user_count, 0)}
                </p>
                <p className="text-sm text-slate-400">Total de Usuários</p>
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
                <p className="text-2xl font-bold text-white">
                  {companies.reduce((acc, c) => acc + c.job_count, 0)}
                </p>
                <p className="text-sm text-slate-400">Total de Vagas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Companies Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Empresas Clientes</h2>
            
            <div className="flex gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-none">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar empresa..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full sm:w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                />
              </div>
              
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg hover:from-amber-400 hover:to-orange-400 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nova Empresa
              </button>
            </div>
          </div>

          {error && (
            <div className="px-6 py-4 bg-red-500/10 border-b border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-12 flex items-center justify-center">
              <div className="flex items-center gap-3 text-slate-400">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Carregando...
              </div>
            </div>
          ) : companies.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <p className="text-slate-400">Nenhuma empresa encontrada</p>
              <p className="text-sm text-slate-500 mt-1">Clique em "Nova Empresa" para criar a primeira</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Empresa</th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Usuários</th>
                    <th className="text-center px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Vagas</th>
                    <th className="text-left px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Criada em</th>
                    <th className="text-right px-6 py-4 text-xs font-medium text-slate-400 uppercase tracking-wider">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center text-white font-semibold">
                            {company.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-white">{company.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-300">
                          {company.user_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-500/20 text-violet-300">
                          {company.job_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {formatDate(company.created_at)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/platform/companies/${company.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
                        >
                          Gerenciar
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="p-6 border-t border-white/10 flex items-center justify-between">
              <p className="text-sm text-slate-400">
                Mostrando {companies.length} de {pagination.total} empresas
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchCompanies(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => fetchCompanies(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 text-sm text-slate-300 hover:text-white hover:bg-white/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Company Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-white/10 shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Nova Empresa</h3>
              <p className="text-sm text-slate-400 mt-1">Cadastre uma nova empresa cliente</p>
            </div>
            
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  placeholder="Ex: Empresa ABC Ltda"
                  required
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-xl hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 transition-all"
                >
                  {creating ? 'Criando...' : 'Criar Empresa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

