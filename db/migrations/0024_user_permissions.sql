-- Sistema de Permissões Granulares para Usuários
-- Permite que Admins de empresa controlem o que cada usuário pode fazer

-- Tabela de permissões por usuário
create table if not exists user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  
  -- Permissões disponíveis
  criar_prompts boolean not null default false,
  cadastrar_candidatos boolean not null default false,
  criar_editar_vagas boolean not null default false,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Cada usuário só pode ter um registro de permissões
  constraint user_permissions_user_unique unique (user_id)
);

-- Índice para busca rápida por usuário
create index if not exists idx_user_permissions_user_id on user_permissions(user_id);

-- Trigger para atualizar updated_at
create or replace function update_user_permissions_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger user_permissions_updated_at
  before update on user_permissions
  for each row
  execute function update_user_permissions_updated_at();

-- RLS: usuários só veem permissões de usuários da mesma empresa
alter table user_permissions enable row level security;

create policy user_permissions_company_isolation on user_permissions
  for all
  using (
    user_id in (
      select id from users 
      where company_id = (select company_id from users where id = auth.uid())
    )
  );

-- Comentários
comment on table user_permissions is 'Permissões granulares por usuário dentro de cada empresa';
comment on column user_permissions.criar_prompts is 'Pode criar e editar templates de prompts';
comment on column user_permissions.cadastrar_candidatos is 'Pode cadastrar e editar candidatos';
comment on column user_permissions.criar_editar_vagas is 'Pode criar e editar vagas';

-- Adicionar coluna is_admin na tabela users para identificar admins
-- Admins têm todas as permissões automaticamente
alter table users add column if not exists is_admin boolean not null default false;

-- Atualizar usuários existentes com role 'admin' para is_admin = true
update users set is_admin = true where role = 'admin';

comment on column users.is_admin is 'Se true, usuário é admin da empresa e pode gerenciar outros usuários';

-- SCRIPT DE VERIFICAÇÃO E CORREÇÃO (rode separadamente se necessário)
-- Verificar usuários admin:
-- SELECT id, email, name, role, is_admin FROM users WHERE role = 'admin' OR is_admin = true;

-- Tornar um usuário específico admin (substitua o email):
-- UPDATE users SET is_admin = true, role = 'admin' WHERE email = 'seu-email@exemplo.com';
