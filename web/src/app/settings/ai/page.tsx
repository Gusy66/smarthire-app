'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ToastProvider'

type AIConfig = {
  openai_api_key: string
  model: string
  temperature: number
  max_tokens: number
}

const MODELS = [
  { id: 'gpt-4o', name: 'GPT-4o', description: 'Mais avançado, melhor qualidade' },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Rápido e econômico' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Balanço entre custo e qualidade' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Alta qualidade, custo médio' }
]

export default function AISettingsPage() {
  const { notify } = useToast()
  const [config, setConfig] = useState<AIConfig>({
    openai_api_key: '',
    model: 'gpt-4o-mini',
    temperature: 0.3,
    max_tokens: 2000
  })
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const res = await fetch('/api/settings/ai')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
    }
  }

  async function saveConfig() {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Erro ao salvar configurações')
      }
      
      notify({ 
        title: 'Configurações salvas', 
        description: 'Configurações da IA foram atualizadas com sucesso',
        variant: 'success' 
      })
    } catch (error) {
      notify({ 
        title: 'Erro ao salvar', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'error' 
      })
    } finally {
      setLoading(false)
    }
  }

  async function testConnection() {
    setTesting(true)
    try {
      const res = await fetch('/api/settings/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          openai_api_key: config.openai_api_key,
          model: config.model 
        })
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error?.message || 'Erro ao testar conexão')
      }
      
      notify({ 
        title: 'Conexão testada', 
        description: 'Conexão com OpenAI estabelecida com sucesso',
        variant: 'success' 
      })
    } catch (error) {
      notify({ 
        title: 'Erro na conexão', 
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'error' 
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient py-8">
      <div className="container-page max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Configurações da IA</h1>
            <p className="text-gray-600 mt-2">Configure a integração com OpenAI para análise inteligente de candidatos</p>
          </div>
          <a href="/settings" className="btn btn-outline">← Voltar</a>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Configurações da API */}
          <div className="card p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-green-100 text-primary-green-600 rounded-lg flex items-center justify-center text-xl">
                🤖
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Configurações da API</h2>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chave da API OpenAI
              </label>
              <input
                type="password"
                value={config.openai_api_key}
                onChange={(e) => setConfig(prev => ({ ...prev, openai_api_key: e.target.value }))}
                placeholder="sk-..."
                className="w-full"
              />
              <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                🔒 Sua chave da API OpenAI. Mantemos esta informação segura e criptografada.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Modelo de IA
              </label>
              <select
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                className="w-full"
              >
                {MODELS.map(model => (
                  <option key={model.id} value={model.id}>
                    {model.name} - {model.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Temperatura (0.0 - 1.0)
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.temperature}
                  onChange={(e) => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Conservador (0.0)</span>
                  <span className="font-medium text-primary-green-600">{config.temperature}</span>
                  <span>Criativo (1.0)</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Máximo de Tokens
                </label>
                <input
                  type="number"
                  min="100"
                  max="4000"
                  value={config.max_tokens}
                  onChange={(e) => setConfig(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                onClick={saveConfig}
                disabled={loading || !config.openai_api_key}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <>
                    <div className="spinner w-4 h-4 mr-2"></div>
                    Salvando...
                  </>
                ) : (
                  '💾 Salvar Configurações'
                )}
              </button>
              
              <button
                onClick={testConnection}
                disabled={testing || !config.openai_api_key}
                className="btn btn-outline"
              >
                {testing ? (
                  <>
                    <div className="spinner w-4 h-4 mr-2"></div>
                    Testando...
                  </>
                ) : (
                  '🔍 Testar'
                )}
              </button>
            </div>
          </div>

          {/* Informações sobre Análise */}
          <div className="card p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-green-100 text-primary-green-600 rounded-lg flex items-center justify-center text-xl">
                ⚡
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Como Funciona a Análise</h2>
            </div>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary-green-100 text-primary-green-600 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Extração de Dados</h3>
                  <p className="text-gray-600">A IA extrai informações relevantes do currículo do candidato de forma inteligente</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary-green-100 text-primary-green-600 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Comparação com Requisitos</h3>
                  <p className="text-gray-600">Compara as habilidades do candidato com os requisitos específicos da etapa</p>
                </div>
              </div>
              
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-primary-green-100 text-primary-green-600 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Pontuação e Análise</h3>
                  <p className="text-gray-600">Gera pontuação objetiva e análise detalhada dos pontos fortes e fracos</p>
                </div>
              </div>
            </div>

            <div className="bg-primary-green-50 border border-primary-green-200 rounded-lg p-6">
              <h4 className="font-semibold text-primary-green-800 mb-3 flex items-center gap-2">
                💡 Dica de Configuração
              </h4>
              <p className="text-sm text-primary-green-700">
                Use temperaturas baixas (0.1-0.3) para análises mais consistentes e objetivas. 
                Temperaturas altas (0.7-1.0) para análises mais criativas e subjetivas.
              </p>
            </div>
          </div>
        </div>

        {/* Exemplo de Análise */}
        <div className="card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-green-100 text-primary-green-600 rounded-lg flex items-center justify-center text-xl">
              📊
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Exemplo de Análise</h2>
          </div>
          
          <div className="bg-gradient-to-r from-primary-green-50 to-white rounded-xl p-6 space-y-6">
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-primary-green-500 rounded-full"></span>
              <span className="font-semibold text-gray-900">Pontos Fortes:</span>
            </div>
            <ul className="text-gray-700 ml-6 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary-green-500 mt-1">✓</span>
                <span>5+ anos de experiência em vendas B2B</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-green-500 mt-1">✓</span>
                <span>Fluência comprovada em inglês</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary-green-500 mt-1">✓</span>
                <span>Conhecimento em CRM (Salesforce)</span>
              </li>
            </ul>
            
            <div className="flex items-center gap-3">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              <span className="font-semibold text-gray-900">Áreas de Melhoria:</span>
            </div>
            <ul className="text-gray-700 ml-6 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">⚠</span>
                <span>Falta experiência com equipes grandes (10+ pessoas)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-500 mt-1">⚠</span>
                <span>Não menciona certificações em vendas</span>
              </li>
            </ul>
            
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
              <span className="w-3 h-3 bg-primary-green-600 rounded-full"></span>
              <span className="font-semibold text-gray-900">Pontuação Final:</span>
              <span className="text-2xl font-bold text-primary-green-600">8.2/10</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
