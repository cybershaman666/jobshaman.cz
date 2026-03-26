from __future__ import annotations

import re
import unicodedata
from typing import Any

from ..ai_orchestration.client import AIClientError, _extract_json, call_primary_with_fallback, get_default_fallback_model, get_default_primary_model
from ..matching_engine.role_taxonomy import DOMAIN_KEYWORDS, ROLE_FAMILY_KEYWORDS
from .job_intelligence import map_job_to_intelligence

_SECTION_IDS = (
    "problem_understanding",
    "first_move",
    "approach_tradeoffs",
    "needs_to_know",
    "thinking_notes",
)


def _normalize_locale(value: Any, fallback: str = "en") -> str:
    code = str(value or fallback).split("-")[0].strip().lower()
    if code == "at":
        return "de"
    return code if code in {"cs", "sk", "de", "pl", "en"} else fallback


def _normalize_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r"[^a-z0-9\s/+.#-]+", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _clip(value: Any, limit: int = 220) -> str:
    normalized = str(value or "").replace("\n", " ").strip()
    if len(normalized) <= limit:
        return normalized
    return f"{normalized[: limit - 1].rstrip()}…"


def _safe_list(values: Any, limit: int = 8) -> list[str]:
    if not isinstance(values, list):
        return []
    out: list[str] = []
    seen: set[str] = set()
    for item in values:
        text = _clip(item, 80)
        normalized = _normalize_text(text)
        if not text or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(text)
        if len(out) >= limit:
            break
    return out


