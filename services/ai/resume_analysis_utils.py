from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

STRENGTH_TARGET = 4
WEAKNESS_TARGET = 3
MATCHED_TARGET = 3
WORD_PATTERN = re.compile(r"\b\w+\b", flags=re.UNICODE)


def prepare_structured_analysis(
    text_content: str,
    stage_description: str,
    requirements: Optional[List[Dict[str, Any]]] = None,
    raw_strengths: Optional[List[str]] = None,
    raw_weaknesses: Optional[List[str]] = None,
    raw_matched: Optional[List[str]] = None,
    raw_missing: Optional[List[str]] = None,
    raw_score: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Constrói uma análise estruturada seguindo o formato exigido.
    """

    requirements_list = requirements or []
    heuristics = _collect_resume_signals(text_content, stage_description, requirements_list)
    stage_focus = heuristics["stage_focus"]

    strengths = _ensure_exact_count(
        _merge_lists(raw_strengths, heuristics["strength_candidates"]),
        STRENGTH_TARGET,
        lambda idx: _strength_placeholder(idx, stage_focus),
    )

    weaknesses = _ensure_exact_count(
        _merge_lists(raw_weaknesses, heuristics["weakness_candidates"]),
        WEAKNESS_TARGET,
        lambda idx: _weakness_placeholder(idx, stage_focus),
    )

    matched_requirements = _ensure_exact_count(
        _merge_lists(raw_matched, heuristics["matched_candidates"]),
        MATCHED_TARGET,
        lambda idx: _matched_placeholder(idx, stage_focus),
    )

    missing_requirements = _merge_lists(raw_missing, heuristics["missing_candidates"])
    if not missing_requirements:
        missing_requirements = ["Nenhum requisito pendente identificado."]

    heuristic_score = heuristics["score"]
    score = heuristic_score
    if raw_score is not None:
        try:
            raw_value = float(raw_score)
            raw_value = max(0.0, min(10.0, raw_value))
            if heuristic_score > 0:
                score = round((raw_value * 0.7) + (heuristic_score * 0.3), 1)
            else:
                score = raw_value
        except (TypeError, ValueError):
            score = heuristic_score

    if not heuristics["has_resume"]:
        score = 0.0

    analysis = _build_analysis_text(
        stage_description=stage_description,
        score=score,
        strengths=strengths,
        weaknesses=weaknesses,
        matched=matched_requirements,
        missing=missing_requirements,
    )

    return {
        "score": score,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "matched_requirements": matched_requirements,
        "missing_requirements": missing_requirements,
        "analysis": analysis,
    }


def _collect_resume_signals(
    text_content: str,
    stage_description: str,
    requirements: List[Dict[str, Any]],
) -> Dict[str, Any]:
    resume_text = text_content or ""
    resume_clean = resume_text.strip()
    resume_lower = resume_text.lower()
    tokens = _tokenize(resume_text)
    word_count = len(tokens)

    stage_keywords = _stage_keywords(stage_description)
    stage_matches = [kw for kw in stage_keywords if kw in resume_lower]
    stage_ratio = (len(stage_matches) / len(stage_keywords)) if stage_keywords else 0.0

    matched_entries: List[Dict[str, Any]] = []
    missing_entries: List[Dict[str, Any]] = []

    for raw_req in requirements:
        req = raw_req or {}
        label = (req.get("label") or "Requisito da etapa").strip()
        description = (req.get("description") or "").strip()
        weight = float(req.get("weight") or 1.0)

        req_tokens = [tok for tok in _tokenize(f"{label} {description}") if len(tok) > 3]
        has_match = any(token in resume_lower for token in req_tokens)
        if not has_match and label:
            label_token = label.lower()
            if len(label_token) <= 3:
                padded = f" {resume_lower} "
                has_match = f" {label_token} " in padded
            else:
                has_match = label_token in resume_lower

        entry = {"label": label, "description": description, "weight": weight}
        if has_match:
            matched_entries.append(entry)
        else:
            missing_entries.append(entry)

    coverage_ratio = (
        len(matched_entries) / len(requirements)
        if requirements
        else (stage_ratio if stage_keywords else 0.0)
    )
    info_ratio = min(1.0, word_count / 400) if resume_clean else 0.0

    score_components = (0.45 * coverage_ratio) + (0.35 * stage_ratio) + (0.2 * info_ratio)
    heuristic_score = round(max(0.0, min(10.0, score_components * 10)), 1)

    strength_candidates: List[str] = []
    weakness_candidates: List[str] = []
    matched_candidates: List[str] = []
    missing_candidates: List[str] = []

    for entry in sorted(matched_entries, key=lambda item: item["weight"], reverse=True):
        _append_unique(
            strength_candidates,
            f"Cumpre o requisito '{entry['label']}' evidenciado no currículo.",
        )
        _append_unique(
            matched_candidates,
            f"{entry['label']}: requisito confirmado pelas informações do currículo.",
        )

    for entry in missing_entries:
        statement = f"O currículo não evidencia '{entry['label']}' conforme solicitado."
        _append_unique(weakness_candidates, statement)
        _append_unique(
            missing_candidates,
            f"{entry['label']}: não identificado no currículo.",
        )

    if stage_matches:
        sample = ", ".join(stage_matches[:3])
        _append_unique(
            strength_candidates,
            f"Currículo menciona termos-chave da etapa, como {sample}.",
        )
    else:
        if stage_keywords:
            _append_unique(
                weakness_candidates,
                "Não há menções diretas aos temas descritos pelo RH para esta etapa.",
            )

    if word_count >= 200:
        _append_unique(
            strength_candidates,
            "Documento apresenta detalhamento consistente das experiências profissionais.",
        )
    elif resume_clean:
        _append_unique(
            strength_candidates,
            "Currículo fornece informações suficientes para contextualizar as experiências do candidato.",
        )

    if word_count < 120 and resume_clean:
        _append_unique(
            weakness_candidates,
            "Currículo apresenta poucas informações, limitando a validação completa dos requisitos.",
        )

    if "ingl" in stage_description.lower() and "ingl" not in resume_lower:
        _append_unique(
            weakness_candidates,
            "Requisito de idioma citado na etapa não foi comprovado no currículo.",
        )

    if not matched_candidates and stage_matches:
        keyword = stage_matches[0]
        _append_unique(
            matched_candidates,
            f"Cita experiências relacionadas a '{keyword}', alinhando-se à descrição da etapa.",
        )

    if not missing_candidates and requirements:
        _append_unique(missing_candidates, "Todos os requisitos informados foram mapeados no currículo.")

    return {
        "score": heuristic_score if resume_clean else 0.0,
        "has_resume": bool(resume_clean),
        "strength_candidates": strength_candidates,
        "weakness_candidates": weakness_candidates,
        "matched_candidates": matched_candidates,
        "missing_candidates": missing_candidates,
        "stage_focus": _summarize_stage_description(stage_description),
    }


def _tokenize(text: str) -> List[str]:
    return WORD_PATTERN.findall(text.lower())


def _stage_keywords(stage_description: str) -> List[str]:
    tokens = [token for token in _tokenize(stage_description) if len(token) > 4]
    seen = set()
    ordered_tokens: List[str] = []
    for token in tokens:
        if token not in seen:
            seen.add(token)
            ordered_tokens.append(token)
    return ordered_tokens


def _merge_lists(primary: Optional[List[str]], fallback: List[str]) -> List[str]:
    merged: List[str] = []
    for source in (primary or [], fallback):
        if isinstance(source, list):
            for item in source:
                cleaned = (item or "").strip()
                if cleaned and cleaned not in merged:
                    merged.append(cleaned)
    return merged


def _ensure_exact_count(
    items: List[str],
    required_size: int,
    placeholder_factory,
) -> List[str]:
    trimmed = [item for item in items if item]
    if len(trimmed) >= required_size:
        return trimmed[:required_size]

    padded = trimmed[:]
    while len(padded) < required_size:
        padded.append(placeholder_factory(len(padded)))
    return padded


def _strength_placeholder(idx: int, stage_focus: str) -> str:
    return (
        f"Não há informação suficiente para definir o ponto forte {idx + 1}; "
        f"inclua conquistas ligadas a {stage_focus.lower()}."
    )


def _weakness_placeholder(idx: int, stage_focus: str) -> str:
    return (
        f"Oportunidade de melhoria {idx + 1} não pôde ser detalhada; "
        f"explore lacunas relacionadas a {stage_focus.lower()}."
    )


def _matched_placeholder(idx: int, stage_focus: str) -> str:
    return (
        f"Não foi possível confirmar outro requisito atendido; descreva evidências práticas "
        f"ligadas a {stage_focus.lower()}."
    )


def _build_analysis_text(
    stage_description: str,
    score: float,
    strengths: List[str],
    weaknesses: List[str],
    matched: List[str],
    missing: List[str],
) -> str:
    stage_text = re.sub(r"\s+", " ", stage_description or "").strip()
    if not stage_text:
        stage_text = "Descrição da etapa não informada."

    lines: List[str] = [
        "Análise estruturada da etapa:",
        f"Descrição considerada: {stage_text}",
        f"Pontuação de aderência: {score:.1f}/10",
        "",
        f"Pontos fortes identificados ({STRENGTH_TARGET}):",
    ]
    lines.extend(f"- {item}" for item in strengths)
    lines.append("")
    lines.append(f"Oportunidades de melhoria ({WEAKNESS_TARGET}):")
    lines.extend(f"- {item}" for item in weaknesses)
    lines.append("")
    lines.append(f"Requisitos atendidos prioritários ({MATCHED_TARGET}):")
    lines.extend(f"- {item}" for item in matched)
    lines.append("")
    lines.append("Requisitos pendentes:")
    lines.extend(f"- {item}" for item in missing)

    return "\n".join(lines).strip()


def _summarize_stage_description(stage_description: str) -> str:
    summary = re.sub(r"\s+", " ", stage_description or "").strip()
    if not summary:
        return "esta etapa"
    if len(summary) <= 140:
        return summary
    truncated = summary[:140].rsplit(" ", 1)[0]
    return f"{truncated}..."


def _append_unique(container: List[str], text: str) -> None:
    cleaned = text.strip()
    if cleaned and cleaned not in container:
        container.append(cleaned)

