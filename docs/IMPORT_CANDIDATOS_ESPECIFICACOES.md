# 📋 Especificações de Importação de Candidatos em Massa

## 1. Padrão de Planilha

### Colunas Obrigatórias (Required)
| Coluna | Tipo | Descrição | Exemplo |
|--------|------|-----------|---------|
| `nome` | Texto | Nome completo do candidato | João Silva |
| `email` | Email | Email único do candidato | joao.silva@email.com |
| `telefone` | Texto | Telefone com DDD | (11) 98765-4321 |
| `vaga_titulo` | Texto | Título da vaga (deve existir no sistema) | Desenvolvedor Python |
| `etapa_nome` | Texto | Nome da etapa inicial (primeira etapa) | Triagem |

### Colunas Opcionais (Optional)
| Coluna | Tipo | Descrição | Exemplo |
|--------|------|-----------|---------|
| `cidade` | Texto | Cidade | São Paulo |
| `estado` | Texto | Estado (UF) | SP |
| `endereco` | Texto | Endereço completo | Rua A, 123 |
| `filhos` | Número | Quantidade de filhos | 2 |
| `genero` | Texto | Gênero (Masculino/Feminino/Outro) | Masculino |
| `idiomas` | Texto | Idiomas separados por vírgula | Português, Inglês, Espanhol |
| `formacao` | Texto | Descrição da formação/educação | Engenharia de Software, USP |

---

## 2. Regras de Validação

### Validações Obrigatórias
- ✅ **Nome**: Não vazio, mín. 3 caracteres
- ✅ **Email**: Formato válido, não pode existir duplicado
- ✅ **Telefone**: Formato válido com DDD (opcional, mas se preenchido deve ser válido)
- ✅ **Vaga**: Deve existir no sistema (título exato)
- ✅ **Etapa**: Deve existir na vaga especificada

### Validações Opcionais
- ✅ **Estado**: Deve ser uma UF válida (SP, RJ, MG, etc)
- ✅ **Gênero**: Se preenchido, deve ser um dos valores permitidos
- ✅ **Filhos**: Se preenchido, deve ser um número

### Ações em Caso de Erro
- ⚠️ **Erro em uma linha**: A linha é rejeitada, mas outras continuam
- ⚠️ **Relatório de erros**: Lista detalhada de linhas com erro
- ⚠️ **Preview antes de salvar**: Mostrar quantos serão adicionados e erros antes de confirmar

---

## 3. Fluxo de Importação

```
1. Upload do arquivo (CSV/Excel)
   ↓
2. Parsing e leitura das linhas
   ↓
3. Validação de cada linha
   ↓
4. Preview com resumo (sucesso/erro)
   ↓
5. Confirmação do usuário
   ↓
6. Criação dos candidatos no banco
   ↓
7. Relatório final com resultado
```

---

## 4. Formatos Suportados

### CSV
- **Encoding**: UTF-8
- **Delimitador**: Vírgula (,)
- **Aspas**: Suportadas para valores com vírgula
- **Header**: Primeira linha com nomes das colunas

### Excel (.xlsx)
- **Extensão**: .xlsx (Office 365) ou .xls (versões antigas)
- **Sheet**: Primeira aba (sheet)
- **Header**: Primeira linha com nomes das colunas

---

## 5. Documentos Necessários

### 1️⃣ Arquivo Template (em branco)
- Arquivo: `candidatos_template.xlsx`
- Contém: Cabeçalhos e validações de dados
- Uso: Usuário faz download e preenche

### 2️⃣ Arquivo Teste (preenchido)
- Arquivo: `candidatos_teste.xlsx`
- Contém: 10-15 registros de exemplo completos
- Uso: Testar a funcionalidade de importação

---

## 6. Processo de Upload de Currículo Posterior

Após importação, para cada candidato:
1. Sistema mostra lista de candidatos importados
2. Se não houver currículo: botão "📎 Anexar Currículo"
3. Usuário seleciona arquivo PDF/DOCX
4. Sistema faz upload para a pasta `resumes`
5. Currículo fica vinculado ao candidato

---

## 7. Exemplo de Dados na Planilha

| nome | email | telefone | vaga_titulo | etapa_nome | cidade | estado | genero | idiomas | formacao |
|------|-------|----------|-------------|-----------|--------|--------|--------|---------|----------|
| João Silva | joao@email.com | (11) 98765-4321 | Desenvolvedor Python | Triagem | São Paulo | SP | Masculino | Português, Inglês | Eng. Software |
| Maria Santos | maria@email.com | (21) 99876-5432 | Desenvolvedor Python | Triagem | Rio de Janeiro | RJ | Feminino | Português, Espanhol | Análise Sistemas |
| Pedro Costa | pedro@email.com | (31) 97654-3210 | UX Designer | Triagem | Belo Horizonte | MG | Masculino | Português | Design Gráfico |

---

## 8. Erro Esperado e Tratamento

```json
{
  "sucesso": 8,
  "erro": 2,
  "total": 10,
  "erros_detalhes": [
    {
      "linha": 5,
      "candidato": "Ana Clara",
      "erro": "Email já existe no sistema (ana.clara@email.com)"
    },
    {
      "linha": 9,
      "candidato": "Carlos Mendes",
      "erro": "Vaga 'Desenvolvedor Java' não encontrada"
    }
  ]
}
```

---

## 9. API Endpoint

### POST `/api/candidates/import`

**Request:**
```json
{
  "file": "FormData - arquivo CSV ou Excel",
  "vincular_curriculos": false
}
```

**Response (Sucesso):**
```json
{
  "ok": true,
  "importados": 8,
  "erros": 2,
  "detalhes": [...],
  "candidatos_ids": ["id1", "id2", ...]
}
```

**Response (Erro):**
```json
{
  "ok": false,
  "erro": "Arquivo inválido",
  "detalhes": "Extensão deve ser .csv ou .xlsx"
}
```

---

## 10. Próximas Fases

- [ ] **Fase 1**: Template + importação básica
- [ ] **Fase 2**: Upload de currículos em massa (pasta ZIP)
- [ ] **Fase 3**: Mapeamento customizado de colunas
- [ ] **Fase 4**: Agendamento de avaliação automática após importação