_COPY = {
    "cs": {
        "kicker": "Signal Boost",
        "timebox": "15 až 20 minut",
        "note": "Nejde o dokonalé řešení. Jde o to, jak přemýšlíte, co upřednostníte a co si potřebujete ověřit.",
        "anti_generic": "Pište konkrétně, z první ruky a klidně ne dokonale. Lepší je jeden skutečný první krok než uhlazený obecný text.",
        "cta_hint": "Po dokončení dostanete veřejný JobShaman link, který můžete poslat spolu s klasickou přihláškou.",
        "constraints": [
            "Pojmenujte jeden první krok.",
            "Uveďte jednu prioritu a jeden trade-off.",
            "Doplňte, co byste si ještě potřebovali ověřit.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "Jak chápu problém",
                "hint": "Co je podle vás skutečné jádro situace a proč na něm záleží.",
            },
            "first_move": {
                "title": "Co bych udělal(a) jako první",
                "hint": "První krok, první ověření, první rozhodnutí.",
            },
            "approach_tradeoffs": {
                "title": "Můj přístup a trade-offy",
                "hint": "Co byste upřednostnili, co byste naopak zatím nedělali a proč.",
            },
            "needs_to_know": {
                "title": "Co bych ještě potřeboval(a) vědět",
                "hint": "Jaké nejasnosti nebo otevřené otázky byste si chtěli ověřit.",
            },
            "thinking_notes": {
                "title": "Rychlé poznámky k uvažování",
                "hint": "Volitelné. Krátké pracovní poznámky nebo záchytné body.",
            },
        },
        "nudges": {
            "too_short": "Ještě trochu přidejte. Potřebujeme vidět váš skutečný první tah, ne jen krátkou deklaraci.",
            "first_move": "Chybí konkrétní první krok. Zkuste pojmenovat, co byste udělali hned jako první.",
            "tradeoff": "Chybí trade-off nebo priorita. Co byste teď upřednostnili a co byste zatím nedělali?",
            "unknowns": "Doplňte, co byste si ještě potřebovali ověřit. Právě to dodává odpovědi autenticitu.",
            "generic": "Zkuste to napsat konkrétněji a víc po svém. Méně obecné fráze, víc vlastní perspektivy.",
        },
        "summary_labels": {
            "structure": "Struktura",
            "prioritization": "Prioritizace",
            "clarity": "Srozumitelnost",
            "depth": "Hloubka",
        },
    },
    "sk": {
        "kicker": "Signal Boost",
        "timebox": "15 až 20 minút",
        "note": "Nejde o dokonalé riešenie. Ide o to, ako premýšľate, čo uprednostníte a čo si potrebujete overiť.",
        "anti_generic": "Píšte konkrétne, z prvej ruky a pokojne ne dokonale. Lepší je jeden skutočný prvý krok než uhladený všeobecný text.",
        "cta_hint": "Po dokončení dostanete verejný JobShaman link, ktorý môžete poslať spolu s klasickou prihláškou.",
        "constraints": [
            "Pomenujte jeden prvý krok.",
            "Uveďte jednu prioritu a jeden trade-off.",
            "Doplňte, čo by ste si ešte potrebovali overiť.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "Ako chápem problém",
                "hint": "Čo je podľa vás skutočné jadro situácie a prečo na ňom záleží.",
            },
            "first_move": {
                "title": "Čo by som urobil(a) ako prvé",
                "hint": "Prvý krok, prvé overenie, prvé rozhodnutie.",
            },
            "approach_tradeoffs": {
                "title": "Môj prístup a trade-offy",
                "hint": "Čo by ste uprednostnili, čo by ste naopak zatiaľ nerobili a prečo.",
            },
            "needs_to_know": {
                "title": "Čo by som ešte potreboval(a) vedieť",
                "hint": "Aké nejasnosti alebo otvorené otázky by ste si chceli overiť.",
            },
            "thinking_notes": {
                "title": "Rýchle poznámky k uvažovaniu",
                "hint": "Voliteľné. Krátke pracovné poznámky alebo záchytné body.",
            },
        },
        "nudges": {
            "too_short": "Ešte trochu pridajte. Potrebujeme vidieť váš skutočný prvý ťah, nielen krátke vyhlásenie.",
            "first_move": "Chýba konkrétny prvý krok. Skúste pomenovať, čo by ste urobili hneď ako prvé.",
            "tradeoff": "Chýba trade-off alebo priorita. Čo by ste teraz uprednostnili a čo by ste zatiaľ nerobili?",
            "unknowns": "Doplňte, čo by ste si ešte potrebovali overiť. Práve to dodáva odpovedi autenticitu.",
            "generic": "Skúste to napísať konkrétnejšie a viac po svojom. Menej všeobecných fráz, viac vlastnej perspektívy.",
        },
        "summary_labels": {
            "structure": "Štruktúra",
            "prioritization": "Prioritizácia",
            "clarity": "Jasnosť",
            "depth": "Hĺbka",
        },
    },
    "de": {
        "kicker": "Signal Boost",
        "timebox": "15 bis 20 Minuten",
        "note": "Es geht nicht um die perfekte Lösung. Es geht darum, wie Sie denken, was Sie priorisieren und was Sie noch klären müssten.",
        "anti_generic": "Schreiben Sie konkret und aus Ihrer eigenen Perspektive. Ein echter erster Schritt ist stärker als glatte Allgemeinplätze.",
        "cta_hint": "Nach dem Abschluss erhalten Sie einen öffentlichen JobShaman-Link, den Sie zusammen mit Ihrer normalen Bewerbung senden können.",
        "constraints": [
            "Benennen Sie einen ersten konkreten Schritt.",
            "Nennen Sie eine Priorität und einen Trade-off.",
            "Ergänzen Sie, was Sie noch klären müssten.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "So verstehe ich das Problem",
                "hint": "Was aus Ihrer Sicht der eigentliche Kern ist und warum er relevant ist.",
            },
            "first_move": {
                "title": "Was ich zuerst tun würde",
                "hint": "Erster Schritt, erster Check, erste Entscheidung.",
            },
            "approach_tradeoffs": {
                "title": "Mein Vorgehen und die Trade-offs",
                "hint": "Was Sie priorisieren würden, was Sie bewusst noch nicht tun würden und warum.",
            },
            "needs_to_know": {
                "title": "Was ich noch wissen müsste",
                "hint": "Welche offenen Fragen oder Unsicherheiten Sie zuerst klären würden.",
            },
            "thinking_notes": {
                "title": "Kurze Denknotizen",
                "hint": "Optional. Kurze Gedanken, Notizen oder Abwägungen.",
            },
        },
        "nudges": {
            "too_short": "Geben Sie noch etwas mehr Kontext. Sichtbar werden soll Ihr echter erster Zug, nicht nur ein kurzer Claim.",
            "first_move": "Der konkrete erste Schritt fehlt noch. Was würden Sie als Erstes tatsächlich tun?",
            "tradeoff": "Es fehlt noch ein Trade-off oder eine Priorität. Was würden Sie zuerst optimieren und was bewusst verschieben?",
            "unknowns": "Ergänzen Sie, was Sie noch wissen müssten. Genau das macht die Antwort glaubwürdig.",
            "generic": "Bitte etwas konkreter und persönlicher formulieren. Weniger Floskeln, mehr echte Perspektive.",
        },
        "summary_labels": {
            "structure": "Struktur",
            "prioritization": "Priorisierung",
            "clarity": "Klarheit",
            "depth": "Tiefe",
        },
    },
    "pl": {
        "kicker": "Signal Boost",
        "timebox": "15 do 20 minut",
        "note": "Nie chodzi o idealne rozwiązanie. Chodzi o to, jak myślisz, co priorytetyzujesz i co jeszcze musisz sprawdzić.",
        "anti_generic": "Pisz konkretnie i po swojemu. Jeden prawdziwy pierwszy ruch jest mocniejszy niż gładki ogólnik.",
        "cta_hint": "Po zakończeniu dostaniesz publiczny link JobShaman, który możesz wysłać razem ze zwykłym zgłoszeniem.",
        "constraints": [
            "Nazwij jeden konkretny pierwszy krok.",
            "Wskaż jeden priorytet i jeden trade-off.",
            "Dopisz, co jeszcze musisz sprawdzić.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "Jak rozumiem problem",
                "hint": "Co jest prawdziwym rdzeniem sytuacji i dlaczego ma znaczenie.",
            },
            "first_move": {
                "title": "Co zrobiłbym / zrobiłabym najpierw",
                "hint": "Pierwszy ruch, pierwszy check, pierwsza decyzja.",
            },
            "approach_tradeoffs": {
                "title": "Moje podejście i trade-offy",
                "hint": "Co byś priorytetyzował(a), czego na razie byś nie robił(a) i dlaczego.",
            },
            "needs_to_know": {
                "title": "Co jeszcze musiałbym / musiałabym wiedzieć",
                "hint": "Jakie pytania lub niejasności najpierw byś doprecyzował(a).",
            },
            "thinking_notes": {
                "title": "Szybkie notatki myślowe",
                "hint": "Opcjonalnie. Krótkie notatki, tok myślenia lub szkic.",
            },
        },
        "nudges": {
            "too_short": "Dodaj jeszcze trochę treści. Chcemy zobaczyć Twój prawdziwy pierwszy ruch, nie tylko krótki slogan.",
            "first_move": "Brakuje konkretnego pierwszego kroku. Co zrobił(a)byś naprawdę jako pierwsze?",
            "tradeoff": "Brakuje trade-offu albo priorytetu. Co optymalizujesz najpierw, a co odkładasz na później?",
            "unknowns": "Dopisz, co jeszcze musisz sprawdzić. To właśnie dodaje odpowiedzi autentyczności.",
            "generic": "Spróbuj napisać to bardziej konkretnie i po swojemu. Mniej ogólników, więcej własnej perspektywy.",
        },
        "summary_labels": {
            "structure": "Struktura",
            "prioritization": "Priorytetyzacja",
            "clarity": "Jasność",
            "depth": "Głębia",
        },
    },
    "en": {
        "kicker": "Signal Boost",
        "timebox": "15 to 20 minutes",
        "note": "This is not about a perfect solution. It is about how you think, what you prioritize, and what you would still need to clarify.",
        "anti_generic": "Write concretely and from your own perspective. One real first move is stronger than polished generic language.",
        "cta_hint": "When you finish, you will get a public JobShaman link you can send with your normal application.",
        "constraints": [
            "Name one concrete first move.",
            "Include one priority and one trade-off.",
            "Add what you would still need to know.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "How I understand the problem",
                "hint": "What you think the real core of the situation is and why it matters.",
            },
            "first_move": {
                "title": "What I would do first",
                "hint": "First move, first check, first decision.",
            },
            "approach_tradeoffs": {
                "title": "My approach and trade-offs",
                "hint": "What you would prioritize, what you would deliberately not do yet, and why.",
            },
            "needs_to_know": {
                "title": "What I would still need to know",
                "hint": "What questions or uncertainties you would want to clarify first.",
            },
            "thinking_notes": {
                "title": "Quick thinking notes",
                "hint": "Optional. Short notes, reasoning fragments, or working assumptions.",
            },
        },
        "nudges": {
            "too_short": "Add a bit more. We want to see your real first move, not just a short claim.",
            "first_move": "The concrete first move is still missing. What would you actually do first?",
            "tradeoff": "A trade-off or priority is still missing. What would you optimize first, and what would you deliberately delay?",
            "unknowns": "Add what you would still need to know. That is what makes the answer feel grounded.",
            "generic": "Try making this more concrete and more yours. Less generic phrasing, more real perspective.",
        },
        "summary_labels": {
            "structure": "Structure",
            "prioritization": "Prioritization",
            "clarity": "Clarity",
            "depth": "Depth",
        },
    },
}


