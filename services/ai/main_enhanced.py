from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import asyncio
import json
import httpx
from typing import Dict, Any, Optional
import os
from datetime import datetime

app = FastAPI(title="SmartHire AI Service Enhanced", version="0.2.0")

# Armazenamento em memória dos runs (em produção, usar Redis/DB)
runs: Dict[str, Dict[str, Any]] = {}

class TranscribeRequest(BaseModel):
    audio_path: str
    language: str | None = None

class EvaluateRequest(BaseModel):
    stage_id: str
    application_id: str
    resume_path: str | None = None
    audio_path: str | None = None
    transcript_path: str | None = None
    user_id: str | None = None

class RunStatus(BaseModel):
    id: str
    type: str
    status: str
    progress: int | None = None
    error: str | None = None
    result: Dict[str, Any] | None = None

class EvaluationResult(BaseModel):
    score: float
    analysis: str
    matched_requirements: list[str]
    missing_requirements: list[str]
    strengths: list[str]
    weaknesses: list[str]
    recommendations: list[str]

class AIConfig(BaseModel):
    openai_api_key: str
    model: str
    temperature: float
    max_tokens: int

# Simulação de processamento de áudio (substituir por Whisper API real)
async def process_audio(audio_path: str) -> str:
    """Simula transcrição de áudio para texto"""
    await asyncio.sleep(2)  # Simula processamento
    return f"Transcrição do áudio {audio_path}: Candidato demonstrou experiência em vendas e comunicação clara."

# Simulação de extração de texto de PDF (substituir por PyPDF2 ou similar)
async def extract_pdf_text(pdf_path: str) -> str:
    """Simula extração de texto de PDF"""
    await asyncio.sleep(1)  # Simula processamento
    return f"Currículo {pdf_path}: João Silva, 5 anos de experiência em vendas, graduado em Administração, fluente em inglês."

# Simulação de análise de transcrição
async def analyze_transcript(transcript_path: str) -> str:
    """Simula leitura de transcrição JSON"""
    await asyncio.sleep(1)
    return f"Transcrição {transcript_path}: Candidato mostrou conhecimento técnico e habilidades interpessoais."

