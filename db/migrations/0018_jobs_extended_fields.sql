-- Adiciona campos extras à tabela jobs para cadastro completo de vagas

alter table jobs add column if not exists salary text;
alter table jobs add column if not exists work_model text check (work_model in ('remote','hybrid','onsite'));
alter table jobs add column if not exists contract_type text check (contract_type in ('clt','pj','internship','freelance','apprentice'));
alter table jobs add column if not exists requirements jsonb default '[]'::jsonb;
alter table jobs add column if not exists skills jsonb default '[]'::jsonb;
alter table jobs add column if not exists benefits jsonb default '[]'::jsonb;

