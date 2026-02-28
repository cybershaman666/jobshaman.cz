#!/usr/bin/env python3
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


DIMENSIONS = [
    "d1_cognitive",
    "d2_social",
    "d3_motivational",
    "d4_energy",
    "d5_values",
    "d6_ai_readiness",
    "d7_cognitive_reflection",
    "d8_digital_eq",
    "d9_systems_thinking",
    "d10_ambiguity_interpretation",
    "d11_problem_decomposition",
    "d12_moral_compass",
]


@dataclass
class BaseItem:
    pool_key: str
    dimension: str
    subdimension: str
    prompt_cs: str
    prompt_en: str
    item_type: str
    payload: dict | None = None
    reverse_scoring: bool = False


def _likert_prompt(dim_label_cs: str, dim_label_en: str, i: int) -> tuple[str, str]:
    return (
        f"{dim_label_cs}: položka {i} — jak moc s tímto výrokem souhlasíte v běžné práci?",
        f"{dim_label_en}: item {i} — how much do you agree with this statement in your everyday work?",
    )


def _mcq_payload(question: str, options: list[str], correct: int) -> dict:
    return {
        "question": question,
        "options": [{"id": chr(ord("a") + idx), "label": label} for idx, label in enumerate(options)],
        "correct_id": chr(ord("a") + correct),
    }


def _scenario_payload(question: str, options: list[str], correct: int) -> dict:
    return _mcq_payload(question, options, correct)


def _ordering_payload(options: list[str]) -> dict:
    ids = [f"o{i+1}" for i in range(len(options))]
    return {
        "options": [{"id": ids[i], "label": options[i]} for i in range(len(options))],
        "correct_order": ids,
    }


def _drag_payload(sources: list[str], targets: list[str]) -> dict:
    source_ids = [f"s{i+1}" for i in range(len(sources))]
    target_ids = [f"t{i+1}" for i in range(len(targets))]
    return {
        "sources": [{"id": source_ids[i], "label": sources[i]} for i in range(len(sources))],
        "targets": [{"id": target_ids[i], "label": targets[i]} for i in range(len(targets))],
        "correct_pairs": [{"source": source_ids[i], "target": target_ids[i]} for i in range(min(len(source_ids), len(target_ids)))],
    }