# Análise real com OpenAI
async def analyze_candidate_with_openai(
    text_content: str, 
    stage_description: str, 
    requirements: list[dict],
    config: AIConfig
) -> EvaluationResult:
    """
    Análise real do candidato usando OpenAI
    """
    try:
        async with httpx.AsyncClient() as client:
            # Preparar prompt para análise
            requirements_text = "\n".join([
                f"- {req.get('label', '')}: {req.get('description', '')} (peso: {req.get('weight', 1.0)})"
                for req in requirements
            ])
            
            prompt = f"""
            Analise o candidato para a vaga baseado nas informações fornecidas.

            DESCRIÇÃO DA ETAPA:
            {stage_description}

            REQUISITOS DA ETAPA:
            {requirements_text}

            INFORMAÇÕES DO CANDIDATO:
            {text_content}

            Por favor, forneça uma análise detalhada no seguinte formato JSON:

            {{
                "score": 8.5,
                "analysis": "Análise geral do candidato...",
                "matched_requirements": ["Experiência em vendas", "Fluência em inglês"],
                "missing_requirements": ["Conhecimento em CRM"],
                "strengths": ["5+ anos de experiência", "Comunicação clara"],
                "weaknesses": ["Falta experiência com equipes grandes"],
                "recommendations": ["Considerar para próxima etapa", "Avaliar em entrevista técnica"]
            }}

            Seja objetivo, justo e detalhado na análise. A pontuação deve ser de 0 a 10.
            """

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

            if response.status_code != 200:
                raise Exception(f"Erro na API OpenAI: {response.status_code} - {response.text}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            # Extrair JSON da resposta
            try:
                # Tentar encontrar JSON na resposta
                start = content.find('{')
                end = content.rfind('}') + 1
                if start != -1 and end != 0:
                    json_str = content[start:end]
                    result = json.loads(json_str)
                else:
                    raise ValueError("JSON não encontrado na resposta")
            except (json.JSONDecodeError, ValueError) as e:
                # Fallback para análise simulada se JSON inválido
                return await analyze_candidate_simulated(text_content, stage_description, requirements)

            return EvaluationResult(
                score=float(result.get("score", 5.0)),
                analysis=result.get("analysis", "Análise não disponível"),
                matched_requirements=result.get("matched_requirements", []),
                missing_requirements=result.get("missing_requirements", []),
                strengths=result.get("strengths", []),
                weaknesses=result.get("weaknesses", []),
                recommendations=result.get("recommendations", [])
            )

    except Exception as e:
        print(f"Erro na análise com OpenAI: {e}")
        # Fallback para análise simulada
        return await analyze_candidate_simulated(text_content, stage_description, requirements)

# Análise simulada (fallback)
async def analyze_candidate_simulated(
    text_content: str, 
    stage_description: str, 
    requirements: list[dict]
) -> EvaluationResult:
    """
    Análise simulada do candidato (fallback)
    """
    await asyncio.sleep(2)  # Simula processamento
    
    text_lower = text_content.lower()
    stage_lower = stage_description.lower()
    
    # Pontuação base (0-10)
    base_score = 5.0
    
    # Análise de correspondência com descrição da etapa
    stage_keywords = ["vendas", "comercial", "atendimento", "cliente", "negociação"]
    stage_matches = sum(1 for keyword in stage_keywords if keyword in text_lower)
    stage_bonus = min(stage_matches * 0.5, 2.0)
    
    # Análise de requisitos
    matched_reqs = []
    missing_reqs = []
    strengths = []
    weaknesses = []
    req_bonus = 0.0
    
    for req in requirements:
        req_text = req.get("label", "").lower()
        req_desc = req.get("description", "").lower()
        req_weight = req.get("weight", 1.0)
        
        if req_text in text_lower or req_desc in text_lower:
            matched_reqs.append(req.get("label", ""))
            strengths.append(f"Atende requisito: {req.get('label', '')}")
            req_bonus += 0.5 * req_weight
        else:
            missing_reqs.append(req.get("label", ""))
            weaknesses.append(f"Não atende: {req.get('label', '')}")
    
    # Cálculo da pontuação final
    final_score = min(base_score + stage_bonus + req_bonus, 10.0)
    
    # Gera análise textual
    analysis = f"""
    Análise do candidato para a etapa:
    
    ✅ Pontos fortes:
    - {len(matched_reqs)} requisitos atendidos
    - Correspondência com descrição da etapa: {stage_matches}/5 palavras-chave
    
    ⚠️ Pontos de melhoria:
    - {len(missing_reqs)} requisitos não identificados
    
    📊 Pontuação: {final_score:.1f}/10
    """
    
    return EvaluationResult(
        score=round(final_score, 1),
        analysis=analysis.strip(),
        matched_requirements=matched_reqs,
        missing_requirements=missing_reqs,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendations=["Considerar para próxima etapa", "Avaliar em entrevista"]
    )

# Buscar configurações do usuário (simulado - em produção, buscar do DB)
async def get_user_ai_config(user_id: str) -> AIConfig:
    """
    Busca configurações da IA do usuário
    Em produção, buscar do banco de dados
    """
    # Por enquanto, retorna configuração padrão
    return AIConfig(
        openai_api_key=os.getenv("OPENAI_API_KEY", ""),
        model="gpt-4o-mini",
        temperature=0.3,
        max_tokens=2000
    )

@app.post("/v1/transcribe", response_model=RunStatus)
async def transcribe(request: TranscribeRequest):
    run_id = str(uuid.uuid4())
    runs[run_id] = {
        "id": run_id,
        "type": "transcribe",
        "status": "running",
        "progress": 0,
        "result": None,
        "created_at": datetime.now().isoformat()
    }
    
    asyncio.create_task(process_transcription(run_id, request.audio_path))
    
    return RunStatus(id=run_id, type="transcribe", status="running", progress=0)

async def process_transcription(run_id: str, audio_path: str):
    try:
        runs[run_id]["progress"] = 50
        transcript = await process_audio(audio_path)
        runs[run_id]["status"] = "succeeded"
        runs[run_id]["progress"] = 100
        runs[run_id]["result"] = {"transcript": transcript}
        runs[run_id]["finished_at"] = datetime.now().isoformat()
    except Exception as e:
        runs[run_id]["status"] = "failed"
        runs[run_id]["error"] = str(e)
        runs[run_id]["finished_at"] = datetime.now().isoformat()

@app.post("/v1/evaluate", response_model=RunStatus)
async def evaluate(request: EvaluateRequest):
    run_id = str(uuid.uuid4())
    runs[run_id] = {
        "id": run_id,
        "type": "evaluate",
        "status": "running",
        "progress": 0,
        "result": None,
        "created_at": datetime.now().isoformat()
    }
    
    asyncio.create_task(process_evaluation(run_id, request))
    
    return RunStatus(id=run_id, type="evaluate", status="running", progress=0)

async def process_evaluation(run_id: str, request: EvaluateRequest):
    try:
        runs[run_id]["progress"] = 20
        
        # Coleta conteúdo de texto
        text_content = ""
        
        if request.resume_path:
            runs[run_id]["progress"] = 40
            text_content += await extract_pdf_text(request.resume_path) + "\n\n"
        
        if request.audio_path:
            runs[run_id]["progress"] = 60
            text_content += await process_audio(request.audio_path) + "\n\n"
        
        if request.transcript_path:
            runs[run_id]["progress"] = 80
            text_content += await analyze_transcript(request.transcript_path) + "\n\n"
        
        # Buscar configurações da IA do usuário
        config = await get_user_ai_config(request.user_id or "default")
        
        # Simula busca de configuração da etapa (em produção, buscar do DB)
        stage_description = "Avaliar experiência em vendas e atendimento ao cliente"
        requirements = [
            {"label": "Experiência em vendas", "description": "Pelo menos 2 anos", "weight": 2.0},
            {"label": "Fluência em inglês", "description": "Conversação fluente", "weight": 1.5},
            {"label": "CRM", "description": "Conhecimento em sistemas CRM", "weight": 1.0}
        ]
        
        # Análise da IA
        runs[run_id]["progress"] = 90
        evaluation = await analyze_candidate_with_openai(text_content, stage_description, requirements, config)
        
        runs[run_id]["status"] = "succeeded"
        runs[run_id]["progress"] = 100
        runs[run_id]["result"] = {
            "score": evaluation.score,
            "analysis": evaluation.analysis,
            "matched_requirements": evaluation.matched_requirements,
            "missing_requirements": evaluation.missing_requirements,
            "strengths": evaluation.strengths,
            "weaknesses": evaluation.weaknesses,
            "recommendations": evaluation.recommendations,
            "stage_id": request.stage_id,
            "application_id": request.application_id
        }
        runs[run_id]["finished_at"] = datetime.now().isoformat()
        
    except Exception as e:
        runs[run_id]["status"] = "failed"
        runs[run_id]["error"] = str(e)
        runs[run_id]["finished_at"] = datetime.now().isoformat()

@app.get("/v1/runs/{run_id}", response_model=RunStatus)
async def get_run(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")
    
    run_data = runs[run_id]
    return RunStatus(
        id=run_data["id"],
        type=run_data["type"],
        status=run_data["status"],
        progress=run_data["progress"],
        error=run_data.get("error"),
        result=run_data.get("result")
    )

@app.get("/health")
async def health():
    return {
        "status": "healthy", 
        "runs_active": len([r for r in runs.values() if r["status"] == "running"]),
        "version": "0.2.0"
    }

# Endpoint para testar configuração da IA
@app.post("/v1/test-config")
async def test_config(config: AIConfig):
    try:
        async with httpx.AsyncClient() as client:
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
                            "role": "user",
                            "content": "Teste de conexão. Responda apenas 'OK' se recebeu esta mensagem."
                        }
                    ],
                    "max_tokens": 10,
                    "temperature": 0
                },
                timeout=10.0
            )
            
            if response.status_code == 200:
                return {"success": True, "message": "Configuração válida"}
            else:
                return {"success": False, "message": f"Erro: {response.status_code}"}
                
    except Exception as e:
        return {"success": False, "message": f"Erro: {str(e)}"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
