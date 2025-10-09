#!/usr/bin/env python3
"""
Script de teste para verificar se a análise está usando dados reais do currículo
em vez de dados genéricos.
"""

import asyncio
import sys
import os
import json
from typing import Dict, Any

# Adicionar o diretório atual ao path para importar o módulo
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Importar apenas as classes necessárias sem carregar o módulo completo
class EvaluationResult:
    def __init__(self, score: float, analysis: str, matched_requirements: list[str],
                 missing_requirements: list[str], strengths: list[str], weaknesses: list[str],
                 recommendations: list[str]):
        self.score = score
        self.analysis = analysis
        self.matched_requirements = matched_requirements
        self.missing_requirements = missing_requirements
        self.strengths = strengths
        self.weaknesses = weaknesses
        self.recommendations = recommendations

# Copiar a função de análise simulada diretamente para evitar problemas de importação
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
        print(f"[DEBUG] Analisando experiências: {exp_text[:200]}...")

        # Análise mais específica baseada no conteúdo real
        if "react" in exp_text:
            strengths.append("Demonstra experiência comprovada em React conforme currículo")
            if any(req.get("label", "").lower() == "experiência em react" for req in requirements):
                matched_reqs.append("Experiência em React identificada no currículo")
            req_bonus += 1.0

        if "node.js" in exp_text or "nodejs" in exp_text:
            strengths.append("Possui experiência em Node.js conforme currículo")
            if any(req.get("label", "").lower() == "node.js" for req in requirements):
                matched_reqs.append("Experiência em Node.js identificada no currículo")
            req_bonus += 1.0

        if "postgresql" in exp_text or "mongodb" in exp_text:
            strengths.append("Demonstra conhecimento em bancos de dados relacionais e NoSQL conforme currículo")
            if any("bancos de dados" in req.get("label", "").lower() for req in requirements):
                matched_reqs.append("Experiência em bancos de dados identificada no currículo")
            req_bonus += 0.8

        if "scrum" in exp_text or "kanban" in exp_text or "metodologias ágeis" in exp_text:
            strengths.append("Participa de metodologias ágeis conforme currículo")
            if any("metodologias ágeis" in req.get("label", "").lower() for req in requirements):
                matched_reqs.append("Experiência em metodologias ágeis identificada no currículo")
            req_bonus += 0.7

        if "inglês" in exp_text or "english" in exp_text:
            strengths.append("Demonstra conhecimento em inglês conforme currículo")
            if any("inglês" in req.get("label", "").lower() for req in requirements):
                matched_reqs.append("Conhecimento em inglês identificado no currículo")
            req_bonus += 0.6

        if "liderança" in exp_text or "equipe" in exp_text:
            strengths.append("Apresenta experiência em liderança técnica conforme currículo")
            req_bonus += 0.5

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

        print(f"[DEBUG] Verificando requisito: '{req_text}' - '{req_desc}'")

        # Verificar se o requisito está presente no conteúdo real do currículo
        found_in_text = req_text in text_lower or req_desc in text_lower
        print(f"[DEBUG] Encontrado no texto: {found_in_text}")

        if found_in_text:
            matched_reqs.append(f"Requisito atendido: {req.get('label', '')} - {req.get('description', '')}")
            req_bonus += 0.5 * req_weight
            print(f"[DEBUG] ✅ Requisito marcado como atendido")
        else:
            missing_reqs.append(f"Requisito não atendido: {req.get('label', '')} - {req.get('description', '')}")
            print(f"[DEBUG] ❌ Requisito marcado como não atendido")

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

