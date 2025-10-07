-- Corrige recursão infinita nas políticas RLS

-- Remover políticas problemáticas
drop policy if exists users_company_isolation on users;
drop policy if exists jobs_company_isolation on jobs;
drop policy if exists candidates_company_isolation on candidates;
drop policy if exists applications_company_isolation on applications;
drop policy if exists job_stages_company_isolation on job_stages;
drop policy if exists application_stages_company_isolation on application_stages;
drop policy if exists stage_ai_runs_company_isolation on stage_ai_runs;

-- Criar função auxiliar para obter company_id do usuário atual
create or replace function get_current_user_company_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select company_id from users where id = auth.uid();
$$;

-- Recriar políticas sem recursão
create policy users_company_isolation on users
  for all
  using (company_id = get_current_user_company_id());

create policy jobs_company_isolation on jobs
  for all
  using (company_id = get_current_user_company_id());

create policy candidates_company_isolation on candidates
  for all
  using (company_id = get_current_user_company_id());

create policy applications_company_isolation on applications
  for all
  using (
    candidate_id in (
      select id from candidates 
      where company_id = get_current_user_company_id()
    )
  );

create policy job_stages_company_isolation on job_stages
  for all
  using (
    job_id in (
      select id from jobs 
      where company_id = get_current_user_company_id()
    )
  );

create policy application_stages_company_isolation on application_stages
  for all
  using (
    application_id in (
      select id from applications 
      where candidate_id in (
        select id from candidates 
        where company_id = get_current_user_company_id()
      )
    )
  );

create policy stage_ai_runs_company_isolation on stage_ai_runs
  for all
  using (
    application_stage_id in (
      select id from application_stages 
      where application_id in (
        select id from applications 
        where candidate_id in (
          select id from candidates 
          where company_id = get_current_user_company_id()
        )
      )
    )
  );
