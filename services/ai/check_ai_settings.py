#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script para verificar configurações de IA no banco de dados
"""
import os
import httpx
import asyncio
from dotenv import load_dotenv

load_dotenv()

async def check_ai_settings():
    """Verifica configurações de IA no banco"""
    
    storage_url = os.getenv("SUPABASE_STORAGE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not storage_url or not service_role:
        print("ERRO: Variaveis SUPABASE_STORAGE_URL ou SUPABASE_SERVICE_ROLE_KEY nao configuradas")
        return
    
    supabase_url = storage_url.replace("/storage/v1", "")
    print(f"Conectando em: {supabase_url}")
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. Verificar se a tabela ai_settings existe e tem dados
            print("\nVerificando tabela ai_settings...")
            response = await client.get(
                f"{supabase_url}/rest/v1/ai_settings",
                headers={
                    "apikey": service_role,
                    "Authorization": f"Bearer {service_role}",
                    "Accept": "application/json",
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"OK: Tabela ai_settings encontrada com {len(data)} registros")
                
                if data:
                    print("\nRegistros encontrados:")
                    for i, record in enumerate(data, 1):
                        print(f"  {i}. User ID: {record.get('user_id')}")
                        print(f"     Model: {record.get('model')}")
                        print(f"     Temperature: {record.get('temperature')}")
                        print(f"     Max Tokens: {record.get('max_tokens')}")
                        print(f"     API Key (primeiros 10 chars): {record.get('openai_api_key', '')[:10]}...")
                        print(f"     Created: {record.get('created_at')}")
                        print()
                else:
                    print("AVISO: Nenhum registro encontrado na tabela ai_settings")
            else:
                print(f"ERRO ao acessar tabela ai_settings: {response.status_code}")
                print(f"   Resposta: {response.text}")
            
            # 2. Testar a função RPC get_ai_settings_by_user
            print("\nTestando funcao RPC get_ai_settings_by_user...")
            
            # Primeiro, vamos pegar um user_id da tabela users
            users_response = await client.get(
                f"{supabase_url}/rest/v1/users",
                headers={
                    "apikey": service_role,
                    "Authorization": f"Bearer {service_role}",
                    "Accept": "application/json",
                },
                timeout=10.0,
            )
            
            if users_response.status_code == 200:
                users = users_response.json()
                if users:
                    test_user_id = users[0]['id']
                    print(f"Testando com user_id: {test_user_id}")
                    
                    rpc_response = await client.post(
                        f"{supabase_url}/rest/v1/rpc/get_ai_settings_by_user",
                        json={"p_user_id": test_user_id},
                        headers={
                            "apikey": service_role,
                            "Authorization": f"Bearer {service_role}",
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                        },
                        timeout=10.0,
                    )
                    
                    if rpc_response.status_code == 200:
                        rpc_data = rpc_response.json()
                        print(f"OK: Funcao RPC funcionando. Retornou: {len(rpc_data)} registros")
                        if rpc_data:
                            print(f"   Dados: {rpc_data}")
                        else:
                            print("   AVISO: Nenhuma configuracao encontrada para este usuario")
                    else:
                        print(f"ERRO na funcao RPC: {rpc_response.status_code}")
                        print(f"   Resposta: {rpc_response.text}")
                else:
                    print("AVISO: Nenhum usuario encontrado na tabela users")
            else:
                print(f"ERRO ao acessar tabela users: {users_response.status_code}")
                
    except Exception as e:
        print(f"ERRO na conexao: {e}")

if __name__ == "__main__":
    asyncio.run(check_ai_settings())
