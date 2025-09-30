'use client'

import Link from 'next/link'

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gradient py-8">
      <div className="container-page max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Configurações</h1>
          <p className="text-gray-600 mt-2">Gerencie as configurações do sistema e personalize sua experiência</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Configurações da IA */}
          <Link href="/settings/ai" className="card p-8 hover:shadow-lg transition-all duration-200 group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-primary-green-100 text-primary-green-600 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🤖
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Configurações da IA</h3>
                <p className="text-sm text-gray-600">Configure a integração com OpenAI</p>
              </div>
            </div>
            <div className="text-primary-green-600 text-sm font-medium group-hover:text-primary-green-700">
              Configurar →
            </div>
          </Link>

          {/* Configurações da Empresa */}
          <Link href="/settings/company" className="card p-8 hover:shadow-lg transition-all duration-200 group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🏢
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Empresa</h3>
                <p className="text-sm text-gray-600">Informações da empresa</p>
              </div>
            </div>
            <div className="text-primary-green-600 text-sm font-medium group-hover:text-primary-green-700">
              Configurar →
            </div>
          </Link>

          {/* Configurações de Usuário */}
          <Link href="/settings/profile" className="card p-8 hover:shadow-lg transition-all duration-200 group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                👤
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Perfil</h3>
                <p className="text-sm text-gray-600">Seus dados pessoais</p>
              </div>
            </div>
            <div className="text-primary-green-600 text-sm font-medium group-hover:text-primary-green-700">
              Configurar →
            </div>
          </Link>

          {/* Configurações de Notificações */}
          <Link href="/settings/notifications" className="card p-8 hover:shadow-lg transition-all duration-200 group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                🔔
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Notificações</h3>
                <p className="text-sm text-gray-600">Preferências de notificação</p>
              </div>
            </div>
            <div className="text-primary-green-600 text-sm font-medium group-hover:text-primary-green-700">
              Configurar →
            </div>
          </Link>
        </div>

        {/* Informações do Sistema */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-green-100 text-primary-green-600 rounded-lg flex items-center justify-center text-xl">
              ℹ️
            </div>
            <h3 className="text-xl font-semibold text-gray-900">Informações do Sistema</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Versão:</span>
                <span className="text-gray-900">1.0.0</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Ambiente:</span>
                <span className="badge badge-info">Desenvolvimento</span>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Última atualização:</span>
                <span className="text-gray-900">{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="font-medium text-gray-700">Status da IA:</span>
                <span className="status-success">● Online</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
