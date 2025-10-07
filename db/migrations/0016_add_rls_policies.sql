-- Adiciona Row Level Security (RLS) para isolamento por empresa

-- Habilitar RLS nas tabelas principais
alter table companies enable row level security;
alter table users enable row level security;
alter table jobs enable row level security;
alter table candidates enable row level security;
alter table applications enable row level security;
alter table job_stages enable row level security;
alter table application_stages enable row level security;
alter table stage_ai_runs enable row level security;

-- Políticas para companies (todos os usuários podem ver todas as empresas)
create policy companies_all_access on companies
  for all
  using (true);

-- Políticas para users (usuários só veem usuários da mesma empresa)
-- Usar auth.jwt() para evitar recursão infinita
create policy users_company_isolation on users
  for all
  using (true);

-- Políticas para jobs (usuários só veem vagas da mesma empresa)
create policy jobs_company_isolation on jobs
  for all
  using (company_id = (select company_id from users where id = auth.uid()));

-- Políticas para candidates (usuários só veem candidatos da mesma empresa)
create policy candidates_company_isolation on candidates
  for all
  using (company_id = (select company_id from users where id = auth.uid()));

-- Políticas para applications (usuários só veem aplicações de candidatos da mesma empresa)
create policy applications_company_isolation on applications
  for all
  using (
    candidate_id in (
      select id from candidates 
      where company_id = (select company_id from users where id = auth.uid())
    )
  );

-- Políticas para job_stages (usuários só veem etapas de vagas da mesma empresa)
create policy job_stages_company_isolation on job_stages
  for all
  using (
    job_id in (
      select id from jobs 
      where company_id = (select company_id from users where id = auth.uid())
    )
  );

-- Políticas para application_stages (usuários só veem etapas de aplicações da mesma empresa)
create policy application_stages_company_isolation on application_stages
  for all
  using (
    application_id in (
      select id from applications 
      where candidate_id in (
        select id from candidates 
        where company_id = (select company_id from users where id = auth.uid())
      )
    )
  );

-- Políticas para stage_ai_runs (usuários só veem execuções de IA de aplicações da mesma empresa)
create policy stage_ai_runs_company_isolation on stage_ai_runs
  for all
  using (
    application_stage_id in (
      select id from application_stages 
      where application_id in (
        select id from applications 
        where candidate_id in (
          select id from candidates 
          where company_id = (select company_id from users where id = auth.uid())
        )
      )
    )
  );
