-- Etapas do processo seletivo e critérios (requisitos) por etapa

create table if not exists job_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references jobs(id) on delete cascade,
  name text not null,
  order_index int not null default 0,
  threshold numeric(5,2) not null default 0.0, -- pontuação mínima para aprovar
  created_at timestamptz not null default now()
);

create index if not exists idx_job_stages_job on job_stages(job_id);

create table if not exists stage_requirements (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references job_stages(id) on delete cascade,
  label text not null,
  weight numeric(5,2) not null default 1.0,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stage_requirements_stage on stage_requirements(stage_id);

-- Status do candidato por etapa
create table if not exists application_stages (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications(id) on delete cascade,
  stage_id uuid not null references job_stages(id) on delete cascade,
  status text check (status in ('pending','running','succeeded','failed')) not null default 'pending',
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique(application_id, stage_id)
);

-- Execuções de IA por etapa
create table if not exists stage_ai_runs (
  id uuid primary key default gen_random_uuid(),
  application_stage_id uuid not null references application_stages(id) on delete cascade,
  type text check (type in ('rag','score')) not null,
  status text check (status in ('pending','running','succeeded','failed')) not null,
  cost numeric(12,4),
  tokens int,
  started_at timestamptz default now(),
  finished_at timestamptz,
  error text
);

-- Pontuações por requisito
create table if not exists stage_scores (
  id uuid primary key default gen_random_uuid(),
  application_stage_id uuid not null references application_stages(id) on delete cascade,
  requirement_id uuid not null references stage_requirements(id) on delete cascade,
  source text check (source in ('ai','manual')) not null,
  value numeric(5,2) not null,
  created_at timestamptz not null default now(),
  unique(application_stage_id, requirement_id, source, created_at)
);

create table if not exists stage_score_overrides (
  id uuid primary key default gen_random_uuid(),
  stage_score_id uuid not null references stage_scores(id) on delete cascade,
  value numeric(5,2) not null,
  reason text,
  created_at timestamptz not null default now(),
  created_by uuid references users(id)
);


