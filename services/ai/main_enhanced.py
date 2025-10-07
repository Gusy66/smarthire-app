from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uuid
import asyncio
import json
import io
import base64
import httpx
from typing import Dict, Any, Optional, Tuple
import os
from datetime import datetime
from pathlib import Path
import tempfile
from urllib.parse import urlparse
import base64
import os
from dotenv import load_dotenv

print("[IA] Carregando variáveis de ambiente...")
result = load_dotenv()
print(f"[IA] Resultado do load_dotenv(): {result}")

# Verificar se as variáveis foram carregadas
supabase_url = os.getenv("SUPABASE_URL")
service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
storage_url = os.getenv("SUPABASE_STORAGE_URL")

print(f"[IA] SUPABASE_URL carregada: {bool(supabase_url)}")
print(f"[IA] SUPABASE_SERVICE_ROLE_KEY carregada: {bool(service_role)}")
print(f"[IA] SUPABASE_STORAGE_URL carregada: {bool(storage_url)}")

try:
    from PyPDF2 import PdfReader  # type: ignore
except ImportError:
    PdfReader = None

try:
    import docx  # type: ignore
except ImportError:
    docx = None

try:
    import pytesseract  # type: ignore
    from PIL import Image  # type: ignore
except ImportError:
    pytesseract = None
    Image = None

SUPPORTED_RESUME_EXTENSIONS = {".pdf", ".docx", ".doc", ".txt"}
SUPPORTED_IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg"}

app = FastAPI(title="SmartHire AI Service Enhanced", version="0.2.0")

# Armazenamento em memória dos runs (em produção, usar Redis/DB)
runs: Dict[str, Dict[str, Any]] = {}

class TranscribeRequest(BaseModel):
    audio_path: str
    language: str | None = None

class StagePayload(BaseModel):
    id: str | None = None
    name: str | None = None
    threshold: float | None = None
    stage_weight: float | None = None
    description: str | None = None
    job_description: str | None = None

class RequirementPayload(BaseModel):
    label: str | None = None
    description: str | None = None
    weight: float | None = None

class EvaluateRequest(BaseModel):
    stage_id: str
    application_id: str
    resume_path: str | None = None
    resume_bucket: str | None = None
    resume_signed_url: str | None = None
    audio_path: str | None = None
    audio_bucket: str | None = None
    audio_signed_url: str | None = None
    transcript_path: str | None = None
    transcript_bucket: str | None = None
    transcript_signed_url: str | None = None
    user_id: str | None = None
    stage: StagePayload | None = None
    requirements: list[RequirementPayload] | None = None
    prompt_template: str | None = None

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

# Utilidades de extração real de texto de currículos
async def read_file_bytes(path: Path) -> bytes:
    return await asyncio.to_thread(path.read_bytes)


async def extract_text_from_pdf(path: Path) -> str:
    if PdfReader is None:
        raise RuntimeError("Dependência PyPDF2 não instalada")

    file_bytes = await read_file_bytes(path)

    def _extract() -> str:
        reader = PdfReader(io.BytesIO(file_bytes))
        texts = []
        for page in reader.pages:
            try:
                texts.append(page.extract_text() or "")
            except Exception:
                continue
        return "\n".join(filter(None, texts))

    return await asyncio.to_thread(_extract)


async def extract_text_from_docx(path: Path) -> str:
    if docx is None:
        raise RuntimeError("Dependência python-docx não instalada")

    def _extract() -> str:
        document = docx.Document(str(path))
        paragraphs = [para.text for para in document.paragraphs if para.text]
        return "\n".join(paragraphs)

    return await asyncio.to_thread(_extract)


async def extract_text_from_plain(path: Path) -> str:
    file_bytes = await read_file_bytes(path)
    return file_bytes.decode("utf-8", errors="ignore")


async def extract_text_with_ocr(path: Path) -> str:
    if pytesseract is None or Image is None:
        raise RuntimeError("Dependências de OCR não instaladas")

    file_bytes = await read_file_bytes(path)

    def _extract() -> str:
        with Image.open(io.BytesIO(file_bytes)) as img:
            return pytesseract.image_to_string(img)

    return await asyncio.to_thread(_extract)
