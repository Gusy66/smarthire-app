-- Seed de desenvolvimento: empresa, usuário admin e template básico
do $$
declare
  v_company_id uuid := gen_random_uuid();
  v_user_id uuid := gen_random_uuid();
  v_template_id uuid := gen_random_uuid();
begin
  insert into companies(id, name) values (v_company_id, 'Acme Recruiting')
  on conflict do nothing;

  -- No Supabase, users geralmente vêm do Auth. Para dev, criamos linha lógica.
  insert into users(id, company_id, email, name, role)
  values (v_user_id, v_company_id, 'admin@acme.test', 'Admin Dev', 'admin')
  on conflict do nothing;

  insert into templates(id, company_id, name, version)
  values (v_template_id, v_company_id, 'Entrevista Padrão', 1)
  on conflict do nothing;

  insert into template_questions(id, template_id, text, weight) values
    (gen_random_uuid(), v_template_id, 'Conte sobre sua experiência relevante.', 1.0),
    (gen_random_uuid(), v_template_id, 'Como você lida com prazos?', 1.0),
    (gen_random_uuid(), v_template_id, 'Descreva um desafio técnico e solução.', 1.5)
  on conflict do nothing;
end $$;


