import AuthGuard from '@/components/AuthGuard'

export default function JobsSectionLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}


