-- Estende tipos de documentos aceitos em stage_documents
-- Adiciona suporte para PDF, DOCX, DOC e JSON além de resume e transcript

-- Primeiro, vamos remover a constraint atual e criar uma nova
alter table stage_documents 
  drop constraint if exists stage_documents_type_check;

-- Adicionar nova constraint que aceita os tipos estendidos
alter table stage_documents 
  add constraint stage_documents_type_check 
  check (type in ('resume','transcript','pdf','docx','doc','json'));

