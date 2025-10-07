alter table if exists stage_ai_runs
  add column if not exists stage_id uuid references job_stages(id);

update stage_ai_runs sar
set stage_id = ast.stage_id
from application_stages ast
where sar.application_stage_id = ast.id
  and sar.stage_id is null;

alter table if exists stage_ai_runs
  alter column stage_id set not null;

create index if not exists idx_stage_ai_runs_stage on stage_ai_runs(stage_id);


