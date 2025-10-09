#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import asyncio
import httpx
import base64

async def debug_openai_config():
    """
    Script para debugar configuração da OpenAI
    """
    print("🔍 Debugando configuração da OpenAI...")
    
    # Verificar variáveis de ambiente
    env_api_key = os.getenv("OPENAI_API_KEY", "")
    env_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    env_temperature = os.getenv("OPENAI_TEMPERATURE", "0.3")
    env_max_tokens = os.getenv("OPENAI_MAX_TOKENS", "2000")
    
    print(f"📡 Variáveis de ambiente:")
    print(f"   OPENAI_API_KEY: {'✅ Configurada' if env_api_key else '❌ VAZIA'}")
    print(f"   OPENAI_MODEL: {env_model}")
    print(f"   OPENAI_TEMPERATURE: {env_temperature}")
    print(f"   OPENAI_MAX_TOKENS: {env_max_tokens}")
    
    if env_api_key:
        print(f"   Chave (primeiros 10 chars): {env_api_key[:10]}...")
    
    # Verificar Supabase
    supabase_url = os.getenv("SUPABASE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    print(f"\n🗄️ Supabase:")
    print(f"   SUPABASE_URL: {'✅ Configurada' if supabase_url else '❌ VAZIA'}")
    print(f"   SUPABASE_SERVICE_ROLE_KEY: {'✅ Configurada' if service_role else '❌ VAZIA'}")
    
    if not supabase_url or not service_role:
        print("❌ Supabase não configurado - não é possível buscar configurações do usuário")
        return
    
    # Testar busca de configurações do usuário
    print(f"\n👤 Testando busca de configurações do usuário...")
    
    # Primeiro, vamos buscar um usuário para testar
    async with httpx.AsyncClient() as client:
        try:
            # Buscar usuários
            response = await client.get(
                f"{supabase_url}/rest/v1/users",
                params={"select": "id,email", "limit": "1"},
                headers={
                    "apikey": service_role,
                    "Authorization": f"Bearer {service_role}",
                    "Accept": "application/json"
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                users = response.json()
                if users:
                    test_user_id = users[0]["id"]
                    print(f"   Usuário de teste: {test_user_id}")
                    
                    # Buscar configurações da IA para este usuário
                    config_response = await client.post(
                        f"{supabase_url}/rest/v1/rpc/get_ai_settings_by_user",
                        json={"p_user_id": test_user_id},
                        headers={
                            "apikey": service_role,
                            "Authorization": f"Bearer {service_role}",
                            "Accept": "application/json",
                            "Content-Type": "application/json"
                        },
                        timeout=10.0,
                    )
                    
                    print(f"   Status da busca de configurações: {config_response.status_code}")
                    if config_response.status_code == 200:
                        config_data = config_response.json()
                        print(f"   Configurações encontradas: {len(config_data)} registros")
                        if config_data:
                            config = config_data[0]
                            print(f"   Configuração: {config}")
                            
                            # Tentar decodificar a chave
                            api_key = config.get("openai_api_key")
                            if api_key:
                                try:
                                    decoded_key = base64.b64decode(api_key).decode('utf-8')
                                    print(f"   ✅ Chave decodificada: {decoded_key[:10]}...")
                                except Exception as e:
                                    print(f"   ❌ Erro ao decodificar chave: {e}")
                            else:
                                print(f"   ❌ Nenhuma chave encontrada na configuração")
                        else:
                            print(f"   ❌ Nenhuma configuração encontrada para o usuário")
                    else:
                        print(f"   ❌ Erro na busca de configurações: {config_response.text}")
                else:
                    print(f"   ❌ Nenhum usuário encontrado")
            else:
                print(f"   ❌ Erro ao buscar usuários: {response.text}")
                
        except Exception as e:
            print(f"   ❌ Erro: {e}")

if __name__ == "__main__":
    asyncio.run(debug_openai_config())
