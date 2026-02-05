'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'

type PublicJob = {
  id: string
  title: string
  description?: string | null
  location?: string | null
  department?: string | null
  job_description?: string | null
  responsibilities?: string | null
  requirements_and_skills?: string | null
  company_name?: string | null
}

declare global {
  interface Window {
    onTurnstileSuccess?: (token: string) => void
    onTurnstileExpired?: () => void
    onTurnstileError?: () => void
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, any>) => string
      remove: (widgetId: string) => void
    }
  }
}

export default function PublicApplyPage() {
  const params = useParams()
  const token = typeof params?.token === 'string' ? params.token : ''
  const [job, setJob] = useState<PublicJob | null>(null)
  const [loadingJob, setLoadingJob] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [resumePath, setResumePath] = useState<string | null>(null)
  const [resumeBucket, setResumeBucket] = useState<string | null>(null)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaContainerRef = useRef<HTMLDivElement | null>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  })

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    let active = true
    setLoadingJob(true)
    fetch(`/api/jobs/public/${token}`, { credentials: 'omit' })
      .then((res) => res.json().then((j) => ({ ok: res.ok, json: j })))
      .then(({ ok, json }) => {
        if (!active) return
        if (!ok) {
          setError(json?.error?.message || 'Vaga não encontrada')
          setJob(null)
          return
        }
        setJob(json?.item || null)
      })
      .catch(() => {
        if (active) setError('Falha ao carregar vaga')
      })
      .finally(() => {
        if (active) setLoadingJob(false)
      })
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    if (!siteKey) return
    window.onTurnstileSuccess = (tokenValue: string) => setCaptchaToken(tokenValue)
    window.onTurnstileExpired = () => setCaptchaToken(null)
    window.onTurnstileError = () => setCaptchaToken(null)

    const renderWidget = () => {
      if (!captchaContainerRef.current || !window.turnstile) return
      if (turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current)
      }
      turnstileWidgetId.current = window.turnstile.render(captchaContainerRef.current, {
        sitekey: siteKey,
        callback: 'onTurnstileSuccess',
        'expired-callback': 'onTurnstileExpired',
        'error-callback': 'onTurnstileError',
      })
    }

    const existingScript = document.getElementById('turnstile-script') as HTMLScriptElement | null
    if (!existingScript) {
      const script = document.createElement('script')
      script.id = 'turnstile-script'
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = () => renderWidget()
      document.body.appendChild(script)
    } else {
      if (window.turnstile) {
        renderWidget()
      } else {
        existingScript.addEventListener('load', renderWidget, { once: true })
      }
    }

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        window.turnstile.remove(turnstileWidgetId.current)
        turnstileWidgetId.current = null
      }
    }
  }, [siteKey])

  async function handleResumeUpload(file: File) {
    if (!file) return
    setUploading(true)
    setError('')
    try {
      const metaRes = await fetch('/api/uploads/public/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          content_type: file.type || 'application/pdf',
          file_size: file.size,
          job_token: token,
        }),
      })
      const metaJson = await metaRes.json().catch(() => null)
      if (!metaRes.ok) {
        throw new Error(metaJson?.error?.message || 'Erro ao preparar upload')
      }
      const uploadUrl = metaJson?.upload_url
      if (!uploadUrl) throw new Error('URL de upload inválida')
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/pdf' },
        body: file,
      })
      if (!uploadRes.ok) {
        throw new Error('Falha ao enviar currículo')
      }
      setResumePath(metaJson?.path || null)
      setResumeBucket(metaJson?.bucket || null)
    } catch (err: any) {
      setError(err?.message || 'Falha ao enviar currículo')
      setResumePath(null)
      setResumeBucket(null)
    } finally {
      setUploading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!resumePath || !resumeBucket) {
      setError('Anexe o currículo antes de enviar')
      return
    }
    if (!captchaToken) {
      setError('Confirme o CAPTCHA antes de enviar')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/jobs/public/${token}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          resume_path: resumePath,
          resume_bucket: resumeBucket,
          captcha_token: captchaToken,
        }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Erro ao enviar candidatura')
      }
      setForm({ name: '', email: '', phone: '' })
      setResumePath(null)
      setResumeBucket(null)
      setCaptchaToken(null)
      setError('') 
      alert('Candidatura enviada com sucesso!')
    } catch (err: any) {
      setError(err?.message || 'Erro ao enviar candidatura')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Candidatar-se</h1>
          <p className="text-sm text-gray-600">Preencha seus dados para participar do processo seletivo.</p>
        </div>

        {loadingJob && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-500">Carregando vaga...</div>
        )}

        {!loadingJob && error && !job && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        )}

        {job && (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
            <div className="text-xs text-gray-500">{job.company_name || 'Empresa'}</div>
            <h2 className="text-xl font-semibold text-gray-900">{job.title}</h2>
            {job.location && <div className="text-sm text-gray-600">{job.location}</div>}
            {job.description && <p className="text-sm text-gray-700 whitespace-pre-wrap">{job.description}</p>}
          </div>
        )}

        {job && (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currículo (PDF/DOC/DOCX)</label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleResumeUpload(file)
                }}
                className="w-full text-sm"
              />
              {uploading && <div className="text-xs text-gray-500 mt-1">Enviando currículo...</div>}
              {!uploading && resumePath && <div className="text-xs text-emerald-600 mt-1">Currículo anexado.</div>}
            </div>

            {siteKey ? (
              <div className="pt-2">
                <div ref={captchaContainerRef} />
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700">
                CAPTCHA não configurado. Defina NEXT_PUBLIC_TURNSTILE_SITE_KEY.
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? 'Enviando...' : 'Enviar candidatura'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
