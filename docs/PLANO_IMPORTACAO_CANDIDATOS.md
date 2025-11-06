# 📋 Plano de Implementação - Importação de Candidatos em Massa

## 📌 Visão Geral

Adicionar funcionalidade para importar múltiplos candidatos simultaneamente através de arquivo CSV ou Excel, com validação robusta e feedback detalhado sobre erros.

---

## 🎯 Objetivos

- ✅ Permitir importação em massa de candidatos (10-100+ por vez)
- ✅ Validar dados antes de salvar no banco
- ✅ Fornecer relatório detalhado de sucesso/erro
- ✅ Permitir upload de currículos após importação
- ✅ Manter compatibilidade com dados existentes

---

## 📚 Documentação Preparada

### 1. **Especificações Técnicas** (`IMPORT_CANDIDATOS_ESPECIFICACOES.md`)
- ✅ Definição de colunas (obrigatórias e opcionais)
- ✅ Regras de validação de dados
- ✅ Fluxo de importação passo-a-passo
- ✅ Formatos suportados (CSV, Excel)
- ✅ Estrutura de resposta da API

### 2. **Guia de Uso** (`GUIA_IMPORTACAO_CANDIDATOS.md`)
- ✅ Tutorial passo-a-passo para usuários
- ✅ Descrição de colunas com exemplos
- ✅ Erros comuns e soluções
- ✅ Boas práticas
- ✅ Dicas por software (Excel, Sheets, etc)

### 3. **Arquivos de Teste**
- ✅ **`candidatos_template.csv`** - Template vazio (localizado em `web/public/`)
- ✅ **`candidatos_teste.csv`** - 14 registros preenchidos (pronto para usar)

---

## 🏗️ Arquitetura da Solução

### Backend (Fase 1)

#### Novo Endpoint
```
POST /api/candidates/import
- Body: FormData com arquivo
- Retorna: { ok, importados, erros, detalhes, candidatos_ids }
```

#### Validações
```javascript
// Validações por campo
- nome: length >= 3, tipo string
- email: formato válido, único
- telefone: formato com DDD (opcional)
- vaga_titulo: deve existir no banco
- etapa_nome: deve existir para a vaga
- estado: validar UF
- genero: um dos [Masculino, Feminino, Outro]
- filhos: deve ser número
```

#### Lógica
```
1. Parse do arquivo (CSV ou Excel)
2. Validar cabeçalhos
3. Processar linha por linha
4. Acumular erros (sem parar no primeiro)
5. Inserir válidos no banco
6. Retornar relatório
```

### Frontend (Fase 1)

#### Componente de Upload
- Upload com drag-and-drop
- Validação de extensão (.csv, .xlsx, .xls)
- Preview dos dados antes de confirmar

#### Tela de Preview
- Tabela com candidatos que serão importados ✅
- Tabela com erros ⚠️
- Resumo: "8 de 10 candidatos serão importados"

#### Tela Pós-Importação
- Lista de candidatos criados
- Botão "📎 Anexar Currículo" para cada candidato sem CV
- Relatório completo

---

## 📦 Tecnologias

### Backend
- **parsing**: `csv-parser` ou `xlsx` (se decidir adicionar)
- **validação**: `validator.js` ou funções customizadas
- **banco**: Supabase (já integrado)

### Frontend
- **components**: React + TailwindCSS (padrão do projeto)
- **upload**: Input de arquivo + drag-and-drop
- **parsing**: Nativo do browser (Papa Parse ou equivalente)

---

## 🔄 Fluxo Completo

```
┌─────────────────────┐
│  Página Candidatos  │
│  Botão: Importar    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────┐
│  Modal de Upload        │
│  - Drag-and-drop        │
│  - Selecionar arquivo   │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  Preview              │
│  ✅ 8 sucesso         │
│  ⚠️  2 erro           │
│  Botão: Confirmar     │
└──────────┬──────────────┘
           │
           ▼
┌─────────────────────────┐
│  POST /api/import       │
│  Processa dados         │
│  Insere no banco        │
└──────────┬──────────────┘
           │
           ▼
┌──────────────────────────┐
│  Resultado              │
│  ✅ Importados com sucesso│
│  - Lista de novos        │
│  - Botão: Anexar CV      │
└──────────────────────────┘
```

---

## 📊 Estrutura da Planilha

### Arquivo de Template
```csv
nome,email,telefone,vaga_titulo,etapa_nome,cidade,estado,genero,idiomas,formacao
"Seu Nome","seu.email@example.com","(XX) XXXXX-XXXX","Nome da Vaga","Triagem","Cidade","UF","Masculino/Feminino/Outro","Idiomas separados por vírgula","Descrição da formação"
```

### Arquivo de Teste
14 candidatos preenchidos com dados realistas de teste:
- 8 Desenvolvedores Python
- 6 UX Designers
- Distribuídos em várias cidades brasileiras
- Todos com dados válidos

---

## ✅ Testes Necessários

### Teste 1: Upload do arquivo de teste
- [ ] Verificar se os 14 candidatos são importados
- [ ] Verificar se emails são únicos
- [ ] Verificar se vagas foram encontradas
- [ ] Verificar se etapas foram encontradas

### Teste 2: Validação de erros
- [ ] Email duplicado (simular)
- [ ] Vaga inexistente (simular)
- [ ] Etapa inexistente (simular)
- [ ] Email inválido (simular)
- [ ] Nome muito curto (simular)

### Teste 3: Upload de currículos
- [ ] Botão aparece para candidatos sem CV
- [ ] Upload funciona corretamente
- [ ] CV fica vinculado

---

## 📅 Fases de Implementação

### Fase 1: MVP (Mínimo Viável)
- Backend: Endpoint `/api/candidates/import`
- Frontend: UI básica com upload
- Validações essenciais
- Relatório de erros

### Fase 2: Upload de Currículos
- Botão "Anexar Currículo" após importação
- Upload individual de arquivos
- Vinculação automática

### Fase 3: Melhorias
- Suporte para Excel avançado (.xlsx)
- Mapeamento de colunas (se layout diferente)
- Preview em tempo real

### Fase 4: Avançado
- Upload de currículos em massa (ZIP)
- Agendamento automático de análise de IA
- Importação recorrente

---

## 📥 Arquivos Disponíveis

Você pode fazer download dos seguintes arquivos da página de Candidatos:

1. **candidatos_template.csv** (template vazio)
2. **candidatos_teste.csv** (14 registros para teste)

Ambos estão em `web/public/` e podem ser baixados diretamente.

---

## 🎓 Próximos Passos

1. ✅ Plano criado
2. ✅ Especificações definidas
3. ✅ Documentação pronta
4. ✅ Arquivos de teste gerados
5. ⏳ **Implementar Backend** (POST /api/candidates/import)
6. ⏳ **Implementar Frontend** (UI + upload)
7. ⏳ **Testar com arquivo de teste**
8. ⏳ **Implementar upload de currículos**