_ROLE_TEMPLATE_COPY = {
    "customer_support": {
        "cs": {
            "title": "Jak byste uklidnili situaci a posunuli ji dopředu",
            "context": "Představte si první reálný kontakt s člověkem, který je frustrovaný, má neúplná data a potřebuje rychlou orientaci.",
            "problem": "Ukažte, jak byste situaci strukturovali, co byste ověřili jako první a jak byste vyvážili rychlost, přesnost a klid v komunikaci.",
        },
        "en": {
            "title": "How you would calm the situation and move it forward",
            "context": "Imagine a first real interaction with a frustrated person who has incomplete data and needs quick orientation.",
            "problem": "Show how you would structure the situation, what you would check first, and how you would balance speed, accuracy, and calm communication.",
        },
    },
    "customer_success": {
        "cs": {
            "title": "Jak byste vedli klienta k výsledku, ne jen k reakci",
            "context": "Představte si zákazníka, který je aktivní, ale není si jistý, jestli z produktu opravdu dostává hodnotu.",
            "problem": "Popište, co byste udělali nejdřív, jak byste nastavili další krok a jak byste rozlišili mezi rychlou pomocí a dlouhodobým dopadem.",
        },
        "en": {
            "title": "How you would move the customer toward an outcome, not just a reply",
            "context": "Imagine an active customer who is not sure whether they are really getting value from the product.",
            "problem": "Describe what you would do first, how you would set the next step, and how you would separate quick help from long-term impact.",
        },
    },
    "operations": {
        "cs": {
            "title": "Jak byste snížili tření v rozběhnutém provozu",
            "context": "Představte si provoz, ve kterém vznikají zpoždění, přetížení nebo ruční improvizace, ale nikdo nemá čas to celé přestavět.",
            "problem": "Popište, jak byste našli nejdůležitější úzké místo, co byste řešili jako první a jaký trade-off byste si hlídali mezi rychlostí a stabilitou.",
        },
        "en": {
            "title": "How you would reduce friction in a moving operation",
            "context": "Imagine an operation with delays, overload, or manual workarounds, but no appetite for a full rebuild.",
            "problem": "Show how you would find the main bottleneck, what you would address first, and which trade-off you would watch between speed and stability.",
        },
    },
    "product_management": {
        "cs": {
            "title": "Jak byste navrhli první užitečný produktový krok",
            "context": "Představte si uživatele, který se zasekne brzy po vstupu a sám přesně neví, co vlastně potřebuje.",
            "problem": "Popište, jak byste uchopili problém, co byste si ověřili jako první a jak byste rozhodli mezi rychlým experimentem a hlubším objevováním potřeb.",
        },
        "en": {
            "title": "How you would design the first useful product move",
            "context": "Imagine a user who drops off early and does not fully know what they need yet.",
            "problem": "Show how you would frame the problem, what you would validate first, and how you would choose between a quick experiment and deeper discovery.",
        },
    },
    "hr_people": {
        "cs": {
            "title": "Jak byste zlepšili moment, kde se lidé ztrácejí",
            "context": "Představte si týmový proces, kde vzniká zmatek, tiché tření nebo nejasné předání odpovědnosti.",
            "problem": "Ukažte, jak byste problém četli, s kým byste začali mluvit a co byste změnili nejdřív, aniž byste zbytečně rozbili fungující části systému.",
        },
        "en": {
            "title": "How you would improve the moment where people start losing clarity",
            "context": "Imagine a team process where confusion, quiet friction, or unclear ownership starts appearing.",
            "problem": "Show how you would read the issue, who you would talk to first, and what you would change first without disrupting what already works.",
        },
    },
}


