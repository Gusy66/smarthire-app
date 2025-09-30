-- Adiciona coluna de dono da vaga e índice
alter table if exists jobs
  add column if not exists created_by uuid references users(id);

create index if not exists idx_jobs_created_by on jobs(created_by);


