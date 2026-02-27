from __future__ import annotations
import json
from typing import Any, Dict, List, Tuple
from ..ai_orchestration.client import call_primary_with_fallback, _extract_json, AIClientError
from ..core.runtime_config import get_active_model_config

DEFAULT_REPORT = {
    "strengths": [],
    "ideal_environment": [],
    "top_roles": [],
    "development_areas": [],
    "next_steps": [],
    "ai_readiness": "",
}

DIMENSION_META = {
    "d1_cognitive": {
        "title": "Kognitivní styl",
        "definition": "Způsob zpracování informací a řešení problémů.",
        "contrast": "Analytické vs. intuitivní • Struktura vs. improvizace • Detail vs. big picture",
    },
    "d2_social": {
        "title": "Sociální styl",
        "definition": "Jak pracuješ s lidmi, týmem a odpovědností.",
        "contrast": "Solo vs. tým • Leader vs. člen • Interní vs. externí komunikace",
    },
    "d3_motivational": {
        "title": "Motivační profil",
        "definition": "Co tě dlouhodobě táhne a udrží u výkonu.",
        "contrast": "Autonomie vs. struktura • Rozvoj vs. výkon • Vnitřní vs. vnější motivace",
    },
    "d4_energy": {
        "title": "Energetický režim",
        "definition": "Jaké tempo a typ zátěže ti sedí.",
        "contrast": "Sprinty vs. stabilita • Multitasking vs. fokus • Změny vs. předvídatelnost",
    },
    "d5_values": {
        "title": "Hodnotové ukotvení",
        "definition": "Co musí práce přinášet, aby dávala smysl.",
        "contrast": "Impact vs. osobní růst • Inovace vs. stabilita • Vztahy vs. výkon",
    },
    "d6_ai_readiness": {
        "title": "AI readiness",
        "definition": "Ochota učit se, adaptovat se a využívat AI v práci.",
        "contrast": "Rychlá adaptace vs. jistota • Experimentování vs. osvědčené postupy",
    },
    "d7_cognitive_reflection": {
        "title": "Cognitive Reflection & Logic",
        "definition": "Schopnost zastavit první intuici a ověřit ji logikou.",
        "contrast": "Rychlá intuice vs. ověřená logika • Šum vs. důkaz",
    },
    "d8_digital_eq": {
        "title": "Digitální EQ",
        "definition": "Citlivost na emoce, tón a důvěru v textové komunikaci.",
        "contrast": "Empatie vs. direktiva • Kontext vs. tvrdý výkon",
    },
    "d9_systems_thinking": {
        "title": "Systémové myšlení",
        "definition": "Schopnost chápat vztahy, zpětné vazby a vedlejší efekty.",
        "contrast": "Lineární příčina vs. síť vztahů • Krátkodobé vs. dlouhodobé",
    },
    "d10_ambiguity_interpretation": {
        "title": "Interpretace ambiguity",
        "definition": "Jak čteš nejasné situace – rizika vs. příležitosti.",
        "contrast": "Opatrnost vs. průzkum • Ochrana vs. růst",
    },
    "d11_problem_decomposition": {
        "title": "Rozklad problémů",
        "definition": "Jak dokážeš rozsekat velký problém na jasné kroky.",
        "contrast": "Chaos vs. struktura • Prioritizace vs. paralelní tlak",
    },
    "d12_moral_compass": {
        "title": "Morální & etický kompas",
        "definition": "Stabilita hodnot v dilematech a tlakových situacích.",
        "contrast": "Krátkodobý zisk vs. dlouhodobá integrita",
    },
}

LEVEL_ORDER = ("low", "mid_low", "balanced", "high")


_EXTENDED_DIMS = {
    "d7_cognitive_reflection",
    "d8_digital_eq",
    "d9_systems_thinking",
    "d10_ambiguity_interpretation",
    "d11_problem_decomposition",
    "d12_moral_compass",
}


