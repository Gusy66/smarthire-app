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
  "avaliacao": {
    "pontuacao": pontuação de 0 a 10 (float),
    "justificativa": resumo textual detalhado da análise do candidato REAL,
    "pontos_fortes": array de strings com pontos fortes específicos baseados no currículo REAL,
    "pontos_que_deixam_a_desejar": array de strings com pontos de melhoria específicos baseados no currículo REAL,
    "requisitos_atendidos": array de strings com requisitos atendidos pelo candidato REAL,
    "requisitos_nao_atendidos": array de strings com requisitos não atendidos pelo candidato REAL
  }
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
   - Exemplo: "Conhecimento avançado em Python com frameworks Django"
   - Exemplo: "Liderança de equipes de desenvolvimento com resultados comprovados"
   - Baseie-se no conteúdo real do currículo

5. WEAKNESSES (Pontos de Melhoria):
   - Identifique pontos de melhoria específicos do candidato
   - Exemplo: "Falta de experiência em tecnologias de cloud (AWS/Azure)"
   - Exemplo: "Não demonstra conhecimento em metodologias ágeis"
   - Exemplo: "Experiência limitada em bancos de dados NoSQL"
   - Seja específico sobre o que precisa melhorar

6. FORMATAÇÃO:
   - TODOS os campos de lista devem ser arrays de strings simples
   - Cada item deve ser uma análise específica e detalhada
   - Evite respostas genéricas ou vagas
   - Baseie-se no conteúdo real do currículo fornecido
- Formato correto: ["string1", "string2", "string3"]
- Formato incorreto: [{"requirement": "string1"}, {"requirement": "string2"}]
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

                     print(f"[IA] DEBUG - JSON parseado completo:")
                     print(f"[IA] {json.dumps(result, indent=2, ensure_ascii=False)}")

                     return evaluation_result

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
    
    # Análise específica baseada no conteúdo do currículo
    tech_keywords = ["python", "react", "javascript", "java", "node", "sql", "mysql", "postgresql", "docker", "aws", "azure", "git", "scrum", "kanban", "agile"]
    management_keywords = ["liderança", "gestão", "equipe", "supervisão", "coordenação", "gerenciamento"]
    sales_keywords = ["vendas", "comercial", "atendimento", "cliente", "negociação", "prospecção", "fechamento"]
    
    # Verificar tecnologias mencionadas no currículo
    tech_found = [tech for tech in tech_keywords if tech in text_lower]
    management_found = [mgmt for mgmt in management_keywords if mgmt in text_lower]
    sales_found = [sales for sales in sales_keywords if sales in text_lower]
    
    # Gerar pontos fortes específicos
    if tech_found:
        strengths.append(f"Demonstra experiência técnica sólida em: {', '.join(tech_found[:3])}")
        matched_reqs.append(f"Possui conhecimento técnico em {', '.join(tech_found[:2])}")
        req_bonus += 1.0
    
    if management_found:
        strengths.append(f"Experiência comprovada em liderança e gestão de equipes")
        matched_reqs.append(f"Demonstra habilidades de liderança e supervisão")
        req_bonus += 0.8
    
    if sales_found:
        strengths.append(f"Experiência sólida em vendas e atendimento comercial")
        matched_reqs.append(f"Possui experiência em processos comerciais e vendas")
        req_bonus += 0.6
    
    # Gerar pontos de melhoria específicos
    if not tech_found:
        missing_reqs.append("Falta experiência técnica específica em tecnologias modernas")
        weaknesses.append("Não demonstra conhecimento técnico em ferramentas de desenvolvimento")
    
    if not management_found:
        missing_reqs.append("Ausência de experiência em liderança e gestão de equipes")
        weaknesses.append("Falta de experiência comprovada em supervisão e coordenação")
    
    if not sales_found:
        missing_reqs.append("Não demonstra experiência em vendas ou atendimento comercial")
        weaknesses.append("Falta de experiência em processos comerciais e negociação")
    
    # Análise específica dos requisitos da etapa
    for req in requirements:
        req_text = req.get("label", "").lower()
        req_desc = req.get("description", "").lower()
        req_weight = req.get("weight", 1.0)
        
        if req_text in text_lower or req_desc in text_lower:
            matched_reqs.append(f"Demonstra experiência específica em {req.get('label', '')}: {req.get('description', '')}")
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
                                decoded_key = base64.b64decode(api_key).decode('utf-8')
                                print(f"[IA] API key decodificada: {decoded_key[:10]}...")
                                env_api_key = decoded_key  # ATRIBUIR A CHAVE DECODIFICADA
                                print(f"[IA] env_api_key atribuída: {env_api_key[:10]}...")
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

    print(f"[IA] Retornando AIConfig com chave: {env_api_key[:10] if env_api_key else 'VAZIA'}...")
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

        print("[IA] Recebido currículo:", request.resume_path, request.resume_bucket, request.resume_signed_url)

        if request.resume_path:
            runs[run_id]["progress"] = 40
            resume_text = ""
            resume_warnings: list[str] = []
            try:
        print(f"[IA] ========== DEBUG EXTRAÇÃO DE CURRÍCULO ==========")
        print(f"[IA] Tentando extrair currículo:")
        print(f"[IA]   - resume_path: {request.resume_path}")
        print(f"[IA]   - resume_signed_url: {request.resume_signed_url}")
        print(f"[IA]   - resume_bucket: {request.resume_bucket}")

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