def _copy(locale: str) -> dict[str, Any]:
    normalized = _normalize_locale(locale)
    return _COPY.get(normalized) or _COPY["en"]


def _localized_text(mapping: dict[str, dict[str, str]], key: str, locale: str) -> dict[str, str]:
    normalized = _normalize_locale(locale)
    if key in mapping:
        return mapping[key].get(normalized) and mapping[key] or mapping[key]
    return {}


def _default_generic_template(job_row: dict[str, Any], locale: str) -> dict[str, str]:
    language = _normalize_locale(locale)
    title = str(job_row.get("title") or "the role").strip() or "the role"
    company = str(job_row.get("company") or "the company").strip() or "the company"
    location = _clip(job_row.get("location"), 120)
    context_text = _clip(job_row.get("role_summary") or job_row.get("first_reply_prompt") or job_row.get("description"), 260)
    if language == "cs":
        return {
            "title": f"Jak byste rozběhli roli {title}",
            "context": f"Představte si, že vstupujete do role {title} ve firmě {company}{f' v kontextu {location}' if location else ''}.",
            "problem": f"Popište první užitečný krok, první prioritu a největší trade-off, který byste si v této situaci hlídali.{f' Kontext: {context_text}' if context_text else ''}",
        }
    if language == "sk":
        return {
            "title": f"Ako by ste rozbehli rolu {title}",
            "context": f"Predstavte si, že vstupujete do roly {title} vo firme {company}{f' v kontexte {location}' if location else ''}.",
            "problem": f"Popíšte prvý užitočný krok, prvú prioritu a najväčší trade-off, ktorý by ste si v tejto situácii strážili.{f' Kontext: {context_text}' if context_text else ''}",
        }
    if language == "de":
        return {
            "title": f"Wie Sie die Rolle {title} in Bewegung bringen würden",
            "context": f"Stellen Sie sich vor, Sie starten in der Rolle {title} bei {company}{f' im Kontext {location}' if location else ''}.",
            "problem": f"Beschreiben Sie den ersten sinnvollen Schritt, die erste Priorität und den wichtigsten Trade-off, auf den Sie achten würden.{f' Kontext: {context_text}' if context_text else ''}",
        }
    if language == "pl":
        return {
            "title": f"Jak uruchomił(a)byś rolę {title}",
            "context": f"Wyobraź sobie, że wchodzisz w rolę {title} w firmie {company}{f' w kontekście {location}' if location else ''}.",
            "problem": f"Opisz pierwszy sensowny krok, pierwszy priorytet i najważniejszy trade-off, którego byś pilnował(a).{f' Kontekst: {context_text}' if context_text else ''}",
        }
    return {
        "title": f"How you would get the {title} role moving",
        "context": f"Imagine stepping into the {title} role at {company}{f' in the context of {location}' if location else ''}.",
        "problem": f"Describe the first useful move, the first priority, and the biggest trade-off you would watch in this situation.{f' Context: {context_text}' if context_text else ''}",
    }


