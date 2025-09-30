# 🤖 Funcionalidades de IA do SmartHire

## Visão Geral

O SmartHire agora inclui um sistema completo de análise de candidatos usando IA, permitindo avaliação automática e detalhada baseada nos requisitos das etapas do processo seletivo.

## ✨ Principais Funcionalidades

### 1. **Configuração da IA** (`/settings/ai`)
- **Chave da API OpenAI**: Configuração segura da chave da API
- **Seleção de Modelo**: Escolha entre diferentes modelos (GPT-4o, GPT-4o Mini, GPT-3.5 Turbo, GPT-4 Turbo)
- **Parâmetros de Análise**: Controle de temperatura e tokens máximos
- **Teste de Conexão**: Validação da configuração antes de usar

### 2. **Análise Inteligente de Candidatos**
- **Extração de Dados**: Processamento automático de currículos e transcrições
- **Comparação com Requisitos**: Análise detalhada contra critérios da etapa
- **Pontuação Automática**: Sistema de pontuação de 0-10 baseado em critérios objetivos
- **Análise Detalhada**: Relatório completo com pontos fortes e fracos

### 3. **Interface de Análise** (`/analysis/[runId]`)
- **Visualização em Tempo Real**: Acompanhamento do progresso da análise
- **Pontuação Visual**: Exibição clara da pontuação com cores indicativas
- **Detalhamento Completo**: 
  - ✅ Pontos fortes do candidato
  - ⚠️ Áreas de melhoria
  - 📋 Requisitos atendidos/não atendidos
  - 💡 Recomendações da IA
- **Exportação**: Funcionalidade para imprimir e exportar análises

## 🔧 Como Usar

### 1. Configurar a IA
1. Acesse `/settings/ai`
2. Insira sua chave da API OpenAI
3. Selecione o modelo desejado
4. Ajuste os parâmetros conforme necessário
5. Teste a conexão

### 2. Analisar um Candidato
1. Acesse uma vaga em `/jobs`
2. Vá para as etapas da vaga
3. Faça upload do currículo do candidato
4. Inicie a análise automática
5. Acompanhe o progresso em tempo real
6. Visualize o resultado detalhado

### 3. Interpretar os Resultados
- **Pontuação 8-10**: Excelente candidato, recomendado para próxima etapa
- **Pontuação 6-7.9**: Bom candidato, considerar com ressalvas
- **Pontuação 0-5.9**: Candidato precisa melhorar, não recomendado

## 🏗️ Arquitetura Técnica

### Backend (FastAPI)
- **Serviço Principal**: `main_enhanced.py`
- **Integração OpenAI**: Análise real usando GPT
- **Fallback Inteligente**: Sistema de backup para análise simulada
- **Processamento Assíncrono**: Análises em background
- **API RESTful**: Endpoints para todas as funcionalidades

### Frontend (Next.js)
- **Configuração**: Interface intuitiva para configuração da IA
- **Análise em Tempo Real**: Acompanhamento visual do progresso
- **Resultados Detalhados**: Visualização rica dos resultados
- **Responsivo**: Funciona em desktop e mobile

### Banco de Dados
- **Configurações**: Tabela `ai_settings` para configurações por usuário
- **Segurança**: Criptografia das chaves da API
- **RLS**: Isolamento por usuário

## 📊 Exemplo de Análise

```
📊 Pontuação Final: 8.2/10

✅ Pontos Fortes:
• 5+ anos de experiência em vendas B2B
• Fluência comprovada em inglês
• Conhecimento em CRM (Salesforce)
• Comunicação clara e objetiva

⚠️ Áreas de Melhoria:
• Falta experiência com equipes grandes (10+ pessoas)
• Não menciona certificações em vendas

📋 Requisitos da Etapa:
✅ Atendidos (3):
• Experiência em vendas
• Fluência em inglês
• Conhecimento em CRM

❌ Não Atendidos (1):
• Liderança de equipes

💡 Recomendações:
• Considerar para próxima etapa
• Avaliar em entrevista técnica
• Verificar experiência de liderança
```

## 🔒 Segurança

- **Chaves Criptografadas**: API keys armazenadas de forma segura
- **Isolamento por Usuário**: Cada usuário vê apenas suas configurações
- **Validação de Entrada**: Validação rigorosa de todos os dados
- **Rate Limiting**: Controle de uso da API OpenAI

## 🚀 Próximas Funcionalidades

- [ ] **Integração com Whisper**: Transcrição real de áudio
- [ ] **Análise de Sentimento**: Avaliação do tom e atitude
- [ ] **Comparação entre Candidatos**: Ranking automático
- [ ] **Templates Personalizados**: Critérios customizáveis por empresa
- [ ] **Relatórios Avançados**: Dashboards e métricas
- [ ] **Integração com ATS**: Sincronização com sistemas externos

## 🛠️ Desenvolvimento

### Executar o Serviço
```bash
# Desenvolvimento
cd services/ai
python main_enhanced.py

# Docker
docker run --rm -p 8000:8000 smarthire-ai:dev
```

### Testar Funcionalidades
```bash
cd services/ai
python test_enhanced.py
```

### Configurar Variáveis de Ambiente
```bash
# .env.local
NEXT_PUBLIC_AI_BASE_URL=http://localhost:8000
OPENAI_API_KEY=sk-your-key-here
```

## 📈 Métricas e Monitoramento

- **Tempo de Análise**: Acompanhamento da performance
- **Taxa de Sucesso**: Percentual de análises bem-sucedidas
- **Custos da API**: Monitoramento de uso da OpenAI
- **Feedback dos Usuários**: Avaliação da qualidade das análises

---

**Desenvolvido com ❤️ para revolucionar o recrutamento inteligente!**
