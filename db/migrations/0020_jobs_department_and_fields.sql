-- Adiciona departamento e campos segmentados na tabela jobs

-- Departamento/Área da vaga
alter table jobs add column if not exists department text;

-- Campos segmentados para descrição
alter table jobs add column if not exists job_description text; -- a. Descrição do cargo
alter table jobs add column if not exists responsibilities text; -- b. Responsabilidades e atribuições
alter table jobs add column if not exists requirements_and_skills text; -- c. Requisitos e Habilidades
-- benefits já existe como JSONB, mantemos
alter table jobs add column if not exists work_schedule text; -- d.i. Horário
-- work_model já existe, mantemos ('remote','hybrid','onsite')
alter table jobs add column if not exists travel_availability text; -- d.iii. Disponibilidade para viajar
alter table jobs add column if not exists observations text; -- e. Observações (opcional)

-- Índice para busca por departamento
create index if not exists idx_jobs_department on jobs(department);

