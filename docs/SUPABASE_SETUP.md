## Setup do Supabase (DB, Storage, pgvector)

### 1) Criar projeto
- Acesse o painel do Supabase e crie um projeto (org de produção e outra de dev, se possível).
- Obtenha `PROJECT_URL`, `ANON_KEY` e `SERVICE_ROLE_KEY` (guardar seguro).

### 2) Ativar extensões e storage
- Ativar a extensão `pgvector` no banco.
- Criar buckets:
  - `resumes/` (PDF/DOCX)
  - `audios/` (WAV/MP3)
  - `transcripts/` (JSON)
  - `exports/` (CSV/Parquet)

### 3) Esquema inicial
- Executar o DDL em `docs/SCHEMA.md` (ajustar conforme nomenclatura).
- Garantir chaves estrangeiras e índices para `company_id`, `job_id`, `candidate_id`, `status`.
- (Opcional) Tabelas auxiliares para embeddings com `pgvector`.

### 4) RLS (Row Level Security)
- Ativar RLS em todas as tabelas com `company_id`.
- Políticas: usuários só leem/escrevem dados da sua `company_id`; admins têm acesso total na empresa.
- Claims JWT: incluir `company_id` no token do usuário, se necessário.

### 5) Variáveis de ambiente
- App Web (`web/.env.local`):
  - `NEXT_PUBLIC_SUPABASE_URL=`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=`
  - `NEXT_PUBLIC_AI_BASE_URL=http://localhost:8000`

- Serviço IA (`services/ai/.env`):
  - `SUPABASE_URL=`
  - `SUPABASE_SERVICE_ROLE_KEY=`
  - `DEEPGRAM_API_KEY=` (ou outro ASR)
  - `LLM_API_BASE=` (provedor LLM)
  - `LLM_API_KEY=`

### 6) Próximos passos
- Carregar dados seed mínimos (empresa, usuário admin) e validar RLS.
- Testar upload assinado de currículo/áudio via Supabase Storage.
- Validar conexão do serviço de IA com o Supabase usando `SERVICE_ROLE_KEY` (somente servidor).


