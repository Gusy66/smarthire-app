-- Adiciona campos expandidos na tabela candidates

-- Campos de localização
alter table candidates add column if not exists city text;
alter table candidates add column if not exists state text;
alter table candidates add column if not exists address text;

-- Campos pessoais
alter table candidates add column if not exists children integer; -- número de filhos (ou null se não informado)
alter table candidates add column if not exists gender text;
-- Remover constraint se existir e adicionar novamente
alter table candidates drop constraint if exists candidates_gender_check;
alter table candidates add constraint candidates_gender_check check (gender is null or gender in ('Masculino','Feminino','Outro'));
alter table candidates add column if not exists languages jsonb default '[]'::jsonb; -- array de idiomas
alter table candidates add column if not exists education text; -- formação

-- Campo para armazenar o caminho do CV anexado (vinculado ao candidato)
alter table candidates add column if not exists resume_path text;
alter table candidates add column if not exists resume_bucket text;

-- Índices para busca
create index if not exists idx_candidates_city on candidates(city);
create index if not exists idx_candidates_state on candidates(state);
create index if not exists idx_candidates_gender on candidates(gender);

