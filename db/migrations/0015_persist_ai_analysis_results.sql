-- Adiciona coluna para persistir resultados de análise da IA
alter table if exists stage_ai_runs
  add column if not exists analysis_result jsonb;

-- Índice para busca rápida por application_stage_id
create index if not exists idx_stage_ai_runs_application_stage on stage_ai_runs(application_stage_id);

-- Índice para busca rápida por status e tipo
create index if not exists idx_stage_ai_runs_status_type on stage_ai_runs(status, type);

-- Função para buscar análise mais recente de uma etapa
create or replace function get_latest_stage_analysis(p_stage_id uuid, p_application_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select sar.result
  from stage_ai_runs sar
  join application_stages ast on ast.id = sar.application_stage_id
  where ast.stage_id = p_stage_id
    and ast.application_id = p_application_id
    and sar.type = 'evaluate'
    and sar.status = 'succeeded'
    and sar.result is not null
  order by sar.finished_at desc
  limit 1;
$$;
