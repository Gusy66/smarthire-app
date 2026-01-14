-- Tabela de Super Admins da plataforma
-- Estes são os administradores da plataforma SmartHire (não das empresas clientes)

create table if not exists platform_admins (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references platform_admins(id)
);

-- Índice para busca por email
create index if not exists idx_platform_admins_email on platform_admins(email);

-- RLS: apenas service_role pode acessar (protege dados sensíveis)
alter table platform_admins enable row level security;

create policy platform_admins_service_only on platform_admins
  for all using (auth.role() = 'service_role');

-- Comentário na tabela para documentação
comment on table platform_admins is 'Super Admins da plataforma SmartHire - gerenciam empresas clientes';
comment on column platform_admins.id is 'ID do usuário no Supabase Auth';
comment on column platform_admins.email is 'Email do super admin';
comment on column platform_admins.name is 'Nome do super admin';
comment on column platform_admins.is_active is 'Se o super admin está ativo';
comment on column platform_admins.created_by is 'Quem criou este super admin';