def _resolve_template(job_row: dict[str, Any], locale: str) -> dict[str, str]:
    intelligence = map_job_to_intelligence(
        {
            "id": job_row.get("id") or "",
            "title": job_row.get("title") or "",
            "description": job_row.get("description") or "",
            "country_code": job_row.get("country_code") or "",
            "language_code": job_row.get("language_code") or locale,
            "work_model": job_row.get("work_model") or "",
            "work_type": job_row.get("work_type") or "",
            "tags": job_row.get("tags") or [],
        }
    )
    family = str(intelligence.get("role_family") or "").strip().lower()
    domain_key = str(intelligence.get("domain_key") or "").strip().lower()
    normalized_locale = _normalize_locale(locale)
    template_key = family if family in _ROLE_TEMPLATE_COPY else domain_key if domain_key in _ROLE_TEMPLATE_COPY else ""
    if template_key:
        localized = _ROLE_TEMPLATE_COPY[template_key].get(normalized_locale) or _ROLE_TEMPLATE_COPY[template_key].get("en")
        if localized:
            return {
                **localized,
                "role_family": family or None,
                "domain_key": domain_key or None,
                "canonical_role": intelligence.get("canonical_role"),
            }
    generic = _default_generic_template(job_row, normalized_locale)
    generic["role_family"] = family or None
    generic["domain_key"] = domain_key or None
    generic["canonical_role"] = intelligence.get("canonical_role")
    return generic