def build_base_items() -> list[BaseItem]:
    items: list[BaseItem] = []
    dim_labels = {
        "d1_cognitive": ("Kognitivní styl", "Cognitive style"),
        "d2_social": ("Sociální orientace", "Social orientation"),
        "d3_motivational": ("Motivační profil", "Motivational profile"),
        "d4_energy": ("Energetický styl", "Energy style"),
        "d5_values": ("Hodnotové kotvení", "Value anchors"),
        "d6_ai_readiness": ("Technologická adaptabilita", "Technology adaptability"),
    }
    for dim in DIMENSIONS[:6]:
        for i in range(1, 7):
            cs, en = _likert_prompt(dim_labels[dim][0], dim_labels[dim][1], i)
            items.append(BaseItem(pool_key=f"D{DIMENSIONS.index(dim)+1}.{i}", dimension=dim, subdimension=f"{dim}_core_{i}", prompt_cs=cs, prompt_en=en, item_type="likert"))

    # D7
    d7_templates = [
        ("V projektu máš neúplná data. Co uděláš jako první?", ["Rychle rozhodnu podle dojmu", "Doplním klíčová fakta a pak rozhodnu", "Odložím to bez termínu"], 1),
        ("Který závěr je logicky nejsilnější?", ["Po změně procesu se zlepšil výsledek, změna tedy pomohla", "Korelace automaticky znamená příčinu", "Příklad jednoho případu je vždy důkaz"], 0),
        ("Před důležitým rozhodnutím je nejlepší:", ["Sepsat kritéria úspěchu a ověřit předpoklady", "Řídit se jen intuicí", "Čekat bez další akce"], 0),
        ("Když se tým neshodne na interpretaci dat:", ["Vyberu názor nejhlasitějšího", "Definuji společná kritéria a porovnám varianty", "Ignoruji debatu"], 1),
        ("V nejasném zadání nejvíc pomůže:", ["Rozpadnout problém na menší otázky", "Hádání bez ověření", "Přeskočit analýzu"], 0),
        ("Správný postup při rizikové volbě je:", ["Pojmenovat rizika i přínosy a stanovit limit", "Uděláme to a uvidíme", "Neřešit odpovědnost"], 0),
    ]
    for i, (q, opts, correct) in enumerate(d7_templates, 1):
        items.append(BaseItem(pool_key=f"D7.{i}", dimension="d7_cognitive_reflection", subdimension=f"d7_logic_{i}", prompt_cs=q, prompt_en=q, item_type="mcq", payload=_mcq_payload(q, opts, correct)))

    # D8
    d8_templates = [
        ("Kolega odpoví jedním slovem a působí napjatě. Jak zareaguješ?", ["Ignoruji to", "Doptám se s respektem, jestli je vše v pořádku", "Pošlu dlouhé vysvětlení bez otázky"], 1),
        ("V konfliktu přes chat je nejlepší:", ["Vrátit stejný tón", "Popsat fakta a vyzvat k upřesnění", "Ukončit komunikaci"], 1),
        ("Nový člen týmu tápe v kontextu. Co je nejlepší krok?", ["Poslat odkazy bez kontextu", "Shrnout kontext a nabídnout prostor na otázky", "Nechat to na ostatních"], 1),
        ("Zpětnou vazbu přes text je vhodné dát takto:", ["Bez příkladu a bez dopadu", "Fakta + dopad + návrh dalšího kroku", "Veřejně bez ověření"], 1),
        ("Při nejistém tónu zprávy je vhodné:", ["Domýšlet negativní úmysl", "Ověřit porozumění krátkou otázkou", "Reagovat ironicky"], 1),
        ("Když je diskuse citlivá:", ["Pokračovat bez uznání emocí", "Uznat pohled druhé strany a držet věcný rámec", "Diskusi ignorovat"], 1),
    ]
    for i, (q, opts, correct) in enumerate(d8_templates, 1):
        items.append(BaseItem(pool_key=f"D8.{i}", dimension="d8_digital_eq", subdimension=f"d8_communication_{i}", prompt_cs=q, prompt_en=q, item_type="scenario_choice", payload=_scenario_payload(q, opts, correct)))

    # D9
    d9_payloads = [
        ("drag_drop", _drag_payload(["Zvýšení ceny", "Lepší podpora", "Rychlejší dodání"], ["Pokles poptávky", "Vyšší spokojenost", "Vyšší loajalita"])),
        ("mcq", _mcq_payload("Kde obvykle vzniká bottleneck?", ["V navazujícím kroku po zlepšení lokální části", "Vždy v první části", "Nikdy nevzniká"], 0)),
        ("ordering", _ordering_payload(["Vstup", "Zpracování", "Výstup", "Zpětná vazba"])),
        ("drag_drop", _drag_payload(["Vyšší marketing", "Nižší chybovost", "Vyšší fluktuace"], ["Růst poptávky", "Nižší reklamace", "Ztráta know-how"])),
        ("mcq", _mcq_payload("Co je zpětná vazba v systému?", ["Výsledek, který ovlivní další vstup", "Jednorázový efekt bez návaznosti", "Náhodný jev"], 0)),
        ("mcq", _mcq_payload("Před změnou procesu je důležité sledovat:", ["Jen lokální metriku", "Dopady na navazující části i časový efekt", "Názor jedné osoby"], 1)),
    ]
    for i, (item_type, payload) in enumerate(d9_payloads, 1):
        q = f"Systémové uvažování: úloha {i}"
        items.append(BaseItem(pool_key=f"D9.{i}", dimension="d9_systems_thinking", subdimension=f"d9_system_{i}", prompt_cs=q, prompt_en=q, item_type=item_type, payload=payload))

    # D10 image_choice as generic ambiguous signals
    d10_templates = [
        ("Nejasný signál v projektu vnímáš spíš jako:", ["Riziko", "Příležitost", "Neutrální šum"], 1),
        ("Když jsou informace neúplné, tvůj první krok je:", ["Zastavit vše", "Rychle zmapovat varianty", "Čekat bez akce"], 1),
        ("V nejistotě je vhodné:", ["Pojmenovat rizika i možnosti", "Ignorovat data", "Rozhodnout bez rámce"], 0),
        ("Při nejasném trendu je lepší:", ["Bezpečný rámec + malý experiment", "Jednorázový velký skok", "Nedělat nic"], 0),
        ("Slabý pozitivní signál znamená:", ["Možný prostor pro test", "Jistý úspěch", "Jisté selhání"], 0),
        ("Nejednoznačný vývoj vyhodnotíš jako:", ["Podklad pro scénáře", "Důkaz jedné pravdy", "Náhodu bez významu"], 0),
    ]
    for i, (q, opts, correct) in enumerate(d10_templates, 1):
        items.append(BaseItem(pool_key=f"D10.{i}", dimension="d10_ambiguity_interpretation", subdimension=f"d10_ambiguity_{i}", prompt_cs=q, prompt_en=q, item_type="image_choice", payload=_mcq_payload(q, opts, correct)))

    # D11
    d11_payloads = [
        ("ordering", _ordering_payload(["Definovat cíl", "Stanovit hypotézy", "Navrhnout pilot", "Ověřit", "Iterovat"])),
        ("drag_drop", _drag_payload(["Zmapovat potřeby", "Navrhnout řešení", "Spustit pilot"], ["Analýza", "Návrh", "Realizace"])),
        ("ordering", _ordering_payload(["Stabilizovat provoz", "Najít příčinu", "Opravit", "Vyhodnotit"])),
        ("mcq", _mcq_payload("První krok při nejasném zadání:", ["Hned realizovat", "Ujasnit cíl a kritéria", "Počkat bez termínu"], 1)),
        ("drag_drop", _drag_payload(["Pravidla a role", "Konkrétní požadavek", "Kritéria hodnocení"], ["Kontext", "Zadání", "Hodnocení"])),
        ("ordering", _ordering_payload(["Definovat výsledek", "Rozdělit na části", "Seřadit podle dopadu", "Přiřadit odpovědnosti"])),
    ]
    for i, (item_type, payload) in enumerate(d11_payloads, 1):
        q = f"Rozklad problému: úloha {i}"
        items.append(BaseItem(pool_key=f"D11.{i}", dimension="d11_problem_decomposition", subdimension=f"d11_decomposition_{i}", prompt_cs=q, prompt_en=q, item_type=item_type, payload=payload))

    # D12
    d12_templates = [
        ("Dostaneš užitečná data bez souhlasu. Co uděláš?", ["Použiji je bez informace", "Požádám o souhlas nebo data nepoužiji", "Předám je dál bez kontextu"], 1),
        ("Vedení chce zamlčet riziko kvůli výsledku. Jak reaguješ?", ["Souhlasím bez výhrad", "Pojmenuji riziko a navrhnu bezpečné řešení", "Ignoruji to"], 1),
        ("Systém zvýhodňuje jednu skupinu. Co uděláš?", ["Neřeším, když roste výkon", "Zastavím nasazení a hledám férovější variantu", "Skryji metriky"], 1),
        ("Najdeš chybu s dopadem na uživatele:", ["Počkám, jestli si někdo všimne", "Nahlásím ji a navrhnu nápravu", "Nechám to být"], 1),
        ("Termín tlačí, audit chybí:", ["Vypustím audit", "Navrhnu minimální auditní kontrolu", "Přehodím odpovědnost"], 1),
        ("Kolega obchází pravidla a škodí důvěře:", ["Ignoruji", "Zvednu téma a navrhnu korekci", "Pošlu anonymní zprávu bez kontextu"], 1),
    ]
    for i, (q, opts, correct) in enumerate(d12_templates, 1):
        items.append(BaseItem(pool_key=f"D12.{i}", dimension="d12_moral_compass", subdimension=f"d12_ethics_{i}", prompt_cs=q, prompt_en=q, item_type="scenario_choice", payload=_scenario_payload(q, opts, correct)))

    return items


