-- Adiciona peso por etapa (stage_weight)
alter table if exists job_stages
  add column if not exists stage_weight numeric(5,2) not null default 1.0;


