create table if not exists prompt_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  description text,
  content text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists stage_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references job_stages(id) on delete cascade,
  prompt_template_id uuid references prompt_templates(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(stage_id)
);

create index if not exists idx_prompt_templates_user on prompt_templates(user_id);
create index if not exists idx_prompt_templates_company on prompt_templates(company_id);
create index if not exists idx_stage_prompt_templates_stage on stage_prompt_templates(stage_id);

alter table prompt_templates enable row level security;
alter table stage_prompt_templates enable row level security;

create policy prompt_templates_user_access on prompt_templates
  for all
  using (user_id = auth.uid());

create policy stage_prompt_templates_user_access on stage_prompt_templates
  for all
  using (
    prompt_template_id in (
      select id from prompt_templates where user_id = auth.uid()
    )
  );

create or replace function update_prompt_templates_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create or replace function update_stage_prompt_templates_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger prompt_templates_updated_at
  before update on prompt_templates
  for each row
  execute function update_prompt_templates_updated_at();

create trigger stage_prompt_templates_updated_at
  before update on stage_prompt_templates
  for each row
  execute function update_stage_prompt_templates_updated_at();
