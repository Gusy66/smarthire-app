import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient">
      {/* Hero Section */}
      <section className="container-page py-20">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Revolucione seu{' '}
            <span className="text-gradient">processo seletivo</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            SmartHire utiliza inteligência artificial para analisar candidatos de forma objetiva, 
            justa e eficiente. Encontre os melhores talentos para sua empresa.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/jobs" className="btn btn-primary text-lg px-8 py-4">
              🚀 Começar Agora
            </Link>
            <Link href="/settings/ai" className="btn btn-outline text-lg px-8 py-4">
              ⚙️ Configurar IA
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50">
        <div className="container-page">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Por que escolher o SmartHire?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Nossa plataforma combina tecnologia de ponta com simplicidade de uso
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-primary-green-100 text-primary-green-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                🤖
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Análise Inteligente
              </h3>
              <p className="text-gray-600">
                IA avançada analisa currículos e entrevistas, fornecendo insights 
                objetivos e detalhados sobre cada candidato.
              </p>
            </div>

            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-primary-green-100 text-primary-green-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                ⚡
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Processo Rápido
              </h3>
              <p className="text-gray-600">
                Reduza o tempo de triagem em até 80% com análises automáticas 
                e relatórios instantâneos.
              </p>
            </div>

            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-primary-green-100 text-primary-green-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
                🎯
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Precisão Garantida
              </h3>
              <p className="text-gray-600">
                Critérios personalizáveis e pontuação objetiva garantem 
                decisões mais justas e consistentes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="py-20">
        <div className="container-page">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Como funciona?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Em poucos passos, você terá análises completas dos seus candidatos
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-primary-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Configure a IA
              </h3>
              <p className="text-gray-600 text-sm">
                Conecte sua chave OpenAI e escolha o modelo de análise
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Crie as Etapas
              </h3>
              <p className="text-gray-600 text-sm">
                Defina requisitos e critérios para cada etapa do processo
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Analise Candidatos
              </h3>
              <p className="text-gray-600 text-sm">
                Faça upload de currículos e inicie a análise automática
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-primary-green-500 text-white rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                4
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Visualize Resultados
              </h3>
              <p className="text-gray-600 text-sm">
                Acompanhe pontuações e análises detalhadas em tempo real
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-green-600">
        <div className="container-page text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Pronto para transformar seu recrutamento?
          </h2>
          <p className="text-xl text-primary-green-100 mb-8 max-w-2xl mx-auto">
            Junte-se a empresas que já estão usando IA para encontrar os melhores talentos
          </p>
          <Link href="/jobs" className="btn bg-white text-primary-green-600 hover:bg-primary-green-50 text-lg px-8 py-4">
            Começar Gratuitamente
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-gray-900 text-white">
        <div className="container-page">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gradient mb-4">SmartHire</h3>
              <p className="text-gray-400">
                Revolucionando o recrutamento com inteligência artificial
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/jobs" className="hover:text-white transition-colors">Vagas</a></li>
                <li><a href="/candidates" className="hover:text-white transition-colors">Candidatos</a></li>
                <li><a href="/settings" className="hover:text-white transition-colors">Configurações</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Recursos</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/settings/ai" className="hover:text-white transition-colors">Análise por IA</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Relatórios</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Integrações</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">Documentação</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contato</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Status</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 SmartHire. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}