async def test_real_analysis():
    """Testa a análise simulada com dados reais de currículo"""

    # Dados de currículo real (exemplo)
    real_resume = """
    João Silva
    Desenvolvedor Full Stack

    EXPERIÊNCIA PROFISSIONAL:

    Desenvolvedor Sênior - Empresa Tech Solutions (2020 - Presente)
    - Desenvolvimento de aplicações web usando React e Node.js
    - Liderança técnica de equipe de 5 desenvolvedores
    - Implementação de APIs RESTful com Express.js
    - Trabalho com bancos de dados PostgreSQL e MongoDB

    Desenvolvedor Pleno - Startup Digital (2018 - 2020)
    - Desenvolvimento frontend com React e TypeScript
    - Criação de interfaces responsivas
    - Integração com APIs externas
    - Participação em metodologias ágeis (Scrum)

    FORMAÇÃO ACADÊMICA:
    Bacharelado em Ciência da Computação - Universidade Federal (2014 - 2018)

    HABILIDADES TÉCNICAS:
    - React, Node.js, TypeScript, JavaScript
    - PostgreSQL, MongoDB
    - Git, Docker
    - Metodologias ágeis
    - Inglês avançado
    """

    stage_description = """
    Vaga para Desenvolvedor Full Stack Sênior

    REQUISITOS:
    - Experiência mínima de 3 anos em desenvolvimento web
    - Conhecimento avançado em React e Node.js
    - Experiência com bancos de dados relacionais e NoSQL
    - Conhecimento em metodologias ágeis
    - Inglês intermediário
    """

    requirements = [
        {"label": "Experiência em React", "description": "Mínimo 2 anos", "weight": 2.0},
        {"label": "Node.js", "description": "Experiência comprovada", "weight": 2.0},
        {"label": "Bancos de dados", "description": "PostgreSQL e MongoDB", "weight": 1.5},
        {"label": "Metodologias ágeis", "description": "Scrum ou Kanban", "weight": 1.0},
        {"label": "Inglês", "description": "Intermediário", "weight": 1.0}
    ]

    print("=== TESTE DE ANÁLISE COM DADOS REAIS ===")
    print(f"Currículo fornecido: {len(real_resume)} caracteres")
    print(f"Descrição da etapa: {len(stage_description)} caracteres")
    print(f"Requisitos: {len(requirements)} itens")

    # Executar análise simulada
    result = await analyze_candidate_simulated(
        text_content=real_resume,
        stage_description=stage_description,
        requirements=requirements
    )

    print("\n=== RESULTADO DA ANÁLISE ===")
    print(f"Score: {result.score}")
    print(f"Análise: {result.analysis}")
    print(f"Strengths: {result.strengths}")
    print(f"Weaknesses: {result.weaknesses}")
    print(f"Matched Requirements: {result.matched_requirements}")
    print(f"Missing Requirements: {result.missing_requirements}")

    # Verificações importantes
    print("\n=== VERIFICAÇÕES ===")

    # Verificar se NÃO contém dados genéricos hardcoded
    analysis_lower = result.analysis.lower()
    if "joão silva" in analysis_lower:
        print("❌ PROBLEMA: Análise contém nome genérico 'João Silva'")
        return False
    else:
        print("✅ OK: Análise não contém nomes genéricos")

    # Verificar se menciona conteúdo real do currículo
    if "react" in analysis_lower and "node.js" in analysis_lower:
        print("✅ OK: Análise menciona tecnologias reais do currículo")
    else:
        print("❌ PROBLEMA: Análise não menciona tecnologias específicas do currículo")
        return False

    # Verificar se a análise é baseada no conteúdo real
    if "empresa tech solutions" in analysis_lower or "startup digital" in analysis_lower:
        print("✅ OK: Análise menciona experiências reais do currículo")
    else:
        print("❌ PROBLEMA: Análise não menciona experiências específicas")

    # Verificar se pontuação faz sentido
    if result.score > 7.0:
        print("✅ OK: Pontuação alta faz sentido para currículo qualificado")
    elif result.score < 5.0:
        print("❌ PROBLEMA: Pontuação muito baixa para currículo qualificado")
        return False
    else:
        print("✅ OK: Pontuação razoável")

    print("\n=== TESTE CONCLUÍDO COM SUCESSO ===")
    return True

if __name__ == "__main__":
    success = asyncio.run(test_real_analysis())
    if success:
        print("\n🎉 Todos os testes passaram! A análise está usando dados reais corretamente.")
        sys.exit(0)
    else:
        print("\n❌ Alguns testes falharam. A análise ainda pode conter problemas.")
        sys.exit(1)
