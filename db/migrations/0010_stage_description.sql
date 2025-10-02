alter table if exists job_stages
  add column if not exists description text;

