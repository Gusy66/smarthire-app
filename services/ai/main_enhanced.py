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
from dotenv import load_dotenv, dotenv_values
# Carregamento seguro de variáveis de ambiente
def load_environment_variables():
    """
    Carrega variáveis de ambiente de forma segura, tratando problemas de encoding
    """
    try:
        # Verificar se arquivo .env existe
        env_file = Path(".env")
        if env_file.exists():
            print(f"[IA] Arquivo .env encontrado: {env_file.absolute()}")
            try:
                # Tentar diferentes encodings (inclui UTF-16/UTF-32)
                encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'utf-16', 'utf-16-le', 'utf-16-be', 'utf-32', 'utf-32-le', 'utf-32-be']
                loaded = False

                for encoding in encodings:
                    try:
                        result = load_dotenv(encoding=encoding)
                        if result:
                            print(f"[IA] ✅ .env carregado com sucesso usando encoding: {encoding}")
                            loaded = True
                            break
                    except UnicodeDecodeError:
                        print(f"[IA] ❌ Falha com encoding {encoding}, tentando próximo...")
                        continue
                    except Exception as e:
                        print(f"[IA] ❌ Erro com encoding {encoding}: {e}")
                        break

                if not loaded:
                    print(f"[IA] ❌ Não foi possível carregar .env com nenhum encoding")
                    print(f"[IA] 🔄 Tentando carregar manualmente...")

                    # Tentar carregar manualmente com diferentes encodings e via dotenv_values
                    manual_loaded = False

                    # 1) dotenv_values
                    try:
                        values = dotenv_values(dotenv_path=str(env_file))
                        if values:
                            for k, v in values.items():
                                if k and v is not None and os.getenv(k) is None:
                                    os.environ[k] = str(v)
                            manual_loaded = True
                            print(f"[IA] ✅ .env carregado via dotenv_values")
                    except Exception as e:
                        print(f"[IA] ❌ dotenv_values falhou: {e}")

                    # 2) Parsing manual
                    if not manual_loaded:
                        for encoding in encodings:
                            try:
                                with open('.env', 'r', encoding=encoding) as f:
                                    content = f.read()
                                    # Remover BOM se houver
                                    if content.startswith('\ufeff'):
                                        content = content.lstrip('\ufeff')
                                    for raw_line in content.split('\n'):
                                        line = raw_line.strip()
                                        if not line or line.startswith('#'):
                                            continue
                                        if '=' not in line:
                                            continue
                                        key, value = line.split('=', 1)
                                        key = key.strip()
                                        value = value.strip().strip('"\'')
                                        if key and os.getenv(key) is None:
                                            os.environ[key] = value
                                    manual_loaded = True
                                    print(f"[IA] ✅ .env carregado manualmente com encoding: {encoding}")
                                    break
                            except UnicodeDecodeError:
                                print(f"[IA] ❌ Falha no carregamento manual com {encoding}: UnicodeDecodeError")
                                continue
                            except Exception as e:
                                print(f"[IA] ❌ Falha no carregamento manual com {encoding}: {e}")
                                continue

                    if not manual_loaded:
                        print(f"[IA] ❌ Não foi possível carregar .env manualmente")
                        print(f"[IA] ⚠️ Continuando sem carregar .env")
                        return False

                return True

            except ImportError:
                print(f"[IA] ❌ python-dotenv não instalado")
                print(f"[IA] ⚠️ Continuando sem carregar .env")
                return False
            except Exception as e:
                print(f"[IA] ❌ Erro ao carregar .env: {e}")
                print(f"[IA] ⚠️ Continuando sem carregar .env")
                return False
        else:
            print(f"[IA] Arquivo .env não encontrado em: {env_file.absolute()}")
            print(f"[IA] ⚠️ Usando apenas variáveis de ambiente do sistema")
            return False
    except Exception as e:
        print(f"[IA] ❌ Erro crítico no carregamento de variáveis: {e}")
        return False

print("[IA] ========== INICIANDO CARREGAMENTO DE VARIÁVEIS ==========")
env_loaded = load_environment_variables()