def build_variants(base_items: list[BaseItem], variants: int = 6) -> list[dict]:
    items: list[dict] = []
    for dim_idx, dim in enumerate(DIMENSIONS, 1):
        dim_items = [row for row in base_items if row.dimension == dim]
        dim_items.sort(key=lambda x: int(x.pool_key.split(".")[1]))
        for q_idx, base in enumerate(dim_items, 1):
            for variant in range(1, variants + 1):
                item_id = base.pool_key if variant == 1 else f"{base.pool_key}_v{variant}"
                cs_suffix = "" if variant == 1 else f" (jiná formulace {variant})"
                en_suffix = "" if variant == 1 else f" (alternate wording {variant})"
                items.append({
                    "id": item_id,
                    "pool_key": base.pool_key,
                    "variant_index": variant,
                    "dimension": base.dimension,
                    "subdimension": base.subdimension,
                    "subdimension_i18n": {"cs": base.subdimension, "en": base.subdimension},
                    "prompt": f"{base.prompt_cs}{cs_suffix}",
                    "prompt_i18n": {"cs": f"{base.prompt_cs}{cs_suffix}", "en": f"{base.prompt_en}{en_suffix}"},
                    "reverse_scoring": bool(base.reverse_scoring and variant % 2 == 0),
                    "sort_order": dim_idx * 100 + q_idx,
                    "item_type": base.item_type,
                    "payload": base.payload,
                    "payload_i18n": None,
                    "assets": None,
                    "status": "active",
                    "version": "jcfpm-v3",
                })
    return items


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    out_path = root / "docs" / "jcfpm_pool_v3.json"
    base = build_base_items()
    full = build_variants(base, variants=6)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(full, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {len(full)} JCFPM items to {out_path}")


if __name__ == "__main__":
    main()