async def download_file_from_storage(path: str, bucket: str | None = None) -> Path:
    storage_url = os.getenv("SUPABASE_STORAGE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not storage_url or not service_role:
        raise RuntimeError("SUPABASE_STORAGE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados")

    actual_bucket = bucket
    file_path = path

    if path.startswith("http"):
        parsed = urlparse(path)
        file_path = parsed.path.lstrip('/')
        if not bucket and '/' in file_path:
            parts = file_path.split('/', 1)
            actual_bucket = parts[0]
            file_path = parts[1]
    else:
        if '/' in path:
            parts = path.split('/', 1)
            if len(parts) == 2:
                actual_bucket = parts[0]
                file_path = parts[1]

    if not actual_bucket:
        raise ValueError("Bucket não informado para download do arquivo")

    download_url = f"{storage_url}/object/{actual_bucket}/{file_path}"

    async with httpx.AsyncClient() as client:
        response = await client.get(download_url, timeout=60.0, headers={
            "Authorization": f"Bearer {service_role}",
            "apikey": service_role,
        })
        response.raise_for_status()

        suffix = Path(file_path).suffix or ""
        temp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
        temp.write(response.content)
        temp.flush()
        temp.close()
        return Path(temp.name)


async def extract_resume_text(resume_path: str, signed_url: str | None = None, bucket: str | None = None) -> Tuple[str, list[str]]:
    temp_file: Path | None = None
    if signed_url:
        temp_file = await download_file_from_storage(signed_url, bucket)
    else:
        temp_file = await download_file_from_storage(resume_path, bucket)
    path = temp_file

    if not path.exists():
        raise FileNotFoundError(f"Arquivo de currículo não encontrado: {resume_path}")

    extension = path.suffix.lower()
    warnings: list[str] = []

    try:
        if extension == ".pdf":
            content = await extract_text_from_pdf(path)
            if not content.strip():
                warnings.append("Nenhum texto extraído do PDF; verifique se é digitalizado.")
        elif extension == ".docx":
            content = await extract_text_from_docx(path)
        elif extension == ".txt":
            content = await extract_text_from_plain(path)
        elif extension in SUPPORTED_IMAGE_EXTENSIONS:
            content = await extract_text_with_ocr(path)
            warnings.append("OCR aplicado em imagem; qualidade pode variar.")
        elif extension == ".doc":
            warnings.append("Formato .doc não suportado diretamente. Converta para .docx ou PDF.")
            content = ""
        else:
            warnings.append(f"Extensão {extension} não suportada. Envie PDF, DOCX ou TXT.")
            content = ""
    except Exception as e:
        warnings.append(f"Falha ao extrair texto do currículo ({extension}): {e}")
        content = ""

    if temp_file:
        try:
            temp_file.unlink(missing_ok=True)
        except Exception:
            pass

    return content.strip(), warnings

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
    config: AIConfig,
    prompt_template: str | None = None
) -> EvaluationResult:
    """
    Análise real do candidato usando OpenAI
    """
    # Verificar se a chave da API está configurada
    if not config.openai_api_key or config.openai_api_key.strip() == "":
        print("[IA] Chave OpenAI não configurada, usando análise simulada")
        return await analyze_candidate_simulated(text_content, stage_description, requirements)
    
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

Forneça uma análise detalhada em JSON válido com as seguintes chaves:

- score: pontuação de 0 a 10 (float)
- analysis: resumo textual da análise
- matched_requirements: array de strings com requisitos atendidos (ex: ["Demonstra experiência sólida em React", "Possui conhecimento em Python"])
- missing_requirements: array de strings com requisitos não atendidos (ex: ["Falta experiência em Docker", "Não demonstra conhecimento em AWS"])
- strengths: array de strings com pontos fortes específicos (ex: ["Experiência sólida em React com componentes reutilizáveis"])
- weaknesses: array de strings com pontos de melhoria específicos (ex: ["Falta de experiência em tecnologias específicas"])
- recommendations: array de strings com recomendações (ex: ["Considerar para próxima etapa", "Avaliar em entrevista"])