# Verificar se as variáveis foram carregadas
supabase_url = os.getenv("SUPABASE_URL")
service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
storage_url = os.getenv("SUPABASE_STORAGE_URL")

print(f"[IA] ========== STATUS DAS VARIÁVEIS ==========")
print(f"[IA] SUPABASE_URL carregada: {bool(supabase_url)}")
print(f"[IA] SUPABASE_SERVICE_ROLE_KEY carregada: {bool(service_role)}")
print(f"[IA] SUPABASE_STORAGE_URL carregada: {bool(storage_url)}")

# Verificar variáveis críticas
if not supabase_url:
    print(f"[IA] ❌ SUPABASE_URL não configurada - verifique seu arquivo .env ou variáveis de ambiente")
if not service_role:
    print(f"[IA] ❌ SUPABASE_SERVICE_ROLE_KEY não configurada - verifique seu arquivo .env ou variáveis de ambiente")

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
            if not requirements_text.strip():
                requirements_text = "- Nenhum requisito específico informado; utilize a descrição da etapa como referência principal."
            
            base_prompt = prompt_template or """
Analise o candidato para esta etapa do processo seletivo de forma objetiva e baseada EXCLUSIVAMENTE nas informações fornecidas.

DESCRIÇÃO DA ETAPA (contexto principal a ser considerado):
{{STAGE_DESCRIPTION}}

REQUISITOS OU EXPECTATIVAS PARA ESTA ETAPA:
{{REQUIREMENTS_LIST}}

INFORMAÇÕES DO CANDIDATO (texto real do currículo e anexos):
{{CANDIDATE_INFO}}

INSTRUÇÕES CRÍTICAS (obrigatórias):
1. Utilize a descrição da etapa como referência central para julgar a aderência do candidato.
2. Compare cada item encontrado no currículo com a descrição/requisitos e explique a relação.
3. Não invente informações: cite apenas o que estiver explicitamente no currículo.
4. Se faltar alguma informação relevante, registre explicitamente que ela não aparece no currículo.
5. Caso o currículo esteja vazio ou ilegível, informe isso claramente e atribua nota 0.

CRITÉRIO DE PONTUAÇÃO (0 a 10):
- 0 significa nenhuma aderência aos requisitos ou competências da etapa.
- 10 significa aderência total aos requisitos e expectativas descritas.
- Distribua a nota proporcionalmente ao atendimento dos requisitos, considerando pesos quando informados.
- Justifique a nota citando evidências concretas do currículo relacionadas à descrição da etapa.

FORMATO DE RESPOSTA (JSON obrigatório):
{"score": number, "analysis": string, "strengths": string[], "weaknesses": string[], "matched_requirements": string[], "missing_requirements": string[]}

REGRAS ADICIONAIS:
- Liste em "matched_requirements" apenas itens comprovados pelo currículo e que se conectem à descrição.
- Liste em "missing_requirements" requisitos/competências relevantes que não foram comprovados.
- Seja específico nas listas: use frases curtas que expliquem a evidência (ou ausência) encontrada.
- Não inclua campos extras ou comentários fora do JSON solicitado.
"""

            prompt = (
                base_prompt
                .replace("{{STAGE_DESCRIPTION}}", stage_description)
                .replace("{{REQUIREMENTS_LIST}}", requirements_text)
                .replace("{{CANDIDATE_INFO}}", text_content)
            )

            print(f"[IA] ========== PROMPT FINAL PARA OPENAI ==========")
            print(f"[IA] Prompt preparado: {len(prompt)} caracteres")
            # Evitar imprimir o prompt completo em produção
            # print(f"[IA] {prompt}")
            print(f"[IA] ========== FIM DO PROMPT ==========")
            print(f"[IA] Fazendo requisição para OpenAI...")

            # Monta payload com JSON Schema único (sem oneOf)
            payload = {
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
                "max_tokens": config.max_tokens,
                "response_format": {
                    "type": "json_schema",
                    "json_schema": {
                        "name": "evaluation_schema",
                        "schema": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "score": {"type": "number", "minimum": 0, "maximum": 10},
                                "analysis": {"type": "string"},
                                "strengths": {"type": "array", "items": {"type": "string"}},
                                "weaknesses": {"type": "array", "items": {"type": "string"}},
                                "matched_requirements": {"type": "array", "items": {"type": "string"}},
                                "missing_requirements": {"type": "array", "items": {"type": "string"}}
                            },
                            "required": [
                                "score",
                                "analysis",
                                "strengths",
                                "weaknesses",
                                "matched_requirements",
                                "missing_requirements"
                            ]
                        },
                        "strict": True
                    }
                }
            }

            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {config.openai_api_key}",
                    "Content-Type": "application/json"
                },
                json=payload,
                timeout=30.0
            )

            print(f"[IA] Resposta OpenAI recebida: {response.status_code}")

            # Fallback automático se o schema for rejeitado (400)
            if response.status_code == 400:
                try:
                    err = response.json()
                    err_msg = (err.get("error", {}) or {}).get("message", "")
                except Exception:
                    err_msg = ""
                if "response_format" in err_msg and ("Invalid schema" in err_msg or "not permitted" in err_msg):
                    print("[IA] Aviso: Schema JSON rejeitado. Requisitando novamente com response_format=json_object...")
                    payload["response_format"] = {"type": "json_object"}
                    response = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={
                            "Authorization": f"Bearer {config.openai_api_key}",
                            "Content-Type": "application/json"
                        },
                        json=payload,
                        timeout=30.0
                    )
                    print(f"[IA] Resposta OpenAI (fallback json_object): {response.status_code}")

            if response.status_code != 200:
                print(f"[IA] Erro na API OpenAI: {response.status_code} - {response.text}")
                raise Exception(f"Erro na API OpenAI: {response.status_code} - {response.text}")

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            print(f"[IA] ========== RESPOSTA DA OPENAI ==========")
            print(f"[IA] Conteúdo da resposta: {len(content)} caracteres")
            # Evitar imprimir a resposta completa
            # print(f"[IA] {content}")
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
            # Evitar imprimir JSON completo
            # print(f"[IA] {json.dumps(result, indent=2, ensure_ascii=False)}")
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

            # Clamp da pontuação [0,10]
            try:
                if score is None or not isinstance(score, (int, float)):
                    score = 0.0
                score = max(0.0, min(10.0, float(score)))
            except Exception:
                score = 0.0

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

