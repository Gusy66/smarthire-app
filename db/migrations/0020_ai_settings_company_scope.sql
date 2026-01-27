-- Vincular ai_settings por empresa (company_id) e unificar chave por companhia

-- 1) Adiciona company_id
alter table public.ai_settings
  add column if not exists company_id uuid;

-- 2) Backfill: copia company_id do usuário dono
update public.ai_settings s
set company_id = u.company_id
from public.users u
where s.user_id = u.id
  and s.company_id is null;

-- 3) Remove duplicatas por company_id, mantendo o registro mais recente (updated_at ou created_at)
with ranked as (
  select
    id,
    company_id,
    updated_at,
    created_at,
    row_number() over (partition by company_id order by coalesce(updated_at, created_at, now()) desc, id desc) as rn
  from public.ai_settings
  where company_id is not null
)
delete from public.ai_settings s
using ranked r
where s.id = r.id
  and r.rn > 1;

-- 4) Força NOT NULL e unicidade por company_id
alter table public.ai_settings
  alter column company_id set not null;

alter table public.ai_settings
  drop constraint if exists ai_settings_user_id_key;

alter table public.ai_settings
  add constraint ai_settings_company_id_key unique (company_id);

-- 5) Atualiza função RPC para buscar config pela empresa do usuário
create or replace function public.get_ai_settings_by_user(p_user_id uuid)
returns setof ai_settings
language sql
security definer
set search_path = public
as $$
  select s.*
  from ai_settings s
  join users u on u.company_id = s.company_id
  where u.id = p_user_id
  limit 1;
$$;

