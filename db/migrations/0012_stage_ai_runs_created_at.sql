alter table if exists stage_ai_runs
  add column if not exists created_at timestamptz not null default now();

