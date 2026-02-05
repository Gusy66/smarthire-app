-- Adiciona token público para candidatura em vagas

alter table jobs add column if not exists public_token uuid default gen_random_uuid();

-- Garantir token para vagas existentes
update jobs set public_token = gen_random_uuid() where public_token is null;

-- Índice único para busca por token
create unique index if not exists idx_jobs_public_token on jobs(public_token);
