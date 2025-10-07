create or replace function public.get_ai_settings_by_user(p_user_id uuid)
returns setof ai_settings
language sql
security definer
set search_path = public
as $$
  select * from ai_settings where user_id = p_user_id;
$$;