def _level_for(score: float, dim: str | None = None) -> str:
    if dim in _EXTENDED_DIMS:
        if score < 40:
            return "low"
        if score < 60:
            return "mid_low"
        if score < 80:
            return "balanced"
        return "high"
    if score < 2.5:
        return "low"
    if score < 4.5:
        return "mid_low"
    if score < 5.5:
        return "balanced"
    return "high"


def _fmt_dim(dim_row: Dict[str, Any]) -> str:
    dim = dim_row.get("dimension")
    title = DIMENSION_META.get(dim, {}).get("title", dim)
    score = dim_row.get("raw_score")
    pct = dim_row.get("percentile")
    max_score = 100 if dim in _EXTENDED_DIMS else 7
    return f"{title} ({score}/{max_score}, {pct}. percentil)"


def _dimension_sentence(dim_row: Dict[str, Any]) -> str:
    dim = dim_row.get("dimension")
    title = DIMENSION_META.get(dim, {}).get("title", dim)
    level = _level_for(float(dim_row.get("raw_score") or 0), dim)
    if dim == "d1_cognitive":
        if level == "high":
            return "Silná analytika a potřeba struktury ti pomáhá rozkládat složité problémy na kroky a držet kvalitu i pod tlakem."
        if level == "balanced":
            return "Dokážeš přepínat mezi analýzou a intuicí, takže umíš jak strukturovat problém, tak rychle rozhodnout v nejasnosti."
        return "Intuice a pružnost jsou tvou výhodou v nejasných situacích, kde nejsou data a je potřeba rychle najít cestu."
    if dim == "d2_social":
        if level == "high":
            return "Silně týmový styl: nabíjí tě koordinace a společné cíle, dobře vedeš komunikaci a vztahy."
        if level == "balanced":
            return "Jsi vyvážený mezi solo a týmovou prací, zvládáš samostatný výkon i spolupráci."
        return "Preferuješ samostatnost a kontrolu nad vlastní prací, nejlépe funguješ s jasným rámcem a minimem rušivých interakcí."
    if dim == "d3_motivational":
        if level == "high":
            return "Silná vnitřní motivace: táhne tě smysl, autonomní práce a dlouhodobý růst."
        if level == "balanced":
            return "Motivuje tě kombinace výkonu i rozvoje, fungují ti jasné cíle i prostor pro zlepšování."
        return "Silněji reaguješ na vnější cíle a konkrétní výsledky, potřebuješ měřitelné výstupy a uznání."
    if dim == "d4_energy":
        if level == "high":
            return "Vyhovuje ti rychlé tempo a změny, umíš se zvednout v dynamice a náročných situacích."
        if level == "balanced":
            return "Zvládáš jak intenzitu, tak stabilitu; výkon držíš napříč různými režimy práce."
        return "Nejlépe funguješ ve stabilním rytmu, kde můžeš pracovat do hloubky bez neustálého přepínání."
    if dim == "d5_values":
        if level == "high":
            return "Hodnoty tě táhnou k dopadu a inovaci; potřebuješ cítit, že práce mění věci k lepšímu."
        if level == "balanced":
            return "Hledáš rovnováhu mezi smyslem, stabilitou a osobním růstem."
        return "Důležitá je pro tebe stabilita a predikovatelnost; smysl vidíš v dlouhodobé jistotě a řádu."
    if dim == "d6_ai_readiness":
        if level == "high":
            return "Silná ochota učit se a experimentovat s AI ti dává náskok v rolích, kde se procesy rychle mění."
        if level == "balanced":
            return "AI bereš pragmaticky: využíváš ji tam, kde dává jasný přínos, ale držíš si bezpečný rámec."
        return "Preferuješ ověřené postupy a stabilitu, což je výhoda v prostředích s přísnými pravidly."
    if dim == "d7_cognitive_reflection":
        if level == "high":
            return "Dokážeš zachytit chybnou intuici a ověřit ji logikou, což ti dává silný „bullshit detector“."
        if level == "balanced":
            return "Umíš přepínat mezi rychlou intuicí a ověřením, když jde o důležitá rozhodnutí."
        return "Spoléháš se na rychlý úsudek; v komplexních úlohách můžeš těžit z vědomého ověřování."
    if dim == "d8_digital_eq":
        if level == "high":
            return "V textu čteš nuance, emoce i kontext, a dokážeš budovat důvěru i na dálku."
        if level == "balanced":
            return "Zvládáš základní digitální empatii, ale při napětí pomůže explicitně ověřovat význam."
        return "Tón v textu můžeš snadno přehlédnout; jasná pravidla komunikace ti zlepší výsledky."
    if dim == "d9_systems_thinking":
        if level == "high":
            return "Vidíš souvislosti, zpětné vazby a vedlejší efekty, takže umíš navrhovat stabilní řešení."
        if level == "balanced":
            return "Umíš kombinovat lineární a systémový pohled, což je dobrý základ pro návrh procesů."
        return "Preferuješ přímé příčiny a následky; pomůže mapovat širší dopady změn."
    if dim == "d10_ambiguity_interpretation":
        if level == "high":
            return "V nejasnosti vidíš příležitosti a dokážeš aktivně zkoumat nové cesty."
        if level == "balanced":
            return "Umíš držet rovnováhu mezi opatrností a průzkumem, což snižuje rizika."
        return "V nejasnosti vnímáš spíš rizika; jasný rámec ti zlepší jistotu."
    if dim == "d11_problem_decomposition":
        if level == "high":
            return "Dokážeš rozsekat velké cíle na jasné kroky a prioritizovat bez ztráty směru."
        if level == "balanced":
            return "Zvládáš základní strukturování, ale nejlépe funguješ s dopředu daným rámcem."
        return "Rozklad problému je náročnější; pomáhají checklisty a explicitní workflow."
    if dim == "d12_moral_compass":
        if level == "high":
            return "Dokážeš držet integritu i pod tlakem a rozhoduješ se konzistentně s hodnotami."
        if level == "balanced":
            return "Tvé rozhodování je stabilní, ale v šedých zónách pomáhá explicitní etický rámec."
        return "V dilematech spíš optimalizuješ výkon; dlouhodobě může pomoci jasné hodnotové ukotvení."
    return "Tato dimenze vykazuje stabilní, dobře čitelný profil."


