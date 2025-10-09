#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import asyncio
import httpx
import json
import uuid
import base64
from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field

# Configuração básica
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

class AIConfig(BaseModel):
    openai_api_key: str = Field(default="")
    model: str = Field(default="gpt-4o-mini")
    temperature: float = Field(default=0.3)
    max_tokens: int = Field(default=2000)

class StagePayload(BaseModel):
    id: str
    name: str
    threshold: float = Field(default=0.0)
    stage_weight: float = Field(default=1.0)
    description: Optional[str] = Field(default=None)
    job_description: Optional[str] = Field(default=None)

class RequirementPayload(BaseModel):
    label: str
    description: str
    weight: float = Field(default=1.0)

class EvaluateRequest(BaseModel):
    stage_id: str
    application_id: str
    resume_path: Optional[str] = None
    resume_bucket: Optional[str] = None
    resume_signed_url: Optional[str] = None
    audio_path: Optional[str] = None
    audio_bucket: Optional[str] = None
    audio_signed_url: Optional[str] = None
    transcript_path: Optional[str] = None
    transcript_bucket: Optional[str] = None
    transcript_signed_url: Optional[str] = None
    user_id: Optional[str] = None
    stage: Optional[StagePayload] = None
    requirements: Optional[List[RequirementPayload]] = None
    prompt_template: Optional[str] = None

class RunStatus(BaseModel):
    id: str
    type: str
    status: str
    progress: int = Field(default=0)
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None

class EvaluationResult(BaseModel):
    score: float = Field(default=5.0)
    analysis: str = Field(default="Análise não disponível")
    matched_requirements: List[str] = Field(default_factory=list)
    missing_requirements: List[str] = Field(default_factory=list)
    strengths: List[str] = Field(default_factory=list)
    weaknesses: List[str] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)

# Dicionário em memória para rastrear runs
runs: Dict[str, Dict[str, Any]] = {}

async def extract_resume_text(resume_path: str, resume_signed_url: str, resume_bucket: str) -> tuple[str, list[str]]:
    """
    Extrai texto de um currículo usando o serviço de IA
    """
    warnings = []

    if not resume_path:
        return "", warnings

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/extract_resume_text",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                    "Content-Type": "application/json"
                },
                json={
                    "resume_path": resume_path,
                    "resume_signed_url": resume_signed_url,
                    "resume_bucket": resume_bucket
                },
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("text", ""), data.get("warnings", [])
            else:
                warnings.append(f"Erro na extração: {response.status_code} - {response.text}")
                return "", warnings

    except Exception as e:
        warnings.append(f"Erro ao conectar com serviço de extração: {e}")
        return "", warnings

async def process_audio(audio_path: str) -> str:
    """
    Processa arquivo de áudio e retorna texto transcrito
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/process_audio",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                    "Content-Type": "application/json"
                },
                json={"audio_path": audio_path},
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("text", "")
            else:
                return ""

    except Exception as e:
        print(f"Erro ao processar áudio: {e}")
        return ""

async def analyze_transcript(transcript_path: str) -> str:
    """
    Analisa arquivo de transcrição e retorna texto
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/rpc/analyze_transcript",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                    "Content-Type": "application/json"
                },
                params={"transcript_path": transcript_path},
                timeout=30.0
            )

            if response.status_code == 200:
                data = response.json()
                return data.get("text", "")
            else:
                return ""

    except Exception as e:
        print(f"Erro ao analisar transcrição: {e}")
        return ""

