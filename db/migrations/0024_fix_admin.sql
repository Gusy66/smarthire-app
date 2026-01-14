-- Script rápido para ativar sistema de permissões
-- Rode este script no Supabase SQL Editor

-- 1. Adicionar coluna is_admin se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;
    RAISE NOTICE 'Coluna is_admin criada';
  ELSE
    RAISE NOTICE 'Coluna is_admin já existe';
  END IF;
END $$;

-- 2. Tornar todos os usuários com role='admin' como is_admin=true
UPDATE users 
SET is_admin = true 
WHERE role = 'admin' AND (is_admin IS NULL OR is_admin = false);

-- 3. Verificar usuários admin
SELECT 
  id, 
  email, 
  name, 
  role, 
  is_admin,
  company_id
FROM users 
WHERE role = 'admin' OR is_admin = true;

-- 4. Se você quiser tornar um usuário específico admin, descomente e ajuste:
-- UPDATE users SET is_admin = true, role = 'admin' WHERE email = 'seu-email@exemplo.com';




