from typing import Dict, Any, List, Optional
import json

TRANSCRIPT_ANALYSIS_PROMPT_TEMPLATE = """
Você é um especialista em Recrutamento e Seleção.
Tarefa: Analisar a seguinte transcrição de entrevista para a vaga descrita.

[CONTEXTO]
Descrição da Vaga/Etapa: {stage_description}
Requisitos: {requirements}

[TRANSCRIÇÃO]
{transcript_text}

[INSTRUÇÕES]
1. Identifique os falantes. O candidato é aquele que responde às perguntas sobre si mesmo.
2. Ignore falas dos entrevistadores para fins de avaliação de competência.
3. Para cada Requisito:
   - O candidato demonstrou explicitamente? (Sim/Não/Parcial)
   - Cite a evidência (fala exata).
4. Gere uma nota final (0-10) baseada na cobertura dos requisitos.
5. NÃO ALUCINE. Se não foi dito, não assuma.

[SAÍDA JSON]
{{
  "score": float,
  "summary": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "requirements_analysis": [
    {{ "name": "req1", "status": "met", "evidence": "..." }}
  ],
  "matched_requirements": ["string"],
  "missing_requirements": ["string"]
}}
"""

def prepare_transcript_prompt(transcript_text: str, stage_description: str, requirements: List[Dict[str, Any]]) -> str:
    requirements_str = "\n".join([f"- {req.get('label', '')}: {req.get('description', '')}" for req in requirements])
    return TRANSCRIPT_ANALYSIS_PROMPT_TEMPLATE.format(
        stage_description=stage_description,
        requirements=requirements_str,
        transcript_text=transcript_text
    )

async def analyze_transcript_content(transcript_text: str, stage_description: str, requirements: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Simula ou executa a análise de transcrição.
    No futuro, esta função chamará o cliente OpenAI com o prompt gerado acima.
    """
    import asyncio
    
    # Simulando processamento
    await asyncio.sleep(2)
    
    # Prompt preparado (seria usado na chamada real)
    prompt = prepare_transcript_prompt(transcript_text, stage_description, requirements)
    # print(f"DEBUG Prompt:\n{prompt}")
    
    # Retorno simulado seguindo a estrutura do prompt
    return {
        "score": 7.5,
        "analysis": "Com base na transcrição fornecida, o candidato demonstra competências alinhadas à vaga.",
        "strengths": [
            "Comunicação clara e articulada evidenciada nas respostas longas",
            "Citou experiências anteriores relevantes ao contexto da vaga"
        ],
        "weaknesses": [
            "Não aprofundou detalhes técnicos em algumas respostas",
            "Algumas respostas foram vagas quanto a métricas de resultados"
        ],
        "matched_requirements": [
            "Experiência na área (mencionado na introdução)",
            "Trabalho em equipe (citado exemplo de projeto X)"
        ],
        "missing_requirements": [
            "Inglês fluente (não mencionado na transcrição)",
            "Certificação específica (não abordada)"
        ],
        "requirements_analysis": [
             { "name": "Experiência", "status": "met", "evidence": "Eu trabalhei 5 anos na empresa X..." }
        ]
    }

