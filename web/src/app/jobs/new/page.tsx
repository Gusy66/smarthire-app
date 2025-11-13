'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ToastProvider'

type Candidate = {
  id: string
  name: string
  email?: string
}

type StageForm = {
  name: string
  description: string
  threshold: number
  stage_weight: number
  order_index: number
}

type JobFormState = {
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
  stages: StageForm[]
}

const departmentOptions = [
  'Marketing',
  'TI',
  'RH',
  'Vendas',
  'Financeiro',
  'Operações',
  'Comercial',
  'Produção',
  'Atendimento',
]

const workModelOptions = [
  { value: '', label: 'Selecione o modelo' },
  { value: 'remote', label: 'Home Office' },
  { value: 'hybrid', label: 'Híbrido' },
  { value: 'onsite', label: 'Presencial' },
]

const contractTypeOptions = [
  { value: '', label: 'Selecione o tipo' },
  { value: 'clt', label: 'CLT' },
  { value: 'pj', label: 'PJ' },
  { value: 'internship', label: 'Estágio' },
  { value: 'freelance', label: 'Freelancer' },
  { value: 'apprentice', label: 'Aprendiz' },
]

const travelOptions = [
  '',
  'Não requer viagem',
  'Ocasional',
  'Frequente',
  'Sim, disponível',
]

