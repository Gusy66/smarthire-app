'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type JobDetail = {
  id: string
  title: string
  department: string
  location: string
  salary: string
  work_model: string
  contract_type: string
  description: string
  job_description: string
  responsibilities: string
  requirements_and_skills: string
  work_schedule: string
  travel_availability: string
  observations: string
  requirements: string[]
  skills: string[]
  benefits: string[]
  status: 'open' | 'paused' | 'closed'
}

type EditJobModalProps = {
  jobId: string | null
  onClose: () => void
  onSaved: () => void
}

export default function EditJobModal({ jobId, onClose, onSaved }: EditJobModalProps) {
  const { notify } = useToast()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<JobDetail | null>(null)
  const [reqInput, setReqInput] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [benefitInput, setBenefitInput] = useState('')

  useEffect(() => {
    if (!jobId) return
    setLoading(true)
    fetch(`/api/jobs/${jobId}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.item) {
          const item = json.item as Partial<JobDetail>
          setForm({
            id: jobId,
            title: item.title || '',
            department: item.department || '',
            location: item.location || '',
            salary: item.salary || '',
            work_model: item.work_model || '',
            contract_type: item.contract_type || '',
            description: item.description || '',
            job_description: item.job_description || '',
            responsibilities: item.responsibilities || '',
            requirements_and_skills: item.requirements_and_skills || '',
            work_schedule: item.work_schedule || '',
            travel_availability: item.travel_availability || '',
            observations: item.observations || '',
            requirements: Array.isArray(item.requirements) ? item.requirements : [],
            skills: Array.isArray(item.skills) ? item.skills : [],
            benefits: Array.isArray(item.benefits) ? item.benefits : [],
            status: (item.status as JobDetail['status']) || 'open',
          })
        }
      })
      .catch(() => {
        notify({ title: 'Erro', description: 'Não foi possível carregar os dados da vaga.', variant: 'error' })
        onClose()
      })
      .finally(() => setLoading(false))
  }, [jobId, notify, onClose])

  if (!jobId || !form) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    const payload = {
      title: form.title,
      department: form.department,
      location: form.location,
      salary: form.salary,
      work_model: form.work_model,
      contract_type: form.contract_type,
      description: form.description,
      job_description: form.job_description,
      responsibilities: form.responsibilities,
      requirements_and_skills: form.requirements_and_skills,
      work_schedule: form.work_schedule,
      travel_availability: form.travel_availability,
      observations: form.observations,
      requirements: form.requirements,
      skills: form.skills,
      benefits: form.benefits,
      status: form.status,
    }
    const res = await fetch(`/api/jobs/${jobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    setSubmitting(false)
    if (!res.ok) {
      const text = await res.text()
      let message = 'Falha ao atualizar a vaga'
      try {
        const payloadErr = text ? JSON.parse(text) : null
        message = payloadErr?.error?.message || message
      } catch {}
      notify({ title: 'Erro', description: message, variant: 'error' })
      return
    }
    notify({ title: 'Vaga atualizada', variant: 'success' })
    onSaved()
    onClose()
  }

  const addChip = (type: 'requirements' | 'skills' | 'benefits', value: string) => {
    if (!value.trim()) return
    setForm((prev) => (prev ? { ...prev, [type]: [...prev[type], value.trim()] } : prev))
  }

  const removeChip = (type: 'requirements' | 'skills' | 'benefits', index: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            [type]: prev[type].filter((_, idx) => idx !== index),
          }
        : prev
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-2 sm:px-4">
      <div className="relative w-full max-w-4xl rounded-xl sm:rounded-2xl bg-white shadow-xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Editar Vaga</h2>
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Atualize as informações da vaga e salve as alterações</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1" aria-label="Fechar">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
          {loading ? (
            <div className="py-20 text-center text-sm text-gray-500">Carregando detalhes da vaga...</div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Título da Vaga *</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Departamento *</label>
                  <input
                    value={form.department}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, department: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, status: e.target.value as JobDetail['status'] } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  >
                    <option value="open">Ativa</option>
                    <option value="paused">Pausada</option>
                    <option value="closed">Encerrada</option>
                  </select>
                </div>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Localização</label>
                  <input
                    value={form.location}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, location: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Modelo de trabalho</label>
                  <input
                    value={form.work_model}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, work_model: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Tipo de contrato</label>
                  <input
                    value={form.contract_type}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, contract_type: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Salário</label>
                  <input
                    value={form.salary}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, salary: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Descrição da vaga</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, description: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Descrição do cargo</label>
                  <textarea
                    value={form.job_description}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, job_description: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Responsabilidades e atribuições</label>
                  <textarea
                    value={form.responsibilities}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, responsibilities: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    rows={3}
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Requisitos e habilidades</label>
                  <textarea
                    value={form.requirements_and_skills}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, requirements_and_skills: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    rows={3}
                  />
                </div>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Jornada de trabalho</label>
                  <input
                    value={form.work_schedule}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, work_schedule: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Disponibilidade para viagens</label>
                  <input
                    value={form.travel_availability}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, travel_availability: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                  />
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Observações</label>
                  <textarea
                    value={form.observations}
                    onChange={(e) => setForm((prev) => (prev ? { ...prev, observations: e.target.value } : prev))}
                    className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                    rows={3}
                  />
                </div>
              </section>
              <section className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Requisitos</label>
                  <div className="flex gap-2">
                    <input
                      value={reqInput}
                      onChange={(e) => setReqInput(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                      placeholder="Adicionar requisito"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addChip('requirements', reqInput)
                        setReqInput('')
                      }}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.requirements.map((item, index) => (
                      <span key={index} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeChip('requirements', index)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Habilidades</label>
                  <div className="flex gap-2">
                    <input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                      placeholder="Adicionar habilidade"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addChip('skills', skillInput)
                        setSkillInput('')
                      }}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.skills.map((item, index) => (
                      <span key={index} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeChip('skills', index)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="md:col-span-2 flex flex-col gap-2">
                  <label className="text-sm font-medium text-gray-700">Benefícios</label>
                  <div className="flex gap-2">
                    <input
                      value={benefitInput}
                      onChange={(e) => setBenefitInput(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                      placeholder="Adicionar benefício"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        addChip('benefits', benefitInput)
                        setBenefitInput('')
                      }}
                      className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Adicionar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.benefits.map((item, index) => (
                      <span key={index} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                        {item}
                        <button
                          type="button"
                          onClick={() => removeChip('benefits', index)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}
          <div className="flex items-center justify-end gap-2 pt-4">
            <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {submitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
