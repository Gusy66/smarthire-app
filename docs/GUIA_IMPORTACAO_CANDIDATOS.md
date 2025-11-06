# 📤 Guia de Importação de Candidatos em Massa

## 🚀 Como Usar

### Passo 1: Download do Template
1. Acesse a página de Candidatos
2. Clique em "📥 Importar Candidatos"
3. Clique em "📄 Baixar Template"
4. Um arquivo `candidatos_template.csv` será baixado

### Passo 2: Preencher a Planilha
1. Abra o arquivo no Excel, Google Sheets ou qualquer editor de planilha
2. Preencha os dados dos candidatos
3. **Não altere os nomes das colunas** (header)
4. Salve o arquivo como CSV ou Excel

### Passo 3: Fazer Upload
1. Volte à página de Candidatos
2. Clique em "📥 Importar Candidatos"
3. Arraste ou selecione o arquivo preenchido
4. Clique em "Preview" para visualizar os dados

### Passo 4: Revisar e Confirmar
1. **Preview** mostrará:
   - ✅ Candidatos que serão importados (sucesso)
   - ⚠️ Linhas com erro (motivo do erro)
2. Revise os dados
3. Clique em "Confirmar Importação"

### Passo 5: Upload de Currículos (Opcional)
1. Após importação bem-sucedida, você verá a lista de novos candidatos
2. Para cada candidato **sem currículo**:
   - Clique no botão "📎 Anexar Currículo"
   - Selecione o arquivo PDF ou DOCX
   - O currículo será vinculado ao candidato

---

## 📋 Colunas da Planilha

### ✅ Obrigatórias (Sempre preencher)

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| **nome** | Nome completo | João Silva |
| **email** | Email único | joao@email.com |
| **telefone** | Telefone com DDD | (11) 98765-4321 |
| **vaga_titulo** | Título da vaga (deve existir) | Desenvolvedor Python |
| **etapa_nome** | Etapa inicial (deve existir na vaga) | Triagem |

### ⭕ Opcionais (Deixar em branco se não souber)

| Coluna | Descrição | Exemplo |
|--------|-----------|---------|
| cidade | Cidade | São Paulo |
| estado | Estado (UF) | SP |
| genero | Gênero | Masculino / Feminino / Outro |
| idiomas | Idiomas separados por vírgula | Português, Inglês |
| formacao | Descrição da formação | Eng. Software, USP |

---

## 📝 Formato dos Dados

### Email
- ✅ Válido: `joao@email.com`, `maria.santos@empresa.com`
- ❌ Inválido: `joao@`, `@email.com`, `joao email`

### Telefone
- ✅ Válido: `(11) 98765-4321`, `(21) 3333-4444`
- ❌ Inválido: `11987654321`, `(11) 9876`, `telefoneinvalido`

### Estado
- ✅ Válidos: SP, RJ, MG, BA, SC, RS, PE, CE, PA, etc.
- ❌ Inválido: São Paulo (use a sigla!)

### Gênero
- ✅ Válidos: `Masculino`, `Feminino`, `Outro`
- ❌ Inválido: `M`, `F`, `Masc.`

---

## ⚠️ Erros Comuns

### "Email já existe"
**Causa**: Email do candidato já está registrado  
**Solução**: Use um email diferente ou verifique se o candidato já existe

### "Vaga não encontrada"
**Causa**: O título da vaga não existe no sistema  
**Solução**: Crie a vaga primeiro ou verifique o nome exato

### "Etapa não encontrada na vaga"
**Causa**: A etapa não existe para essa vaga  
**Solução**: Crie a etapa na vaga ou verifique o nome

### "Email inválido"
**Causa**: Email não tem formato correto  
**Solução**: Verifique se tem @ e domínio

### "Nome muito curto"
**Causa**: Nome tem menos de 3 caracteres  
**Solução**: Use nome completo

---

## 📊 Testando com Dados de Exemplo

1. Faça download do arquivo **`candidatos_teste.csv`**
   - Contém 14 candidatos completamente preenchidos
   - Pronto para importar e testar

2. Siga os passos normais de importação

3. Todos os dados devem ser válidos e importar com sucesso ✅

---

## 🎯 Boas Práticas

1. **Verifique os dados antes de importar**
   - Use o Preview para validar

2. **Não altere os nomes das colunas**
   - Sempre respeite o header

3. **Use dados realistas**
   - Nomes completos, emails válidos

4. **Mantenha a codificação UTF-8**
   - Para caracteres acentuados

5. **Anexe currículos assim que possível**
   - Para ativar a análise de IA

---

## 💡 Dicas Úteis

- **Google Sheets**: Exporte como CSV quando terminar
- **Excel**: Salve como CSV ou mantenha .xlsx (ambos funcionam)
- **LibreOffice**: Salve como CSV com codificação UTF-8
- **Números (Mac)**: Exporte como CSV

---

## 🆘 Precisa de Ajuda?

Consulte o documento de **especificações técnicas** para mais detalhes:  
`docs/IMPORT_CANDIDATOS_ESPECIFICACOES.md`
