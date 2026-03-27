from __future__ import annotations

import json
import os
import re
import unicodedata
from typing import Any

from ..ai_orchestration.client import (
    AIClientError,
    _extract_json,
    call_primary_with_fallback,
    get_default_fallback_model,
    get_default_primary_model,
    resolve_ai_provider,
)
from ..core import config
from ..matching_engine.role_taxonomy import DOMAIN_KEYWORDS, REQUIRED_QUALIFICATION_RULES, ROLE_FAMILY_KEYWORDS
from .job_intelligence import map_job_to_intelligence

_SECTION_IDS = (
    "problem_frame",
    "first_step",
    "solution_direction",
    "risk_and_unknowns",
    "stakeholder_note",
)

_OPTIONAL_SECTION_IDS = {"stakeholder_note"}
_SUPPORTED_LOCALES = {"cs", "sk", "de", "pl", "en"}
_QUESTION_PACK_SIZE = 3

_GENERIC_MARKERS = (
    "best practices",
    "team player",
    "communication skills",
    "motivated",
    "dynamic environment",
    "analyze the requirements",
    "stakeholder alignment",
    "hardworking",
    "professional attitude",
    "motivovan",
    "komunikacni",
    "dynamick",
    "profesional",
)
_ACTION_MARKERS = (
    "check",
    "call",
    "review",
    "compare",
    "map",
    "inspect",
    "ask",
    "open",
    "verify",
    "align",
    "zkontrol",
    "over",
    "porovn",
    "map",
    "zept",
    "proj",
    "obvol",
    "sjedn",
)
_TRADEOFF_MARKERS = (
    "priority",
    "prioritize",
    "trade-off",
    "tradeoff",
    "not do",
    "not yet",
    "delay",
    "before",
    "instead of",
    "priorita",
    "uprednost",
    "zatim",
    "zatim ne",
    "nebudu",
    "odloz",
)
_RISK_MARKERS = (
    "risk",
    "unknown",
    "missing",
    "clarify",
    "question",
    "before i commit",
    "before changing",
    "dependency",
    "need to know",
    "rizik",
    "chybi",
    "potreb",
    "overit",
    "upresnit",
    "zavis",
)

_COPY = {
    "cs": {
        "kicker": "Signal Boost",
        "timebox": "15 až 20 minut",
        "note": "Nejde o ideální esej. Jde o to, jak čtete kontext role, jak rozhodujete a co by recruiter z vaší odpovědi viděl navíc oproti CV.",
        "anti_generic": "Pište konkrétně a z role. Jedna jasná první akce a jedno reálné riziko řeknou víc než uhlazené obecné fráze.",
        "cta_hint": "Po dokončení dostanete veřejný JobShaman link, který můžete poslat spolu s klasickou přihláškou.",
        "how_to_title": "Jak na to",
        "deliverable_title": "V mini case ukažte",
        "how_to_steps": [
            "Nejdřív si přečtěte roli a tři konkrétní otázky, na které recruiter opravdu potřebuje odpověď.",
            "Pak napište, jak byste situaci rámovali, co uděláte jako první a kam byste řešení vedli.",
            "Nakonec pojmenujte rizika, chybějící fakta a případně komu byste to potřebovali srovnat.",
        ],
        "job_excerpt_title": "Kontext z inzerátu",
        "constraints": [
            "Jak čtete skutečný problém nebo tlak v roli.",
            "Jaký by byl váš první konkrétní krok a jakým směrem byste vedli řešení.",
            "Jaká rizika a otevřené otázky byste si ještě museli ujasnit.",
        ],
        "recruiter_reading_guide": "Recruiter by z toho měl během pár minut pochopit, jak čtete kontext, jak rozhodujete pod tlakem a co pojmenujete jako slepé místo dřív, než se pustíte do řešení.",
        "sections": {
            "problem_frame": {
                "title": "Jak bych si srovnal(a) problém",
                "hint": "Pojmenujte skutečný problém, ne jen téma role.",
            },
            "first_step": {
                "title": "Co udělám jako první",
                "hint": "Jeden konkrétní krok, který byste opravdu udělali hned.",
            },
            "solution_direction": {
                "title": "Jakým směrem bych vedl(a) řešení",
                "hint": "Ukažte prioritu, trade-off a co byste zatím nespouštěli.",
            },
            "risk_and_unknowns": {
                "title": "Jaká rizika a neznámé si hlídám",
                "hint": "Napište, co ještě potřebujete vědět, než se zavážete k řešení.",
            },
            "stakeholder_note": {
                "title": "Krátká poznámka pro další lidi",
                "hint": "Volitelné. Komu byste to srovnali a co by od vás potřeboval slyšet.",
            },
        },
        "nudges": {
            "too_short": "Ještě trochu přidejte. Recruiter musí vidět víc než jen obecný úmysl.",
            "problem_frame": "Chybí jasné čtení problému. Co je tady skutečný tlak, omezení nebo riziko?",
            "first_step": "Chybí konkrétní první krok. Co byste opravdu udělali jako první akci?",
            "solution_direction": "Doplňte směr řešení a trade-off. Co byste upřednostnili a co byste zatím nespouštěli?",
            "risk_and_unknowns": "Doplňte rizika nebo chybějící fakta. Co byste si ještě museli ověřit?",
            "generic": "Zkuste méně obecných frází a víc role-specific detailu z konkrétní situace.",
        },
        "summary_labels": {
            "context_read": "Čtení kontextu",
            "decision_quality": "Kvalita rozhodnutí",
            "risk_judgment": "Práce s rizikem",
            "role_specificity": "Specifičnost pro roli",
        },
    },
    "en": {
        "kicker": "Signal Boost",
        "timebox": "15 to 20 minutes",
        "note": "This is not a polished essay. It is a role-aware mini case that should show how you read context, make decisions, and reveal signal that a CV alone cannot show.",
        "anti_generic": "Write concretely and from the role. One clear first action and one real risk say more than polished generic language.",
        "cta_hint": "When you finish, you will get a public JobShaman link you can send with your normal application.",
        "how_to_title": "How to approach it",
        "deliverable_title": "In the mini case, show",
        "how_to_steps": [
            "First, read the role context and the three specific questions the recruiter would really care about.",
            "Then explain how you frame the problem, what you would do first, and where you would steer the solution.",
            "Finish with the risks, missing facts, and optionally who you would align next.",
        ],
        "job_excerpt_title": "Context from the listing",
        "constraints": [
            "How you read the real pressure or problem in the role.",
            "What your first concrete step would be and which direction you would lead the solution.",
            "Which risks and unknowns you would still need to clarify.",
        ],
        "recruiter_reading_guide": "A recruiter should be able to read this in a few minutes and understand how you read context, make decisions under pressure, and name blind spots before charging into execution.",
        "sections": {
            "problem_frame": {
                "title": "How I would frame the problem",
                "hint": "Name the real problem, not just the topic of the role.",
            },
            "first_step": {
                "title": "What I would do first",
                "hint": "One concrete first action you would actually take right away.",
            },
            "solution_direction": {
                "title": "Where I would steer the solution",
                "hint": "Show the priority, the trade-off, and what you would deliberately not start yet.",
            },
            "risk_and_unknowns": {
                "title": "Which risks and unknowns I am watching",
                "hint": "Write what you still need to know before you commit to the path.",
            },
            "stakeholder_note": {
                "title": "Short note for other stakeholders",
                "hint": "Optional. Who would you align next, and what would they need to hear from you?",
            },
        },
        "nudges": {
            "too_short": "Add a bit more. A recruiter needs more than a generic intention statement.",
            "problem_frame": "The problem framing is still too thin. What is the actual pressure, bottleneck, or risk here?",
            "first_step": "The concrete first step is still missing. What would you actually do first?",
            "solution_direction": "Add the solution direction and trade-off. What would you prioritize, and what would you deliberately not start yet?",
            "risk_and_unknowns": "Add the risks or missing facts. What would you still need to verify?",
            "generic": "Make this more role-specific and grounded in the scenario, with fewer generic phrases.",
        },
        "summary_labels": {
            "context_read": "Context Read",
            "decision_quality": "Decision Quality",
            "risk_judgment": "Risk Judgment",
            "role_specificity": "Role Specificity",
        },
    },
}

_ROLE_FAMILY_ARCHETYPE_MAP = {
    "customer_support": "customer_support",
    "customer_success": "customer_support",
    "operations_coordination": "operations",
    "operations_management": "operations",
    "product_management": "product",
    "people_ops": "people",
    "sales_account": "sales",
    "software_engineering": "engineering",
    "construction_site": "construction_site",
    "civil_engineering": "construction_site",
    "construction": "construction_site",
}

_DOMAIN_ARCHETYPE_MAP = {
    "customer_support": "customer_support",
    "operations": "operations",
    "product_management": "product",
    "sales": "sales",
    "it": "engineering",
    "construction_site": "construction_site",
    "construction": "construction_site",
}

_BROADER_RULE_ROLE_HINTS = {
    "construction_supervisor": {
        "canonical_role": "Construction Supervisor",
        "role_family": "construction_site",
        "domain_key": "construction_site",
        "archetype": "construction_site",
    },
}

_ARCHETYPE_MARKERS = {
    "construction_site": (
        "stavbyved",
        "construction",
        "site manager",
        "site supervisor",
        "bauleiter",
        "kierownik budowy",
        "subcontractor",
        "safety",
        "schedule",
        "site",
    ),
    "customer_support": (
        "support",
        "customer service",
        "helpdesk",
        "ticket",
        "sla",
        "escalation",
        "refund",
        "frustrated",
        "complaint",
    ),
    "operations": (
        "operations",
        "dispatch",
        "warehouse",
        "fleet",
        "logistics",
        "workflow",
        "throughput",
        "handoff",
    ),
    "product": (
        "product",
        "roadmap",
        "onboarding",
        "drop-off",
        "activation",
        "experiment",
        "discovery",
        "retention",
    ),
    "people": (
        "recruit",
        "talent",
        "candidate pipeline",
        "onboarding",
        "hiring manager",
        "interview",
        "people",
        "hr",
    ),
    "sales": (
        "sales",
        "account",
        "pipeline",
        "deal",
        "revenue",
        "renewal",
        "prospect",
        "forecast",
    ),
    "engineering": (
        "engineer",
        "developer",
        "incident",
        "bug",
        "service",
        "api",
        "deploy",
        "latency",
        "backend",
    ),
}

_ARCHETYPE_FOCUS_AREAS = {
    "construction_site": [
        "site sequencing",
        "safety and compliance",
        "subcontractor coordination",
        "resource readiness",
    ],
    "customer_support": [
        "missing ticket context",
        "calm first response",
        "SLA and escalation judgment",
        "closing the loop",
    ],
    "operations": [
        "bottleneck discovery",
        "throughput vs stability",
        "handoff friction",
        "operational visibility",
    ],
    "product": [
        "signal before solution",
        "small experiment over redesign",
        "user value clarity",
        "evidence gaps",
    ],
    "people": [
        "candidate or manager signal",
        "process bottlenecks",
        "quality vs speed",
        "alignment with stakeholders",
    ],
    "sales": [
        "next commercial move",
        "deal risk and timing",
        "stakeholder map",
        "qualification gaps",
    ],
    "engineering": [
        "fast diagnosis",
        "containment before refactor",
        "risk to production",
        "missing logs and ownership",
    ],
    "generic": [
        "real pressure in the role",
        "first move",
        "trade-offs",
        "unknowns",
    ],
}


def _copy(locale: str) -> dict[str, Any]:
    language = _normalize_locale(locale)
    return _COPY.get(language) or _COPY["en"]