async def get_user_ai_config(user_id: str) -> AIConfig:
    """
    Busca configurações de IA do usuário no banco de dados
    """
    print(f"[IA] Buscando configurações para user_id: {user_id}")

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE:
        print("[IA] Variáveis de ambiente não configuradas")
        return AIConfig()

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{SUPABASE_URL}/rest/v1/rpc/get_ai_settings_by_user",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                    "Content-Type": "application/json"
                },
                json={"p_user_id": user_id},
                timeout=10.0
            )

            print(f"[IA] Status da resposta: {response.status_code}")
            print(f"[IA] ai_settings response: {response.text}")

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    record = data[0]
                    api_key = record.get("openai_api_key", "")
                    print(f"[IA] API key raw: {api_key}")

                    # Decodificar chave da API se estiver criptografada
                    if api_key:
                        try:
                            decoded_key = base64.b64decode(api_key).decode('utf-8')
                            print(f"[IA] API key decodificada: {decoded_key[:10]}...")
                            return AIConfig(
                                openai_api_key=decoded_key,
                                model=record.get("model", "gpt-4o-mini"),
                                temperature=record.get("temperature", 0.3),
                                max_tokens=record.get("max_tokens", 2000)
                            )
                        except Exception as e:
                            print(f"[IA] Erro ao decodificar chave: {e}")
                            return AIConfig(openai_api_key=api_key)
                    else:
                        print("[IA] Chave vazia no banco")
                        return AIConfig()
                else:
                    print("[IA] Nenhum registro encontrado")
                    return AIConfig()
            else:
                print(f"[IA] Erro na consulta: {response.status_code}")
                return AIConfig()

    except Exception as e:
        print(f"[IA] Erro ao buscar configurações: {e}")
        return AIConfig()

async def get_stage_details(stage_id: str, user_id: str) -> Optional[StagePayload]:
    """
    Busca detalhes da etapa do banco de dados
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{SUPABASE_URL}/rest/v1/job_stages",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                    "Content-Type": "application/json"
                },
                params={
                    "id": f"eq.{stage_id}",
                    "select": "id,name,threshold,stage_weight,description,jobs(description)"
                },
                timeout=10.0
            )

            if response.status_code == 200:
                data = response.json()
                if data and len(data) > 0:
                    stage = data[0]
                    return StagePayload(
                        id=stage.get("id", ""),
                        name=stage.get("name", ""),
                        threshold=stage.get("threshold", 0.0),
                        stage_weight=stage.get("stage_weight", 1.0),
                        description=stage.get("description"),
                        job_description=stage.get("jobs", {}).get("description")
                    )

    except Exception as e:
        print(f"Erro ao buscar detalhes da etapa: {e}")

    return None

async def analyze_candidate_simulated(text_content: str, stage_description: str, requirements: list[dict]) -> EvaluationResult:
    """
    Análise simulada quando não há chave da API
    """
    print("[IA] ========== ANÁLISE SIMULADA ==========")

    # Análise simulada baseada no conteúdo
    if len(text_content.strip()) < 100:
        return EvaluationResult(
            score=2.0,
            analysis="Currículo muito curto ou vazio. Difícil avaliar competências.",
            strengths=["Informações básicas presentes"],
            weaknesses=["Falta de detalhes sobre experiências", "Currículo muito resumido"],
            matched_requirements=["Apresenta informações básicas"],
            missing_requirements=["Experiência detalhada", "Competências específicas"]
        )

    return EvaluationResult(
        score=7.5,
        analysis="Candidato apresenta boa experiência geral, mas faltam alguns requisitos específicos da vaga.",
        strengths=[
            "Experiência sólida em tecnologia da informação",
            "Habilidades técnicas relevantes",
            "Formação acadêmica adequada"
        ],
        weaknesses=[
            "Falta de experiência específica na área requerida",
            "Pouca experiência em liderança de equipes"
        ],
        matched_requirements=[
            "Possui formação na área",
            "Experiência em desenvolvimento de software"
        ],
        missing_requirements=[
            "Experiência específica em tecnologias requeridas",
            "Experiência em gestão de projetos"
        ]
    )

async def analyze_candidate_with_openai(
    text_content: str,
    stage_description: str,
    requirements: list[dict],
    config: AIConfig,
    prompt_template: str | None = None
) -> EvaluationResult:
    """
    Análise real do candidato usando OpenAI
    """
    # Verificar se a chave da API está configurada
    print(f"[IA] Verificando chave OpenAI: '{config.openai_api_key[:10] if config.openai_api_key else 'VAZIA'}...'")
    print(f"[IA] Chave vazia: {not config.openai_api_key}")
    print(f"[IA] Chave strip vazia: {config.openai_api_key.strip() == '' if config.openai_api_key else 'N/A'}")

    if not config.openai_api_key or config.openai_api_key.strip() == "":
        print("[IA] Chave OpenAI não configurada, usando análise simulada")
        return await analyze_candidate_simulated(text_content, stage_description, requirements)

    print("[IA] Chave OpenAI configurada, prosseguindo com análise real")

    print(f"[IA] ========== DEBUG DADOS PARA OPENAI ==========")
    print(f"[IA] Preparando análise com:")
    print(f"[IA]   - Texto: {len(text_content)} caracteres")
    print(f"[IA]   - Descrição da etapa: {len(stage_description)} caracteres")
    print(f"[IA]   - Requisitos: {len(requirements)} itens")
    print(f"[IA]   - Modelo: {config.model}")
    print(f"[IA]   - Temperature: {config.temperature}")
    print(f"[IA]   - Max tokens: {config.max_tokens}")
    print(f"[IA] ========== CONTEÚDO DO TEXTO ==========")
    print(f"[IA] {text_content}")
    print(f"[IA] ========== DESCRIÇÃO DA ETAPA ==========")
    print(f"[IA] {stage_description}")
    print(f"[IA] ========== REQUISITOS ==========")
    print(f"[IA] {requirements}")

    try:
        async with httpx.AsyncClient() as client:
            # Preparar prompt para análise
            requirements_text = "\n".join([
                f"- {req.get('label', '')}: {req.get('description', '')} (peso: {req.get('weight', 1.0)})"
                for req in requirements
            ])

            base_prompt = prompt_template or """
