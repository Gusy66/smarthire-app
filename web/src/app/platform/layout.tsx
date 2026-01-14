export const metadata = {
  title: 'SmartHire Platform Admin',
  description: 'Painel de administração da plataforma SmartHire'
}

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Este layout sobrescreve visualmente o layout pai
  // O conteúdo das páginas /platform já tem fundo próprio (full screen)
  return (
    <div className="fixed inset-0 z-[100] overflow-auto">
      {children}
    </div>
  )
}