def _normalize_locale(value: Any, fallback: str = "en") -> str:
    code = str(value or fallback).split("-")[0].strip().lower()
    if code == "at":
        return "de"
    if code in _SUPPORTED_LOCALES:
        return code
    return _normalize_locale(fallback, "en") if fallback != code else "en"


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
        text = _clip(item, 160)
        normalized = _normalize_text(text)
        if not text or not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _safe_dict(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _strip_html(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"[*_#>`~\[\]\(\)]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _plain_excerpt(value: Any, limit: int = 280) -> str:
    text = _strip_html(value)
    return _clip(text, limit) if text else ""


def _description_sentences(value: Any, limit: int = 5) -> list[str]:
    text = _strip_html(value)
    if not text:
        return []
    parts = re.split(r"(?<=[.!?])\s+", text)
    out: list[str] = []
    for part in parts:
        candidate = _clip(part, 220)
        if candidate and len(candidate) >= 18:
            out.append(candidate)
        if len(out) >= limit:
            break
    return out


def _compact_role_title(value: Any) -> str:
    title = str(value or "").strip()
    if not title:
        return "role"
    return re.sub(r"\s+", " ", title)[:120]


def _build_job_excerpt(job_row: dict[str, Any]) -> str:
    for field in ("first_reply_prompt", "challenge", "role_summary"):
        excerpt = _plain_excerpt(job_row.get(field), 280)
        if excerpt:
            return excerpt
    sentences = _description_sentences(job_row.get("description"))
    if sentences:
        return " ".join(sentences[:2])
    return _plain_excerpt(job_row.get("description"), 260)


def _matching_rule_fallback(text: str) -> dict[str, Any] | None:
    best_hint: dict[str, Any] | None = None
    best_score = 0
    for rule in REQUIRED_QUALIFICATION_RULES:
        rule_name = str(rule.get("name") or "").strip().lower()
        hint = _BROADER_RULE_ROLE_HINTS.get(rule_name)
        if not hint:
            continue
        job_terms = [str(item or "").strip().lower() for item in (rule.get("job_terms") or [])]
        score = sum(1 for term in job_terms if term and term in text)
        if score > best_score:
            best_score = score
            best_hint = {
                **hint,
                "matched_rule": rule_name,
                "matched_terms": [term for term in job_terms if term and term in text][:4],
                "score": score,
            }
    return best_hint


def _keyword_domain_fallback(text: str) -> dict[str, Any] | None:
    best_key = ""
    best_hits = 0
    for domain_key, keywords in DOMAIN_KEYWORDS.items():
        hits = sum(1 for keyword in keywords if _normalize_text(keyword) in text)
        if hits > best_hits:
            best_hits = hits
            best_key = str(domain_key or "").strip().lower()
    if best_hits <= 0:
        return None
    archetype = _DOMAIN_ARCHETYPE_MAP.get(best_key)
    if not archetype:
        return None
    return {
        "canonical_role": "",
        "role_family": best_key,
        "domain_key": best_key,
        "archetype": archetype,
        "matched_rule": "domain_keywords",
        "matched_terms": [keyword for keyword in (DOMAIN_KEYWORDS.get(best_key) or []) if _normalize_text(keyword) in text][:4],
        "score": best_hits,
    }


def _resolve_archetype(
    *,
    normalized_text: str,
    intelligence: dict[str, Any],
    fallback_hint: dict[str, Any] | None,
) -> str:
    canonical_role = _normalize_text(intelligence.get("canonical_role"))
    role_family = str(intelligence.get("role_family") or "").strip().lower()
    domain_key = str(intelligence.get("domain_key") or "").strip().lower()
    confidence = float(intelligence.get("mapping_confidence") or 0.0)

    if fallback_hint and (
        confidence < 0.62
        or role_family in {"", "unknown"}
        or domain_key in {"", "unknown"}
        or canonical_role in {"", "unknown role"}
    ):
        return str(fallback_hint.get("archetype") or "generic")

    for field in (role_family, domain_key):
        if field in _ROLE_FAMILY_ARCHETYPE_MAP:
            return _ROLE_FAMILY_ARCHETYPE_MAP[field]
        if field in _DOMAIN_ARCHETYPE_MAP:
            return _DOMAIN_ARCHETYPE_MAP[field]

    for archetype, markers in _ARCHETYPE_MARKERS.items():
        if any(marker in normalized_text for marker in markers):
            return archetype

    return "generic"


def _extract_job_evidence(job_row: dict[str, Any], archetype: str) -> list[str]:
    markers = _ARCHETYPE_MARKERS.get(archetype, ())
    raw_candidates: list[str] = []
    for field in ("role_summary", "first_reply_prompt"):
        excerpt = _plain_excerpt(job_row.get(field), 220)
        if excerpt:
            raw_candidates.append(excerpt)
    raw_candidates.extend(_description_sentences(job_row.get("description"), limit=5))
    raw_candidates.extend(_safe_list(job_row.get("tags"), limit=4))
    if not raw_candidates:
        return []

    prioritized: list[tuple[int, str]] = []
    for candidate in raw_candidates:
        normalized = _normalize_text(candidate)
        if not normalized:
            continue
        score = sum(1 for marker in markers if marker in normalized)
        prioritized.append((score, candidate))
    prioritized.sort(key=lambda item: (item[0], len(item[1])), reverse=True)

    out: list[str] = []
    seen: set[str] = set()
    for _, candidate in prioritized:
        normalized = _normalize_text(candidate)
        if normalized in seen:
            continue
        seen.add(normalized)
        out.append(_clip(candidate, 180))
        if len(out) >= 4:
            break
    return out


def _extract_focus_areas(archetype: str, intelligence: dict[str, Any], evidence: list[str]) -> list[str]:
    base = list(_ARCHETYPE_FOCUS_AREAS.get(archetype) or _ARCHETYPE_FOCUS_AREAS["generic"])
    keywords = []
    for value in (
        intelligence.get("extracted_keywords") or [],
        intelligence.get("extracted_skills") or [],
    ):
        for item in value:
            normalized = str(item or "").strip()
            if len(normalized) >= 4:
                keywords.append(normalized)
    for candidate in evidence:
        normalized = _normalize_text(candidate)
        for keyword in normalized.split(" "):
            if len(keyword) >= 5:
                keywords.append(keyword)
    seen: set[str] = set()
    out: list[str] = []
    for item in base + keywords:
        normalized = _normalize_text(item)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        out.append(str(item))
        if len(out) >= 6:
            break
    return out


def _resolve_role_context(job_row: dict[str, Any], locale: str) -> dict[str, Any]:
    intelligence = map_job_to_intelligence(
        {
            "id": job_row.get("id") or "",
            "title": job_row.get("title") or "",
            "description": job_row.get("description") or "",
            "role_summary": job_row.get("role_summary") or "",
            "country_code": job_row.get("country_code") or "",
            "language_code": job_row.get("language_code") or locale,
            "work_model": job_row.get("work_model") or "",
            "work_type": job_row.get("work_type") or "",
            "tags": job_row.get("tags") or [],
        }
    )
    normalized_text = _normalize_text(
        " ".join(
            [
                str(job_row.get("title") or ""),
                str(job_row.get("role_summary") or ""),
                str(job_row.get("description") or ""),
                str(job_row.get("location") or ""),
                " ".join(str(item) for item in (job_row.get("tags") or [])),
            ]
        )
    )
    fallback_hint = _matching_rule_fallback(normalized_text) or _keyword_domain_fallback(normalized_text)
    archetype = _resolve_archetype(normalized_text=normalized_text, intelligence=intelligence, fallback_hint=fallback_hint)

    effective_role_family = str(intelligence.get("role_family") or "").strip().lower()
    effective_domain_key = str(intelligence.get("domain_key") or "").strip().lower()
    effective_canonical_role = str(intelligence.get("canonical_role") or "").strip()
    mapping_source = str(intelligence.get("mapping_source") or "rules")
    mapping_notes = dict(intelligence.get("mapping_notes") or {})
    mapping_confidence = float(intelligence.get("mapping_confidence") or 0.0)

    if fallback_hint and (
        mapping_confidence < 0.62
        or effective_role_family in {"", "unknown"}
        or effective_domain_key in {"", "unknown"}
        or not effective_canonical_role
    ):
        effective_role_family = str(fallback_hint.get("role_family") or effective_role_family or archetype)
        effective_domain_key = str(fallback_hint.get("domain_key") or effective_domain_key or archetype)
        effective_canonical_role = str(fallback_hint.get("canonical_role") or effective_canonical_role or _compact_role_title(job_row.get("title")))
        mapping_source = f"{mapping_source}+{str(fallback_hint.get('matched_rule') or 'fallback')}"
        mapping_notes["fallback_terms"] = list(fallback_hint.get("matched_terms") or [])
        mapping_confidence = max(mapping_confidence, 0.58)

    evidence = _extract_job_evidence(job_row, archetype)
    focus_areas = _extract_focus_areas(archetype, intelligence, evidence)

    return {
        "title": _compact_role_title(job_row.get("title")),
        "company": _clip(job_row.get("company"), 120),
        "location": _clip(job_row.get("location"), 120),
        "canonical_role": effective_canonical_role or _compact_role_title(job_row.get("title")),
        "role_family": effective_role_family or archetype,
        "domain_key": effective_domain_key or archetype,
        "archetype": archetype,
        "seniority": str(intelligence.get("seniority") or "mid").strip().lower(),
        "work_mode": str(intelligence.get("work_mode") or "").strip().lower() or None,
        "language_code": _normalize_locale(locale, _normalize_locale(job_row.get("language_code"), "en")),
        "mapping_confidence": round(mapping_confidence, 3),
        "mapping_source": mapping_source,
        "job_evidence": evidence,
        "focus_areas": focus_areas,
        "keywords": _safe_list(intelligence.get("extracted_keywords"), limit=8),
    }


def _question_pack_construction(locale: str, role_context: dict[str, Any]) -> list[dict[str, str]]:
    evidence = role_context.get("job_evidence") or []
    default_evidence = evidence[0] if evidence else "Site execution depends on incomplete field information."
    if _normalize_locale(locale) == "cs":
        return [
            {
                "id": "q1",
                "question": "Když je na stavbě skluz a informace z terénu nejsou úplné, co byste si ověřil(a) jako první přímo na místě nebo s vedoucími profesí?",
                "why_this_matters": "Recruiter potřebuje vidět, jestli nezačnete měnit harmonogram naslepo a umíte najít skutečný zdroj skluzu.",
                "job_evidence": default_evidence,
                "recruiter_signal": "Čte sekvencování stavby, ne jen administrativní plán.",
            },
            {
                "id": "q2",
                "question": "Jak byste vyvážil(a) tlak na termín s bezpečností, připraveností subdodavatelů a dostupností zdrojů?",
                "why_this_matters": "Tahle role není jen o rychlosti. Je o tom, co nepustíte dál, dokud nejsou splněné kritické podmínky.",
                "job_evidence": evidence[1] if len(evidence) > 1 else "The role likely balances deadline pressure with coordination on site.",
                "recruiter_signal": "Ukazuje úsudek mezi deadlinem, bezpečností a koordinací profesí.",
            },
            {
                "id": "q3",
                "question": "Jaká onsite fakta nebo potvrzení byste ještě potřeboval(a) od subdodavatelů, stavbyvedení nebo zásobování, než rozhodnete další krok?",
                "why_this_matters": "Silný stavbyvedoucí nehraje na jistotu jen v hlavě. Ví, které chybějící informace rozhodují o dalším kroku.",
                "job_evidence": evidence[2] if len(evidence) > 2 else "Missing field facts can change the next move.",
                "recruiter_signal": "Pojmenovává chybějící fakta dřív, než eskaluje nebo přestaví plán.",
            },
        ]
    return [
        {
            "id": "q1",
            "question": "If the site is slipping and field information is incomplete, what would you verify first on site or with the foremen before touching the plan?",
            "why_this_matters": "A recruiter wants to see whether you can find the real source of the slip before you start rearranging the schedule blindly.",
            "job_evidence": default_evidence,
            "recruiter_signal": "Reads site sequencing instead of only the admin plan.",
        },
        {
            "id": "q2",
            "question": "How would you balance deadline pressure with safety, subcontractor readiness, and resource availability?",
            "why_this_matters": "This role is not just about speed. It is about what you refuse to push forward until critical conditions are actually real.",
            "job_evidence": evidence[1] if len(evidence) > 1 else "The role likely balances deadline pressure with coordination on site.",
            "recruiter_signal": "Shows judgment between deadline, safety, and coordination.",
        },
        {
            "id": "q3",
            "question": "Which on-site facts or confirmations would you still need from subcontractors, site leadership, or supply before you commit to the next move?",
            "why_this_matters": "A strong construction lead does not pretend certainty. They know which missing facts actually change the decision.",
            "job_evidence": evidence[2] if len(evidence) > 2 else "Missing field facts can change the next move.",
            "recruiter_signal": "Names decision-critical unknowns before escalating or reshuffling the site.",
        },
    ]


def _question_pack_customer_support(locale: str, role_context: dict[str, Any]) -> list[dict[str, str]]:
    evidence = role_context.get("job_evidence") or []
    default_evidence = evidence[0] if evidence else "The customer is frustrated and the ticket context is incomplete."
    if _normalize_locale(locale) == "cs":
        return [
            {
                "id": "q1",
                "question": "Když přijde frustrovaný zákazník s neúplným ticketem, jak byste vedl(a) první odpověď, abyste situaci uklidnil(a) a přitom neztratil(a) přesnost?",
                "why_this_matters": "Recruiter chce vidět, jestli umíte zvládnout tón, sběr faktů i další krok ve stejné odpovědi.",
                "job_evidence": default_evidence,
                "recruiter_signal": "Umí uklidnit tlak bez planých slibů.",
            },
            {
                "id": "q2",
                "question": "Podle čeho byste rozhodl(a), že ještě řešíte sám/sama, nebo už je čas na eskalaci podle SLA, dopadu a rizika chyby?",
                "why_this_matters": "Customer support je i o úsudku. Nejde jen o milou komunikaci, ale o správnou hranici mezi řešením a eskalací.",
                "job_evidence": evidence[1] if len(evidence) > 1 else "The role likely involves time-sensitive support judgment.",
                "recruiter_signal": "Rozlišuje mezi rychlou odpovědí a správným eskalačním rozhodnutím.",
            },
            {
                "id": "q3",
                "question": "Jaké informace vám ještě chybí a jak byste zajistil(a), že se z podobného ticketu stane lepší interní signál pro produkt nebo operations?",
                "why_this_matters": "Silná podpora nezavírá jen tiket. Uzavírá smyčku poznání pro další týmy.",
                "job_evidence": evidence[2] if len(evidence) > 2 else "Support work should close the loop, not only answer the ticket.",
                "recruiter_signal": "Přemýšlí o root cause a předání dál, ne jen o jednom reply.",
            },
        ]
    return [
        {
            "id": "q1",
            "question": "When a frustrated customer arrives with an incomplete ticket, how would you shape the first reply so the situation calms down without losing accuracy?",
            "why_this_matters": "A recruiter wants to see whether you can handle tone, fact-finding, and the next step in the same answer.",
            "job_evidence": default_evidence,
            "recruiter_signal": "Can calm pressure without overpromising.",
        },
        {
            "id": "q2",
            "question": "How would you decide whether to keep handling it yourself or escalate based on SLA, impact, and the risk of being wrong?",
            "why_this_matters": "Customer support is also judgment work. It is not just friendly communication but the right line between solving and escalating.",
            "job_evidence": evidence[1] if len(evidence) > 1 else "The role likely involves time-sensitive support judgment.",
            "recruiter_signal": "Separates speed from escalation judgment.",
        },
        {
            "id": "q3",
            "question": "What information is still missing, and how would you make sure the ticket becomes a better internal signal for product or operations next time?",
            "why_this_matters": "Strong support does not only close a ticket. It closes a learning loop for the rest of the company.",
            "job_evidence": evidence[2] if len(evidence) > 2 else "Support work should close the loop, not only answer the ticket.",
            "recruiter_signal": "Thinks beyond the single reply toward root cause and feedback flow.",
        },
    ]


def _generic_question_pack(locale: str, role_context: dict[str, Any], archetype: str) -> list[dict[str, str]]:
    evidence = role_context.get("job_evidence") or []
    focus = role_context.get("focus_areas") or []
    title = role_context.get("title") or "this role"
    intro = evidence[0] if evidence else f"This role likely depends on {', '.join(focus[:2]) or 'good judgment'}."
    if _normalize_locale(locale) == "cs":
        prompts = {
            "operations": [
                ("Kde byste nejdřív hledal(a) hlavní provozní úzké místo a jak byste poznal(a), že řešíte správný problém?", "Recruiter potřebuje vidět, jestli umíte najít skutečné tření místo povrchní optimalizace.", "Ukazuje bottleneck thinking místo generického zlepšování."),
                ("Jaký malý zásah byste upřednostnil(a) před velkou přestavbou a proč?", "Silný operations člověk rozlišuje mezi rychlou stabilizací a příliš širokou změnou.", "Umí volit mezi throughputem a stabilitou."),
                ("Jaká data nebo potvrzení vám ještě chybí, než ten zásah pustíte do provozu?", "Dobré rozhodnutí v operations stojí na datech, ne na dojmu.", "Pojmenovává rozhodovací mezery před spuštěním změny."),
            ],
            "product": [
                ("Jaký signál nebo uživatelský moment byste si ověřil(a), než navrhnete řešení?", "Recruiter chce vidět, jestli nezačnete řešením dřív než čtením problému.", "Začíná od evidence, ne od nápadu."),
                ("Jaký menší experiment byste upřednostnil(a) před větším redesignem?", "Produktový úsudek je často o správné velikosti dalšího kroku.", "Volí testovatelný směr místo velkého skoku."),
                ("Co vám ještě chybí vědět o uživatelích, segmentu nebo dopadu?", "Bez pojmenování neznámých zůstává řešení jen hypotézou.", "Umí přiznat mezery v evidenci a dopadu."),
            ],
            "people": [
                ("Jak byste nejdřív zjistil(a), jestli je hlavní problém v pipeline, očekávání hiring managera, nebo v kandidátském zážitku?", "Recruiter chce vidět diagnostiku procesu, ne jen aktivitu.", "Odděluje signál od šumu v náborovém procesu."),
                ("Co byste prioritizoval(a) jako první krok a co byste zatím nespouštěl(a)?", "People role jsou plné trade-offů mezi rychlostí, kvalitou a kapacitou týmu.", "Ukazuje procesní úsudek místo administrativního checklistu."),
                ("Jaké vstupy vám ještě chybí od kandidátů, hiring managera nebo týmu?", "Bez chybějících perspektiv bývá people rozhodnutí zkreslené.", "Hlídá si slepá místa v alignementu."),
            ],
            "sales": [
                ("Jak byste určil(a) první komerční krok, když obchod nebo účet začíná ztrácet momentum?", "Recruiter chce vidět, jestli umíte jít po skutečné překážce v dealu.", "Zaměřuje se na další rozhodující pohyb, ne jen na aktivitu."),
                ("Co byste upřednostnil(a) před posíláním dalších follow-upů naslepo?", "Silný sales úsudek pozná, kdy zpomalit a kdy kvalifikovat hlouběji.", "Rozlišuje mezi tlakem na aktivitu a kvalitou dalšího kroku."),
                ("Jaké informace vám chybí o stakeholderech, rozpočtu nebo timeline?", "Bez těchto dat hrozí falešný optimismus v pipeline.", "Pojmenovává komerční rizika a kvalifikační mezery."),
            ],
            "engineering": [
                ("Jaký první diagnostický krok byste udělal(a), když se objevuje chyba nebo degradace služby?", "Recruiter chce vidět, jestli začnete od rychlého signálu, ne od náhodného fixu.", "Začíná diagnostikou a containmentem."),
                ("Co byste stabilizoval(a) hned a co byste ještě nerefaktoroval(a)?", "Silný engineering úsudek umí oddělit mitigaci od větší opravy.", "Rozlišuje mezi produkční stabilitou a širším redesignem."),
                ("Jaké logy, ownership nebo technické souvislosti vám ještě chybí?", "Bez pojmenování neznámých je technické sebevědomí levné.", "Ví, jaké technické důkazy ještě potřebuje."),
            ],
        }
        selected = prompts.get(archetype)
        if selected:
            return [
                {
                    "id": f"q{index + 1}",
                    "question": question,
                    "why_this_matters": why,
                    "job_evidence": evidence[index] if len(evidence) > index else intro,
                    "recruiter_signal": signal,
                }
                for index, (question, why, signal) in enumerate(selected[:_QUESTION_PACK_SIZE])
            ]
        return [
            {
                "id": "q1",
                "question": f"Když nastoupíte do role {title}, co byste si potřeboval(a) nejdřív srovnat, abyste neřešil(a) špatný problém?",
                "why_this_matters": "Recruiter chce vidět, jak čtete kontext role dřív, než navrhnete řešení.",
                "job_evidence": intro,
                "recruiter_signal": "Začíná správným rámováním problému.",
            },
            {
                "id": "q2",
                "question": "Jaký první konkrétní krok byste udělal(a) a proč právě ten?",
                "why_this_matters": "Silný signál je konkrétní akce, ne abstraktní úmysl.",
                "job_evidence": evidence[1] if len(evidence) > 1 else intro,
                "recruiter_signal": "Umí přejít od úvahy k prvnímu kroku.",
            },
            {
                "id": "q3",
                "question": "Jaká rizika, trade-offy nebo chybějící fakta byste si ještě potřeboval(a) potvrdit?",
                "why_this_matters": "Recruiter vidí, jestli umíte přiznat neznámé a rozhodovat i s nimi.",
                "job_evidence": evidence[2] if len(evidence) > 2 else intro,
                "recruiter_signal": "Pojmenovává rizika a neznámé před závazkem.",
            },
        ]
    prompts = {
        "operations": [
            ("Where would you look first for the real operational bottleneck, and how would you know you are fixing the right problem?", "A recruiter wants to see whether you can find the real friction rather than polishing the surface.", "Shows bottleneck thinking instead of generic improvement language."),
            ("Which small intervention would you prioritize before a broader redesign, and why?", "Strong operations judgment separates fast stabilization from changes that are too wide too early.", "Balances throughput and stability."),
            ("Which data points or confirmations are still missing before you push the change into live operations?", "Good operations decisions are grounded in visibility, not impression.", "Names decision gaps before rollout."),
        ],
        "product": [
            ("Which signal or user moment would you verify before proposing a solution?", "A recruiter wants to see whether you start with evidence before jumping to the answer.", "Starts from evidence, not from taste."),
            ("Which smaller experiment would you prioritize over a broader redesign?", "Product judgment is often about choosing the right next move size.", "Prefers a testable step over a big leap."),
            ("What would you still need to know about users, segments, or impact?", "Without naming unknowns, the solution is still only a hypothesis.", "Can name evidence gaps clearly."),
        ],
        "people": [
            ("How would you tell whether the main problem sits in the pipeline, the hiring manager expectations, or the candidate experience?", "A recruiter wants process diagnosis, not just activity.", "Separates signal from noise in a people process."),
            ("What would you prioritize first, and what would you deliberately not launch yet?", "People roles are full of trade-offs between speed, quality, and team capacity.", "Shows process judgment rather than checklist thinking."),
            ("Which inputs are still missing from candidates, hiring managers, or the team?", "People decisions get distorted when one critical perspective is still missing.", "Watches for alignment blind spots."),
        ],
        "sales": [
            ("How would you choose the first commercial move when a deal or account is losing momentum?", "A recruiter wants to see whether you can get to the real blocker in the deal.", "Focuses on the decisive next move, not just activity volume."),
            ("What would you prioritize before sending more blind follow-ups?", "Strong sales judgment knows when to slow down and qualify deeper.", "Separates activity pressure from quality of next step."),
            ("What do you still need to know about stakeholders, budget, or timing?", "Without this, pipeline confidence can become false optimism.", "Names commercial risks and qualification gaps."),
        ],
        "engineering": [
            ("What is the first diagnostic move you would make when a bug or service degradation appears?", "A recruiter wants to see whether you start with signal gathering instead of a random fix.", "Starts with diagnosis and containment."),
            ("What would you stabilize now, and what would you deliberately not refactor yet?", "Strong engineering judgment separates mitigation from broader cleanup.", "Separates production stability from future redesign."),
            ("Which logs, ownership questions, or technical dependencies are still missing?", "Without naming unknowns, technical confidence is cheap.", "Knows which technical evidence is still missing."),
        ],
    }
    selected = prompts.get(archetype)
    if selected:
        return [
            {
                "id": f"q{index + 1}",
                "question": question,
                "why_this_matters": why,
                "job_evidence": evidence[index] if len(evidence) > index else intro,
                "recruiter_signal": signal,
            }
            for index, (question, why, signal) in enumerate(selected[:_QUESTION_PACK_SIZE])
        ]
    return [
        {
            "id": "q1",
            "question": f"When you step into the {title} role, what would you need to understand first so you do not solve the wrong problem?",
            "why_this_matters": "A recruiter wants to see how you read role context before you start proposing answers.",
            "job_evidence": intro,
            "recruiter_signal": "Starts with problem framing.",
        },
        {
            "id": "q2",
            "question": "What would your first concrete move be, and why that move before the others?",
            "why_this_matters": "A strong work signal is a real first action, not abstract intent.",
            "job_evidence": evidence[1] if len(evidence) > 1 else intro,
            "recruiter_signal": "Can move from reasoning into action.",
        },
        {
            "id": "q3",
            "question": "Which risks, trade-offs, or missing facts would you still need to verify before you commit further?",
            "why_this_matters": "A recruiter sees whether you can name unknowns instead of pretending certainty.",
            "job_evidence": evidence[2] if len(evidence) > 2 else intro,
            "recruiter_signal": "Names risks and unknowns before commitment.",
        },
    ]


def _build_question_pack(role_context: dict[str, Any], locale: str) -> list[dict[str, str]]:
    archetype = str(role_context.get("archetype") or "generic")
    if archetype == "construction_site":
        return _question_pack_construction(locale, role_context)
    if archetype == "customer_support":
        return _question_pack_customer_support(locale, role_context)
    return _generic_question_pack(locale, role_context, archetype)


def _scenario_for_archetype(role_context: dict[str, Any], locale: str) -> dict[str, str]:
    language = _normalize_locale(locale)
    title = role_context.get("title") or "the role"
    company = role_context.get("company") or "the company"
    location = role_context.get("location")
    location_fragment = f" v {location}" if language == "cs" and location else f" in {location}" if location else ""
    archetype = str(role_context.get("archetype") or "generic")

    if language == "cs":
        scenarios = {
            "construction_site": {
                "title": f"Jak byste srovnal(a) skluz a chaos v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Na stavbě se objevuje skluz, subdodavatelé čekají na potvrzení dalšího kroku a informace z místa nejsou úplně čisté.",
                "problem": "Potřebujete rychle rozhodnout, co si ověřit jako první, co stabilizovat hned a jak neobětovat bezpečnost ani koordinaci profesí jen kvůli tlaku na termín.",
            },
            "customer_support": {
                "title": f"Jak byste uklidnil(a) ticket a dostal(a) ho pod kontrolu v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Přichází frustrovaný zákazník, ticket nemá dost dat a čas běží proti vám.",
                "problem": "Potřebujete zvládnout první odpověď, správně se rozhodnout mezi řešením a eskalací a zároveň si srovnat, co ještě musíte vědět, abyste neodpověděl(a) špatně.",
            },
            "operations": {
                "title": f"Jak byste našel(a) pravé provozní tření v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Provoz běží, ale vznikají zpoždění, ruční improvizace a nikdo si není jistý, kde je hlavní úzké místo.",
                "problem": "Potřebujete poznat, co opravdu brzdí provoz, co stabilizovat hned a co zatím nechat být, aby se systém nerozsypal ještě víc.",
            },
            "product": {
                "title": f"Jak byste oddělil(a) signál od nápadu v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Tým vidí problém, ale není jasné, jestli jde o UX, value proposition nebo jen špatně přečtený uživatelský moment.",
                "problem": "Potřebujete rozhodnout, jaký signál si ověřit jako první, co zkusit malým experimentem a jaké neznámé si nenechat utéct.",
            },
            "people": {
                "title": f"Jak byste odhalil(a) slabé místo procesu v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Nábor nebo people proces běží, ale kvalita výsledků a rychlost se začínají rozcházet.",
                "problem": "Potřebujete poznat, kde je skutečné slabé místo, co byste změnil(a) jako první a jaké vstupy vám ještě chybí od lidí kolem procesu.",
            },
            "sales": {
                "title": f"Jak byste rozhýbal(a) obchodní momentum v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Obchod nebo účet ztrácí tah a není jasné, jestli je problém v deal strategy, stakeholderech nebo prioritách klienta.",
                "problem": "Potřebujete určit další komerční krok, správně vyhodnotit riziko a nepálit čas na aktivitu, která obchod nikam neposune.",
            },
            "engineering": {
                "title": f"Jak byste stabilizoval(a) technický problém v roli {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Služba nebo část produktu začíná zlobit, signály jsou nečisté a tým nechce rozbít produkci ještě víc.",
                "problem": "Potřebujete zvolit první diagnostický krok, oddělit mitigaci od větší opravy a pojmenovat, co vám ještě chybí, než se zavážete k technickému směru.",
            },
            "generic": {
                "title": f"Jak byste rychle přečetl(a) kontext role {title}",
                "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{location_fragment}. Je jasné jen to, že tlak existuje, ale ještě nevíte, kde přesně vzniká největší riziko nebo ztráta hodnoty.",
                "problem": "Potřebujete ukázat, jak byste si srovnal(a) problém, co byste udělal(a) jako první a jaká neznámá by vám ještě bránila jít dál.",
            },
        }
        return scenarios.get(archetype) or scenarios["generic"]

    scenarios = {
        "construction_site": {
            "title": f"How you would steady a slipping site in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. The site is slipping, subcontractors are waiting for confirmation, and the field information is still incomplete.",
            "problem": "You need to decide what to verify first, what to stabilize immediately, and how not to sacrifice safety or coordination just to chase the deadline.",
        },
        "customer_support": {
            "title": f"How you would steady a messy support case in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. A frustrated customer arrives, the ticket is missing context, and the clock is already working against you.",
            "problem": "You need to handle the first reply, decide correctly between solving and escalating, and name what you still need to know so you do not answer too fast and too wrong.",
        },
        "operations": {
            "title": f"How you would find the real operational drag in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. Operations are running, but delays, manual workarounds, and overloaded handoffs keep showing up.",
            "problem": "You need to work out what is truly slowing the system down, what to stabilize first, and what not to widen too early.",
        },
        "product": {
            "title": f"How you would separate signal from solution in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. The team sees a problem, but it is not clear whether the issue is UX, value clarity, or a badly read user moment.",
            "problem": "You need to decide which signal to verify first, what to try as a smaller experiment, and which unknowns still matter before a bigger move.",
        },
        "people": {
            "title": f"How you would surface the real process gap in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. A hiring or people process is moving, but speed and quality are starting to drift apart.",
            "problem": "You need to identify the real weak point, choose the first change, and name which missing inputs from candidates, managers, or the team still matter.",
        },
        "sales": {
            "title": f"How you would restore commercial momentum in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. A deal or account is losing momentum, and it is not yet clear whether the blocker is strategy, stakeholder alignment, or client timing.",
            "problem": "You need to choose the next commercial move, judge the real risk, and avoid spending time on activity that will not move the opportunity forward.",
        },
        "engineering": {
            "title": f"How you would stabilize a technical issue in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. A service or product surface is starting to fail, the signals are noisy, and the team cannot afford to make production worse.",
            "problem": "You need to choose the first diagnostic move, separate mitigation from broader repair, and name what is still missing before you commit technically.",
        },
        "generic": {
            "title": f"How you would read the real pressure in the {title} role",
            "context": f"Imagine your first week in the {title} role at {company}{location_fragment}. You know there is pressure in the system, but not yet where the deepest risk or value loss really sits.",
            "problem": "You need to show how you would frame the problem, what you would do first, and what unknowns would still hold you back from moving further.",
        },
    }
    return scenarios.get(archetype) or scenarios["generic"]


def _section_specific_hints(locale: str, role_context: dict[str, Any]) -> dict[str, str]:
    language = _normalize_locale(locale)
    archetype = str(role_context.get("archetype") or "generic")
    focus = role_context.get("focus_areas") or []
    focus_line = ", ".join(focus[:3]) if focus else "the real constraint in the role"
    if language == "cs":
        hints = {
            "construction_site": {
                "problem_frame": "Co je tady skutečný driver skluzu: sekvence prací, bezpečnost, připravenost subdodavatelů, nebo zdroje?",
                "first_step": "Pojmenujte první onsite kontrolu, call nebo porovnání s harmonogramem, které uděláte dřív než změníte plán.",
                "solution_direction": "Ukažte, co byste stabilizoval(a) hned a co byste zatím nepřehazoval(a), dokud nejsou potvrzená fakta.",
                "risk_and_unknowns": "Jaká fakta ještě chybí od profesí, stavbyvedení, zásobování nebo BOZP?",
                "stakeholder_note": "Volitelné. Co byste potřeboval(a) srovnat s PM, investorem nebo vedoucími profesí?",
            },
            "customer_support": {
                "problem_frame": "Co je tady hlavní problém za ticketem: frustrace zákazníka, chybějící data, SLA tlak, nebo riziko špatné odpovědi?",
                "first_step": "Napište první reply nebo první kontrolu v systému, kterou byste udělal(a), abyste situaci uklidnil(a) i zpřesnil(a).",
                "solution_direction": "Ukažte, co byste vyřešil(a) hned, co byste eskaloval(a) a co byste ještě záměrně nesliboval(a).",
                "risk_and_unknowns": "Jaké informace z ticketu, účtu nebo interních systémů vám ještě chybí?",
                "stakeholder_note": "Volitelné. Co byste předal(a) dál produktu, operations nebo senior supportu?",
            },
        }
        archetype_hints = hints.get(archetype)
        if archetype_hints:
            return archetype_hints
        return {
            "problem_frame": f"Vysvětlete, kde v tomhle kontextu vidíte skutečný tlak nebo slabé místo kolem: {focus_line}.",
            "first_step": "Jmenujte jednu konkrétní první akci, ne obecný záměr.",
            "solution_direction": "Ukažte prioritu, trade-off a co byste zatím cíleně nespouštěli.",
            "risk_and_unknowns": "Napište, jaká fakta, čísla nebo perspektivy vám ještě chybí.",
            "stakeholder_note": "Volitelné. Komu byste to potřeboval(a) rychle srovnat a proč?",
        }
    hints = {
        "construction_site": {
            "problem_frame": "What is truly driving the slip here: sequence, safety, subcontractor readiness, or resource reality on site?",
            "first_step": "Name the first on-site check, call, or schedule comparison you would make before changing the plan.",
            "solution_direction": "Show what you would stabilize now and what you would deliberately not reshuffle until the facts are cleaner.",
            "risk_and_unknowns": "Which facts are still missing from trades, site leadership, supply, or compliance?",
            "stakeholder_note": "Optional. What would you align with the PM, investor, or site leads next?",
        },
        "customer_support": {
            "problem_frame": "What is the real issue beneath the ticket: customer frustration, missing context, SLA pressure, or the risk of a wrong answer?",
            "first_step": "Write the first reply or the first system check you would use to calm the case and sharpen the facts.",
            "solution_direction": "Show what you would resolve now, what you would escalate, and what you would deliberately not promise yet.",
            "risk_and_unknowns": "Which missing details from the ticket, account, or internal systems still matter before you commit?",
            "stakeholder_note": "Optional. What would you pass forward to product, operations, or senior support?",
        },
    }
    archetype_hints = hints.get(archetype)
    if archetype_hints:
        return archetype_hints
    return {
        "problem_frame": f"Explain where the real pressure or weak point sits in this context around: {focus_line}.",
        "first_step": "Name one concrete first action, not a general intention statement.",
        "solution_direction": "Show the priority, the trade-off, and what you would deliberately not launch yet.",
        "risk_and_unknowns": "Write which facts, numbers, or perspectives are still missing.",
        "stakeholder_note": "Optional. Who would you align next, and why them?",
    }


def _build_sections(locale: str, role_context: dict[str, Any]) -> list[dict[str, Any]]:
    copy = _copy(locale)
    hints = _section_specific_hints(locale, role_context)
    sections: list[dict[str, Any]] = []
    for section_id in _SECTION_IDS:
        item = copy["sections"][section_id]
        sections.append(
            {
                "id": section_id,
                "title": item["title"],
                "hint": hints.get(section_id) or item["hint"],
                "optional": section_id in _OPTIONAL_SECTION_IDS,
                "min_chars": 70 if section_id not in _OPTIONAL_SECTION_IDS else 0,
                "soft_max_chars": 720 if section_id not in _OPTIONAL_SECTION_IDS else 420,
                "starter_prompts": _starter_prompts(locale, role_context, section_id),
                "placeholder": hints.get(section_id) or item["hint"],
            }
        )
    return sections


def _jcfpm_percentile(snapshot: dict[str, Any], dimension: str) -> int:
    percentile_summary = _safe_dict(snapshot.get("percentile_summary"))
    try:
        if dimension in percentile_summary:
            return max(0, min(100, int(round(float(percentile_summary.get(dimension) or 0)))))
    except (TypeError, ValueError):
        pass

    for row in snapshot.get("dimension_scores") or []:
        if not isinstance(row, dict):
            continue
        if str(row.get("dimension") or "").strip() != dimension:
            continue
        try:
            return max(0, min(100, int(round(float(row.get("percentile") or 0)))))
        except (TypeError, ValueError):
            return 0
    return 0


def _build_signal_boost_fit_context(
    candidate_profile: dict[str, Any] | None,
    role_context: dict[str, Any],
    locale: str,
) -> dict[str, Any] | None:
    profile = candidate_profile or {}
    preferences = _safe_dict(profile.get("preferences"))
    snapshot = _safe_dict(preferences.get("jcfpm_v1"))
    if not snapshot:
        return None

    language = _normalize_locale(locale)
    archetype = str(role_context.get("archetype") or "generic")
    ai_report = _safe_dict(snapshot.get("ai_report"))
    strengths = _safe_list(ai_report.get("strengths"), limit=4)
    environment = _safe_list(ai_report.get("ideal_environment"), limit=4)
    development_areas = _safe_list(ai_report.get("development_areas"), limit=4)
    top_roles = _safe_list([_safe_dict(item).get("title") for item in (ai_report.get("top_roles") or [])], limit=3)

    d1 = _jcfpm_percentile(snapshot, "d1_cognitive")
    d2 = _jcfpm_percentile(snapshot, "d2_social")
    d3 = _jcfpm_percentile(snapshot, "d3_motivational")
    d4 = _jcfpm_percentile(snapshot, "d4_energy")
    d6 = _jcfpm_percentile(snapshot, "d6_ai_readiness")
    d12 = _jcfpm_percentile(snapshot, "d12_moral_compass")

    if language == "cs":
        headline_by_archetype = {
            "construction_site": "Co z tvého stylu práce může být pro tuhle roli přenosné a co už by byl vědomý stretch.",
            "customer_support": "Co z tvého stylu práce může supportu pomoct a kde by bylo fér být konkrétní o ramp-upu.",
            "operations": "Co se z tvého stylu práce do role dobře přenáší a kde by bylo dobré být poctivý o tření.",
            "product": "Co je pro tuhle roli přenositelná výhoda a kde je dobré role nepřikrášlovat.",
        }
        transferable_strengths = _safe_list(
            [
                "Silnější analytická a systémová orientace může pomoct tam, kde role potřebuje číst chaos a skládat z něj strukturu." if d1 >= 60 else "",
                "Vyšší úsudek a práce s principy může pomoct v rozhodnutích, kde nestačí jen tlačit na rychlost." if d12 >= 60 else "",
                "Dobrá adaptabilita může pomoct v prostředí, kde role teprve hledá funkční systém nebo nový způsob práce." if d6 >= 60 else "",
                strengths[0] if strengths else "",
                environment[0] if environment else "",
                f"Tvoje JCFPM ukazuje blízkost k rolím typu {', '.join(top_roles[:2])}, což může být dobrý přenos pro část téhle práce." if top_roles else "",
            ],
            limit=3,
        )
        stretch_areas = _safe_list(
            [
                "Tahle role může chtít víc každodenního tlaku na lidi, dodavatele nebo operativní follow-up, než co ti dlouhodobě bere energii." if archetype == "construction_site" and (d2 < 48 or d4 < 48) else "",
                "Pokud role stojí na častém nahánění, telefonování a tvrdém operativním rytmu, je fér to brát jako vědomý stretch, ne automatický fit." if archetype == "construction_site" and (d2 < 55 or d4 < 55) else "",
                "Support může chtít víc vysokofrekvenční komunikace a emočního přepínání, než co je přirozeně udržitelné." if archetype == "customer_support" and (d2 < 50 or d4 < 50) else "",
                "Role může chtít víc průběžného pushování lidí a operativního dotahování, než co je pro tebe přirozeně příjemný režim." if archetype in {"operations", "people", "sales"} and (d2 < 52 or d4 < 52) else "",
                "Je dobré nepředstírat hotovou doménovou zkušenost tam, kde by ses ve skutečnosti teprve rychle zaučoval(a)." if role_context.get("archetype") == "construction_site" else "",
                development_areas[0] if development_areas else "",
            ],
            limit=3,
        )
        framing_hint = (
            "Neschovávej to. Lepší je pojmenovat, co už přenášíš silně, kde by byl rychlý ramp-up a co by sis chtěl(a) ověřit v prvních týdnech."
        )
        recruiter_soft_signals = _safe_list(
            [
                "Má systémové a analytické uvažování, které může být přenosné i do nové domény." if d1 >= 60 else "",
                "Nepůsobí jako člověk, který by tlačil za každou cenu. Spíš chce nejdřív pochopit realitu a pak řídit další krok." if d12 >= 55 else "",
                "Role může být stretch hlavně tam, kde stojí na vysoké frekvenci follow-upů, telefonu nebo tvrdší vendor koordinaci." if stretch_areas else "",
            ],
            limit=3,
        )
        recruiter_validation_focus = _safe_list(
            [
                "Ověřit konkrétní doménový ramp-up: co už kandidát opravdu dělal v podobném provozu a co by se teprve učil(a).",
                "Ověřit, jak by fungoval(a) v rytmu, kde je hodně follow-upu, tlačení na dodavatele nebo každodenní operativní eskalace." if archetype == "construction_site" else "",
                "Ověřit, jestli jeho/její klidný styl zůstane funkční i v prostředí s vysokou frekvencí zákaznického tlaku." if archetype == "customer_support" else "",
            ],
            limit=3,
        )
        return {
            "headline": headline_by_archetype.get(archetype) or "Krátký fit kontext z tvého hlubšího profilu.",
            "transferable_strengths": transferable_strengths,
            "stretch_areas": stretch_areas,
            "framing_hint": framing_hint,
            "recruiter_soft_signals": recruiter_soft_signals,
            "recruiter_validation_focus": recruiter_validation_focus,
        }

    headline_by_archetype = {
        "construction_site": "Where your working style likely transfers well into this role, and where it would be a conscious stretch.",
        "customer_support": "Where your working style could help in support, and where it is worth being honest about the ramp-up.",
        "operations": "What transfers naturally from your working style here, and where the friction might show up.",
        "product": "What looks transferable for this role, and where it is better not to oversell the fit.",
    }
    transferable_strengths = _safe_list(
        [
            "Stronger analytical and systems thinking can transfer well into roles that need structure inside messy reality." if d1 >= 60 else "",
            "Judgment and principle-led thinking can help in roles where decisions matter more than pure speed." if d12 >= 60 else "",
            "Adaptability can help when the role is still building a system rather than inheriting a clean one." if d6 >= 60 else "",
            strengths[0] if strengths else "",
            environment[0] if environment else "",
            f"Your JCFPM profile is also close to roles like {', '.join(top_roles[:2])}, which can signal adjacent transferability." if top_roles else "",
        ],
        limit=3,
    )
    stretch_areas = _safe_list(
        [
            "This role may demand more daily pressure on people, suppliers, or follow-ups than what is naturally energizing for you." if archetype == "construction_site" and (d2 < 48 or d4 < 48) else "",
            "If the role depends on frequent chasing, calling, and hard operational push, that is better framed as a stretch than as an instant fit." if archetype == "construction_site" and (d2 < 55 or d4 < 55) else "",
            "Support may require more high-frequency communication and emotional switching than what feels naturally sustainable." if archetype == "customer_support" and (d2 < 50 or d4 < 50) else "",
            "The role may ask for more people-push and operational follow-through than what feels naturally comfortable." if archetype in {"operations", "people", "sales"} and (d2 < 52 or d4 < 52) else "",
            "It is better not to imply finished domain depth where the reality is fast ramp-up rather than prior depth." if role_context.get("archetype") == "construction_site" else "",
            development_areas[0] if development_areas else "",
        ],
        limit=3,
    )
    framing_hint = "Do not hide the gap. It is stronger to name what transfers well, where the ramp-up is real, and what you would want to validate in the first weeks."
    recruiter_soft_signals = _safe_list(
        [
            "Brings systems thinking that may transfer well even into a newer domain." if d1 >= 60 else "",
            "Does not read like someone who would push blindly; more likely to read reality first and then move." if d12 >= 55 else "",
            "The stretch is probably not in intelligence, but in the day-to-day rhythm if the role depends on constant follow-up, phone work, or harder supplier pressure." if stretch_areas else "",
        ],
        limit=3,
    )
    recruiter_validation_focus = _safe_list(
        [
            "Validate the domain ramp-up directly: what has already been done in a similar operating context, and what would still be learned on the job.",
            "Validate how the candidate handles a rhythm with heavy follow-up, supplier pressure, and daily operational escalation." if archetype == "construction_site" else "",
            "Validate whether the candidate's calmer style still holds under high-frequency customer pressure." if archetype == "customer_support" else "",
        ],
        limit=3,
    )
    return {
        "headline": headline_by_archetype.get(archetype) or "Short fit context from the deeper profile signal.",
        "transferable_strengths": transferable_strengths,
        "stretch_areas": stretch_areas,
        "framing_hint": framing_hint,
        "recruiter_soft_signals": recruiter_soft_signals,
        "recruiter_validation_focus": recruiter_validation_focus,
    }


def _starter_prompts(locale: str, role_context: dict[str, Any], section_id: str) -> list[str]:
    archetype = str(role_context.get("archetype") or "generic")
    language = _normalize_locale(locale)
    if language == "cs":
        prompts = {
            "problem_frame": {
                "construction_site": [
                    "Skutečný problém tady podle mě není jen skluz, ale hlavně to, že bez čistých onsite faktů se může rozpadnout další sekvence prací.",
                    "Jádro situace vidím v tom, že termín tlačí, ale rozhodnutí bez potvrzených dat od profesí by mohlo udělat větší škodu.",
                ],
                "customer_support": [
                    "Skutečný problém tady není jen naštvaný zákazník, ale kombinace frustrace, chybějícího kontextu a rizika špatné odpovědi pod tlakem času.",
                    "Největší tlak je v tom, že musím zklidnit situaci a zároveň si rychle srovnat fakta, abych neeskaloval(a) špatným směrem.",
                ],
            },
            "first_step": {
                "construction_site": [
                    "Jako první bych si na místě ověřil(a), kde se reálně láme sekvence a kdo blokuje další profesi.",
                    "První krok by u mě byl rychlý status s vedoucími profesí a kontrola, co je skutečně připravené a co jen vypadá připraveně.",
                ],
                "customer_support": [
                    "Jako první bych zákazníkovi odpověděl(a) tak, aby věděl, že situaci přebírám, a zároveň bych si otevřel(a) historii účtu a ticketu.",
                    "První krok by byl uklidnit tón komunikace a hned si vytáhnout chybějící fakta z interních systémů.",
                ],
            },
        }
        section_prompts = prompts.get(section_id, {})
        if archetype in section_prompts:
            return list(section_prompts[archetype])
        generic = {
            "problem_frame": [f"Skutečný problém tady podle mě souvisí hlavně s tím, jak role pracuje s {', '.join((role_context.get('focus_areas') or ['tlakem'])[:2])}."],
            "first_step": ["Jako první bych si ověřil(a) konkrétní místo, kde teď vzniká největší tlak nebo ztráta hodnoty."],
            "solution_direction": ["Teď bych upřednostnil(a) jeden menší stabilizační krok před širší změnou, dokud nebudu mít čistší data."],
            "risk_and_unknowns": ["Ještě bych potřeboval(a) potvrdit několik faktů, protože bez nich bych riskoval(a), že řeším špatnou věc."],
            "stakeholder_note": ["Potom bych to krátce srovnal(a) s člověkem, který drží nejbližší rozhodnutí nebo dopad."],
        }
        return generic.get(section_id, [])

    prompts = {
        "problem_frame": {
            "construction_site": [
                "The real problem here is not only the slip itself, but that the next site decisions can drift fast if the field facts are still noisy.",
                "I would treat this first as a sequencing and coordination issue, not just as a deadline issue.",
            ],
            "customer_support": [
                "The real problem is not only an angry customer. It is the mix of frustration, missing context, and the risk of a wrong answer under time pressure.",
                "I would frame this as a trust and fact-clarity problem before I frame it as a ticket-processing problem.",
            ],
        },
        "first_step": {
            "construction_site": [
                "First I would verify on site where the sequence is actually blocked and which trade is waiting on what.",
                "My first move would be a fast status check with the site leads plus a comparison between the live site state and the plan.",
            ],
            "customer_support": [
                "First I would send a calm first reply and immediately open the account history and ticket trail to fill the missing context.",
                "My first move would be to steady the customer interaction while pulling the internal facts that determine whether this is solvable or escalation-worthy.",
            ],
        },
    }
    section_prompts = prompts.get(section_id, {})
    if archetype in section_prompts:
        return list(section_prompts[archetype])
    generic = {
        "problem_frame": [f"The real pressure here seems tied to how the role handles {', '.join((role_context.get('focus_areas') or ['context'])[:2])}."],
        "first_step": ["First I would verify the place where the biggest pressure or value loss is actually happening."],
        "solution_direction": ["I would prioritize one stabilizing move before a broader change until I have cleaner evidence."],
        "risk_and_unknowns": ["I would still need to confirm a few facts, because otherwise I could end up solving the wrong problem."],
        "stakeholder_note": ["Then I would align quickly with the person closest to the next decision or impact."],
    }
    return generic.get(section_id, [])


def _ai_available() -> bool:
    return bool(config.MISTRAL_API_KEY or config.OPENAI_API_KEY)


def _signal_boost_ai_provider() -> str:
    if config.MISTRAL_API_KEY:
        return "mistral"
    return resolve_ai_provider()


def _signal_boost_primary_model() -> str:
    if _signal_boost_ai_provider() == "mistral":
        return os.getenv("MISTRAL_MODEL", "mistral-small-latest")
    return get_default_primary_model()


def _signal_boost_fallback_model() -> str | None:
    if _signal_boost_ai_provider() == "mistral":
        return os.getenv("MISTRAL_FALLBACK_MODEL") or os.getenv("MISTRAL_MODEL_FALLBACK") or None
    return get_default_fallback_model()


def _ai_meta_base() -> dict[str, Any]:
    provider = _signal_boost_ai_provider()
    try:
        model = _signal_boost_primary_model()
    except Exception:
        model = None
    return {
        "ai_provider": provider,
        "ai_model_requested": model,
    }


def build_signal_boost_brief(
    job_row: dict[str, Any],
    locale: str,
    *,
    candidate_profile: dict[str, Any] | None = None,
    prefer_ai: bool = False,
) -> dict[str, Any]:
    language = _normalize_locale(locale, _normalize_locale(job_row.get("language_code"), "en"))
    copy = _copy(language)
    role_context = _resolve_role_context(job_row, language)
    question_pack = _build_question_pack(role_context, language)
    scenario = _scenario_for_archetype(role_context, language)
    job_excerpt = _build_job_excerpt(job_row)
    fit_context = _build_signal_boost_fit_context(candidate_profile, role_context, language)

    return {
        "kicker": copy["kicker"],
        "timebox": copy["timebox"],
        "candidate_note": copy["note"],
        "anti_generic_hint": copy["anti_generic"],
        "cta_hint": copy["cta_hint"],
        "how_to_title": copy["how_to_title"],
        "deliverable_title": copy["deliverable_title"],
        "how_to_steps": list(copy.get("how_to_steps") or []),
        "job_excerpt_title": copy.get("job_excerpt_title"),
        "job_excerpt": job_excerpt or None,
        "scenario_title": scenario["title"],
        "scenario_context": scenario["context"],
        "core_problem": scenario["problem"],
        "constraints": list(copy["constraints"]),
        "structured_sections": _build_sections(language, role_context),
        "locale": language,
        "mini_case_type": "role_aware_mini_case",
        "role_context": role_context,
        "question_pack": question_pack,
        "fit_context": fit_context,
        "recruiter_reading_guide": copy["recruiter_reading_guide"],
        "meta": {
            "role_family": role_context.get("role_family"),
            "domain_key": role_context.get("domain_key"),
            "canonical_role": role_context.get("canonical_role"),
            "archetype": role_context.get("archetype"),
            "mapping_confidence": role_context.get("mapping_confidence"),
            "mapping_source": role_context.get("mapping_source"),
            "used_ai_fallback": False,
            **_ai_meta_base(),
            "ai_requested": bool(prefer_ai),
            "ai_used_brief": False,
            "ai_fallback_used": False,
            "ai_skip_reason": "deterministic_role_aware_brief",
        },
    }


def _fallback_starter_payload(brief: dict[str, Any], locale: str) -> dict[str, str]:
    role_context = dict(brief.get("role_context") or {})
    archetype = str(role_context.get("archetype") or "generic")
    language = _normalize_locale(locale)
    if language == "cs":
        if archetype == "construction_site":
            return {
                "problem_frame": "Skutečný problém tady podle mě není jen skluz, ale hlavně to, že bez čistých onsite faktů a potvrzení od profesí můžu přehodit plán špatným směrem.",
                "first_step": "Jako první bych si na místě ověřil(a), kde se reálně láme sekvence prací, kdo čeká na koho a jestli je blokace v připravenosti, bezpečnosti nebo materiálu.",
                "solution_direction": "Teď bych stabilizoval(a) nejbližší kritickou sekvenci a nepřehazoval(a) širší plán, dokud nebudu mít potvrzené, že tím nerozbíjím další návaznosti nebo BOZP.",
                "risk_and_unknowns": "Ještě bych potřeboval(a) vědět, co mají skutečně potvrzené subdodavatelé, kde je riziko bezpečnosti a které zdroje nebo povolení jsou opravdu připravené.",
                "stakeholder_note": "Jakmile bych měl(a) čistší stav, srovnal(a) bych další krok s PM a vedoucími profesí, aby byl jasný jeden společný postup.",
            }
        if archetype == "customer_support":
            return {
                "problem_frame": "Největší problém tady není jen nespokojený zákazník, ale to, že musím rychle uklidnit situaci a přitom si doplnit fakta, která v ticketu chybí.",
                "first_step": "Jako první bych zákazníkovi potvrdil(a), že případ přebírám, a hned bych si otevřel(a) historii účtu, předchozí komunikaci a technický kontext ticketu.",
                "solution_direction": "Teď bych prioritizoval(a) přesné srovnání problému a další jasný krok pro zákazníka. Nechtěl(a) bych zatím slibovat finální řešení, dokud nebude jasné, jestli je potřeba eskalace.",
                "risk_and_unknowns": "Potřeboval(a) bych ještě vědět, jaký je dopad problému, jestli běží SLA, co už bylo zkoušeno a jestli nehrozí, že špatným odhadem problém zhorším.",
                "stakeholder_note": "Pokud by se ukázalo, že to přesahuje support, předal(a) bych dál krátké shrnutí produktu nebo senior supportu s tím, co už je potvrzené a co zatím chybí.",
            }
    if archetype == "construction_site":
        return {
            "problem_frame": "The real problem is not only the site slip itself, but that I could easily move the plan in the wrong direction if the field facts and trade readiness are still noisy.",
            "first_step": "First I would verify on site where the sequence is actually breaking, who is waiting on whom, and whether the blocker is readiness, safety, or material reality.",
            "solution_direction": "I would stabilize the nearest critical sequence first and avoid reshuffling the broader plan until I know I am not breaking other dependencies or safety requirements.",
            "risk_and_unknowns": "I would still need to know what the subcontractors have truly confirmed, where the safety risk sits, and which resources or permits are actually ready.",
            "stakeholder_note": "Once the picture is cleaner, I would align the next move with the PM and trade leads so there is one shared version of the immediate plan.",
        }
    if archetype == "customer_support":
        return {
            "problem_frame": "The biggest issue is not only the unhappy customer. It is that I need to calm the situation quickly while filling in the facts that are still missing from the ticket.",
            "first_step": "First I would acknowledge ownership to the customer and immediately pull the account history, prior interactions, and the technical context behind the ticket.",
            "solution_direction": "I would prioritize clarifying the problem accurately and giving the customer one clear next step. I would not promise a final resolution yet until I know whether this should stay with me or escalate.",
            "risk_and_unknowns": "I would still need to know the impact, the SLA pressure, what has already been tried, and whether a wrong assumption here could make the case worse.",
            "stakeholder_note": "If it turns out to be bigger than support alone, I would pass a tight summary forward to product or senior support with the confirmed facts and the missing pieces.",
        }
    focus = ", ".join((role_context.get("focus_areas") or ["the role context"])[:3])
    return {
        "problem_frame": f"I think the real problem sits less in the visible symptom and more in how the role handles {focus}.",
        "first_step": "First I would verify the exact place where the current pressure or value loss is actually happening.",
        "solution_direction": "I would prioritize one stabilizing move before any broader redesign, because I do not want to widen the solution before the signal is cleaner.",
        "risk_and_unknowns": "I would still need a few more facts, numbers, or stakeholder confirmations so I do not commit too early to the wrong path.",
        "stakeholder_note": "After that I would align quickly with the person closest to the next decision or the main impact.",
    }


def build_signal_boost_starter_payload(
    job_row: dict[str, Any],
    locale: str,
    current_response_payload: dict[str, Any] | None = None,
    *,
    prefer_ai: bool = False,
) -> dict[str, Any]:
    language = _normalize_locale(locale, _normalize_locale(job_row.get("language_code"), "en"))
    current = current_response_payload if isinstance(current_response_payload, dict) else {}
    brief = build_signal_boost_brief(job_row, language, prefer_ai=prefer_ai)
    fallback = _fallback_starter_payload(brief, language)

    if not _ai_available():
        return {
            "response_payload": fallback,
            "meta": {**_ai_meta_base(), "used_ai": False, "ai_skip_reason": "provider_credentials_missing"},
        }

    prompt = f"""
Help a candidate start a role-aware Signal Boost mini case.

Locale: {language}
Role context: {json.dumps(brief.get("role_context") or {}, ensure_ascii=False)}
Question pack: {json.dumps(brief.get("question_pack") or [], ensure_ascii=False)}
Scenario title: {brief.get("scenario_title") or ""}
Scenario context: {brief.get("scenario_context") or ""}
Core problem: {brief.get("core_problem") or ""}
Current partial answers: {json.dumps(current, ensure_ascii=False)}

Return STRICT JSON with this exact shape:
{{
  "problem_frame": "string",
  "first_step": "string",
  "solution_direction": "string",
  "risk_and_unknowns": "string",
  "stakeholder_note": "string"
}}

Rules:
- Write in the requested locale.
- Keep every field concrete and role-specific.
- Use the question pack to stay grounded in the real role signal.
- Write in first person.
- Do not sound like a cover letter, textbook, or generic coaching answer.
- Include one concrete action, one clear trade-off, and one explicit uncertainty or risk.
- If current partial answers exist, stay aligned with them instead of contradicting them.
""".strip()

    try:
        result, fallback_used = call_primary_with_fallback(
            prompt,
            primary_model=_signal_boost_primary_model(),
            fallback_model=_signal_boost_fallback_model(),
            generation_config={"temperature": 0.35, "top_p": 0.9},
            provider_override=_signal_boost_ai_provider(),
        )
        parsed = _extract_json(result.text)
        response_payload = {
            section_id: _clip(parsed.get(section_id) or fallback.get(section_id), 720 if section_id not in _OPTIONAL_SECTION_IDS else 420)
            for section_id in _SECTION_IDS
        }
        return {
            "response_payload": response_payload,
            "meta": {
                **_ai_meta_base(),
                "used_ai": True,
                "ai_model_used": result.model_name,
                "ai_fallback_used": bool(fallback_used),
                "ai_tokens_in": result.tokens_in,
                "ai_tokens_out": result.tokens_out,
                "ai_latency_ms": result.latency_ms,
            },
        }
    except (AIClientError, ValueError) as exc:
        return {"response_payload": fallback, "meta": {**_ai_meta_base(), "used_ai": False, "ai_error": str(exc)}}


def _section_text(response_payload: dict[str, Any], section_id: str) -> str:
    if not isinstance(response_payload, dict):
        return ""
    return str(response_payload.get(section_id) or "").strip()


def _combined_response_text(response_payload: dict[str, Any]) -> str:
    return "\n".join(_section_text(response_payload, section_id) for section_id in _SECTION_IDS).strip()


def _role_specific_terms(brief: dict[str, Any] | None) -> list[str]:
    if not isinstance(brief, dict):
        return []
    role_context = dict(brief.get("role_context") or {})
    terms = []
    for value in (
        role_context.get("focus_areas") or [],
        role_context.get("job_evidence") or [],
        role_context.get("keywords") or [],
    ):
        for item in value:
            normalized = _normalize_text(item)
            if len(normalized) >= 5:
                terms.append(normalized)
                terms.extend(token for token in normalized.split(" ") if len(token) >= 5)
    normalized_title = _normalize_text(role_context.get("title"))
    if len(normalized_title) >= 5:
        terms.append(normalized_title)
        terms.extend(token for token in normalized_title.split(" ") if len(token) >= 5)
    deduped: list[str] = []
    seen: set[str] = set()
    for item in terms:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
        if len(deduped) >= 12:
            break
    return deduped


def _deterministic_quality(response_payload: dict[str, Any], locale: str, brief: dict[str, Any] | None = None) -> dict[str, Any]:
    language = _normalize_locale(locale)
    copy = _copy(language)
    problem_frame = _section_text(response_payload, "problem_frame")
    first_step = _section_text(response_payload, "first_step")
    solution_direction = _section_text(response_payload, "solution_direction")
    risks = _section_text(response_payload, "risk_and_unknowns")
    combined = _combined_response_text(response_payload)
    normalized = _normalize_text(combined)
    total_chars = len(combined)
    word_count = len(normalized.split()) if normalized else 0

    missing_problem_frame = len(problem_frame) < 60
    missing_first_step = len(first_step) < 60 or not any(marker in _normalize_text(first_step) for marker in _ACTION_MARKERS)
    missing_solution_direction = len(solution_direction) < 70 or not any(marker in _normalize_text(solution_direction) for marker in _TRADEOFF_MARKERS)
    missing_risks = len(risks) < 60 or not any(marker in _normalize_text(risks) for marker in _RISK_MARKERS)
    too_short = total_chars < 360 or word_count < 65
    genericity_hits = sum(1 for marker in _GENERIC_MARKERS if marker in normalized)
    role_terms = _role_specific_terms(brief)
    role_specificity_hits = sum(1 for term in role_terms if term in normalized)
    likely_generic = genericity_hits >= 2 or (role_terms and role_specificity_hits <= 0)

    nudges: list[str] = []
    if too_short:
        nudges.append(copy["nudges"]["too_short"])
    if missing_problem_frame:
        nudges.append(copy["nudges"]["problem_frame"])
    if missing_first_step:
        nudges.append(copy["nudges"]["first_step"])
    if missing_solution_direction:
        nudges.append(copy["nudges"]["solution_direction"])
    if missing_risks:
        nudges.append(copy["nudges"]["risk_and_unknowns"])
    if likely_generic:
        nudges.append(copy["nudges"]["generic"])

    scores = {
        "context_read": max(18, min(100, 32 + len(problem_frame) // 6 + (14 if not missing_problem_frame else 0) + (role_specificity_hits * 8))),
        "decision_quality": max(18, min(100, 30 + len(first_step) // 7 + len(solution_direction) // 10 + (14 if not missing_first_step else 0) + (14 if not missing_solution_direction else 0))),
        "risk_judgment": max(18, min(100, 28 + len(risks) // 7 + (18 if not missing_risks else 0))),
        "role_specificity": max(18, min(100, 26 + role_specificity_hits * 16 - genericity_hits * 6)),
    }

    publish_ready = not too_short and not missing_problem_frame and not missing_first_step and not missing_solution_direction and not missing_risks and not likely_generic
    return {
        "publish_ready": publish_ready,
        "total_chars": total_chars,
        "word_count": word_count,
        "too_short": too_short,
        "missing_problem_frame": missing_problem_frame,
        "missing_first_step": missing_first_step,
        "missing_solution_direction": missing_solution_direction,
        "missing_risks": missing_risks,
        "likely_generic": likely_generic,
        "genericity_hits": genericity_hits,
        "role_specificity_hits": role_specificity_hits,
        "nudges": nudges[:4],
        "scores": scores,
        # Compatibility fields for older consumers.
        "missing_first_move": missing_first_step,
        "missing_tradeoff": missing_solution_direction,
        "missing_unknowns": missing_risks,
    }


def _maybe_ai_quality(response_payload: dict[str, Any], locale: str, brief: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(brief, dict) or not _ai_available():
        return None
    combined = _combined_response_text(response_payload)
    if len(combined) < 260:
        return None

    prompt = f"""
Evaluate this candidate Signal Boost mini case for recruiter usefulness.

Locale: {_normalize_locale(locale)}
Role context: {json.dumps(brief.get("role_context") or {}, ensure_ascii=False)}
Question pack: {json.dumps(brief.get("question_pack") or [], ensure_ascii=False)}
Candidate response: {json.dumps(response_payload, ensure_ascii=False)}

Return STRICT JSON:
{{
  "publish_ready": true,
  "likely_generic": false,
  "missing_problem_frame": false,
  "missing_first_step": false,
  "missing_solution_direction": false,
  "missing_risks": false,
  "nudges": ["string"],
  "scores": {{
    "context_read": 78,
    "decision_quality": 81,
    "risk_judgment": 74,
    "role_specificity": 83
  }}
}}

Rules:
- Judge recruiter usefulness, not literary polish.
- Penalize vague, cover-letter style language.
- Reward role-specific reasoning, concrete first action, real trade-offs, and named unknowns.
- Keep nudges short and actionable.
""".strip()

    try:
        result, fallback_used = call_primary_with_fallback(
            prompt,
            primary_model=_signal_boost_primary_model(),
            fallback_model=_signal_boost_fallback_model(),
            generation_config={"temperature": 0.1, "top_p": 0.9},
            provider_override=_signal_boost_ai_provider(),
        )
        parsed = _extract_json(result.text)
        scores_raw = dict(parsed.get("scores") or {})
        return {
            "publish_ready": bool(parsed.get("publish_ready")),
            "likely_generic": bool(parsed.get("likely_generic")),
            "missing_problem_frame": bool(parsed.get("missing_problem_frame")),
            "missing_first_step": bool(parsed.get("missing_first_step")),
            "missing_solution_direction": bool(parsed.get("missing_solution_direction")),
            "missing_risks": bool(parsed.get("missing_risks")),
            "nudges": _safe_list(parsed.get("nudges"), limit=4),
            "scores": {
                "context_read": max(18, min(100, int(scores_raw.get("context_read") or 18))),
                "decision_quality": max(18, min(100, int(scores_raw.get("decision_quality") or 18))),
                "risk_judgment": max(18, min(100, int(scores_raw.get("risk_judgment") or 18))),
                "role_specificity": max(18, min(100, int(scores_raw.get("role_specificity") or 18))),
            },
            "ai_quality_used": True,
            "ai_model_used": result.model_name,
            "ai_fallback_used": bool(fallback_used),
        }
    except (AIClientError, ValueError, TypeError):
        return None


def evaluate_signal_boost_quality(response_payload: dict[str, Any], locale: str, brief: dict[str, Any] | None = None) -> dict[str, Any]:
    deterministic = _deterministic_quality(response_payload, locale, brief)
    ai_quality = _maybe_ai_quality(response_payload, locale, brief)
    if not ai_quality:
        return deterministic

    nudges = _safe_list(list(ai_quality.get("nudges") or []) + list(deterministic.get("nudges") or []), limit=4)
    merged = {
        **deterministic,
        "publish_ready": bool(ai_quality.get("publish_ready")),
        "likely_generic": bool(ai_quality.get("likely_generic")),
        "missing_problem_frame": bool(ai_quality.get("missing_problem_frame")),
        "missing_first_step": bool(ai_quality.get("missing_first_step")),
        "missing_solution_direction": bool(ai_quality.get("missing_solution_direction")),
        "missing_risks": bool(ai_quality.get("missing_risks")),
        "missing_first_move": bool(ai_quality.get("missing_first_step")),
        "missing_tradeoff": bool(ai_quality.get("missing_solution_direction")),
        "missing_unknowns": bool(ai_quality.get("missing_risks")),
        "nudges": nudges,
        "scores": dict(ai_quality.get("scores") or deterministic.get("scores") or {}),
        "ai_quality_used": True,
        "ai_model_used": ai_quality.get("ai_model_used"),
        "ai_fallback_used": ai_quality.get("ai_fallback_used"),
    }
    return merged


def build_signal_boost_summary(
    response_payload: dict[str, Any],
    locale: str,
    quality: dict[str, Any] | None = None,
    brief: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    evaluation = quality or evaluate_signal_boost_quality(response_payload, locale, brief=brief)
    if not evaluation.get("publish_ready") or evaluation.get("likely_generic"):
        return None

    labels = _copy(_normalize_locale(locale))["summary_labels"]
    scores = dict(evaluation.get("scores") or {})
    return {
        "items": [
            {"key": "context_read", "label": labels["context_read"], "score": max(18, min(100, int(scores.get("context_read") or 18)))},
            {"key": "decision_quality", "label": labels["decision_quality"], "score": max(18, min(100, int(scores.get("decision_quality") or 18)))},
            {"key": "risk_judgment", "label": labels["risk_judgment"], "score": max(18, min(100, int(scores.get("risk_judgment") or 18)))},
            {"key": "role_specificity", "label": labels["role_specificity"], "score": max(18, min(100, int(scores.get("role_specificity") or 18)))},
        ],
        "suppressed": False,
    }


def _deterministic_recruiter_readout(
    response_payload: dict[str, Any],
    locale: str,
    brief: dict[str, Any],
    quality: dict[str, Any],
) -> dict[str, Any]:
    role_context = dict(brief.get("role_context") or {})
    archetype = str(role_context.get("archetype") or "generic")
    language = _normalize_locale(locale)
    quality_scores = dict(quality.get("scores") or {})
    question_pack = list(brief.get("question_pack") or [])
    fit_context = _safe_dict(brief.get("fit_context"))
    first_step = _section_text(response_payload, "first_step")
    problem_frame = _section_text(response_payload, "problem_frame")
    risks = _section_text(response_payload, "risk_and_unknowns")
    role_title = str(role_context.get("title") or role_context.get("canonical_role") or "the role")

    if language == "cs":
        headline_by_archetype = {
            "construction_site": "Ukazuje, jak by kandidát četl stav na stavbě dřív, než sáhne do plánu.",
            "customer_support": "Ukazuje, jak by kandidát zvládl tlak zákazníka a neúplný ticket bez ztráty přesnosti.",
            "operations": "Ukazuje, jak by kandidát hledal skutečné provozní tření místo povrchní optimalizace.",
            "product": "Ukazuje, jak by kandidát šel po signálu dřív než po řešení.",
            "people": "Ukazuje, jak by kandidát diagnostikoval proces a slabá místa v práci s lidmi.",
            "sales": "Ukazuje, jak by kandidát hledal další rozhodující obchodní krok místo prázdné aktivity.",
            "engineering": "Ukazuje, jak by kandidát rozlišil diagnostiku, stabilizaci a větší technickou změnu.",
        }
        what_cv_by_archetype = {
            "construction_site": [
                "Jak rychle si srovná sekvenci, bezpečnost a připravenost profesí na stavbě.",
                "Jak pracuje s neúplnými onsite fakty dřív, než změní plán.",
                "Jak vyvažuje termín proti koordinaci a reálnému stavu zdrojů.",
            ],
            "customer_support": [
                "Jak uklidní frustrovaného zákazníka bez planých slibů.",
                "Jak rozlišuje mezi řešením, eskalací a doplněním kontextu.",
                "Jak uzavírá learning loop směrem k produktu nebo operations.",
            ],
        }
        generic_what_cv = [
            "Jak kandidát čte kontext role dřív, než navrhne řešení.",
            "Jak rychle se umí přepnout z úvahy do konkrétní první akce.",
            "Jak pojmenuje rizika a neznámé místo předstírané jistoty.",
        ]
        strength_signals = _safe_list(
            [
                "Čte skutečný problém dřív, než se vrhne do akce." if not quality.get("missing_problem_frame") else "",
                "Volí konkrétní první krok místo obecného úmyslu." if not quality.get("missing_first_step") else "",
                "Pojmenovává trade-off a směr řešení." if not quality.get("missing_solution_direction") else "",
                "Pracuje s riziky a chybějícími fakty." if not quality.get("missing_risks") else "",
                *(fit_context.get("recruiter_soft_signals") or []),
                f"Používá role-specific detail z oblasti: {', '.join((role_context.get('focus_areas') or [])[:2])}." if int(quality.get("role_specificity_hits") or 0) > 0 else "",
            ],
            limit=4,
        )
        risk_flags = _safe_list(
            [
                "Z odpovědi ještě není úplně jasné, co je skutečný problém." if quality.get("missing_problem_frame") else "",
                "Chybí ostřejší první krok, podle kterého by šlo poznat skutečné pracovní chování." if quality.get("missing_first_step") else "",
                "Trade-off nebo směr řešení je zatím slabší a chce doplnit." if quality.get("missing_solution_direction") else "",
                "Rizika a rozhodovací neznámé jsou zatím pojmenované jen částečně." if quality.get("missing_risks") else "",
                *(fit_context.get("stretch_areas") or []),
            ],
            limit=4,
        )
        follow_up_questions = _safe_list(
            [
                *(fit_context.get("recruiter_validation_focus") or []),
                question_pack[1].get("question") if len(question_pack) > 1 else "",
                question_pack[2].get("question") if len(question_pack) > 2 else "",
                "Co by udělal(a), kdyby se první předpoklad ukázal jako chybný?",
            ],
            limit=3,
        )
        recommended_next_step = (
            "Dává smysl otevřít navazující rozhovor nad konkrétní situací z role a nechat kandidáta rozvést první rozhodnutí a práci s rizikem."
            if quality.get("publish_ready")
            else "Nejprve bych kandidáta dotlačil k konkrétnějšímu prvnímu kroku a jasnějším rizikům, teprve potom bych tento signál bral jako silný podklad."
        )
        return {
            "headline": headline_by_archetype.get(archetype) or f"Ukazuje, jak kandidát přemýšlí v roli {role_title}, když ještě nemá všechna data.",
            "strength_signals": strength_signals or ["Odpověď už ukazuje základní pracovní úsudek nad konkrétní situací."],
            "risk_flags": risk_flags,
            "follow_up_questions": follow_up_questions,
            "what_cv_does_not_show": what_cv_by_archetype.get(archetype) or generic_what_cv,
            "recommended_next_step": recommended_next_step,
            "fit_context": fit_context or None,
            "scores_snapshot": {
                "context_read": int(quality_scores.get("context_read") or 18),
                "decision_quality": int(quality_scores.get("decision_quality") or 18),
                "risk_judgment": int(quality_scores.get("risk_judgment") or 18),
                "role_specificity": int(quality_scores.get("role_specificity") or 18),
            },
            "evidence_excerpt": _clip(first_step or problem_frame or risks, 180) or None,
        }

    headline_by_archetype = {
        "construction_site": "Shows how the candidate reads site reality before they start moving the plan.",
        "customer_support": "Shows how the candidate handles a frustrated customer and incomplete context without losing precision.",
        "operations": "Shows how the candidate looks for the real operational drag instead of surface-level optimization.",
        "product": "Shows how the candidate follows signal before solution.",
        "people": "Shows how the candidate diagnoses a people process rather than just reacting to symptoms.",
        "sales": "Shows how the candidate looks for the decisive next commercial move instead of empty activity.",
        "engineering": "Shows how the candidate separates diagnosis, stabilization, and larger technical change.",
    }
    what_cv_by_archetype = {
        "construction_site": [
            "How they balance sequencing, safety, and subcontractor readiness on the ground.",
            "How they work with incomplete site facts before changing the plan.",
            "How they weigh deadline pressure against resource reality and coordination.",
        ],
        "customer_support": [
            "How they calm a frustrated customer without overpromising.",
            "How they judge solving vs escalating vs clarifying.",
            "How they turn a messy ticket into a learning signal for the rest of the company.",
        ],
    }
    generic_what_cv = [
        "How the candidate reads the role context before proposing a solution.",
        "How quickly they turn thinking into a concrete first move.",
        "How they name risks and unknowns instead of pretending certainty.",
    ]
    strength_signals = _safe_list(
        [
            "Reads the real problem before jumping into action." if not quality.get("missing_problem_frame") else "",
            "Commits to a concrete first move instead of abstract intent." if not quality.get("missing_first_step") else "",
            "Shows a real trade-off and solution direction." if not quality.get("missing_solution_direction") else "",
            "Works with risks and missing facts rather than pretending certainty." if not quality.get("missing_risks") else "",
            *(fit_context.get("recruiter_soft_signals") or []),
            f"Uses role-specific detail around {', '.join((role_context.get('focus_areas') or [])[:2])}." if int(quality.get("role_specificity_hits") or 0) > 0 else "",
        ],
        limit=4,
    )
    risk_flags = _safe_list(
        [
            "The response still needs a sharper problem frame." if quality.get("missing_problem_frame") else "",
            "The first move is still too soft or abstract." if quality.get("missing_first_step") else "",
            "The trade-off or solution direction still needs more substance." if quality.get("missing_solution_direction") else "",
            "The risks and decision-critical unknowns still need to be named more clearly." if quality.get("missing_risks") else "",
            *(fit_context.get("stretch_areas") or []),
        ],
        limit=4,
    )
    follow_up_questions = _safe_list(
        [
            *(fit_context.get("recruiter_validation_focus") or []),
            question_pack[1].get("question") if len(question_pack) > 1 else "",
            question_pack[2].get("question") if len(question_pack) > 2 else "",
            "What would they do if their first assumption turned out to be wrong?",
        ],
        limit=3,
    )
    recommended_next_step = (
        "Worth using as a follow-up interview anchor: ask the candidate to walk through the first move, the trade-off, and what they would verify next."
        if quality.get("publish_ready")
        else "Push for a more concrete first move and clearer risks before treating this as a strong hiring signal."
    )
    return {
        "headline": headline_by_archetype.get(archetype) or f"Shows how the candidate thinks in the {role_title} role when the context is still incomplete.",
        "strength_signals": strength_signals or ["The response already shows some practical judgment inside a concrete situation."],
        "risk_flags": risk_flags,
        "follow_up_questions": follow_up_questions,
        "what_cv_does_not_show": what_cv_by_archetype.get(archetype) or generic_what_cv,
        "recommended_next_step": recommended_next_step,
        "fit_context": fit_context or None,
        "scores_snapshot": {
            "context_read": int(quality_scores.get("context_read") or 18),
            "decision_quality": int(quality_scores.get("decision_quality") or 18),
            "risk_judgment": int(quality_scores.get("risk_judgment") or 18),
            "role_specificity": int(quality_scores.get("role_specificity") or 18),
        },
        "evidence_excerpt": _clip(first_step or problem_frame or risks, 180) or None,
    }


def _maybe_ai_recruiter_readout(
    response_payload: dict[str, Any],
    locale: str,
    brief: dict[str, Any],
    quality: dict[str, Any],
) -> dict[str, Any] | None:
    if not _ai_available():
        return None
    combined = _combined_response_text(response_payload)
    if len(combined) < 260:
        return None

    prompt = f"""
You are writing a recruiter-ready readout for a candidate mini case.

Locale: {_normalize_locale(locale)}
Role context: {json.dumps(brief.get("role_context") or {}, ensure_ascii=False)}
Question pack: {json.dumps(brief.get("question_pack") or [], ensure_ascii=False)}
Fit context: {json.dumps(brief.get("fit_context") or {}, ensure_ascii=False)}
Candidate response: {json.dumps(response_payload, ensure_ascii=False)}
Quality signals: {json.dumps(quality, ensure_ascii=False)}

Return STRICT JSON:
{{
  "headline": "string",
  "strength_signals": ["string"],
  "risk_flags": ["string"],
  "follow_up_questions": ["string"],
  "what_cv_does_not_show": ["string"],
  "recommended_next_step": "string",
  "fit_context": {{
    "headline": "string",
    "transferable_strengths": ["string"],
    "stretch_areas": ["string"],
    "framing_hint": "string",
    "recruiter_soft_signals": ["string"],
    "recruiter_validation_focus": ["string"]
  }}
}}

Rules:
- Write for recruiters, not for candidates.
- Make the output sound sharper and more decision-useful than a CV summary.
- Do not praise empty things like motivation or communication skills.
- Ground the readout in the actual role context and candidate response.
- Keep lists short: 2 to 4 items each.
""".strip()

    try:
        result, fallback_used = call_primary_with_fallback(
            prompt,
            primary_model=_signal_boost_primary_model(),
            fallback_model=_signal_boost_fallback_model(),
            generation_config={"temperature": 0.2, "top_p": 0.9},
            provider_override=_signal_boost_ai_provider(),
        )
        parsed = _extract_json(result.text)
        readout = {
            "headline": _clip(parsed.get("headline"), 220),
            "strength_signals": _safe_list(parsed.get("strength_signals"), limit=4),
            "risk_flags": _safe_list(parsed.get("risk_flags"), limit=4),
            "follow_up_questions": _safe_list(parsed.get("follow_up_questions"), limit=4),
            "what_cv_does_not_show": _safe_list(parsed.get("what_cv_does_not_show"), limit=4),
            "recommended_next_step": _clip(parsed.get("recommended_next_step"), 260),
            "fit_context": {
                "headline": _clip(_safe_dict(parsed.get("fit_context")).get("headline"), 220),
                "transferable_strengths": _safe_list(_safe_dict(parsed.get("fit_context")).get("transferable_strengths"), limit=4),
                "stretch_areas": _safe_list(_safe_dict(parsed.get("fit_context")).get("stretch_areas"), limit=4),
                "framing_hint": _clip(_safe_dict(parsed.get("fit_context")).get("framing_hint"), 240),
                "recruiter_soft_signals": _safe_list(_safe_dict(parsed.get("fit_context")).get("recruiter_soft_signals"), limit=4),
                "recruiter_validation_focus": _safe_list(_safe_dict(parsed.get("fit_context")).get("recruiter_validation_focus"), limit=4),
            },
            "ai_used": True,
            "ai_model_used": result.model_name,
            "ai_fallback_used": bool(fallback_used),
        }
        if not readout["headline"] or not readout["strength_signals"] or not readout["what_cv_does_not_show"]:
            return None
        return readout
    except (AIClientError, ValueError, TypeError):
        return None


def build_signal_boost_recruiter_readout(
    response_payload: dict[str, Any],
    locale: str,
    brief: dict[str, Any],
    quality: dict[str, Any] | None = None,
) -> dict[str, Any]:
    evaluation = quality or evaluate_signal_boost_quality(response_payload, locale, brief=brief)
    ai_readout = _maybe_ai_recruiter_readout(response_payload, locale, brief, evaluation)
    deterministic = _deterministic_recruiter_readout(response_payload, locale, brief, evaluation)
    if not ai_readout:
        return deterministic
    merged = {**deterministic, **ai_readout}
    if "scores_snapshot" not in merged:
        merged["scores_snapshot"] = deterministic.get("scores_snapshot")
    if "evidence_excerpt" not in merged:
        merged["evidence_excerpt"] = deterministic.get("evidence_excerpt")
    return merged