def _build_fallback_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    dim_scores = payload.get("dimension_scores") or []
    top_roles = payload.get("top_roles") or []
    if not isinstance(dim_scores, list):
        dim_scores = []
    if not isinstance(top_roles, list):
        top_roles = []

    sorted_by_pct = sorted(dim_scores, key=lambda r: float(r.get("percentile") or 0), reverse=True)
    sorted_by_low = sorted(dim_scores, key=lambda r: float(r.get("percentile") or 0))

    strengths_rows = (sorted_by_pct[:3] or sorted_by_pct[:2] or dim_scores[:2])
    dev_rows = (sorted_by_low[:2] or sorted_by_low[:1] or dim_scores[:1])

    strengths: List[str] = []
    for row in strengths_rows:
        strengths.append(f"{_fmt_dim(row)}. {_dimension_sentence(row)}")

    development: List[str] = []
    for row in dev_rows:
        dim = row.get("dimension")
        title = DIMENSION_META.get(dim, {}).get("title", dim)
        level = _level_for(float(row.get("raw_score") or 0), dim)
        if level == "high":
            detail = "Pozor na přetížení: vysoká intenzita potřebuje vědomou regeneraci a disciplínu v prioritách."
        elif level == "balanced":
            detail = "V této oblasti máš zdravou rovnováhu; výhodu získáš, když ji propojíš s nejsilnějšími stránkami."
        else:
            detail = "Tady je prostor pro růst: drobné změny prostředí nebo návyků můžou výrazně zvednout komfort a výkon."
        max_score = 100 if dim in _EXTENDED_DIMS else 7
        development.append(f"{title} ({row.get('raw_score')}/{max_score}, {row.get('percentile')}. percentil). {detail}")

    # Ideal environment derived from D2/D4/D5 (fallback to others if missing)
    ideal_environment: List[str] = []
    for dim in ("d2_social", "d4_energy", "d5_values"):
        row = next((r for r in dim_scores if r.get("dimension") == dim), None)
        if not row:
            continue
        level = _level_for(float(row.get("raw_score") or 0), dim)
        if dim == "d2_social":
            ideal_environment.append(
                "Prospíváš v týmech s jasnou rolí a kvalitní komunikací." if level in ("high", "balanced")
                else "Nejlépe funguješ v samostatných úkolech s jasným zadáním a minimem rušivých meetingů."
            )
        if dim == "d4_energy":
            ideal_environment.append(
                "Dynamické prostředí ti sedí, když máš možnost rychle rozhodovat a měnit směr." if level == "high"
                else "Stabilní rytmus, hlubší fokus a předvídatelné priority ti umožní podávat nejlepší výkon."
            )
        if dim == "d5_values":
            ideal_environment.append(
                "Potřebuješ vidět dopad práce a možnost inovovat." if level == "high"
                else "Důležitá je stabilita, férovost a jasné standardy."
            )
    if len(ideal_environment) < 3:
        ideal_environment.append("Hledej role s jasným očekáváním výsledku a realistickým tempem.")

    # Top roles with reasons tied to top dims
    top_roles_out: List[Dict[str, str]] = []
    reason_dims = strengths_rows[:2] or dim_scores[:2]
    reason_bits = [DIMENSION_META.get(r.get("dimension"), {}).get("title", r.get("dimension")) for r in reason_dims]
    reason_scores = [
        f"{r.get('raw_score')}/{100 if r.get('dimension') in _EXTENDED_DIMS else 7}" for r in reason_dims
    ]
    reason_effects = [_dimension_sentence(r) for r in reason_dims]
    for role in top_roles[:5]:
        title = role.get("title") or "Role"
        reason = f"Sedí díky {reason_bits[0]} ({reason_scores[0]})"
        if len(reason_bits) > 1:
            reason += f" a {reason_bits[1]} ({reason_scores[1]}). {reason_effects[0]} {reason_effects[1]}"
        else:
            reason += ", což podporuje způsob práce typický pro tuto roli."
        top_roles_out.append({"title": title, "reason": reason})

    next_steps = [
        "Ověř si 1–2 top role krátkým projektem nebo stínováním v praxi.",
        "Vyber prostředí, které odpovídá tvému energetickému režimu, a nastav si režim práce dopředu.",
        "Rozviň nejslabší dimenzi malým experimentem (např. nový typ úkolu, změna tempa, jiný styl spolupráce).",
    ]
    if top_roles:
        next_steps.append(f"Porovnej nabídky v rolích typu {top_roles[0].get('title')} podle míry autonomie a vlivu.")

    # AI readiness summary
    d6 = next((r for r in dim_scores if r.get("dimension") == "d6_ai_readiness"), None)
    if d6:
        d6_level = _level_for(float(d6.get("raw_score") or 0), "d6_ai_readiness")
        if d6_level == "high":
            ai_readiness = "Máš vysokou AI připravenost a rychlou adaptaci. Vyhledávej role, kde se AI aktivně používá a procesy se rychle mění."
        elif d6_level == "balanced":
            ai_readiness = "AI vnímáš pragmaticky: vybírej role s jasným přínosem AI, ale i stabilními procesy."
        else:
            ai_readiness = "Preferuješ stabilní postupy; dobře ti sednou role s jasnými standardy a postupným zaváděním AI."
    else:
        ai_readiness = "AI připravenost nelze přesně odhadnout, drž se rolí s jasným rámcem a postupnou adaptací."

    return {
        "strengths": strengths[:6],
        "ideal_environment": ideal_environment[:5],
        "top_roles": top_roles_out[:5],
        "development_areas": development[:4],
        "next_steps": next_steps[:5],
        "ai_readiness": ai_readiness,
    }