# Análise simulada (fallback) - MELHORADA PARA USAR DADOS REAIS
async def analyze_candidate_simulated(
    text_content: str,
    stage_description: str,
    requirements: list[dict]
) -> EvaluationResult:
    """
    Análise simulada do candidato baseada exclusivamente no conteúdo real do currículo
    """
    await asyncio.sleep(2)  # Simula processamento

    # Se não houver conteúdo de currículo, retornar análise vazia
    if not text_content or not text_content.strip():
        return EvaluationResult(
            score=0.0,
            analysis="Não foi possível realizar a análise: currículo vazio ou não fornecido.",
            matched_requirements=[],
            missing_requirements=["Currículo não fornecido"],
            strengths=[],
            weaknesses=["Ausência de informações do candidato"],
            recommendations=["Fornecer currículo para análise"]
        )

    text_lower = text_content.lower()
    stage_lower = stage_description.lower()

    # Pontuação base (0-10)
    base_score = 5.0

    # Análise de correspondência com descrição da etapa
    stage_keywords = ["vendas", "comercial", "atendimento", "cliente", "negociação", "desenvolvimento", "programação", "análise", "gestão", "liderança"]
    stage_matches = sum(1 for keyword in stage_keywords if keyword in text_lower)
    stage_bonus = min(stage_matches * 0.3, 1.5)

    # Análise de requisitos baseada no conteúdo real
    matched_reqs = []
    missing_reqs = []
    strengths = []
    weaknesses = []
    req_bonus = 0.0

    # Extrair informações reais do currículo para análise
    lines = [line.strip() for line in text_content.split('\n') if line.strip()]
    experiences = []
    education = []
    skills = []

    for line in lines:
        if any(keyword in line.lower() for keyword in ["experiência", "trabalhou", "atuou", "cargo", "empresa"]):
            experiences.append(line)
        elif any(keyword in line.lower() for keyword in ["formação", "graduação", "curso", "universidade", "faculdade"]):
            education.append(line)
        elif any(keyword in line.lower() for keyword in ["habilidade", "competência", "conhecimento", "skill"]):
            skills.append(line)

    # Análise baseada em experiências reais encontradas
    if experiences:
        exp_text = ' '.join(experiences).lower()
        if any(word in exp_text for word in ["vendas", "comercial", "cliente", "atendimento"]):
            strengths.append("Possui experiência comprovada em área comercial/vendas baseada no currículo")
            matched_reqs.append("Experiência em vendas/comercial identificada no currículo")
            req_bonus += 1.0
        if any(word in exp_text for word in ["desenvolvimento", "programação", "software", "sistema"]):
            strengths.append("Demonstra experiência em desenvolvimento de software")
            matched_reqs.append("Experiência em desenvolvimento identificada")
            req_bonus += 1.0
        if any(word in exp_text for word in ["gestão", "liderança", "equipe", "coordenação"]):
            strengths.append("Apresenta experiência em gestão e liderança")
            matched_reqs.append("Experiência em gestão identificada")
            req_bonus += 0.8

    # Análise baseada em formação
    if education:
        edu_text = ' '.join(education).lower()
        if any(word in edu_text for word in ["administração", "engenharia", "computação", "sistemas"]):
            strengths.append("Formação acadêmica relevante identificada no currículo")
            req_bonus += 0.5

    # Análise baseada em habilidades
    if skills:
        skills_text = ' '.join(skills).lower()
        if any(word in skills_text for word in ["comunicação", "trabalho em equipe", "liderança"]):
            strengths.append("Habilidades interpessoais identificadas no currículo")
            req_bonus += 0.3

    # Análise específica dos requisitos da etapa baseada no conteúdo real
    for req in requirements:
        req_text = req.get("label", "").lower()
        req_desc = req.get("description", "").lower()
        req_weight = req.get("weight", 1.0)

        # Verificar se o requisito está presente no conteúdo real do currículo
        if req_text in text_lower or req_desc in text_lower:
            matched_reqs.append(f"Requisito atendido: {req.get('label', '')} - {req.get('description', '')}")
            req_bonus += 0.5 * req_weight
        else:
            missing_reqs.append(f"Requisito não atendido: {req.get('label', '')} - {req.get('description', '')}")

    # Se não encontrou pontos fortes específicos, criar baseados no conteúdo geral
    if not strengths and text_content.strip():
        word_count = len(text_content.split())
        if word_count > 100:
            strengths.append("Currículo detalhado com informações abrangentes")
        elif word_count > 50:
            strengths.append("Currículo com informações relevantes")
        else:
            strengths.append("Currículo básico fornecido")

    # Análise de pontos de melhoria baseados na ausência de informações
    if not any(word in text_lower for word in ["experiência", "trabalhou", "atuou"]):
        weaknesses.append("Ausência de informações sobre experiências profissionais")
        missing_reqs.append("Experiência profissional não detalhada no currículo")

    if not any(word in text_lower for word in ["formação", "graduação", "curso"]):
        weaknesses.append("Ausência de informações sobre formação acadêmica")
        missing_reqs.append("Formação acadêmica não informada")

    # Cálculo da pontuação final baseada no conteúdo real
    content_score = min(len(strengths) * 1.5 + req_bonus, 5.0)
    final_score = min(base_score + stage_bonus + content_score, 10.0)

    # Gera análise textual baseada exclusivamente no conteúdo real
    analysis = f"""
    Análise baseada exclusivamente no conteúdo do currículo fornecido:

    ✅ Informações encontradas no currículo:
    - {len(experiences)} menções à experiência profissional
    - {len(education)} menções à formação acadêmica
    - {len(skills)} menções à habilidades/competências
    - {len(matched_reqs)} requisitos da etapa atendidos
    - {stage_matches} palavras-chave da descrição da etapa encontradas

    ⚠️ Lacunas identificadas:
    - {len(missing_reqs)} requisitos da etapa não atendidos
    - Principais pontos de melhoria baseados no conteúdo fornecido

    📊 Pontuação: {final_score:.1f}/10 (baseada na quantidade e qualidade das informações do currículo)
    """

    # Adiciona pontos de melhoria específicos se não houver requisitos específicos
    if not weaknesses:
        if len(text_content) < 200:
            weaknesses.append("Currículo muito conciso - considere adicionar mais detalhes sobre experiências")
        else:
            weaknesses.append("Currículo analisado com sucesso - nenhuma fraqueza crítica identificada")

    return EvaluationResult(
        score=round(final_score, 1),
        analysis=analysis.strip(),
        matched_requirements=matched_reqs,
        missing_requirements=missing_reqs,
        strengths=strengths,
        weaknesses=weaknesses,
        recommendations=["Revisar currículo para próxima análise", "Considerar entrevista técnica"]
    )

