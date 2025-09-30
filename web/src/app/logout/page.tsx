'use client'

import { useEffect } from 'react'
import { getSupabaseBrowser } from '@/lib/supabaseBrowser'
import { useRouter } from 'next/navigation'

export default function LogoutPage() {
  const supabase = getSupabaseBrowser()
  const router = useRouter()
  useEffect(() => {
    ;(async () => {
      await supabase.auth.signOut()
      router.replace('/login')
    })()
  }, [router, supabase])
  return <div className="text-sm">Saindo...</div>
}


