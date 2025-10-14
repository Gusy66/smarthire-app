#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import sys
import os

# Adicionar o diretório atual ao path para importar módulos locais
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main_enhanced import get_user_ai_config

async def test_config():
    """Testa se a configuração está sendo buscada corretamente"""
    print("🔍 Testando busca de configuração...")

    # Testar com o user_id específico
    user_id = "d8342330-8160-4132-8289-187213bbb057"

    try:
        config = await get_user_ai_config(user_id)

        print("✅ Configuração obtida:")
        print(f"   openai_api_key: {config.openai_api_key[:10] if config.openai_api_key else 'VAZIA'}...")
        print(f"   model: {config.model}")
        print(f"   temperature: {config.temperature}")
        print(f"   max_tokens: {config.max_tokens}")

        if config.openai_api_key:
            print("✅ Chave OpenAI configurada corretamente!")
        else:
            print("❌ Chave OpenAI está vazia!")

    except Exception as e:
        print(f"❌ Erro ao buscar configuração: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_config())






