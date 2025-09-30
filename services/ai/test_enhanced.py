#!/usr/bin/env python3
"""
Script para testar o serviço de IA melhorado
"""

import asyncio
import httpx
import json

async def test_enhanced_ai():
    base_url = "http://localhost:8000"
    
    print("🧪 Testando Serviço de IA Melhorado")
    print("=" * 50)
    
    # Teste 1: Health check
    print("\n1. Testando health check...")
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{base_url}/health")
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    
    # Teste 2: Teste de configuração (simulado)
    print("\n2. Testando configuração da IA...")
    test_config = {
        "openai_api_key": "sk-test-key",
        "model": "gpt-4o-mini",
        "temperature": 0.3,
        "max_tokens": 2000
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{base_url}/v1/test-config",
            json=test_config
        )
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    
    # Teste 3: Análise de candidato
    print("\n3. Testando análise de candidato...")
    evaluation_request = {
        "stage_id": "test-stage-123",
        "application_id": "test-app-456",
        "resume_path": "test-resume.pdf",
        "user_id": "test-user-789"
    }
    
    async with httpx.AsyncClient() as client:
        # Iniciar análise
        response = await client.post(
            f"{base_url}/v1/evaluate",
            json=evaluation_request
        )
        print(f"   Status: {response.status_code}")
        run_data = response.json()
        print(f"   Run ID: {run_data['id']}")
        
        # Aguardar conclusão
        run_id = run_data['id']
        max_attempts = 10
        attempt = 0
        
        while attempt < max_attempts:
            await asyncio.sleep(2)
            attempt += 1
            
            response = await client.get(f"{base_url}/v1/runs/{run_id}")
            run_status = response.json()
            
            print(f"   Tentativa {attempt}: Status = {run_status['status']}, Progress = {run_status.get('progress', 0)}%")
            
            if run_status['status'] in ['succeeded', 'failed']:
                break
        
        # Mostrar resultado final
        if run_status['status'] == 'succeeded':
            result = run_status['result']
            print(f"\n   ✅ Análise concluída!")
            print(f"   📊 Pontuação: {result['score']}/10")
            print(f"   📝 Análise: {result['analysis'][:100]}...")
            print(f"   ✅ Requisitos atendidos: {len(result['matched_requirements'])}")
            print(f"   ❌ Requisitos não atendidos: {len(result['missing_requirements'])}")
        else:
            print(f"   ❌ Análise falhou: {run_status.get('error', 'Erro desconhecido')}")

if __name__ == "__main__":
    asyncio.run(test_enhanced_ai())
