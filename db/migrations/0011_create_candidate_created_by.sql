alter table if exists candidates
  add column if not exists company_id uuid references companies(id),
  add column if not exists created_by uuid references users(id);

create index if not exists idx_candidates_created_by on candidates(created_by);

-- Preenche company_id e created_by a partir das aplicações existentes
update candidates c
set company_id = coalesce(c.company_id, j.company_id),
    created_by = coalesce(c.created_by, j.created_by)
from applications a
join jobs j on j.id = a.job_id
where a.candidate_id = c.id
  and (c.company_id is null or c.created_by is null);