def _build_sections(locale: str) -> list[dict[str, Any]]:
    copy = _copy(locale)
    sections: list[dict[str, Any]] = []
    for section_id in _SECTION_IDS:
        item = copy["sections"][section_id]
        sections.append(
            {
                "id": section_id,
                "title": item["title"],
                "hint": item["hint"],
                "optional": section_id == "thinking_notes",
                "min_chars": 60 if section_id != "thinking_notes" else 0,
                "soft_max_chars": 720 if section_id != "thinking_notes" else 420,
            }
        )
    return sections


def _ai_available() -> bool:
    try:
        return bool(get_default_primary_model())
    except Exception:
        return False


def _brief_needs_ai(job_row: dict[str, Any]) -> bool:
    description = str(job_row.get("description") or "").strip()
    role_summary = str(job_row.get("role_summary") or "").strip()
    first_reply_prompt = str(job_row.get("first_reply_prompt") or "").strip()
    return len(description) < 180 and len(role_summary) < 60 and len(first_reply_prompt) < 40


def _maybe_ai_brief(job_row: dict[str, Any], locale: str, fallback: dict[str, str]) -> dict[str, str] | None:
    if not _brief_needs_ai(job_row) or not _ai_available():
        return None
    language = _normalize_locale(locale)
    prompt = f"""
Create a realistic short work-signal scenario for a candidate applying to a job.

Job title: {job_row.get("title") or ""}
Company: {job_row.get("company") or ""}
Location: {job_row.get("location") or ""}
Description: {job_row.get("description") or ""}
Role summary: {job_row.get("role_summary") or ""}
First reply prompt: {job_row.get("first_reply_prompt") or ""}
Locale: {language}

Return STRICT JSON:
{{
  "scenario_title": "string",
  "scenario_context": "string",
  "core_problem": "string"
}}

Rules:
- Make it concrete, not academic.
- Force prioritization and perspective, not textbook explanation.
- Make it feel solvable in 15-20 minutes.
- No generic consultancy phrasing.
- Write in the requested locale.
""".strip()
    try:
        result, _ = call_primary_with_fallback(
            prompt,
            primary_model=get_default_primary_model(),
            fallback_model=get_default_fallback_model(),
            generation_config={"temperature": 0.2, "top_p": 0.9},
        )
        parsed = _extract_json(result.text)
        title = _clip(parsed.get("scenario_title"), 160)
        context = _clip(parsed.get("scenario_context"), 400)
        problem = _clip(parsed.get("core_problem"), 500)
        if not title or not context or not problem:
            return None
        return {"title": title, "context": context, "problem": problem}
    except (AIClientError, ValueError):
        return None


def build_signal_boost_brief(job_row: dict[str, Any], locale: str) -> dict[str, Any]:
    language = _normalize_locale(locale, _normalize_locale(job_row.get("language_code"), "en"))
    copy = _copy(language)
    template = _resolve_template(job_row, language)
    ai_template = _maybe_ai_brief(job_row, language, template)
    effective = ai_template or template
    return {
        "kicker": copy["kicker"],
        "timebox": copy["timebox"],
        "candidate_note": copy["note"],
        "anti_generic_hint": copy["anti_generic"],
        "cta_hint": copy["cta_hint"],
        "scenario_title": effective["title"],
        "scenario_context": effective["context"],
        "core_problem": effective["problem"],
        "constraints": list(copy["constraints"]),
        "structured_sections": _build_sections(language),
        "locale": language,
        "meta": {
            "role_family": template.get("role_family"),
            "domain_key": template.get("domain_key"),
            "canonical_role": template.get("canonical_role"),
            "used_ai_fallback": bool(ai_template),
        },
    }


def _section_text(response_payload: dict[str, Any], section_id: str) -> str:
    if not isinstance(response_payload, dict):
        return ""
    value = response_payload.get(section_id)
    return str(value or "").strip()


def _combined_response_text(response_payload: dict[str, Any]) -> str:
    return "\n".join(_section_text(response_payload, section_id) for section_id in _SECTION_IDS).strip()


