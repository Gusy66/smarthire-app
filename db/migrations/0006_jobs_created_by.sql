-- Adiciona autoria e empresa nas vagas
alter table if exists jobs
  add column if not exists company_id uuid references companies(id),
  add column if not exists created_by uuid references users(id);

update jobs
set company_id = companies.id
from companies
where (jobs.company_id is null)
  and companies.id = (
    select company_id from users where users.id = jobs.created_by limit 1
  );

update jobs
set created_by = users.id
from users
where jobs.created_by is null
  and users.company_id = jobs.company_id
limit 1;

create index if not exists idx_jobs_created_by on jobs(created_by);


