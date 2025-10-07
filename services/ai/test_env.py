#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para testar carregamento de variáveis de ambiente
"""
import os
from dotenv import load_dotenv

print("=== Teste de Variáveis de Ambiente ===")

# Carregar .env
load_dotenv()

# Verificar variáveis
storage_url = os.getenv("SUPABASE_STORAGE_URL")
service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase_url = os.getenv("SUPABASE_URL")

print(f"SUPABASE_STORAGE_URL: {storage_url}")
print(f"SUPABASE_SERVICE_ROLE_KEY: {service_role[:20] if service_role else 'None'}...")
print(f"SUPABASE_URL: {supabase_url}")

# Verificar se as variáveis estão sendo carregadas
if storage_url and service_role:
    print("✅ Variáveis carregadas corretamente")
else:
    print("❌ Variáveis não carregadas")
