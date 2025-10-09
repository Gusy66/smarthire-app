#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import asyncio
import httpx
import json
from datetime import datetime

async def debug_analysis_data():
    """
    Script para debugar dados de análise salvos no banco
    """
    storage_url = os.getenv("SUPABASE_STORAGE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not storage_url or not service_role:
        print("❌ Variáveis de ambiente não configuradas")
        return
    
    supabase_url = storage_url.replace("/storage/v1", "")
    
    print("🔍 Debugando dados de análise no Supabase...")
    print("📋 Verificando estrutura do JSON retornado pela OpenAI...")
    print(f"📡 URL: {supabase_url}")
    
    async with httpx.AsyncClient() as client:
        try:
            # Buscar todas as análises recentes
            response = await client.get(
                f"{supabase_url}/rest/v1/stage_ai_runs",
                params={
                    "select": "id,run_id,status,result,created_at,finished_at,application_stage_id",
                    "type": "eq.evaluate",
                    "status": "eq.succeeded",
                    "order": "created_at.desc",
                    "limit": "5"
                },
                headers={
                    "apikey": service_role,
                    "Authorization": f"Bearer {service_role}",
                    "Accept": "application/json"
                },
                timeout=10.0,
            )
            
            if response.status_code == 200:
                data = response.json()
                print(f"✅ Encontradas {len(data)} análises:")
                
                for i, analysis in enumerate(data, 1):
                    print(f"\n📊 Análise {i}:")
                    print(f"   ID: {analysis.get('id')}")
                    print(f"   Run ID: {analysis.get('run_id')}")
                    print(f"   Status: {analysis.get('status')}")
                    print(f"   Criado: {analysis.get('created_at')}")
                    print(f"   Finalizado: {analysis.get('finished_at')}")
                    print(f"   Application Stage ID: {analysis.get('application_stage_id')}")
                    
                    result = analysis.get('result')
                    if result:
                        print(f"   📈 Resultado:")
                        print(f"      Score: {result.get('score')}")
                        print(f"      Analysis: {result.get('analysis', 'N/A')[:100]}...")
                        print(f"      Strengths: {len(result.get('strengths', []))} itens")
                        print(f"      Weaknesses: {len(result.get('weaknesses', []))} itens")
                        print(f"      Matched Requirements: {len(result.get('matched_requirements', []))} itens")
                        print(f"      Missing Requirements: {len(result.get('missing_requirements', []))} itens")
                        print(f"      Recommendations: {len(result.get('recommendations', []))} itens")
                        
                        # Mostrar detalhes dos campos
                        if result.get('strengths'):
                            print(f"      🔥 Strengths: {result['strengths']}")
                        if result.get('weaknesses'):
                            print(f"      ⚠️ Weaknesses: {result['weaknesses']}")
                        if result.get('matched_requirements'):
                            print(f"      ✅ Matched: {result['matched_requirements']}")
                        if result.get('missing_requirements'):
                            print(f"      ❌ Missing: {result['missing_requirements']}")

                        print(f"\n      📋 Estrutura completa do JSON:")
                        print(f"      {json.dumps(result, indent=2, ensure_ascii=False)}")
                    else:
                        print(f"   ❌ Sem resultado")
            else:
                print(f"❌ Erro ao buscar análises: {response.status_code}")
                print(f"Resposta: {response.text}")
                
        except Exception as e:
            print(f"❌ Erro: {e}")

if __name__ == "__main__":
    asyncio.run(debug_analysis_data())