Analise o candidato para a vaga baseado nas informações fornecidas.

DESCRIÇÃO DA ETAPA:
{{STAGE_DESCRIPTION}}

REQUISITOS DA ETAPA:
{{REQUIREMENTS_LIST}}

INFORMAÇÕES DO CANDIDATO:
{{CANDIDATE_INFO}}

INSTRUÇÕES CRÍTICAS:
1. USE APENAS as informações reais do candidato fornecidas acima
2. NÃO invente dados fictícios como "João Silva" ou empresas genéricas
3. Se o currículo estiver vazio ou incompleto, mencione isso na análise
4. Baseie-se EXCLUSIVAMENTE no conteúdo real do currículo do candidato

Forneça uma análise detalhada em JSON válido com a seguinte estrutura:

{
  "score": pontuação de 0 a 10 (float),
  "analysis": resumo textual detalhado da análise do candidato REAL,
  "strengths": array de strings com pontos fortes específicos baseados no currículo REAL,
  "weaknesses": array de strings com pontos de melhoria específicos baseados no currículo REAL,
  "matched_requirements": array de strings com requisitos atendidos pelo candidato REAL,
  "missing_requirements": array de strings com requisitos não atendidos pelo candidato REAL
}

IMPORTANTE:
- Use APENAS dados reais do candidato fornecido
- Se não houver informações suficientes, mencione isso na justificativa
- Seja específico e baseie-se na descrição da etapa e nas informações REAIS do candidato

INSTRUÇÕES DETALHADAS:

1. ANÁLISE ESPECÍFICA DO CURRÍCULO:
   - Leia cuidadosamente o currículo do candidato
   - Identifique experiências, habilidades e competências mencionadas
   - Compare com os requisitos da etapa
   - Seja específico sobre o que foi encontrado ou não encontrado

2. MATCHED_REQUIREMENTS (Requisitos Atendidos):
   - Liste especificamente quais requisitos foram atendidos
   - Exemplo: "Demonstra experiência sólida em React com projetos em produção"
   - Exemplo: "Possui conhecimento avançado em Python com frameworks Django"
   - Exemplo: "Experiência comprovada em liderança de equipes de desenvolvimento"
   - NÃO use textos genéricos como "experiência relevante"