def evaluate_signal_boost_quality(response_payload: dict[str, Any], locale: str) -> dict[str, Any]:
    language = _normalize_locale(locale)
    copy = _copy(language)
    first_move = _section_text(response_payload, "first_move")
    tradeoffs = _section_text(response_payload, "approach_tradeoffs")
    needs = _section_text(response_payload, "needs_to_know")
    combined = _combined_response_text(response_payload)
    normalized = _normalize_text(combined)

    total_chars = len(combined)
    word_count = len(normalized.split()) if normalized else 0
    tradeoff_markers = (
        "trade-off", "tradeoff", "priority", "prioritize", "not do", "wouldn't", "but",
        "trade off", "priorita", "uprednost", "zatim", "zatial", "naopak", "neudel", "nicht", "zuerst",
        "priorytet", "najpierw", "odloz", "later", "delay"
    )
    uncertainty_markers = (
        "need to know", "would ask", "would clarify", "unknown", "question", "?",
        "potreb", "overi", "upresn", "otaz", "wissen", "klaren", "frage", "musze", "sprawdz", "pytan"
    )
    generic_markers = (
        "best practices", "team player", "communication skills", "motivated", "dynamic environment",
        "analyze the requirements", "stakeholder alignment", "synergie", "proaktiv", "hardworking",
        "motivovan", "komunikacni", "dynamick", "profesjonal", "zmotywowan"
    )
    action_markers = (
        "call", "check", "ask", "map", "review", "draft", "test", "speak", "prioritize", "write", "compare",
        "zavol", "over", "zept", "map", "test", "napis", "skontrol", "spyt", "over", "prüf", "frag", "teste",
        "zadzwo", "sprawdz", "zapyt", "porown", "napisz"
    )

    missing_first_move = len(first_move) < 48 or not any(marker in _normalize_text(first_move) for marker in action_markers)
    missing_tradeoff = len(tradeoffs) < 70 or not any(marker in _normalize_text(tradeoffs) for marker in tradeoff_markers)
    missing_unknowns = len(needs) < 40 or not any(marker in needs.lower() for marker in uncertainty_markers)
    too_short = total_chars < 320 or word_count < 55
    genericity_hits = sum(1 for marker in generic_markers if marker in normalized)
    likely_generic = genericity_hits >= 2

    nudges: list[str] = []
    if too_short:
        nudges.append(copy["nudges"]["too_short"])
    if missing_first_move:
        nudges.append(copy["nudges"]["first_move"])
    if missing_tradeoff:
        nudges.append(copy["nudges"]["tradeoff"])
    if missing_unknowns:
        nudges.append(copy["nudges"]["unknowns"])
    if likely_generic:
        nudges.append(copy["nudges"]["generic"])

    publish_ready = not too_short and not missing_first_move and not missing_tradeoff
    return {
        "publish_ready": publish_ready,
        "total_chars": total_chars,
        "word_count": word_count,
        "too_short": too_short,
        "missing_first_move": missing_first_move,
        "missing_tradeoff": missing_tradeoff,
        "missing_unknowns": missing_unknowns,
        "likely_generic": likely_generic,
        "genericity_hits": genericity_hits,
        "nudges": nudges[:4],
    }


def build_signal_boost_summary(response_payload: dict[str, Any], locale: str, quality: dict[str, Any] | None = None) -> dict[str, Any] | None:
    evaluation = quality or evaluate_signal_boost_quality(response_payload, locale)
    if not evaluation.get("publish_ready") or evaluation.get("likely_generic"):
        return None

    first_move = _section_text(response_payload, "first_move")
    tradeoffs = _section_text(response_payload, "approach_tradeoffs")
    needs = _section_text(response_payload, "needs_to_know")
    combined = _combined_response_text(response_payload)
    language = _normalize_locale(locale)
    labels = _copy(language)["summary_labels"]

    structure = min(100, 48 + len(first_move) // 10 + len(tradeoffs) // 18)
    prioritization = min(100, 40 + (20 if not evaluation.get("missing_tradeoff") else 0) + len(tradeoffs) // 16)
    clarity = min(100, 44 + len(first_move.split(".")) * 4 + (10 if not evaluation.get("likely_generic") else 0))
    depth = min(100, 42 + len(needs) // 10 + len(combined) // 35)

    return {
        "items": [
            {"key": "structure", "label": labels["structure"], "score": max(18, structure)},
            {"key": "prioritization", "label": labels["prioritization"], "score": max(18, prioritization)},
            {"key": "clarity", "label": labels["clarity"], "score": max(18, clarity)},
            {"key": "depth", "label": labels["depth"], "score": max(18, depth)},
        ],
        "suppressed": False,
    }
