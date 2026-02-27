from __future__ import annotations
import json
from typing import Any, Dict, List
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
        "contrast": "Dopad vs. osobní růst • Inovace vs. stabilita • Vztahy vs. výkon",
    },
    "d6_ai_readiness": {
        "title": "Připravenost na práci s AI",
        "definition": "Ochota učit se, adaptovat se a využívat AI v práci.",
        "contrast": "Rychlá adaptace vs. jistota • Experimentování vs. osvědčené postupy",
    },
    "d7_cognitive_reflection": {
        "title": "Kognitivní reflexe a logika",
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
        "title": "Interpretace nejasností",
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


def _normalize_score_100(dim: str, raw_score: Any) -> int:
    try:
        value = float(raw_score or 0)
    except (TypeError, ValueError):
        value = 0.0
    if dim in _EXTENDED_DIMS:
        normalized = value
    else:
        normalized = (value / 7.0) * 100.0
    return int(round(max(0.0, min(100.0, normalized))))


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

    scored_rows: List[Dict[str, Any]] = []
    for row in dim_scores:
        dim = str(row.get("dimension") or "")
        scored_rows.append({
            **row,
            "dimension": dim,
            "score_100": _normalize_score_100(dim, row.get("raw_score")),
            "percentile_num": int(round(float(row.get("percentile") or 0))),
        })

    scored_rows.sort(key=lambda r: r["score_100"], reverse=True)
    strengths_rows = scored_rows[:3] or scored_rows[:2] or scored_rows[:1]
    dev_rows = sorted(scored_rows, key=lambda r: r["score_100"])[:2] or scored_rows[:1]

    strength_focus = {
        "d1_cognitive": ("dobře třídíš informace a rozhoduješ se na základě faktů", "analýze variant a argumentaci"),
        "d2_social": ("umíš dobře pracovat s lidmi a sladit tým", "domluvě v týmu a předávání odpovědnosti"),
        "d3_motivational": ("máš stabilní vnitřní tah na cíl", "dlouhodobých úkolech a dokončování práce"),
        "d4_energy": ("udržíš výkon i v náročnějším tempu", "řízení priorit při více úkolech"),
        "d5_values": ("držíš směr podle jasných hodnot", "rozhodování pod tlakem a volbě priorit"),
        "d6_ai_readiness": ("rychle se učíš nové nástroje a postupy", "zavádění AI nástrojů do běžné práce"),
        "d7_cognitive_reflection": ("zastavíš první dojem a ověříš ho", "kritickém posouzení návrhů"),
        "d8_digital_eq": ("v psané komunikaci dobře čteš tón i kontext", "citlivé komunikaci s klienty a týmem"),
        "d9_systems_thinking": ("vidíš souvislosti a vedlejší dopady", "návrhu procesů a změn"),
        "d10_ambiguity_interpretation": ("v nejistotě umíš hledat směr místo paralýzy", "rozhodování bez kompletních dat"),
        "d11_problem_decomposition": ("umíš velké úkoly rozdělit na kroky", "plánování a řízení složitějších úkolů"),
        "d12_moral_compass": ("udržíš férové rozhodování i pod tlakem", "situacích s konfliktem zájmů"),
    }
    growth_focus = {
        "d1_cognitive": ("občas rozhodneš rychle bez ověření", "před rozhodnutím napiš 3 fakta, 1 riziko a 1 alternativu"),
        "d2_social": ("můžeš podcenit sladění s ostatními", "u klíčového úkolu si vždy potvrď očekávání druhé strany"),
        "d3_motivational": ("energie může kolísat podle typu úkolu", "na začátku týdne si urč 2 konkrétní cíle s termínem"),
        "d4_energy": ("rychlé změny tě mohou unavit", "naplánuj si 2 bloky hluboké práce bez vyrušení"),
        "d5_values": ("když chybí smysl, klesá tah na výsledek", "u každého většího úkolu si napiš, komu to pomůže"),
        "d6_ai_readiness": ("u nových nástrojů můžeš váhat", "1x týdně otestuj jeden jednoduchý AI postup na reálném úkolu"),
        "d7_cognitive_reflection": ("první intuice může někdy vyhrát nad ověřením", "u důležitých rozhodnutí použij otázku: „Jaký mám důkaz?“"),
        "d8_digital_eq": ("v textu může dojít k nepochopení tónu", "u citlivých zpráv přidej krátké potvrzení porozumění"),
        "d9_systems_thinking": ("hrozí přehlédnutí vedlejších dopadů", "před změnou napiš: co to zlepší, co to může zhoršit"),
        "d10_ambiguity_interpretation": ("nejistota může brzdit rozhodnutí", "u nejasné situace sepiš 2 rizika a 2 příležitosti"),
        "d11_problem_decomposition": ("větší úkol může působit nepřehledně", "rozděl větší zadání na 3–5 kroků s termínem"),
        "d12_moral_compass": ("v tlaku může být těžší držet stejný metr", "u složitého rozhodnutí si napiš, koho to ovlivní krátkodobě i dlouhodobě"),
    }

    strengths: List[str] = []
    for row in strengths_rows:
        dim = row["dimension"]
        title = DIMENSION_META.get(dim, {}).get("title", dim)
        focus, practice = strength_focus.get(dim, ("v této oblasti máš nadprůměrný výkon", "náročnějších pracovních situacích"))
        strengths.append(
            f"{title}: {row['score_100']}/100 ({row['percentile_num']}. percentil). "
            f"To znamená, že {focus}. V praxi to poznáš hlavně při {practice}."
        )

    development: List[str] = []
    for row in dev_rows:
        dim = row["dimension"]
        title = DIMENSION_META.get(dim, {}).get("title", dim)
        risk, step = growth_focus.get(dim, ("tady je prostor pro posun", "zvol jeden malý návyk a drž ho 7 dní"))
        development.append(
            f"{title}: {row['score_100']}/100 ({row['percentile_num']}. percentil). "
            f"Právě tady se nejvíc projeví, že {risk}. První konkrétní krok: {step}."
        )

    by_dim = {row["dimension"]: row for row in scored_rows}
    social = by_dim.get("d2_social", {}).get("score_100", 50)
    energy = by_dim.get("d4_energy", {}).get("score_100", 50)
    values = by_dim.get("d5_values", {}).get("score_100", 50)
    ai = by_dim.get("d6_ai_readiness", {}).get("score_100", 50)

    ideal_environment: List[str] = [
        "Tým s pravidelnou zpětnou vazbou a jasnými očekáváními." if social >= 60
        else "Prostředí s větším prostorem na samostatnou práci a menším počtem rušivých schůzek.",
        "Rychlejší tempo práce s častou prioritizací." if energy >= 65
        else "Stabilnější rytmus s možností soustředit se do hloubky.",
        "Práce, kde je vidět dopad na lidi nebo byznys." if values >= 60
        else "Práce s jasnými pravidly, férovým vedením a dlouhodobou stabilitou.",
        "Prostředí, kde je běžné používat AI nástroje v praxi." if ai >= 60
        else "Prostředí, kde se nové nástroje zavádějí postupně a s podporou.",
    ]

    # Top roles with reasons tied to strongest dimensions
    top_roles_out: List[Dict[str, str]] = []
    reason_dims = strengths_rows[:2] or scored_rows[:2]
    reason_a = reason_dims[0] if reason_dims else None
    reason_b = reason_dims[1] if len(reason_dims) > 1 else None
    role_use_case = "Tahle kombinace se hodí při rozhodování, komunikaci i dotahování výsledků."
    if reason_a and reason_a["dimension"] == "d11_problem_decomposition":
        role_use_case = "Silnou stránku využiješ hlavně při plánování práce, prioritizaci a předávání úkolů."
    elif reason_a and reason_a["dimension"] == "d8_digital_eq":
        role_use_case = "Silnou stránku využiješ hlavně při komunikaci s klienty, týmem a v citlivých situacích."
    elif reason_a and reason_a["dimension"] == "d9_systems_thinking":
        role_use_case = "Silnou stránku využiješ hlavně při návrhu procesů a vyhodnocování dopadů změn."

    for role in top_roles[:5]:
        title = role.get("title") or "Role"
        fit = int(round(float(role.get("fit_score") or 0)))
        if reason_a and reason_b:
            a_title = DIMENSION_META.get(reason_a["dimension"], {}).get("title", reason_a["dimension"])
            b_title = DIMENSION_META.get(reason_b["dimension"], {}).get("title", reason_b["dimension"])
            reason = (
                f"Shoda {fit} %. Sedí, protože máš silné {a_title} ({reason_a['score_100']}/100) "
                f"a {b_title} ({reason_b['score_100']}/100). {role_use_case}"
            )
        else:
            reason = f"Shoda {fit} %. Tato role odpovídá tvému aktuálnímu profilu práce."
        top_roles_out.append({"title": title, "reason": reason})

    next_steps: List[str] = []
    for row in dev_rows[:2]:
        dim = row["dimension"]
        title = DIMENSION_META.get(dim, {}).get("title", dim)
        step = growth_focus.get(dim, ("tady je prostor pro posun", "zvol jeden malý návyk a drž ho 7 dní"))[1]
        next_steps.append(
            f"Na příštích 7 dní zaměř oblast „{title}“: {step}. Cíl: splnit aspoň 4 z 5 pracovních dnů."
        )
    if top_roles:
        next_steps.append(
            f"Otestuj roli „{top_roles[0].get('title')}“ na malém úkolu (2–4 hodiny) a zapiš si, co ti šlo snadno a co tě brzdilo."
        )
    next_steps.append(
        "Po 14 dnech si porovnej 3 konkrétní situace: co se zlepšilo, co zůstává slabé a jaký bude další krok."
    )

    d6 = by_dim.get("d6_ai_readiness")
    d10 = by_dim.get("d10_ambiguity_interpretation")
    if d6 and d10:
        d6_score = d6["score_100"]
        d10_score = d10["score_100"]
        if d6_score >= 75 and d10_score >= 70:
            ai_readiness = (
                f"Připravenost na práci s AI máš {d6_score}/100 a práci s nejasností {d10_score}/100. "
                "Máš silný základ pro role, kde se nástroje i procesy rychle mění. Udržíš náskok, když budeš AI používat na reálných úkolech každý týden."
            )
        elif d6_score >= 50:
            ai_readiness = (
                f"Připravenost na práci s AI máš {d6_score}/100 a práci s nejasností {d10_score}/100. "
                "AI umíš využít, když je jasný přínos a postup. Největší posun uděláš pravidelným tréninkem na konkrétních pracovních situacích."
            )
        else:
            ai_readiness = (
                f"Připravenost na práci s AI máš {d6_score}/100 a práci s nejasností {d10_score}/100. "
                "Lépe ti sedí postupné zavádění nástrojů s jasným návodem. Začni jedním jednoduchým použitím týdně a měř, kde šetří čas."
            )
    else:
        ai_readiness = "Připravenost na práci s AI teď nejde přesně určit. Doporučení: zaváděj nové nástroje po malých krocích a vždy měř reálný přínos."

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
Piš česky, srozumitelně pro netechnického uživatele. Styl: věcný, podpůrný, konkrétní.
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
- next_steps: 3–5 bodů, praktické kroky s horizontem 7–14 dní a jasným měřítkem.
- ai_readiness: 2–4 věty, jasný závěr a doporučení.
- Nepoužívej fráze typu "záleží", "obecně", "může být", "typicky" bez konkrétního kontextu.
- Nepoužívej anglický žargon ani fráze "na základě profilových dimenzí", "baseline", "fixní limit".
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
        banned_fragments = (
            "na základě profilových dimenzí",
            "nastav měřitelný návyk",
            "baseline",
            "fixní limit",
        )

        def _looks_generic(lines: List[str]) -> bool:
            for line in lines:
                lowered = str(line or "").strip().lower()
                if not lowered:
                    return True
                if len(lowered) < 45:
                    return True
                if any(fragment in lowered for fragment in banned_fragments):
                    return True
            return False

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
        if _looks_generic(strengths[:4]) or _looks_generic(development_areas[:2]) or _looks_generic(next_steps[:3]):
            return _build_fallback_report(payload)
        if any(fragment in ai_readiness.lower() for fragment in banned_fragments):
            return _build_fallback_report(payload)
        if payload_titles:
            for role in top_roles[:5]:
                title = str(role.get("title") or "")
                reason = str(role.get("reason") or "")
                if not title or title not in payload_titles:
                    return _build_fallback_report(payload)
                if len(reason.strip()) < 55 or "díky" not in reason.lower():
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
