'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

type Toast = { id: string; title: string; description?: string; variant?: 'success'|'error'|'info' }

const ToastCtx = createContext<{ notify: (t: Omit<Toast,'id'>) => void } | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) throw new Error('ToastProvider ausente')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const remove = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), [])
  const notify = useCallback((t: Omit<Toast,'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((ts) => [...ts, { id, ...t }])
    setTimeout(() => remove(id), 3500)
  }, [remove])

  return (
    <ToastCtx.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" aria-atomic="true" className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`card p-3 min-w-[240px] ${t.variant==='error' ? 'border-red-400' : t.variant==='success' ? 'border-green-400' : ''}`}>
            <div className="font-medium">{t.title}</div>
            {t.description ? <div className="text-sm opacity-80">{t.description}</div> : null}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}


