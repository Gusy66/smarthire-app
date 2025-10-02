'use client'

import { useEffect, useMemo, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type PromptTemplate = {
  id: string
  name: string
  description?: string | null
  content: string
  is_default: boolean
  created_at?: string
  updated_at?: string
}

type FormState = {
  name: string
  description: string
  content: string
  is_default: boolean
}

const initialForm: FormState = {
  name: '',
  description: '',
  content: '',
  is_default: false,
}

export default function PromptTemplatesPage() {
  const { notify } = useToast()
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<FormState>(initialForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    setLoading(true)
    try {
      const res = await fetch('/api/prompt-templates')
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao carregar templates')
      setTemplates(json.items || [])
    } catch (error: any) {
      notify({
        title: 'Erro ao carregar',
        description: error?.message || 'Não foi possível carregar os templates',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setForm(initialForm)
    setEditingId(null)
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim() || form.content.trim().length < 20) {
      notify({
        title: 'Dados inválidos',
        description: 'Informe um nome e um conteúdo com pelo menos 20 caracteres.',
        variant: 'error',
      })
      return
    }

    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        content: form.content.trim(),
        is_default: form.is_default,
      }
      const url = editingId ? `/api/prompt-templates/${editingId}` : '/api/prompt-templates'
      const method = editingId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao salvar template')

      notify({
        title: editingId ? 'Template atualizado' : 'Template criado',
        variant: 'success',
      })
      resetForm()
      await loadTemplates()
    } catch (error: any) {
      notify({
        title: 'Erro ao salvar',
        description: error?.message || 'Houve um problema ao salvar o template',
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(template: PromptTemplate) {
    setEditingId(template.id)
    setForm({
      name: template.name,
      description: template.description || '',
      content: template.content,
      is_default: template.is_default,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este template?')) return
    try {
      const res = await fetch(`/api/prompt-templates/${id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao excluir template')
      notify({ title: 'Template excluído', variant: 'success' })
      if (editingId === id) resetForm()
      await loadTemplates()
    } catch (error: any) {
      notify({
        title: 'Erro ao excluir',
        description: error?.message || 'Não foi possível excluir o template',
        variant: 'error',
      })
    }
  }

  async function makeDefault(template: PromptTemplate) {
    try {
      const res = await fetch(`/api/prompt-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          content: template.content,
          is_default: true,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error?.message || 'Erro ao definir padrão')
      notify({ title: 'Template marcado como padrão', variant: 'success' })
      await loadTemplates()
    } catch (error: any) {
      notify({
        title: 'Erro ao definir padrão',
        description: error?.message || 'Não foi possível atualizar o template',
        variant: 'error',
      })
    }
  }

  const defaultTemplate = useMemo(() => templates.find((t) => t.is_default) || null, [templates])

  return (
    <div className="min-h-screen bg-gradient py-8">
      <div className="container-page max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Templates de Prompt</h1>
            <p className="text-gray-600 mt-2">
              Crie instruções personalizadas para orientar a análise de currículos em cada etapa.
            </p>
          </div>
          <a href="/settings" className="btn btn-outline">← Voltar</a>
        </div>

        <section className="card p-8 space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {editingId ? 'Editar template' : 'Novo template'}
              </h2>
              <p className="text-sm text-gray-600">
                Utilize variáveis como <code>{'{{CANDIDATE_INFO}}'}</code>, <code>{'{{STAGE_DESCRIPTION}}'}</code> e <code>{'{{REQUIREMENTS_LIST}}'}</code> conforme necessário.
              </p>
            </div>
            {editingId && (
              <button onClick={resetForm} className="btn btn-outline btn-sm">Cancelar edição</button>
            )}
          </header>

          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid md:grid-cols-2 gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700">Nome</span>
                <input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex.: Avaliação Comercial"
                  required
                  className="border rounded px-3 py-2"
                />
              </label>
              <label className="grid gap-2">
                <span className="text-sm font-medium text-gray-700">Descrição</span>
                <input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Resumo ou contexto"
                  className="border rounded px-3 py-2"
                />
              </label>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-gray-700">Conteúdo do prompt</span>
              <textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder={"Ex.: Você é um analista de RH..."}
                rows={10}
                className="border rounded px-3 py-2 font-mono text-sm"
              />
            </label>

            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
              />
              Tornar este o template padrão
            </label>

            <div className="flex gap-3 justify-end">
              <button type="button" onClick={resetForm} className="btn btn-outline" disabled={saving}>
                Limpar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Salvando...' : editingId ? 'Atualizar template' : 'Criar template'}
              </button>
            </div>
          </form>
        </section>

        <section className="space-y-4">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Templates existentes</h2>
              {defaultTemplate ? (
                <p className="text-sm text-gray-500">
                  Template padrão atual: <span className="font-medium text-gray-800">{defaultTemplate.name}</span>
                </p>
              ) : (
                <p className="text-sm text-gray-500">Defina ao menos um template como padrão para uso automático.</p>
              )}
            </div>
            <button onClick={loadTemplates} className="btn btn-outline btn-sm" disabled={loading}>
              {loading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </header>

          {loading ? (
            <div className="card p-6 text-center text-gray-600">Carregando templates...</div>
          ) : templates.length === 0 ? (
            <div className="card p-6 text-center text-gray-500">
              Nenhum template cadastrado ainda. Crie o primeiro usando o formulário acima.
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {templates.map((template) => {
                const expanded = expandedTemplateId === template.id
                return (
                  <article
                    key={template.id}
                    className={`card p-6 space-y-3 border ${template.is_default ? 'border-primary-green-300' : 'border-transparent'}`}
                  >
                    <header className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          {template.name}
                          {template.is_default && (
                            <span className="badge badge-success text-xs">Padrão</span>
                          )}
                        </h3>
                        {template.description && (
                          <p className="text-sm text-gray-600">{template.description}</p>
                        )}
                      </div>
                    </header>

                    <div className="bg-gray-50 rounded-lg p-3 border text-sm font-mono whitespace-pre-wrap max-h-48 overflow-hidden relative">
                      <pre className={`text-xs leading-relaxed ${expanded ? 'max-h-none' : 'max-h-32 overflow-hidden'}`}>
{template.content}
                      </pre>
                      {template.content.length > 320 && (
                        <button
                          type="button"
                          className="absolute bottom-2 right-3 text-xs text-blue-600 underline"
                          onClick={() => setExpandedTemplateId(expanded ? null : template.id)}
                        >
                          {expanded ? 'Mostrar menos' : 'Ver completo'}
                        </button>
                      )}
                    </div>

                    <footer className="flex flex-wrap gap-2 justify-end">
                      {!template.is_default && (
                        <button className="btn btn-outline btn-sm" onClick={() => makeDefault(template)}>
                          Definir como padrão
                        </button>
                      )}
                      <button className="btn btn-outline btn-sm" onClick={() => handleEdit(template)}>
                        Editar
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(template.id)}>
                        Excluir
                      </button>
                    </footer>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}