export default function NewJobPage() {
  const router = useRouter()
  const { notify } = useToast()

  const steps: Array<{ key: 'basic' | 'details' | 'process'; title: string; description: string }> = [
    { key: 'basic', title: 'Informações Básicas', description: 'Título e dados gerais' },
    { key: 'details', title: 'Detalhes da Vaga', description: 'Responsabilidades e requisitos' },
    { key: 'process', title: 'Processo Seletivo', description: 'Etapas e candidatos' },
  ]

  const [activeTab, setActiveTab] = useState<'basic' | 'details' | 'process'>('basic')
  const [status, setStatus] = useState<'open' | 'closed'>('open')
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<JobFormState>({
    title: '',
    department: '',
    location: '',
    salary: '',
    work_model: '',
    contract_type: '',
    description: '',
    job_description: '',
    responsibilities: '',
    requirements_and_skills: '',
    work_schedule: '',
    travel_availability: '',
    observations: '',
    requirements: [],
    skills: [],
    benefits: [],
    stages: [],
  })

  const [reqInput, setReqInput] = useState('')
  const [skillInput, setSkillInput] = useState('')
  const [benefitInput, setBenefitInput] = useState('')
  const [stageInput, setStageInput] = useState({
    name: '',
    description: '',
    threshold: 7,
    stage_weight: 1,
  })

  const [availableCandidates, setAvailableCandidates] = useState<Candidate[]>([])
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([])
  const [candidateSearchTerm, setCandidateSearchTerm] = useState('')

  const filteredCandidates = useMemo(() => {
    const query = candidateSearchTerm.trim().toLowerCase()
    if (!query) return availableCandidates
    return availableCandidates.filter((candidate) => {
      const name = candidate.name?.toLowerCase() ?? ''
      const email = candidate.email?.toLowerCase() ?? ''
      return name.includes(query) || email.includes(query)
    })
  }, [availableCandidates, candidateSearchTerm])

  const currentStepIndex = steps.findIndex((step) => step.key === activeTab)

  const goToStep = (step: 'basic' | 'details' | 'process') => {
    setActiveTab(step)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goToNextStep = () => {
    if (currentStepIndex < steps.length - 1) {
      setActiveTab(steps[currentStepIndex + 1].key)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPreviousStep = () => {
    if (currentStepIndex > 0) {
      setActiveTab(steps[currentStepIndex - 1].key)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  useEffect(() => {
    fetch('/api/candidates?page=1&page_size=100', { credentials: 'same-origin' })
      .then((r) => r.json())
      .then((j) => setAvailableCandidates(j.items || []))
      .catch(() => setAvailableCandidates([]))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      notify({ title: 'Título obrigatório', description: 'Informe um título para a vaga.', variant: 'error' })
      return
    }
    if (!form.department) {
      notify({ title: 'Departamento obrigatório', description: 'Selecione o departamento da vaga.', variant: 'error' })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, status }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        notify({ title: 'Erro ao criar vaga', description: err?.error?.message || 'Não foi possível criar a vaga.', variant: 'error' })
        return
      }
      const job = await res.json()
      const jobId = job?.id

      if (jobId && form.stages.length > 0) {
        for (const stage of form.stages) {
          await fetch(`/api/jobs/${jobId}/stages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(stage),
          })
        }
      }

      if (jobId && selectedCandidateIds.length > 0) {
        for (const candidateId of selectedCandidateIds) {
          await fetch(`/api/jobs/${jobId}/applications`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidate_id: candidateId }),
          })
        }
      }

      notify({ title: 'Vaga criada com sucesso', variant: 'success' })
      router.push('/jobs')
    } finally {
      setSubmitting(false)
    }
  }

  const addRequirement = () => {
    const value = reqInput.trim()
    if (!value) return
    setForm((f) => ({ ...f, requirements: [...f.requirements, value] }))
    setReqInput('')
  }

  const addSkill = () => {
    const value = skillInput.trim()
    if (!value) return
    setForm((f) => ({ ...f, skills: [...f.skills, value] }))
    setSkillInput('')
  }

  const addBenefit = () => {
    const value = benefitInput.trim()
    if (!value) return
    setForm((f) => ({ ...f, benefits: [...f.benefits, value] }))
    setBenefitInput('')
  }

  const addStage = () => {
    if (!stageInput.name.trim()) {
      notify({ title: 'Nome da etapa obrigatório', description: 'Informe um nome para a etapa antes de adicionar.', variant: 'error' })
      return
    }
    setForm((f) => ({
      ...f,
      stages: [
        ...f.stages,
        {
          name: stageInput.name,
          description: stageInput.description,
          threshold: stageInput.threshold,
          stage_weight: stageInput.stage_weight,
          order_index: f.stages.length,
        },
      ],
    }))
    setStageInput({ name: '', description: '', threshold: 7, stage_weight: 1 })
    notify({ title: 'Etapa adicionada', variant: 'success' })
  }

  const removeStage = (index: number) => {
    setForm((f) => ({
      ...f,
      stages: f.stages
        .filter((_, idx) => idx !== index)
        .map((stage, idx) => ({ ...stage, order_index: idx })),
    }))
  }

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      <div className="space-y-6">
        <div className="-mx-4 md:-mx-8 -mt-6 bg-white border-b border-gray-200 shadow-sm px-6 md:px-12 lg:px-16 py-6 flex flex-col gap-4 md:gap-0 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <Link href="/jobs" className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold text-gray-900">Nova Vaga</h1>
              <p className="text-sm text-gray-600">Configure todos os detalhes da vaga e processo seletivo</p>
            </div>
          </div>
          <button
            type="submit"
            form="job-create-form"
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
            disabled={submitting}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {submitting ? 'Salvando...' : 'Salvar Vaga'}
          </button>
        </div>

        <div className="-mx-4 md:-mx-8 pb-12">
          <div className="bg-white border-t border-b border-gray-200 shadow-sm px-6 md:px-12 lg:px-16 py-8">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              {steps.map((step, index) => {
                const isActive = step.key === activeTab
                const isCompleted = index < currentStepIndex
                return (
                  <div key={step.key} className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => goToStep(step.key)}
                      className={`flex items-center gap-3 rounded-full px-3 py-1 transition ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isCompleted
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                          isActive
                            ? 'bg-white text-blue-600'
                            : isCompleted
                              ? 'bg-green-600 text-white'
                              : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <div className="flex flex-col items-start leading-tight">
                        <span className="text-xs uppercase tracking-wide">{step.title}</span>
                        <span className="text-[10px] text-white/80 md:text-[11px] md:text-white/80 lg:text-xs lg:text-white/80 hidden sm:inline-block">
                          {step.description}
                        </span>
                      </div>
                    </button>
                    {index < steps.length - 1 && (
                      <div className={`h-[2px] w-10 sm:w-16 ${index < currentStepIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex border-b border-gray-200 text-sm font-medium text-gray-600">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`flex-1 px-6 py-3 text-center transition-colors ${activeTab === 'basic' ? 'text-gray-900 border-b-2 border-gray-900 bg-white' : 'bg-gray-50 hover:text-gray-900'}`}
            >
              Informações Básicas
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('details')}
              className={`flex-1 px-6 py-3 text-center transition-colors ${activeTab === 'details' ? 'text-gray-900 border-b-2 border-gray-900 bg-white' : 'bg-gray-50 hover:text-gray-900'}`}
            >
              Detalhes da Vaga
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('process')}
              className={`flex-1 px-6 py-3 text-center transition-colors ${activeTab === 'process' ? 'text-gray-900 border-b-2 border-gray-900 bg-white' : 'bg-gray-50 hover:text-gray-900'}`}
            >
              Processo Seletivo
            </button>
          </div>

          <form id="job-create-form" onSubmit={handleSubmit} className="space-y-8">
            {activeTab === 'basic' && (
              <section className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900">Informações Gerais</h2>
                  <p className="text-sm text-gray-500">Dados básicos da vaga</p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="lg:col-span-2 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Título da Vaga *</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                      placeholder="Ex: Desenvolvedor Full Stack"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Departamento *</label>
                    <select
                      value={form.department}
                      onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      required
                    >
                      <option value="">Selecione o departamento</option>
                      {departmentOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Localização</label>
                    <input
                      value={form.location}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      placeholder="Ex: São Paulo - SP"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Tipo de Contrato</label>
                    <select
                      value={form.contract_type}
                      onChange={(e) => setForm((f) => ({ ...f, contract_type: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    >
                      {contractTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Faixa Salarial</label>
                    <input
                      value={form.salary}
                      onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                      placeholder="Ex: R$ 8.000 - R$ 12.000"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Modelo de Trabalho</label>
                    <select
                      value={form.work_model}
                      onChange={(e) => setForm((f) => ({ ...f, work_model: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    >
                      {workModelOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-2 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Descrição Geral (opcional)</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Utilize este campo para uma visão geral da vaga"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-4 py-3">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Vaga ativa para receber candidaturas</span>
                    <p className="text-xs text-gray-500">Desative para interromper temporariamente novas candidaturas</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStatus((prev) => (prev === 'open' ? 'closed' : 'open'))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${status === 'open' ? 'bg-green-600' : 'bg-gray-300'}`}
                    aria-label="Alterar status da vaga"
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition ${status === 'open' ? 'translate-x-5' : 'translate-x-1'}`}
                    />
                  </button>
                </div>
              </section>
            )}

            {activeTab === 'details' && (
              <section className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900">Detalhes da Vaga</h2>
                  <p className="text-sm text-gray-500">Descreva as responsabilidades, requisitos e benefícios</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Descrição do Cargo</label>
                  <textarea
                    value={form.job_description}
                    onChange={(e) => setForm((f) => ({ ...f, job_description: e.target.value }))}
                    placeholder="Descreva em detalhes o cargo, suas atribuições e objetivos"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Responsabilidades e Atribuições</label>
                  <textarea
                    value={form.responsibilities}
                    onChange={(e) => setForm((f) => ({ ...f, responsibilities: e.target.value }))}
                    placeholder="Liste as principais responsabilidades e atribuições"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">Requisitos e Habilidades</label>
                  <textarea
                    value={form.requirements_and_skills}
                    onChange={(e) => setForm((f) => ({ ...f, requirements_and_skills: e.target.value }))}
                    placeholder="Descreva os requisitos técnicos, formações e habilidades desejadas"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-28 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                  />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Requisitos (lista)</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={reqInput}
                        onChange={(e) => setReqInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRequirement() } }}
                        placeholder="Digite e pressione Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                      <button type="button" onClick={addRequirement} className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Adicionar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.requirements.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                          {item}
                          <button type="button" onClick={() => setForm((f) => ({ ...f, requirements: f.requirements.filter((_, i) => i !== idx) }))} className="text-gray-500 hover:text-gray-700">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Habilidades</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={skillInput}
                        onChange={(e) => setSkillInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill() } }}
                        placeholder="Digite e pressione Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                      <button type="button" onClick={addSkill} className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Adicionar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.skills.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">
                          {item}
                          <button type="button" onClick={() => setForm((f) => ({ ...f, skills: f.skills.filter((_, i) => i !== idx) }))} className="text-blue-600 hover:text-blue-800">×</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Benefícios</label>
                    <div className="flex items-center gap-2">
                      <input
                        value={benefitInput}
                        onChange={(e) => setBenefitInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBenefit() } }}
                        placeholder="Digite e pressione Enter"
                        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                      <button type="button" onClick={addBenefit} className="px-3 py-2 text-xs font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50">Adicionar</button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {form.benefits.map((item, idx) => (
                        <span key={idx} className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs text-purple-700">
                          {item}
                          <button type="button" onClick={() => setForm((f) => ({ ...f, benefits: f.benefits.filter((_, i) => i !== idx) }))} className="text-purple-600 hover:text-purple-800">×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Horário</label>
                    <input
                      value={form.work_schedule}
                      onChange={(e) => setForm((f) => ({ ...f, work_schedule: e.target.value }))}
                      placeholder="Ex: 08h às 17h"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Disponibilidade para viajar</label>
                    <select
                      value={form.travel_availability}
                      onChange={(e) => setForm((f) => ({ ...f, travel_availability: e.target.value }))}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    >
                      {travelOptions.map((option) => (
                        <option key={option} value={option}>
                          {option || 'Selecione'}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-1 flex flex-col gap-2">
                    <label className="text-sm font-medium text-gray-700">Observações (opcional)</label>
                    <textarea
                      value={form.observations}
                      onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                      placeholder="Informações adicionais sobre a vaga"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                    />
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'process' && (
              <section className="space-y-8">
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-gray-900">Processo Seletivo</h2>
                  <p className="text-sm text-gray-500">Configure as etapas e atribua candidatos à vaga</p>
                </div>

                <div className="rounded-xl border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">Adicionar Etapas</div>
                  <div className="grid gap-4 px-4 py-4 lg:grid-cols-4">
                    <div className="lg:col-span-2 flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wide text-gray-500">Nome da etapa</label>
                      <input
                        value={stageInput.name}
                        onChange={(e) => setStageInput((s) => ({ ...s, name: e.target.value }))}
                        placeholder="Ex: Triagem de currículo"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wide text-gray-500">Nota mínima</label>
                      <input
                        type="number"
                        step="0.1"
                        value={stageInput.threshold}
                        onChange={(e) => setStageInput((s) => ({ ...s, threshold: Number(e.target.value) }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wide text-gray-500">Peso</label>
                      <input
                        type="number"
                        step="0.1"
                        value={stageInput.stage_weight}
                        onChange={(e) => setStageInput((s) => ({ ...s, stage_weight: Number(e.target.value) }))}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                    </div>
                    <div className="lg:col-span-4 flex flex-col gap-2">
                      <label className="text-xs uppercase tracking-wide text-gray-500">Descrição da etapa</label>
                      <textarea
                        value={stageInput.description}
                        onChange={(e) => setStageInput((s) => ({ ...s, description: e.target.value }))}
                        placeholder="Explique o objetivo e os critérios da etapa"
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900/40"
                      />
                    </div>
                    <div className="lg:col-span-4">
                      <button type="button" onClick={addStage} className="inline-flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                        + Adicionar Etapa
                      </button>
                    </div>
                  </div>
                  {form.stages.length > 0 && (
                    <div className="border-t border-gray-200 px-4 py-4 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-700">Etapas adicionadas</h3>
                      <div className="space-y-2">
                        {form.stages.map((stage, idx) => (
                          <div key={idx} className="flex items-start justify-between rounded-lg border border-gray-200 px-4 py-3 bg-white">
                            <div className="space-y-1">
                              <div className="text-sm font-medium text-gray-900">{idx + 1}. {stage.name}</div>
                              {stage.description && <p className="text-xs text-gray-600 whitespace-pre-line">{stage.description}</p>}
                              <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>Nota mínima: {stage.threshold}</span>
                                <span>•</span>
                                <span>Peso: {stage.stage_weight}</span>
                              </div>
                            </div>
                            <button type="button" onClick={() => removeStage(idx)} className="text-xs font-medium text-red-600 hover:text-red-700">Remover</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200">
                  <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">Atribuir Candidatos Existentes</div>
                  <div className="p-4 space-y-4">
                    {availableCandidates.length === 0 ? (
                      <p className="text-sm text-gray-500">Nenhum candidato cadastrado até o momento.</p>
                    ) : (
                      <>
                        <div className="relative">
                          <input
                            type="search"
                            value={candidateSearchTerm}
                            onChange={(e) => setCandidateSearchTerm(e.target.value)}
                            placeholder="Buscar candidatos por nome ou e-mail"
                            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-gray-900/40 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
                          />
                          <svg
                            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 1010.5 18a7.5 7.5 0 006.15-3.35z" />
                          </svg>
                        </div>
                        {filteredCandidates.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
                            Nenhum candidato encontrado para &ldquo;{candidateSearchTerm}&rdquo;.
                          </div>
                        ) : (
                          <div className="max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white">
                            <div className="divide-y divide-gray-200">
                              {filteredCandidates.map((candidate) => {
                                const selected = selectedCandidateIds.includes(candidate.id)
                                return (
                                  <label
                                    key={candidate.id}
                                    className={`flex cursor-pointer items-center gap-3 px-4 py-3 transition ${selected ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'}`}
                                  >
                                    <input
                                      type="checkbox"
                                      className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                      checked={selected}
                                      onChange={(event) => {
                                        const isChecked = event.target.checked
                                        setSelectedCandidateIds((ids) => {
                                          if (isChecked) {
                                            return ids.includes(candidate.id) ? ids : [...ids, candidate.id]
                                          }
                                          return ids.filter((id) => id !== candidate.id)
                                        })
                                      }}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold">{candidate.name || 'Sem nome informado'}</p>
                                      {candidate.email && (
                                        <p className={`truncate text-xs ${selected ? 'text-white/80' : 'text-gray-500'}`}>{candidate.email}</p>
                                      )}
                                    </div>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {selectedCandidateIds.length > 0 && (
                      <div className="text-xs text-gray-500">{selectedCandidateIds.length} candidat{selectedCandidateIds.length === 1 ? 'o selecionado' : 'os selecionados'}.</div>
                    )}
                  </div>
                </div>
              </section>
            )}
          </form>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-gray-500">
              Passo {currentStepIndex + 1} de {steps.length}
            </div>
            <div className="flex items-center gap-3 justify-end">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Voltar
                </button>
              )}
              {currentStepIndex < steps.length - 1 ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700"
                >
                  Avançar
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ) : (
                <button
                  type="submit"
                  form="job-create-form"
                  className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-green-700 disabled:opacity-60"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Salvar vaga'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)
}

