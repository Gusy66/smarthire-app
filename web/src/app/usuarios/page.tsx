'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type UserPermissions = {
  criar_prompts: boolean
  cadastrar_candidatos: boolean
  criar_editar_vagas: boolean
}

type User = {
  id: string
  email: string
  name: string
  role: string
  is_admin: boolean
  created_at: string
  permissions: UserPermissions
}

export default function UsuariosPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [users, setUsers] = useState<User[]>([])
  const [error, setError] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  
  // Modal de criar/editar usuário
  const [showModal, setShowModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    is_admin: false,
    permissions: {
      criar_prompts: false,
      cadastrar_candidatos: false,
      criar_editar_vagas: false
    }
  })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [formSuccess, setFormSuccess] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    setLoading(true)
    try {
      const res = await fetch('/api/users', { credentials: 'same-origin' })
      
      if (res.status === 403) {
        setIsAdmin(false)
        setError('Você não tem permissão para acessar esta página')
        return
      }
      
      if (!res.ok) {
        throw new Error('Erro ao carregar usuários')
      }
      
      const data = await res.json()
      setUsers(data.users || [])
      setIsAdmin(true)
    } catch (err) {
      setError('Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  function openCreateModal() {
    setEditingUser(null)
    setFormData({
      name: '',
      email: '',
      password: '',
      is_admin: false,
      permissions: {
        criar_prompts: false,
        cadastrar_candidatos: false,
        criar_editar_vagas: false
      }
    })
    setFormError('')
    setFormSuccess('')
    setShowModal(true)
  }

  function openEditModal(user: User) {
    setEditingUser(user)
    setFormData({
      name: user.name || '',
      email: user.email,
      password: '',
      is_admin: user.is_admin,
      permissions: { ...user.permissions }
    })
    setFormError('')
    setFormSuccess('')
    setShowModal(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    setFormSuccess('')

    if (!formData.name.trim()) {
      setFormError('Nome é obrigatório')
      return
    }

    if (!editingUser) {
      if (!formData.email.trim()) {
        setFormError('Email é obrigatório')
        return
      }
      if (!formData.password || formData.password.length < 6) {
        setFormError('Senha deve ter pelo menos 6 caracteres')
        return
      }
    }

    setSaving(true)
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users'
      const method = editingUser ? 'PATCH' : 'POST'
      
      const body: Record<string, unknown> = {
        name: formData.name.trim(),
        is_admin: formData.is_admin,
        permissions: formData.permissions
      }

      if (!editingUser) {
        body.email = formData.email.trim()
        body.password = formData.password
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body)
      })

      const data = await res.json()

      if (!res.ok) {
        setFormError(data.error?.message || 'Erro ao salvar usuário')
        return
      }

      setFormSuccess(editingUser ? 'Usuário atualizado!' : 'Usuário criado!')
      fetchUsers()
      
      setTimeout(() => {
        setShowModal(false)
      }, 1500)

    } catch {
      setFormError('Erro ao salvar usuário')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(`Tem certeza que deseja remover o usuário "${user.name}"?`)) {
      return
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'same-origin'
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error?.message || 'Erro ao remover usuário')
        return
      }

      fetchUsers()
    } catch {
      alert('Erro ao remover usuário')
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Carregando...
        </div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Acesso Restrito</h2>
        <p className="text-gray-600">{error || 'Você não tem permissão para acessar esta página'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
          <p className="text-gray-500 mt-1">Gerencie os usuários da sua empresa</p>
        </div>
        
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg flex items-center gap-2 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Usuário
        </button>
      </div>

      {/* Lista de Usuários */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {users.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-gray-500">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Permissões</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Criado em</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                        {(user.name || user.email).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{user.name || 'Sem nome'}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {user.is_admin ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Usuário
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap justify-center gap-1">
                      {user.is_admin ? (
                        <span className="text-xs text-gray-500">Todas</span>
                      ) : (
                        <>
                          {user.permissions.criar_prompts && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-700">
                              Prompts
                            </span>
                          )}
                          {user.permissions.cadastrar_candidatos && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                              Candidatos
                            </span>
                          )}
                          {user.permissions.criar_editar_vagas && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">
                              Vagas
                            </span>
                          )}
                          {!user.permissions.criar_prompts && !user.permissions.cadastrar_candidatos && !user.permissions.criar_editar_vagas && (
                            <span className="text-xs text-gray-400">Nenhuma</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-sm">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(user)}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(user)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Criar/Editar Usuário */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-emerald-700 text-sm">
                  {formSuccess}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Nome completo"
                  required
                />
              </div>

              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="email@exemplo.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                      placeholder="Mínimo 6 caracteres"
                      minLength={6}
                      required
                    />
                  </div>
                </>
              )}

              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_admin}
                    onChange={(e) => setFormData({ ...formData, is_admin: e.target.checked })}
                    className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                  />
                  <div>
                    <span className="font-medium text-gray-800">Administrador</span>
                    <p className="text-sm text-gray-500">Pode gerenciar usuários e tem todas as permissões</p>
                  </div>
                </label>
              </div>

              {!formData.is_admin && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm font-medium text-gray-700">Permissões</p>
                  
                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.criar_prompts}
                      onChange={(e) => setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, criar_prompts: e.target.checked }
                      })}
                      className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-medium text-gray-800">Criar Prompts</span>
                      <p className="text-sm text-gray-500">Pode criar e editar templates de análise</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.cadastrar_candidatos}
                      onChange={(e) => setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, cadastrar_candidatos: e.target.checked }
                      })}
                      className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-medium text-gray-800">Cadastrar Candidatos</span>
                      <p className="text-sm text-gray-500">Pode cadastrar e editar candidatos</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <input
                      type="checkbox"
                      checked={formData.permissions.criar_editar_vagas}
                      onChange={(e) => setFormData({
                        ...formData,
                        permissions: { ...formData.permissions, criar_editar_vagas: e.target.checked }
                      })}
                      className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-medium text-gray-800">Criar/Editar Vagas</span>
                      <p className="text-sm text-gray-500">Pode criar e editar vagas de emprego</p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Salvando...' : (editingUser ? 'Salvar' : 'Criar Usuário')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}




