from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import asyncio
import json
from typing import Dict, Any
import os

app = FastAPI(title="SmartHire AI Service", version="0.1.0")

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

# Simulação de processamento de áudio
async def process_audio(audio_path: str) -> str:
    """Simula transcrição de áudio para texto"""
    await asyncio.sleep(2)  # Simula processamento
    return f"Transcrição do áudio {audio_path}: Candidato demonstrou experiência em vendas e comunicação clara."

# Simulação de extração de texto de PDF
async def extract_pdf_text(pdf_path: str) -> str:
    """Simula extração de texto de PDF"""
    await asyncio.sleep(1)  # Simula processamento
    return f"Currículo {pdf_path}: João Silva, 5 anos de experiência em vendas, graduado em Administração, fluente em inglês."

# Simulação de análise de transcrição
async def analyze_transcript(transcript_path: str) -> str:
    """Simula leitura de transcrição JSON"""
    await asyncio.sleep(1)
    return f"Transcrição {transcript_path}: Candidato mostrou conhecimento técnico e habilidades interpessoais."

# IA de Análise (simulada)
async def analyze_candidate(
    text_content: str, 
    stage_description: str, 
    requirements: list[dict]
) -> EvaluationResult:
    """
    Simula análise de IA do candidato contra os critérios da etapa
    """
    await asyncio.sleep(3)  # Simula processamento de IA
    
    # Simulação de análise baseada em palavras-chave
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
    req_bonus = 0.0
    
    for req in requirements:
        req_text = req.get("label", "").lower()
        req_desc = req.get("description", "").lower()
        req_weight = req.get("weight", 1.0)
        
        # Verifica se o requisito está presente no texto
        if req_text in text_lower or req_desc in text_lower:
            matched_reqs.append(req.get("label", ""))
            req_bonus += 0.5 * req_weight
        else:
            missing_reqs.append(req.get("label", ""))
    
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
        missing_requirements=missing_reqs
    )

@app.post("/v1/transcribe", response_model=RunStatus)
async def transcribe(request: TranscribeRequest):
    run_id = str(uuid.uuid4())
    runs[run_id] = {
        "id": run_id,
        "type": "transcribe",
        "status": "running",
        "progress": 0,
        "result": None
    }
    
    # Processa em background
    asyncio.create_task(process_transcription(run_id, request.audio_path))
    
    return RunStatus(id=run_id, type="transcribe", status="running", progress=0)

async def process_transcription(run_id: str, audio_path: str):
    try:
        runs[run_id]["progress"] = 50
        transcript = await process_audio(audio_path)
        runs[run_id]["status"] = "succeeded"
        runs[run_id]["progress"] = 100
        runs[run_id]["result"] = {"transcript": transcript}
    except Exception as e:
        runs[run_id]["status"] = "failed"
        runs[run_id]["error"] = str(e)

@app.post("/v1/evaluate", response_model=RunStatus)
async def evaluate(request: EvaluateRequest):
    run_id = str(uuid.uuid4())
    runs[run_id] = {
        "id": run_id,
        "type": "evaluate",
        "status": "running",
        "progress": 0,
        "result": None
    }
    
    # Processa em background
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
        
        # Simula busca de configuração da etapa (em produção, buscar do DB)
        stage_description = "Avaliar experiência em vendas e atendimento ao cliente"
        requirements = [
            {"label": "Experiência em vendas", "description": "Pelo menos 2 anos", "weight": 2.0},
            {"label": "Fluência em inglês", "description": "Conversação fluente", "weight": 1.5},
            {"label": "CRM", "description": "Conhecimento em sistemas CRM", "weight": 1.0}
        ]
        
        # Análise da IA
        runs[run_id]["progress"] = 90
        evaluation = await analyze_candidate(text_content, stage_description, requirements)
        
        runs[run_id]["status"] = "succeeded"
        runs[run_id]["progress"] = 100
        runs[run_id]["result"] = {
            "score": evaluation.score,
            "analysis": evaluation.analysis,
            "matched_requirements": evaluation.matched_requirements,
            "missing_requirements": evaluation.missing_requirements,
            "stage_id": request.stage_id,
            "application_id": request.application_id
        }
        
    except Exception as e:
        runs[run_id]["status"] = "failed"
        runs[run_id]["error"] = str(e)

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

# Endpoint de saúde
@app.get("/health")
async def health():
    return {"status": "healthy", "runs_active": len([r for r in runs.values() if r["status"] == "running"])}
