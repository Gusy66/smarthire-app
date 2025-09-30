## Esquema de Dados — Supabase (Postgres)

Tabelas principais (alto nível):

- companies(id, name, created_at)
- users(id, company_id, email, name, role, created_at)
- jobs(id, company_id, title, description, location, status, created_at)
- candidates(id, company_id, name, email, phone, created_at)
- applications(id, candidate_id, job_id, created_at)
- interviews(id, application_id, scheduled_at, duration_minutes, status, created_at)
- documents(id, company_id, owner_type, owner_id, type, storage_path, created_at)
- templates(id, company_id, name, version, created_at)
- template_questions(id, template_id, text, weight)
- ai_runs(id, company_id, type, status, cost, tokens, started_at, finished_at, error)
- scores(id, interview_id, question_id, source, value, created_at)
- score_overrides(id, score_id, value, reason, created_at, created_by)
- exports(id, company_id, type, status, storage_path, created_at)
- audit_logs(id, company_id, user_id, action, entity, entity_id, metadata, created_at)

Extensões: `pgvector` (colunas embeddings em tabelas auxiliares: resumes_embeddings, transcripts_embeddings).

### Exemplo de DDL (simplificado)
```sql
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  company_id uuid not null references companies(id),
  email text not null unique,
  name text,
  role text check (role in ('admin','recruiter','interviewer')) not null,
  created_at timestamptz not null default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  title text not null,
  description text,
  location text,
  status text check (status in ('open','closed')) not null default 'open',
  created_at timestamptz not null default now()
);

create table candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id),
  job_id uuid not null references jobs(id),
  created_at timestamptz not null default now()
);

create table interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  scheduled_at timestamptz not null,
  duration_minutes int not null,
  status text check (status in ('scheduled','completed','cancelled')) not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  owner_type text check (owner_type in ('candidate','interview')) not null,
  owner_id uuid not null,
  type text check (type in ('resume','audio','transcript')) not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  version int not null,
  created_at timestamptz not null default now()
);

create table template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id),
  text text not null,
  weight numeric(5,2) not null default 1
);

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  type text check (type in ('transcribe','rag','score')) not null,
  status text check (status in ('pending','running','succeeded','failed')) not null,
  cost numeric(12,4),
  tokens int,
  started_at timestamptz default now(),
  finished_at timestamptz,
  error text
);

create table scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id),
  question_id uuid references template_questions(id),
  source text check (source in ('ai','manual')) not null,
  value numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create table score_overrides (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references scores(id),
  value numeric(5,2) not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  type text not null,
  status text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  user_id uuid references users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);
```

### RLS (Row Level Security) — Diretrizes
- Ativar RLS em todas as tabelas com `company_id` e aplicar política: usuário só acessa linhas da sua empresa.
- Permitir admins verem tudo na empresa; restrições adicionais por `role` em operações de escrita.
- Tabelas sem `company_id` (ex.: `template_questions` através do `template_id`) devem checar via join com tabela pai.

Exemplo (conceitual):
```sql
alter table jobs enable row level security;
create policy jobs_company_isolation on jobs
  for all
  using (company_id = auth.uid()::uuid in (select company_id from users where id = auth.uid()));
```

Obs.: No Supabase, as políticas devem referenciar as claims JWT (ex.: `auth.uid()`) e/ou custom claims com `company_id`.


