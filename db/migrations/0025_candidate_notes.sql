-- Tabela de observações de candidatos (por vaga)
create table if not exists candidate_notes (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references candidates(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  user_id uuid references users(id) on delete set null,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_candidate_notes_candidate_id on candidate_notes(candidate_id);
create index if not exists idx_candidate_notes_job_id on candidate_notes(job_id);
create index if not exists idx_candidate_notes_company_id on candidate_notes(company_id);

alter table candidate_notes enable row level security;

create policy candidate_notes_company_isolation on candidate_notes
  for all
  using (
    company_id = (
      select company_id from users where id = auth.uid()
    )
  );
