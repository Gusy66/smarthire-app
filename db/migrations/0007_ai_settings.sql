-- Tabela para configurações da IA por usuário
create table if not exists ai_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  openai_api_key text not null, -- Criptografada em base64
  model text not null default 'gpt-4o-mini',
  temperature numeric(3,2) not null default 0.3,
  max_tokens integer not null default 2000,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- Índice para busca rápida por usuário
create index if not exists idx_ai_settings_user on ai_settings(user_id);

-- RLS para isolamento por usuário
alter table ai_settings enable row level security;

create policy ai_settings_user_isolation on ai_settings
  for all
  using (user_id = auth.uid());

-- Trigger para atualizar updated_at
create or replace function update_ai_settings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger ai_settings_updated_at
  before update on ai_settings
  for each row
  execute function update_ai_settings_updated_at();