def _build_prompt(payload: Dict[str, Any]) -> str:
    return f"""
Vytvoř personalizovaný career report na základě následujícího profilu.
Piš česky, konkrétně a ne obecně. Styl: koučovací, empatický, ale přímočarý.
Vyhni se klišé a generickým frázím.
Opírej se o konkrétní dimenze, jejich skóre a percentily (nejméně 2 silné + 1 slabší oblast).
Každý bod musí vysvětlovat "proč" a uvést situaci, kde se to projeví.
Odpověz STRICT JSON ve tvaru:
{{
  "strengths": ["..."],
  "ideal_environment": ["..."],
  "top_roles": [{{"title": "...", "reason": "..."}}],
  "development_areas": ["..."],
  "next_steps": ["..."],
  "ai_readiness": "..."
}}

Pravidla:
- strengths: 4–6 bodů, každý 2–3 věty, musí uvést název dimenze + hodnotu/percentil.
- ideal_environment: 3–5 bodů, každý 1–2 věty, vazba na D2/D4/D5.
- top_roles: 3–5 rolí z payload.top_roles (nepřidávej jiné), důvod musí odkazovat na konkrétní dimenze (min. 2).
- development_areas: 2–4 bodů, každý 2–3 věty, konstruktivní a konkrétní.
- next_steps: 3–5 bodů, praktické kroky (např. typ projektu, styl práce, zkouška role).
- ai_readiness: 2–4 věty, jasný závěr a doporučení.
- Nepoužívej fráze typu "záleží", "obecně", "může být", "typicky" bez konkrétního kontextu.
- U top_roles vždy přidej "proč" ve formě: "Sedí díky [dimenze A] + [dimenze B] a tomu, jak se to projevuje v praxi."

Profil:
{json.dumps(payload, ensure_ascii=False, indent=2)}
""".strip()


