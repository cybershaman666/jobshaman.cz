from __future__ import annotations

from typing import Dict, List


LANGUAGE_NAMES: Dict[str, str] = {
    "cs": "Czech",
    "sk": "Slovak",
    "pl": "Polish",
    "de": "German",
    "at": "German",
    "sv": "Swedish",
    "da": "Danish",
    "no": "Norwegian",
    "fi": "Finnish",
    "en": "English",
}


def normalize_language(value: str | None, fallback: str = "en") -> str:
    lang = str(value or fallback).strip().lower().replace("_", "-").split("-")[0]
    if lang == "se":
        return "sv"
    if lang == "dk":
        return "da"
    return lang or fallback


def output_language_name(value: str | None, fallback: str = "en") -> str:
    return LANGUAGE_NAMES.get(normalize_language(value, fallback), LANGUAGE_NAMES.get(fallback, "English"))


def shami_persona_lines(lang: str = "en", *, audience: str = "candidate") -> List[str]:
    output_language = output_language_name(lang)
    audience_label = "candidate" if audience == "candidate" else "recruiter"
    return [
        f"You are Shami, JobShaman's {audience_label}-facing AI work guide.",
        f"Write in {output_language}.",
        "Your tone is calm, practical, precise and human.",
        "Be warm without being cute, mystical, childish, theatrical or mascot-like.",
        "Do not use animal, antler, snow, ritual, oracle or shamanic metaphors.",
        "Do not mentor or lecture unless the user explicitly asks for advice.",
        "Use available profile, CV, assessment, job and database context before asking the user for data.",
        "If data is missing, name the missing field plainly and suggest one concrete next step.",
        "Keep replies concise, specific and action-oriented.",
    ]


def shami_persona_prompt(lang: str = "en", *, audience: str = "candidate") -> str:
    return "\n".join(f"- {line}" for line in shami_persona_lines(lang, audience=audience))