# Buscar configurações do usuário - MELHORADA COM VALIDAÇÕES
async def get_user_ai_config(user_id: str) -> AIConfig:
    """
    Busca configurações da IA do usuário com validações robustas.
    Se não houver configuração persistida, utiliza variáveis de ambiente como fallback.
    """
    print(f"[IA] ========== INICIANDO BUSCA DE CONFIGURAÇÕES ==========")
    print(f"[IA] User ID: {user_id}")

    # Variáveis de ambiente como fallback
    env_api_key = os.getenv("OPENAI_API_KEY", "")
    env_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    env_temperature = float(os.getenv("OPENAI_TEMPERATURE", "0.3"))
    env_max_tokens = int(os.getenv("OPENAI_MAX_TOKENS", "2000"))
    require_user_key = os.getenv("AI_REQUIRE_USER_KEY", "false").lower() in ("1", "true", "yes", "y")

    supabase_url = os.getenv("SUPABASE_URL")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    print(f"[IA] ========== VARIÁVEIS DE AMBIENTE ==========")
    print(f"[IA] SUPABASE_URL: {supabase_url}")
    print(f"[IA] SUPABASE_SERVICE_ROLE_KEY: {'CONFIGURADO' if service_role else 'VAZIO'}")
    print(f"[IA] OPENAI_API_KEY ambiente: {env_api_key[:6] + '...' if env_api_key else 'VAZIO'}")
    print(f"[IA] AI_REQUIRE_USER_KEY: {'ON' if require_user_key else 'OFF'}")

    config_source = "none"  # user | env | none

    # Tentar buscar configurações do banco de dados
    if supabase_url and service_role and user_id and user_id != "default":
        print(f"[IA] ========== BUSCANDO CONFIGURAÇÕES NO BANCO ==========")
        print(f"[IA] Fazendo requisição para: {supabase_url}/rest/v1/rpc/get_ai_settings_by_user")

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
                    timeout=15.0,
                )

                print(f"[IA] Status da resposta do banco: {response.status_code}")

                if response.status_code == 200:
                    data = response.json()
                    print(f"[IA] Dados retornados do banco: {len(data) if data else 0} registros")

                    if data and len(data) > 0:
                        record = data[0]
                        print(f"[IA] ========== DADOS DO USUÁRIO ENCONTRADOS ==========")
                        print(f"[IA] Model: {record.get('model', 'NÃO CONFIGURADO')}")
                        print(f"[IA] Temperature: {record.get('temperature', 'NÃO CONFIGURADO')}")
                        print(f"[IA] Max Tokens: {record.get('max_tokens', 'NÃO CONFIGURADO')}")

                        # Processar chave da API
                        api_key_raw = record.get("openai_api_key")
                        print(f"[IA] Chave API raw encontrada: {'SIM' if api_key_raw else 'NÃO'}")

                        if api_key_raw:
                            try:
                                decoded_key = base64.b64decode(api_key_raw).decode('utf-8')
                                print(f"[IA] Chave API decodificada com sucesso: {decoded_key[:6]}...")

                                # Validar se a chave parece válida (não é vazia após decodificar)
                                if decoded_key and decoded_key.strip():
                                    env_api_key = decoded_key.strip()
                                    print(f"[IA] ✅ Chave API válida atribuída do banco de dados")
                                    config_source = "user"
                                else:
                                    print(f"[IA] ❌ Chave API decodificada está vazia")

                            except Exception as decode_error:
                                print(f"[IA] ❌ Erro ao decodificar chave API: {decode_error}")
                                print(f"[IA] Chave raw: {api_key_raw[:50] if api_key_raw else 'VAZIA'}...")
                        else:
                            print(f"[IA] ❌ Chave API não encontrada no registro do usuário")

                        # Aplicar outras configurações se disponíveis
                        if record.get("model"):
                            env_model = record.get("model")
                            print(f"[IA] Modelo atualizado: {env_model}")

                        if record.get("temperature") is not None:
                            env_temperature = float(record.get("temperature"))
                            print(f"[IA] Temperature atualizada: {env_temperature}")

                        if record.get("max_tokens"):
                            env_max_tokens = int(record.get("max_tokens"))
                            print(f"[IA] Max tokens atualizado: {env_max_tokens}")

                    else:
                        print(f"[IA] ❌ Nenhum registro encontrado para o usuário {user_id}")
                        print(f"[IA] ⚠️ Usando configurações de ambiente como fallback")

                elif response.status_code == 404:
                    print(f"[IA] ❌ Função get_ai_settings_by_user não encontrada - verifique se existe no banco")
                else:
                    print(f"[IA] ❌ Erro na resposta do banco: {response.status_code}")
                    print(f"[IA] Resposta: {response.text}")

        except Exception as db_error:
            print(f"[IA] ❌ Falha crítica ao conectar com banco de dados: {db_error}")
            print(f"[IA] ⚠️ Continuando com configurações de ambiente")

    else:
        print(f"[IA] ========== PULANDO BUSCA NO BANCO ==========")
        if not supabase_url:
            print(f"[IA] ❌ SUPABASE_URL não configurada")
        if not service_role:
            print(f"[IA] ❌ SUPABASE_SERVICE_ROLE_KEY não configurada")
        if not user_id or user_id == "default":
            print(f"[IA] ❌ User ID inválido: {user_id}")

    # Aplicar política: exigir chave do usuário quando flag está ON
    if require_user_key and config_source != "user":
        # Desativar uso de OPENAI_API_KEY de ambiente
        env_api_key = ""
        print("[IA] 🔒 AI_REQUIRE_USER_KEY=ON → desativando fallback de OPENAI_API_KEY de ambiente")
        config_source = "none"

    # Validação final da configuração
    print(f"[IA] ========== CONFIGURAÇÃO FINAL ==========")
    print(f"[IA] Modelo: {env_model}")
    print(f"[IA] Temperature: {env_temperature}")
    print(f"[IA] Max Tokens: {env_max_tokens}")
    print(f"[IA] Chave API configurada: {'✅ SIM' if env_api_key and env_api_key.strip() else '❌ NÃO'} (source={config_source})")

    if env_api_key and env_api_key.strip():
        print(f"[IA] Chave API (prefixo): {env_api_key[:6]}...")
    else:
        print(f"[IA] ❌ ATENÇÃO: Chave API não configurada - análise será simulada")

    return AIConfig(
        openai_api_key=env_api_key.strip() if env_api_key else "",
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
        service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        base_url = (
            os.getenv("SUPABASE_URL")
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            or (os.getenv("SUPABASE_STORAGE_URL") or "").replace("/storage/v1", "")
        )

        if not base_url or not service_role:
            print(f"[IA] Aviso: Não foi possível salvar análise {run_id} - variáveis de ambiente não configuradas")
            return
        
        async with httpx.AsyncClient() as client:
            # Atualizar o registro na tabela stage_ai_runs usando WHERE clause
            response = await client.patch(
                f"{base_url}/rest/v1/stage_ai_runs?run_id=eq.{run_id}",
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