def generate_jcfpm_report(payload: Dict[str, Any]) -> Dict[str, Any]:
    cfg = get_active_model_config("ai_orchestration", "jcfpm_report")
    primary = cfg.get("primary_model") or "gpt-4.1-mini"
    fallback = cfg.get("fallback_model") or "gpt-4.1-nano"
    generation_config = {
        "temperature": cfg.get("temperature", 0.2),
        "top_p": cfg.get("top_p", 1),
    }
    prompt = _build_prompt(payload)
    try:
        result, _ = call_primary_with_fallback(prompt, primary, fallback, generation_config=generation_config)
        parsed = _extract_json(result.text)
        if not isinstance(parsed, dict):
            raise AIClientError("Invalid AI report payload")
        strengths = list(parsed.get("strengths") or [])
        ideal_environment = list(parsed.get("ideal_environment") or [])
        top_roles = list(parsed.get("top_roles") or [])
        development_areas = list(parsed.get("development_areas") or [])
        next_steps = list(parsed.get("next_steps") or [])
        ai_readiness = str(parsed.get("ai_readiness") or "")

        # Basic validation to avoid generic or incomplete outputs
        def _has_digits(value: str) -> bool:
            return any(ch.isdigit() for ch in value)

        payload_titles = {str(r.get("title")) for r in (payload.get("top_roles") or []) if r.get("title")}
        if (
            len(strengths) < 4
            or len(ideal_environment) < 3
            or len(top_roles) < 3
            or len(development_areas) < 2
            or len(next_steps) < 3
            or not ai_readiness
        ):
            return _build_fallback_report(payload)

        if not all(isinstance(x, str) and _has_digits(x) for x in strengths[:4]):
            return _build_fallback_report(payload)
        if payload_titles:
            for role in top_roles[:5]:
                title = str(role.get("title") or "")
                if not title or title not in payload_titles:
                    return _build_fallback_report(payload)

        return {
            "strengths": strengths,
            "ideal_environment": ideal_environment,
            "top_roles": top_roles,
            "development_areas": development_areas,
            "next_steps": next_steps,
            "ai_readiness": ai_readiness,
        }
    except Exception:
        return _build_fallback_report(payload)
