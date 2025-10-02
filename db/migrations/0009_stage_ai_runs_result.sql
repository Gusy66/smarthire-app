alter table if exists stage_ai_runs
  add column if not exists result jsonb;

