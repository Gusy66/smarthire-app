'use client'

export default function ApplySuccessPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-16">
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xl font-semibold">
          ✓
        </div>
        <h1 className="mt-4 text-2xl font-semibold text-gray-900">Candidatura enviada!</h1>
        <p className="mt-2 text-sm text-gray-600">
          Obrigado por se candidatar. Em breve entraremos em contato.
        </p>
      </div>
    </div>
  )
}