IMPORTANTE: 
- Para "strengths" e "matched_requirements", escreva análises textuais detalhadas, não apenas números
- Para "weaknesses" e "missing_requirements", escreva análises textuais detalhadas, não apenas números
- Seja específico e detalhado em cada campo
- Baseie-se no conteúdo do currículo e na descrição da etapa
- Para "missing_requirements", liste especificamente quais requisitos não foram atendidos (ex: "Falta experiência em Docker", "Não demonstra conhecimento em AWS")
- Para "matched_requirements", liste especificamente quais requisitos foram atendidos (ex: "Demonstra experiência sólida em React", "Possui conhecimento em Python")
- Evite respostas genéricas como "falta experiência específica" - seja específico sobre o que falta
- TODOS os campos de lista devem ser arrays de strings simples, não objetos com chaves
- Formato correto: ["string1", "string2", "string3"]
- Formato incorreto: [{"requirement": "string1"}, {"requirement": "string2"}]
"""

            prompt = (
                base_prompt
                .replace("{{STAGE_DESCRIPTION}}", stage_description)
                .replace("{{REQUIREMENTS_LIST}}", requirements_text)
                .replace("{{CANDIDATE_INFO}}", text_content)
            )

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

            return EvaluationResult(
                score=float(result.get("score", 5.0)),
                analysis=result.get("analysis", "Análise não disponível"),
                matched_requirements=ensure_string_list(result.get("matched_requirements", [])),
                missing_requirements=ensure_string_list(result.get("missing_requirements", [])),
                strengths=ensure_string_list(result.get("strengths", [])),
                weaknesses=ensure_string_list(result.get("weaknesses", [])),
                recommendations=ensure_string_list(result.get("recommendations", []))
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
            matched_reqs.append(f"Demonstra experiência sólida em {req.get('label', '')}: {req.get('description', '')}")
            strengths.append(f"Candidato possui conhecimento técnico em {req.get('label', '')} conforme evidenciado no currículo")
            req_bonus += 0.5 * req_weight
        else:
            missing_reqs.append(f"Falta experiência específica em {req.get('label', '')}: {req.get('description', '')}")
            weaknesses.append(f"Não demonstra conhecimento em {req.get('label', '')} conforme descrito na etapa")
    
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
    
    # Adiciona pontos fortes e fracos baseados no conteúdo
    if not strengths:
        strengths.append("Candidato apresenta experiência relevante para a posição")
    if not weaknesses:
        weaknesses.append("Nenhuma fraqueza específica identificada na análise inicial")
    
    # Adiciona análise específica baseada no conteúdo do currículo
    if "python" in text_lower:
        strengths.append("Demonstra conhecimento em Python para desenvolvimento backend")
    if "react" in text_lower:
        strengths.append("Possui experiência em React para desenvolvimento frontend")
    if "php" in text_lower:
        strengths.append("Conhece PHP para desenvolvimento backend")
    if "typescript" in text_lower:
        strengths.append("Demonstra conhecimento em TypeScript")
    if "aws" in text_lower:
        strengths.append("Possui experiência com serviços AWS")
    if "docker" in text_lower:
        strengths.append("Conhece Docker para containerização")
    if "fintech" in text_lower or "banking" in text_lower or "financeiro" in text_lower:
        strengths.append("Experiência relevante em projetos do setor financeiro")
    
    # Identifica possíveis lacunas específicas
    if "mysql" not in text_lower and "database" not in text_lower:
        weaknesses.append("Não demonstra experiência específica com bancos de dados MySQL")
    if "microserviços" not in text_lower and "microservices" not in text_lower:
        weaknesses.append("Falta experiência específica com arquitetura de microserviços")
    if "scrum" not in text_lower and "kanban" not in text_lower and "ágil" not in text_lower:
        weaknesses.append("Não demonstra experiência com metodologias ágeis")
    
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
    Busca configurações da IA do usuário.
    Se não houver configuração persistida, utiliza variáveis de ambiente como fallback.
    """
    print(f"[IA] Buscando configurações para user_id: {user_id}")
    
    env_api_key = os.getenv("OPENAI_API_KEY", "")
    env_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    env_temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
    env_max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))

    supabase_url = os.getenv("SUPABASE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    print(f"[IA] Variáveis de ambiente - supabase_url: {bool(supabase_url)}, service_role: {bool(service_role)}")
    print(f"[IA] Chave de ambiente: {env_api_key[:10] if env_api_key else 'VAZIA'}...")

    if supabase_url and service_role and user_id != "default":
        print(f"[IA] Supabase URL: {supabase_url}")
        print(f"[IA] Fazendo requisição para: {supabase_url}/rest/v1/rpc/get_ai_settings_by_user")
        print(f"[IA] Payload: {{'p_user_id': '{user_id}'}}")
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{supabase_url}/rest/v1/rpc/get_ai_settings_by_user",
                    json={"p_user_id": user_id},
                    headers={
                        "apikey": service_role,
                        "Authorization": f"Bearer {service_role}",
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
                print(f"[IA] Status da resposta: {response.status_code}")
                if response.status_code == 200:
                    data = response.json()
                    print(f"[IA] ai_settings response: {data}")
                    if data:
                        record = data[0]
                        print(f"[IA] Record encontrado: {record}")
                        try:
                            api_key = record.get("openai_api_key")
                            print(f"[IA] API key raw: {api_key}")
                            if api_key:
                                env_api_key = base64.b64decode(api_key).decode('utf-8')
                                print(f"[IA] API key decodificada: {env_api_key[:10]}...")
                        except Exception as decode_ex:
                            print(f"[IA] Falha ao decodificar chave: {decode_ex}")
                        env_model = record.get("model", env_model)
                        env_temperature = float(record.get("temperature", env_temperature))
                        env_max_tokens = int(record.get("max_tokens", env_max_tokens))
                    else:
                        print("[IA] Nenhum registro encontrado para o usuário")
                else:
                    print(f"[IA] Erro Supabase {response.status_code}: {response.text}")
        except Exception as ex:
            print(f"[IA] Falha ao buscar ai_settings: {ex}")
    else:
        print(f"[IA] Condições não atendidas para buscar ai_settings:")
        print(f"[IA]   supabase_url: {bool(supabase_url)}")
        print(f"[IA]   service_role: {bool(service_role)}")
        print(f"[IA]   user_id != 'default': {user_id != 'default'}")

    return AIConfig(
        openai_api_key=env_api_key,
        model=env_model,
        temperature=env_temperature,
        max_tokens=env_max_tokens,
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
        extraction_warnings: list[str] = []

        print("[IA] Recebido currículo:", request.resume_path, request.resume_bucket, request.resume_signed_url)

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
                print(f"[IA] Texto extraído do currículo ({len(resume_text)} chars): {resume_text[:200]}...")
            except Exception as ex:
                resume_warnings.append(f"Falha ao ler currículo: {ex}")
                print(f"[IA] Erro ao extrair currículo: {ex}")

            if resume_text:
                text_content += resume_text + "\n\n"
                print(f"[IA] Currículo adicionado ao conteúdo total")
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
        config = await get_user_ai_config(request.user_id or "default")

        # Define descrição da etapa e requisitos com base no payload fornecido
        stage_payload = request.stage
        stage_description = "Etapa do processo seletivo"

        if stage_payload and stage_payload.name:
            stage_description = stage_payload.name

        # Priorizar a descrição detalhada da etapa
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
        print(f"[IA] Conteúdo total para análise ({len(text_content)} chars): {text_content[:300]}...")

        # Análise da IA
        runs[run_id]["progress"] = 90
        evaluation = await analyze_candidate_with_openai(
            text_content,
            stage_description,
            requirements_payload,
            config,
            prompt_template=request.prompt_template,
        )
        
        runs[run_id]["status"] = "succeeded"
        runs[run_id]["progress"] = 100
        
        # Preparar resultado da análise
        analysis_result = {
            "score": evaluation.score,
            "analysis": evaluation.analysis,
            "matched_requirements": evaluation.matched_requirements,
            "missing_requirements": evaluation.missing_requirements,
            "strengths": evaluation.strengths,
            "weaknesses": evaluation.weaknesses,
            "recommendations": evaluation.recommendations,
            "extraction_warnings": extraction_warnings,
            "stage_id": request.stage_id,
            "application_id": request.application_id,
            "prompt_template": request.prompt_template,
            "stage": request.stage.model_dump() if request.stage else None,
            "requirements": [req.model_dump() for req in (request.requirements or [])],
        }
        
        runs[run_id]["result"] = analysis_result
        runs[run_id]["finished_at"] = datetime.now().isoformat()
        
        # Salvar resultado no banco de dados
        await save_analysis_to_database(run_id, analysis_result)
        
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

# Função para salvar análise no banco de dados
async def save_analysis_to_database(run_id: str, analysis_result: dict):
    """
    Salva o resultado da análise no banco de dados
    """
    try:
        storage_url = os.getenv("SUPABASE_STORAGE_URL")
        service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not storage_url or not service_role:
            print(f"[IA] Aviso: Não foi possível salvar análise {run_id} - variáveis de ambiente não configuradas")
            return
            
        supabase_url = storage_url.replace("/storage/v1", "")
        
        async with httpx.AsyncClient() as client:
            # Atualizar o registro na tabela stage_ai_runs usando WHERE clause
            response = await client.patch(
                f"{supabase_url}/rest/v1/stage_ai_runs?run_id=eq.{run_id}",
                json={
                    "result": analysis_result,
                    "status": "succeeded",
                    "finished_at": datetime.now().isoformat()
                },
                headers={
                    "apikey": service_role,
                    "Authorization": f"Bearer {service_role}",
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                timeout=10.0,
            )
            
            if response.status_code in [200, 204]:
                print(f"[IA] Análise {run_id} salva no banco com sucesso")
            else:
                print(f"[IA] Erro ao salvar análise {run_id}: {response.status_code} - {response.text}")
                
    except Exception as e:
        print(f"[IA] Erro ao salvar análise {run_id} no banco: {e}")

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
