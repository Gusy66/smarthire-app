-- Extensões necessárias
create extension if not exists pgcrypto;
create extension if not exists vector;

-- Tabelas principais
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key,
  company_id uuid not null references companies(id),
  email text not null unique,
  name text,
  role text check (role in ('admin','recruiter','interviewer')) not null,
  created_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  title text not null,
  description text,
  location text,
  status text check (status in ('open','closed')) not null default 'open',
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id),
  job_id uuid not null references jobs(id),
  created_at timestamptz not null default now()
);

create table if not exists interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id),
  scheduled_at timestamptz not null,
  duration_minutes int not null,
  status text check (status in ('scheduled','completed','cancelled')) not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  owner_type text check (owner_type in ('candidate','interview')) not null,
  owner_id uuid not null,
  type text check (type in ('resume','audio','transcript')) not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  version int not null,
  created_at timestamptz not null default now()
);

create table if not exists template_questions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id),
  text text not null,
  weight numeric(5,2) not null default 1
);

create table if not exists ai_runs (
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

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references interviews(id),
  question_id uuid references template_questions(id),
  source text check (source in ('ai','manual')) not null,
  value numeric(5,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists score_overrides (
  id uuid primary key default gen_random_uuid(),
  score_id uuid not null references scores(id),
  value numeric(5,2) not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  type text not null,
  status text not null,
  storage_path text,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  user_id uuid references users(id),
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Índices úteis
create index if not exists idx_jobs_company on jobs(company_id);
create index if not exists idx_candidates_company on candidates(company_id);
create index if not exists idx_applications_candidate on applications(candidate_id);
create index if not exists idx_applications_job on applications(job_id);
create index if not exists idx_interviews_app on interviews(application_id);
create index if not exists idx_documents_company on documents(company_id);
create index if not exists idx_ai_runs_company on ai_runs(company_id);


