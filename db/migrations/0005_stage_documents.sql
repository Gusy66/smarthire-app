-- Tabela de anexos por etapa (currículos, transcrições, etc.)
create table if not exists stage_documents (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references job_stages(id) on delete cascade,
  type text check (type in ('resume','transcript')) not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_stage_documents_stage on stage_documents(stage_id);
create index if not exists idx_stage_documents_type on stage_documents(type);