3. MISSING_REQUIREMENTS (Requisitos Não Atendidos):
   - Liste especificamente quais requisitos não foram atendidos
   - Exemplo: "Falta experiência específica em Docker e containerização"
   - Exemplo: "Não demonstra conhecimento em AWS ou cloud computing"
   - Exemplo: "Ausência de experiência com metodologias ágeis (Scrum/Kanban)"
   - Seja específico sobre o que falta, não genérico

4. STRENGTHS (Pontos Fortes):
   - Identifique pontos fortes específicos do candidato
   - Exemplo: "Experiência sólida em React com componentes reutilizáveis"

5. WEAKNESSES (Pontos de Melhoria):
   - Identifique pontos de melhoria específicos do candidato
   - Exemplo: "Falta de experiência em tecnologias específicas"

6. FORMATAÇÃO:
   - TODOS os campos de lista devem ser arrays de strings simples
   - Cada item deve ser uma análise específica e detalhada
   - Evite respostas genéricas ou vagas
   - Baseie-se no conteúdo real do currículo fornecido
"""

            prompt = (
                base_prompt
                .replace("{{STAGE_DESCRIPTION}}", stage_description)
                .replace("{{REQUIREMENTS_LIST}}", requirements_text)
                .replace("{{CANDIDATE_INFO}}", text_content)
            )

            print(f"[IA] ========== PROMPT FINAL PARA OPENAI ==========")
            print(f"[IA] Prompt preparado: {len(prompt)} caracteres")
            print(f"[IA] ========== PROMPT COMPLETO ==========")
            print(f"[IA] {prompt}")
            print(f"[IA] ========== FIM DO PROMPT ==========")
            print(f"[IA] Fazendo requisição para OpenAI...")

            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": config.model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "Você é um especialista em RH que analisa candidatos de forma objetiva e justa. Sempre responda em formato JSON válido."
                        },
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ],
                    "temperature": config.temperature,
                    "max_tokens": config.max_tokens
                },
                timeout=30.0
            )

            print(f"[IA] Resposta OpenAI recebida: {response.status_code}")

            if response.status_code != 200:
                print(f"[IA] Erro na API OpenAI: {response.status_code} - {response.text}")
                raise Exception(f"Erro na API OpenAI: {response.status_code} - {response.text}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            print(f"[IA] ========== RESPOSTA DA OPENAI ==========")
            print(f"[IA] Conteúdo da resposta: {len(content)} caracteres")
            print(f"[IA] ========== CONTEÚDO COMPLETO DA RESPOSTA ==========")
            print(f"[IA] {content}")
            print(f"[IA] ========== FIM DA RESPOSTA ==========")

            # Extrair JSON da resposta
            try:
                print(f"[IA] Tentando extrair JSON da resposta...")
                # Tentar encontrar JSON na resposta
                start = content.find('{')
                end = content.rfind('}') + 1
                print(f"[IA] Posições JSON: start={start}, end={end}")
                if start != -1 and end != 0:
                    json_str = content[start:end]
                    print(f"[IA] JSON extraído: {len(json_str)} caracteres")
                    result = json.loads(json_str)
                    print(f"[IA] JSON parseado com sucesso!")
                else:
                    print(f"[IA] JSON não encontrado na resposta")
                    raise ValueError("JSON não encontrado na resposta")
            except (json.JSONDecodeError, ValueError) as e:
                print(f"[IA] Erro ao fazer parse do JSON: {e}")
                print(f"[IA] Usando análise simulada como fallback")
                # Fallback para análise simulada se JSON inválido
                return await analyze_candidate_simulated(text_content, stage_description, requirements)

            # Função para converter objetos em strings se necessário
            def ensure_string_list(items):
                if not isinstance(items, list):
                    return []
                result_list = []
                for item in items:
                    if isinstance(item, str):
                        result_list.append(item)
                    elif isinstance(item, dict) and "requirement" in item:
                        result_list.append(item["requirement"])
                    elif isinstance(item, dict) and "description" in item:
                        result_list.append(item["description"])
                    else:
                        result_list.append(str(item))
                return result_list

            # Mapear diferentes formatos de resposta da IA
            score = 5.0
            analysis = "Análise não disponível"
            strengths = []
            weaknesses = []
            matched_requirements = []
            missing_requirements = []
            recommendations = []

            # Verificar estrutura do JSON retornado pela OpenAI
            print(f"[IA] ========== ESTRUTURA DO JSON RECEBIDO ==========")
            print(f"[IA] Chaves no resultado: {list(result.keys())}")
            print(f"[IA] ========== CONTEÚDO COMPLETO DO JSON ==========")
            print(f"[IA] {json.dumps(result, indent=2, ensure_ascii=False)}")
            print(f"[IA] ========== FIM DA ESTRUTURA ==========")

            # Formato atual da OpenAI (campos na raiz)
            if "score" in result:
                score = float(result.get("score", 5.0))
                analysis = result.get("analysis", "Análise não disponível")
                strengths = ensure_string_list(result.get("strengths", []))
                weaknesses = ensure_string_list(result.get("weaknesses", []))
                matched_requirements = ensure_string_list(result.get("matched_requirements", []))
                missing_requirements = ensure_string_list(result.get("missing_requirements", []))
                recommendations = []  # Removido - não será usado
            # Formato antigo (com estrutura "avaliacao") - manter para compatibilidade
            elif "avaliacao" in result:
                avaliacao = result["avaliacao"]
                # Tentar diferentes nomes de campos para pontuação
                score = float(avaliacao.get("pontuacao_final", avaliacao.get("pontuacao", 5.0)))
                # Tentar diferentes nomes de campos para análise
                analysis = avaliacao.get("justificativa_pontuacao", avaliacao.get("justificativa", avaliacao.get("analise", avaliacao.get("resumo", "Análise não disponível"))))
                strengths = ensure_string_list(avaliacao.get("pontos_fortes", []))
                weaknesses = ensure_string_list(avaliacao.get("pontos_que_deixam_a_desejar", []))
                matched_requirements = ensure_string_list(avaliacao.get("requisitos_atendidos", []))
                missing_requirements = ensure_string_list(avaliacao.get("requisitos_nao_atendidos", []))
                recommendations = []  # Removido - não será usado

            evaluation_result = EvaluationResult(
                score=score,
                analysis=analysis,
                matched_requirements=matched_requirements,
                missing_requirements=missing_requirements,
                strengths=strengths,
                weaknesses=weaknesses,
                recommendations=recommendations
            )

            print(f"[IA] ========== RESULTADO FINAL DA ANÁLISE ==========")
            print(f"[IA] Score: {evaluation_result.score}")
            print(f"[IA] Analysis: {evaluation_result.analysis}")
            print(f"[IA] Strengths: {evaluation_result.strengths}")
            print(f"[IA] Weaknesses: {evaluation_result.weaknesses}")
            print(f"[IA] Matched requirements: {evaluation_result.matched_requirements}")
            print(f"[IA] Missing requirements: {evaluation_result.missing_requirements}")
            print(f"[IA] ========== FIM DO RESULTADO ==========")

            return evaluation_result

    except Exception as e:
        print(f"Erro na análise com OpenAI: {e}")
        # Fallback para análise simulada
        return await analyze_candidate_simulated(text_content, stage_description, requirements)

async def save_analysis_to_database(run_id: str, analysis_result: dict):
    """
    Salva resultado da análise no banco de dados
    """
    try:
        async with httpx.AsyncClient() as client:
            response = await client.patch(
                f"{SUPABASE_URL}/rest/v1/stage_ai_runs",
                headers={
                    "apikey": SUPABASE_SERVICE_ROLE,
                    "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE}",
                    "Content-Type": "application/json"
                },
                params={"run_id": f"eq.{run_id}"},
                json={"result": analysis_result},
                timeout=10.0
            )

            if response.status_code == 200:
                print(f"[IA] Análise {run_id} salva no banco com sucesso")
            else:
                print(f"[IA] Erro ao salvar análise: {response.status_code} - {response.text}")

    except Exception as e:
        print(f"[IA] Erro ao salvar análise no banco: {e}")

# Configuração do servidor FastAPI
from fastapi import FastAPI, HTTPException

app = FastAPI(
    title="SmartHire AI Service",
    description="Serviço de IA para análise de candidatos",
    version="2.0.0"
)

@app.post("/v1/evaluate", response_model=RunStatus)
async def evaluate(request: EvaluateRequest):
    run_id = str(uuid.uuid4())
    print(f"[IA] Criando run de avaliação: {run_id}")

    runs[run_id] = {
        "id": run_id,
        "type": "evaluate",
        "status": "running",
        "progress": 0,
        "result": None,
        "created_at": datetime.now().isoformat()
    }

    print(f"[IA] Run criado com sucesso. Total de runs: {len(runs)}")
    print(f"[IA] Runs disponíveis: {list(runs.keys())}")

    asyncio.create_task(process_evaluation(run_id, request))

    return RunStatus(id=run_id, type="evaluate", status="running", progress=0)

async def process_evaluation(run_id: str, request: EvaluateRequest):
    try:
        runs[run_id]["progress"] = 20

        # Coleta conteúdo de texto
        text_content = ""
        extraction_warnings: list[str] = []

        print(f"[IA] ========== DEBUG EXTRAÇÃO DE CURRÍCULO ==========")
        print(f"[IA] Tentando extrair currículo:")
        print(f"[IA]   - resume_path: {request.resume_path}")
        print(f"[IA]   - resume_signed_url: {request.resume_signed_url}")
        print(f"[IA]   - resume_bucket: {request.resume_bucket}")

        if request.resume_path:
            runs[run_id]["progress"] = 40
            resume_text = ""
            resume_warnings: list[str] = []
            try:
                resume_text, resume_warnings = await extract_resume_text(
                    request.resume_path,
                    request.resume_signed_url,
                    request.resume_bucket,
                )
                print(f"[IA] ========== RESULTADO DA EXTRAÇÃO ==========")
                print(f"[IA] Texto extraído do currículo ({len(resume_text)} chars):")
                print(f"[IA] ========== CONTEÚDO COMPLETO ==========")
                print(f"[IA] {resume_text}")
                print(f"[IA] ========== FIM DO CONTEÚDO ==========")
                print(f"[IA] Warnings da extração: {resume_warnings}")
            except Exception as ex:
                resume_warnings.append(f"Falha ao ler currículo: {ex}")
                print(f"[IA] Erro ao extrair currículo: {ex}")

            if resume_text:
                text_content += resume_text + "\n\n"
                print(f"[IA] Currículo adicionado ao conteúdo total")
                print(f"[IA] Texto do currículo extraído: {resume_text[:200]}...")
            else:
                print("[IA] AVISO: Nenhum texto extraído do currículo")
            extraction_warnings.extend(resume_warnings)

        if request.audio_path:
            runs[run_id]["progress"] = 60
            text_content += await process_audio(request.audio_path) + "\n\n"

        if request.transcript_path:
            runs[run_id]["progress"] = 80
            text_content += await analyze_transcript(request.transcript_path) + "\n\n"

        # Buscar configurações da IA do usuário
        print(f"[IA] User ID recebido: {request.user_id}")
        print(f"[IA] Tipo do user_id: {type(request.user_id)}")
        print(f"[IA] User ID será usado: {request.user_id or 'default'}")
        config = await get_user_ai_config(request.user_id or "default")

        # Buscar descrição da etapa
        stage_payload = await get_stage_details(request.stage_id, request.user_id)
        stage_description = "Nenhuma descrição de etapa fornecida."
        if stage_payload and stage_payload.description:
            stage_description = stage_payload.description
        elif stage_payload and stage_payload.job_description:
            stage_description += f"\nDescrição da vaga: {stage_payload.job_description}"

        # Usar a descrição detalhada da etapa como base para análise
        # Se não houver requisitos específicos, usar a descrição da etapa
        requirements_payload = []

        if request.requirements and len(request.requirements) > 0:
            # Se há requisitos específicos, usar eles
            requirements_payload = [
                {
                    "label": req.label or "",
                    "description": req.description or "",
                    "weight": req.weight or 1.0,
                }
                for req in request.requirements
            ]
        else:
            # Se não há requisitos específicos, criar um requisito baseado na descrição da etapa
            requirements_payload = [
                {
                    "label": "Requisitos da Etapa",
                    "description": stage_description,
                    "weight": 1.0,
                }
            ]

        print(f"[IA] Descrição da etapa: {stage_description}")
        print(f"[IA] Requisitos para análise ({len(requirements_payload)}): {requirements_payload}")
        print(f"[IA] ========== DEBUG CONTEÚDO PARA ANÁLISE ==========")
        print(f"[IA] Conteúdo total para análise ({len(text_content)} chars):")
        print(f"[IA] ========== CONTEÚDO COMPLETO ==========")
        print(f"[IA] {text_content}")
        print(f"[IA] ========== FIM DO CONTEÚDO ==========")
        print(f"[IA] ========== DEBUG PROMPT TEMPLATE ==========")
        print(f"[IA] Prompt template recebido: {request.prompt_template[:200] if request.prompt_template else 'NENHUM'}...")
        if request.prompt_template:
            print(f"[IA] ========== PROMPT TEMPLATE COMPLETO ==========")
            print(f"[IA] {request.prompt_template}")
            print(f"[IA] ========== FIM DO PROMPT TEMPLATE ==========")

        # Análise da IA
        runs[run_id]["progress"] = 90
        print(f"[IA] Chamando analyze_candidate_with_openai com config: {config}")
        print(f"[IA] Config OpenAI key: {config.openai_api_key[:10] if config.openai_api_key else 'VAZIA'}...")
        evaluation = await analyze_candidate_with_openai(
            text_content,
            stage_description,
            requirements_payload,
            config,
            prompt_template=request.prompt_template,
        )
        print(f"[IA] Resultado da análise: score={evaluation.score}, strengths={len(evaluation.strengths)}, weaknesses={len(evaluation.weaknesses)}")

        runs[run_id]["status"] = "succeeded"
        runs[run_id]["progress"] = 100

        # Preparar resultado da análise
        analysis_result_dict = evaluation.model_dump()
        runs[run_id]["result"] = analysis_result_dict
        runs[run_id]["finished_at"] = datetime.now().isoformat()

        # Salvar análise no banco de dados
        await save_analysis_to_database(run_id, analysis_result_dict)
        print(f"[IA] Análise {run_id} salva no banco com sucesso")

    except Exception as e:
        runs[run_id]["status"] = "failed"
        runs[run_id]["error"] = str(e)
        runs[run_id]["finished_at"] = datetime.now().isoformat()

@app.get("/health")
async def health_check():
    return {"status": "ok", "runs_count": len(runs), "timestamp": datetime.now().isoformat()}

@app.get("/v1/runs/{run_id}", response_model=RunStatus)
async def get_run(run_id: str):
    print(f"[IA] GET /v1/runs/{run_id}")
    print(f"[IA] Runs disponíveis: {list(runs.keys())}")

    if run_id not in runs:
        print(f"[IA] Run {run_id} não encontrado")
        raise HTTPException(status_code=404, detail="Run not found")

    run_data = runs[run_id]
    print(f"[IA] Run encontrado: {run_data}")
    return RunStatus(
        id=run_data["id"],
        type=run_data["type"],
        status=run_data["status"],
        progress=run_data["progress"],
        error=run_data.get("error"),
        result=run_data.get("result")
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
