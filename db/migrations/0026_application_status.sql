-- Adiciona status final da aplicação (aprovação/reprovação)
alter table applications add column if not exists status text not null default 'pending';

alter table applications drop constraint if exists applications_status_check;
alter table applications add constraint applications_status_check check (status in ('pending','approved','rejected'));

create index if not exists idx_applications_status on applications(status);
