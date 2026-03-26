from __future__ import annotations

import os
import re
import unicodedata
from typing import Any

from ..ai_orchestration.client import AIClientError, _extract_json, call_primary_with_fallback, get_default_fallback_model, get_default_primary_model, resolve_ai_provider
from ..core import config
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


def _plain_excerpt(value: Any, limit: int = 280) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    text = re.sub(r"[*_#>`~\[\]\(\)]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return _clip(text, limit)


_COPY = {
    "cs": {
        "kicker": "Signal Boost",
        "timebox": "15 až 20 minut",
        "note": "Nejde o dokonalé řešení. Jde o to, jak přemýšlíte, co upřednostníte a co si potřebujete ověřit.",
        "anti_generic": "Pište konkrétně, z první ruky a klidně ne dokonale. Lepší je jeden skutečný první krok než uhlazený obecný text.",
        "cta_hint": "Po dokončení dostanete veřejný JobShaman link, který můžete poslat spolu s klasickou přihláškou.",
        "how_to_title": "Jak na to",
        "deliverable_title": "Ve své odpovědi ukažte",
        "how_to_steps": [
            "Nejdřív si přečtěte zadání níže. Odpovídáte na jednu konkrétní pracovní situaci.",
            "Pak napište, co byste udělali jako první a proč právě to.",
            "Nakonec doplňte prioritu, trade-off a co byste si ještě potřebovali ověřit.",
        ],
        "job_excerpt_title": "Krátký kontext z role",
        "constraints": [
            "Jaký by byl váš první konkrétní krok.",
            "Co byste teď upřednostnili a co byste zatím nedělali.",
            "Co byste si ještě potřebovali rychle ověřit.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "V čem je tady hlavní problém",
                "hint": "2 až 4 věty. Co je podle vás skutečný problém v této situaci?",
            },
            "first_move": {
                "title": "Co udělám jako první",
                "hint": "Jeden konkrétní první krok. Co byste opravdu udělali hned teď?",
            },
            "approach_tradeoffs": {
                "title": "Co teď upřednostním",
                "hint": "Napište jednu prioritu, jeden trade-off a co byste zatím nedělali.",
            },
            "needs_to_know": {
                "title": "Co si ještě potřebuji ověřit",
                "hint": "Jaké informace nebo otevřené otázky byste si potřebovali rychle ujasnit.",
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
        "how_to_title": "Ako na to",
        "deliverable_title": "Vo svojej odpovedi ukážte",
        "how_to_steps": [
            "Najskôr si prečítajte zadanie nižšie. Odpovedáte na jednu konkrétnu pracovnú situáciu.",
            "Potom napíšte, čo by ste urobili ako prvé a prečo práve to.",
            "Nakoniec doplňte prioritu, trade-off a čo by ste si ešte potrebovali overiť.",
        ],
        "job_excerpt_title": "Krátky kontext z role",
        "constraints": [
            "Aký by bol váš prvý konkrétny krok.",
            "Čo by ste teraz uprednostnili a čo by ste zatiaľ nerobili.",
            "Čo by ste si ešte potrebovali rýchlo overiť.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "V čom je tu hlavný problém",
                "hint": "2 až 4 vety. Čo je podľa vás skutočný problém v tejto situácii?",
            },
            "first_move": {
                "title": "Čo urobím ako prvé",
                "hint": "Jeden konkrétny prvý krok. Čo by ste naozaj urobili hneď teraz?",
            },
            "approach_tradeoffs": {
                "title": "Čo teraz uprednostním",
                "hint": "Napíšte jednu prioritu, jeden trade-off a čo by ste zatiaľ nerobili.",
            },
            "needs_to_know": {
                "title": "Čo si ešte potrebujem overiť",
                "hint": "Aké informácie alebo otvorené otázky by ste si potrebovali rýchlo ujasniť.",
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
        "how_to_title": "So gehen Sie vor",
        "deliverable_title": "In Ihrer Antwort sollte sichtbar werden",
        "how_to_steps": [
            "Lesen Sie zuerst die Aufgabe unten. Sie reagieren auf eine konkrete Arbeitssituation.",
            "Schreiben Sie dann, was Sie als Erstes tun würden und warum genau das.",
            "Ergänzen Sie zum Schluss Priorität, Trade-off und was Sie noch klären müssten.",
        ],
        "job_excerpt_title": "Kurzer Kontext aus der Rolle",
        "constraints": [
            "Was Ihr erster konkreter Schritt wäre.",
            "Was Sie jetzt priorisieren und was Sie bewusst noch nicht tun würden.",
            "Was Sie noch schnell klären müssten.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "Worin das eigentliche Problem liegt",
                "hint": "2 bis 4 Sätze. Was ist in dieser Situation das eigentliche Problem?",
            },
            "first_move": {
                "title": "Was ich als Erstes tun würde",
                "hint": "Ein konkreter erster Schritt. Was würden Sie wirklich sofort tun?",
            },
            "approach_tradeoffs": {
                "title": "Was ich jetzt priorisieren würde",
                "hint": "Nennen Sie eine Priorität, einen Trade-off und was Sie bewusst noch nicht tun würden.",
            },
            "needs_to_know": {
                "title": "Was ich noch klären müsste",
                "hint": "Welche Informationen oder offenen Fragen müssten Sie zuerst noch klären?",
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
        "how_to_title": "Jak to ugryźć",
        "deliverable_title": "W odpowiedzi pokaż",
        "how_to_steps": [
            "Najpierw przeczytaj zadanie poniżej. Odpowiadasz na jedną konkretną sytuację z pracy.",
            "Potem napisz, co zrobił(a)byś jako pierwsze i dlaczego właśnie to.",
            "Na końcu dopisz priorytet, trade-off i to, co jeszcze trzeba sprawdzić.",
        ],
        "job_excerpt_title": "Krótki kontekst z roli",
        "constraints": [
            "Jaki byłby Twój pierwszy konkretny krok.",
            "Co teraz byłoby priorytetem, a czego jeszcze byś nie robił(a).",
            "Co trzeba byłoby jeszcze szybko doprecyzować.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "Na czym polega tu główny problem",
                "hint": "2 do 4 zdań. Jaki jest prawdziwy problem w tej sytuacji?",
            },
            "first_move": {
                "title": "Co zrobił(a)bym najpierw",
                "hint": "Jeden konkretny pierwszy krok. Co zrobił(a)byś naprawdę od razu?",
            },
            "approach_tradeoffs": {
                "title": "Co teraz byłoby priorytetem",
                "hint": "Napisz jeden priorytet, jeden trade-off i czego na razie byś nie robił(a).",
            },
            "needs_to_know": {
                "title": "Co jeszcze muszę sprawdzić",
                "hint": "Jakie informacje albo otwarte pytania trzeba jeszcze szybko doprecyzować?",
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
        "how_to_title": "How to approach it",
        "deliverable_title": "In your answer, show",
        "how_to_steps": [
            "First, read the task below. You are responding to one concrete work situation.",
            "Then write what you would do first and why that would be your first move.",
            "Finish with one priority, one trade-off, and what you would still need to clarify.",
        ],
        "job_excerpt_title": "Short role context",
        "constraints": [
            "What your first concrete move would be.",
            "What you would prioritize now and what you would deliberately not do yet.",
            "What you would still need to clarify quickly.",
        ],
        "sections": {
            "problem_understanding": {
                "title": "What the real problem is here",
                "hint": "2 to 4 sentences. What is the actual problem in this situation?",
            },
            "first_move": {
                "title": "What I would do first",
                "hint": "One concrete first move. What would you actually do right away?",
            },
            "approach_tradeoffs": {
                "title": "What I would prioritize now",
                "hint": "Name one priority, one trade-off, and what you would deliberately not do yet.",
            },
            "needs_to_know": {
                "title": "What I would still need to clarify",
                "hint": "What information or open questions would you still need to clarify quickly?",
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
        "sk": {
            "title": "Ako by ste upokojili situáciu a posunuli ju dopredu",
            "context": "Predstavte si prvý reálny kontakt s človekom, ktorý je frustrovaný, má neúplné dáta a potrebuje rýchlu orientáciu.",
            "problem": "Ukážte, ako by ste situáciu štruktúrovali, čo by ste overili ako prvé a ako by ste vyvážili rýchlosť, presnosť a pokoj v komunikácii.",
        },
        "de": {
            "title": "Wie Sie die Situation beruhigen und voranbringen würden",
            "context": "Stellen Sie sich einen ersten realen Kontakt mit einer frustrierten Person vor, die unvollständige Daten hat und schnell Orientierung braucht.",
            "problem": "Zeigen Sie, wie Sie die Situation strukturieren würden, was Sie zuerst prüfen würden und wie Sie Geschwindigkeit, Genauigkeit und Ruhe in der Kommunikation ausbalancieren.",
        },
        "pl": {
            "title": "Jak uspokoił(a)byś sytuację i popchnął ją do przodu",
            "context": "Wyobraź sobie pierwszy realny kontakt z osobą sfrustrowaną, mającą niepełne dane i potrzebującą szybkiej orientacji.",
            "problem": "Pokaż, jak uporządkował(a)byś sytuację, co sprawdził(a)byś najpierw i jak wyważył(a)byś szybkość, trafność oraz spokój w komunikacji.",
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
        "sk": {
            "title": "Ako by ste viedli klienta k výsledku, nie len k reakcii",
            "context": "Predstavte si zákazníka, ktorý je aktívny, ale nie je si istý, či z produktu naozaj dostáva hodnotu.",
            "problem": "Popíšte, čo by ste urobili najskôr, ako by ste nastavili ďalší krok a ako by ste rozlíšili medzi rýchlou pomocou a dlhodobým dopadom.",
        },
        "de": {
            "title": "Wie Sie den Kunden zu einem Ergebnis führen würden, nicht nur zu einer Antwort",
            "context": "Stellen Sie sich einen aktiven Kunden vor, der nicht sicher ist, ob er aus dem Produkt wirklich Nutzen zieht.",
            "problem": "Beschreiben Sie, was Sie zuerst tun würden, wie Sie den nächsten Schritt setzen würden und wie Sie zwischen schneller Hilfe und langfristigem Effekt unterscheiden.",
        },
        "pl": {
            "title": "Jak poprowadził(a)byś klienta do rezultatu, a nie tylko do odpowiedzi",
            "context": "Wyobraź sobie aktywnego klienta, który nie ma pewności, czy naprawdę czerpie wartość z produktu.",
            "problem": "Opisz, co zrobił(a)byś najpierw, jak ustawił(a)byś kolejny krok i jak odróżnił(a)byś szybką pomoc od długofalowego efektu.",
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
        "sk": {
            "title": "Ako by ste znížili trenie v rozbehnutej prevádzke",
            "context": "Predstavte si prevádzku, v ktorej vznikajú meškania, preťaženie alebo ručné improvizácie, ale nikto nemá čas ju celú prestavať.",
            "problem": "Popíšte, ako by ste našli najdôležitejšie úzke miesto, čo by ste riešili ako prvé a aký trade-off by ste si strážili medzi rýchlosťou a stabilitou.",
        },
        "de": {
            "title": "Wie Sie Reibung in einem laufenden Betrieb reduzieren würden",
            "context": "Stellen Sie sich einen Betrieb mit Verzögerungen, Überlastung oder manuellen Workarounds vor, ohne Spielraum für einen kompletten Umbau.",
            "problem": "Zeigen Sie, wie Sie den wichtigsten Engpass finden würden, was Sie zuerst angehen würden und welchen Trade-off Sie zwischen Geschwindigkeit und Stabilität beobachten würden.",
        },
        "pl": {
            "title": "Jak ograniczył(a)byś tarcie w działającej operacji",
            "context": "Wyobraź sobie operację, w której pojawiają się opóźnienia, przeciążenie albo ręczne obejścia, ale nikt nie ma przestrzeni na pełną przebudowę.",
            "problem": "Pokaż, jak znalazł(a)byś główne wąskie gardło, czym zajął(a)byś się najpierw i jakiego trade-offu pilnował(a)byś między szybkością a stabilnością.",
        },
        "en": {
            "title": "How you would reduce friction in a moving operation",
            "context": "Imagine an operation with delays, overload, or manual workarounds, but no appetite for a full rebuild.",
            "problem": "Show how you would find the main bottleneck, what you would address first, and which trade-off you would watch between speed and stability.",
        },
    },
    "sales_account": {
        "cs": {
            "title": "Jak byste rozběhli obchod v novém regionu",
            "context": "Představte si, že přebíráte region, kde je potenciál, ale vztahy, rytmus oslovení i první pipeline se teprve musí rozběhnout.",
            "problem": "Popište, kde byste začali, jak byste si rozdělili první priority mezi akvizici a péči o existující kontakty a co byste si potřebovali rychle ověřit o trhu nebo klientech.",
        },
        "sk": {
            "title": "Ako by ste rozbehli obchod v novom regióne",
            "context": "Predstavte si, že preberáte región, kde je potenciál, ale vzťahy, rytmus oslovení aj prvá pipeline sa ešte len musia rozbehnúť.",
            "problem": "Popíšte, kde by ste začali, ako by ste si rozdelili prvé priority medzi akvizíciu a starostlivosť o existujúce kontakty a čo by ste si potrebovali rýchlo overiť o trhu alebo klientoch.",
        },
        "de": {
            "title": "Wie Sie Vertrieb in einer neuen Region in Gang bringen würden",
            "context": "Stellen Sie sich vor, Sie übernehmen eine Region mit Potenzial, in der Beziehungen, Outreach-Rhythmus und erste Pipeline aber erst aufgebaut werden müssen.",
            "problem": "Beschreiben Sie, wo Sie anfangen würden, wie Sie die ersten Prioritäten zwischen Akquise und Betreuung bestehender Kontakte aufteilen würden und was Sie über Markt oder Kunden schnell klären müssten.",
        },
        "pl": {
            "title": "Jak rozkręcił(a)byś sprzedaż w nowym regionie",
            "context": "Wyobraź sobie, że przejmujesz region z potencjałem, ale relacje, rytm kontaktu i pierwsza pipeline dopiero trzeba zbudować.",
            "problem": "Opisz, od czego byś zaczął(a), jak podzielił(a)byś pierwsze priorytety między pozyskiwanie a pracę z istniejącymi kontaktami i co musiał(a)byś szybko sprawdzić o rynku lub klientach.",
        },
        "en": {
            "title": "How you would get sales moving in a new region",
            "context": "Imagine taking over a region with potential, but where relationships, outreach rhythm, and the first pipeline still need to be built.",
            "problem": "Describe where you would start, how you would split early priorities between acquisition and existing contacts, and what you would need to clarify quickly about the market or customers.",
        },
    },
    "product_management": {
        "cs": {
            "title": "Jak byste navrhli první užitečný produktový krok",
            "context": "Představte si uživatele, který se zasekne brzy po vstupu a sám přesně neví, co vlastně potřebuje.",
            "problem": "Popište, jak byste uchopili problém, co byste si ověřili jako první a jak byste rozhodli mezi rychlým experimentem a hlubším objevováním potřeb.",
        },
        "sk": {
            "title": "Ako by ste navrhli prvý užitočný produktový krok",
            "context": "Predstavte si používateľa, ktorý sa zasekne skoro po vstupe a sám presne nevie, čo vlastne potrebuje.",
            "problem": "Popíšte, ako by ste uchopili problém, čo by ste si overili ako prvé a ako by ste sa rozhodli medzi rýchlym experimentom a hlbším objavovaním potrieb.",
        },
        "de": {
            "title": "Wie Sie den ersten nützlichen Produkt-Schritt entwerfen würden",
            "context": "Stellen Sie sich einen Nutzer vor, der früh aussteigt und selbst noch nicht genau weiß, was er eigentlich braucht.",
            "problem": "Beschreiben Sie, wie Sie das Problem fassen würden, was Sie zuerst validieren würden und wie Sie zwischen einem schnellen Experiment und tieferer Discovery entscheiden würden.",
        },
        "pl": {
            "title": "Jak zaprojektował(a)byś pierwszy użyteczny ruch produktowy",
            "context": "Wyobraź sobie użytkownika, który odpada bardzo wcześnie i sam nie wie jeszcze dokładnie, czego potrzebuje.",
            "problem": "Opisz, jak ujął(a)byś problem, co zweryfikował(a)byś najpierw i jak zdecydował(a)byś między szybkim eksperymentem a głębszym odkrywaniem potrzeb.",
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
        "sk": {
            "title": "Ako by ste zlepšili moment, kde sa ľudia strácajú",
            "context": "Predstavte si tímový proces, kde vzniká zmätok, tiché trenie alebo nejasné odovzdanie zodpovednosti.",
            "problem": "Ukážte, ako by ste problém čítali, s kým by ste začali hovoriť a čo by ste zmenili najskôr bez toho, aby ste zbytočne rozbili fungujúce časti systému.",
        },
        "de": {
            "title": "Wie Sie den Moment verbessern würden, an dem Menschen die Orientierung verlieren",
            "context": "Stellen Sie sich einen Teamprozess vor, in dem Verwirrung, leise Reibung oder unklare Verantwortungsübergaben entstehen.",
            "problem": "Zeigen Sie, wie Sie das Problem lesen würden, mit wem Sie zuerst sprechen würden und was Sie zuerst ändern würden, ohne funktionierende Teile des Systems unnötig zu stören.",
        },
        "pl": {
            "title": "Jak poprawił(a)byś moment, w którym ludzie tracą orientację",
            "context": "Wyobraź sobie proces zespołowy, w którym pojawia się chaos, ciche tarcie albo niejasne przekazanie odpowiedzialności.",
            "problem": "Pokaż, jak odczytał(a)byś problem, z kim porozmawiał(a)byś najpierw i co zmienił(a)byś na początku, nie rozbijając niepotrzebnie działających części systemu.",
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


def _compact_role_title(value: Any) -> str:
    title = re.sub(r"\s+", " ", str(value or "").strip())
    if not title:
        return "role"
    patterns = [
        r"^(spolecnost|firma|company)\s+.+?\s+hleda\s+",
        r"^hledame\s+",
        r"^hleda\s+",
        r"^we are hiring\s+",
        r"^looking for\s+",
        r"^gesucht\s+wird\s+",
    ]
    normalized = title
    for pattern in patterns:
        normalized = re.sub(pattern, "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+pro\s+.+$", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+for\s+.+$", "", normalized, flags=re.IGNORECASE)
    normalized = re.sub(r"\s+fur\s+.+$", "", normalized, flags=re.IGNORECASE)
    normalized = normalized.strip(" -,:;/")
    return normalized or title


def _description_sentences(value: Any) -> list[str]:
    raw = str(value or "").strip()
    if not raw:
        return []
    text = re.sub(r"[*_#>`~\[\]\(\)]", " ", raw)
    text = re.sub(r"\s+", " ", text).strip()
    parts = re.split(r"(?<=[.!?])\s+|(?<=:)\s+", text)
    results: list[str] = []
    boilerplate_markers = (
        "jsme ", "o nas", "nabizime", "we are ", "about us", "we offer",
        "wir sind", "wir bieten", "jestesmy", "o nas", "oferujemy",
    )
    for part in parts:
        sentence = _clip(part, 220)
        normalized = _normalize_text(sentence)
        if not sentence or len(sentence) < 40:
            continue
        if any(normalized.startswith(marker) for marker in boilerplate_markers):
            continue
        results.append(sentence)
        if len(results) >= 2:
            break
    return results


def _default_generic_template(job_row: dict[str, Any], locale: str) -> dict[str, str]:
    language = _normalize_locale(locale)
    title = _compact_role_title(job_row.get("title") or "the role")
    company = str(job_row.get("company") or "the company").strip() or "the company"
    location = _clip(job_row.get("location"), 120)
    if language == "cs":
        return {
            "title": f"Co byste řešili jako první v roli {title}",
            "context": f"Představte si svůj první týden v roli {title} ve firmě {company}{f' pro oblast {location}' if location else ''}.",
            "problem": "Napište, jaký by byl váš první konkrétní krok, co byste teď upřednostnili a co byste si ještě potřebovali rychle ověřit, abyste nezačali špatným směrem.",
        }
    if language == "sk":
        return {
            "title": f"Čo by ste riešili ako prvé v role {title}",
            "context": f"Predstavte si svoj prvý týždeň v role {title} vo firme {company}{f' pre oblasť {location}' if location else ''}.",
            "problem": "Napíšte, aký by bol váš prvý konkrétny krok, čo by ste teraz uprednostnili a čo by ste si ešte potrebovali rýchlo overiť, aby ste nezačali zlým smerom.",
        }
    if language == "de":
        return {
            "title": f"Was Sie zuerst in der Rolle {title} angehen würden",
            "context": f"Stellen Sie sich Ihre erste Woche in der Rolle {title} bei {company}{f' fur den Bereich {location}' if location else ''} vor.",
            "problem": "Schreiben Sie, was Ihr erster konkreter Schritt wäre, was Sie jetzt priorisieren würden und was Sie schnell klären müssten, damit Sie nicht in die falsche Richtung starten.",
        }
    if language == "pl":
        return {
            "title": f"Co zrobił(a)byś najpierw w roli {title}",
            "context": f"Wyobraź sobie swój pierwszy tydzień w roli {title} w firmie {company}{f' dla obszaru {location}' if location else ''}.",
            "problem": "Napisz, jaki byłby Twój pierwszy konkretny krok, co byłoby teraz priorytetem i co trzeba byłoby jeszcze szybko sprawdzić, żeby nie ruszyć w złą stronę.",
        }
    return {
        "title": f"What you would tackle first in the {title} role",
        "context": f"Imagine your first week in the {title} role at {company}{f' for the {location} area' if location else ''}.",
        "problem": "Write what your first concrete move would be, what you would prioritize now, and what you would need to clarify quickly so you do not start in the wrong direction.",
    }


def _fallback_template_key(job_row: dict[str, Any]) -> str:
    title = _normalize_text(job_row.get("title") or "")
    description = _normalize_text(job_row.get("description") or "")
    combined = f"{title} {description}".strip()
    if not combined:
        return ""

    keyword_groups = {
        "sales_account": (
            "obchod", "konzultant", "consultant", "sales", "account manager", "business development", "obchodni", "obchodny", "regional sales",
        ),
        "customer_support": (
            "support", "customer service", "zakaznick", "helpdesk", "care agent",
        ),
        "customer_success": (
            "customer success", "account care", "retention", "adoption",
        ),
        "operations": (
            "operations", "provoz", "operac", "logistics", "fleet", "warehouse",
        ),
        "product_management": (
            "product manager", "product owner", "produkt", "ai product", "pm ",
        ),
        "hr_people": (
            "hr", "people ops", "recruit", "talent", "lidsk", "human resources",
        ),
    }
    for template_key, markers in keyword_groups.items():
        if any(marker in combined for marker in markers):
            return template_key
    return ""


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
    template_key = family if family in _ROLE_TEMPLATE_COPY else domain_key if domain_key in _ROLE_TEMPLATE_COPY else _fallback_template_key(job_row)
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


def _should_prefer_ai_brief(job_row: dict[str, Any], template: dict[str, Any]) -> bool:
    if not _ai_available():
        return False
    if template.get("role_family") in _ROLE_TEMPLATE_COPY:
        return False
    description = str(job_row.get("description") or "").strip()
    role_summary = str(job_row.get("role_summary") or "").strip()
    title = str(job_row.get("title") or "").strip()
    return len(description) > 120 or len(role_summary) > 80 or len(title) > 40


def _section_starter_prompts(locale: str) -> dict[str, list[str]]:
    language = _normalize_locale(locale)
    if language == "cs":
        return {
            "problem_understanding": [
                "Myslím, že hlavní problém tady není jen výkon, ale hlavně ...",
                "Za skutečné jádro situace považuji ..., protože ...",
            ],
            "first_move": [
                "Jako první bych si ověřil(a) ...",
                "První konkrétní krok by u mě byl ...",
            ],
            "approach_tradeoffs": [
                "Teď bych upřednostnil(a) ... před ..., protože ...",
                "Zatím bych nedělal(a) ..., protože ...",
            ],
            "needs_to_know": [
                "Ještě bych potřeboval(a) vědět ...",
                "Než bych šel/šla dál, ověřil(a) bych si ...",
            ],
            "thinking_notes": [
                "Rychlá poznámka: kdyby se ukázalo ..., změnil(a) bych směr na ...",
            ],
        }
    if language == "sk":
        return {
            "problem_understanding": [
                "Myslím, že hlavný problém tu nie je len výkon, ale najmä ...",
                "Za skutočné jadro situácie považujem ..., pretože ...",
            ],
            "first_move": [
                "Ako prvé by som si overil(a) ...",
                "Prvý konkrétny krok by u mňa bol ...",
            ],
            "approach_tradeoffs": [
                "Teraz by som uprednostnil(a) ... pred ..., pretože ...",
                "Zatiaľ by som nerobil(a) ..., pretože ...",
            ],
            "needs_to_know": [
                "Ešte by som potreboval(a) vedieť ...",
                "Skôr než by som išiel/šla ďalej, overil(a) by som si ...",
            ],
            "thinking_notes": [
                "Rýchla poznámka: ak by sa ukázalo ..., zmenil(a) by som smer na ...",
            ],
        }
    if language == "de":
        return {
            "problem_understanding": [
                "Ich glaube, das eigentliche Problem ist hier nicht nur ..., sondern vor allem ...",
                "Den Kern der Situation sehe ich in ..., weil ...",
            ],
            "first_move": [
                "Als Erstes würde ich prüfen, ...",
                "Mein erster konkreter Schritt wäre ...",
            ],
            "approach_tradeoffs": [
                "Ich würde jetzt ... vor ... priorisieren, weil ...",
                "Bewusst noch nicht tun würde ich ..., weil ...",
            ],
            "needs_to_know": [
                "Ich müsste noch wissen ...",
                "Bevor ich weitergehe, würde ich erst klären ...",
            ],
            "thinking_notes": [
                "Kurze Notiz: Wenn sich zeigt, dass ..., würde ich eher in Richtung ... gehen.",
            ],
        }
    if language == "pl":
        return {
            "problem_understanding": [
                "Myślę, że główny problem nie dotyczy tu tylko ..., ale przede wszystkim ...",
                "Za prawdziwy rdzeń sytuacji uważam ..., bo ...",
            ],
            "first_move": [
                "Najpierw sprawdził(a)bym ...",
                "Mój pierwszy konkretny krok to ...",
            ],
            "approach_tradeoffs": [
                "Na tym etapie priorytet dał(a)bym ... zamiast ..., ponieważ ...",
                "Na razie nie robił(a)bym ..., ponieważ ...",
            ],
            "needs_to_know": [
                "Wciąż potrzebował(a)bym wiedzieć ...",
                "Zanim pójdę dalej, doprecyzował(a)bym ...",
            ],
            "thinking_notes": [
                "Krótka notatka: jeśli okaże się, że ..., zmienił(a)bym kierunek na ...",
            ],
        }
    return {
        "problem_understanding": [
            "I think the real problem here is not only ..., but mainly ...",
            "The core of the situation seems to be ..., because ...",
        ],
        "first_move": [
            "First I would verify ...",
            "My first concrete move would be ...",
        ],
        "approach_tradeoffs": [
            "At this stage I would prioritize ... over ..., because ...",
            "I would not do ... yet, because ...",
        ],
        "needs_to_know": [
            "I would still need to know ...",
            "Before going further, I would clarify ...",
        ],
        "thinking_notes": [
            "Quick note: if it turns out that ..., I would shift toward ...",
        ],
    }


def _section_placeholders(locale: str) -> dict[str, str]:
    language = _normalize_locale(locale)
    if language == "cs":
        return {
            "problem_understanding": "2 až 4 věty. Co je podle vás skutečný problém a proč na něm záleží?",
            "first_move": "Začněte větou: Jako první bych...",
            "approach_tradeoffs": "Co byste teď upřednostnili a co byste zatím nedělali?",
            "needs_to_know": "Jaké informace byste si ještě potřebovali ověřit?",
            "thinking_notes": "Volitelné krátké poznámky, hypotézy nebo pracovní zkratky.",
        }
    if language == "sk":
        return {
            "problem_understanding": "2 až 4 vety. Čo je podľa vás skutočný problém a prečo na ňom záleží?",
            "first_move": "Začnite vetou: Ako prvé by som...",
            "approach_tradeoffs": "Čo by ste teraz uprednostnili a čo by ste zatiaľ nerobili?",
            "needs_to_know": "Aké informácie by ste si ešte potrebovali overiť?",
            "thinking_notes": "Voliteľné krátke poznámky, hypotézy alebo pracovné skratky.",
        }
    if language == "de":
        return {
            "problem_understanding": "2 bis 4 Sätze. Was ist aus Ihrer Sicht das eigentliche Problem und warum ist es wichtig?",
            "first_move": "Beginnen Sie mit: Als Erstes würde ich...",
            "approach_tradeoffs": "Was würden Sie jetzt priorisieren und was noch bewusst nicht tun?",
            "needs_to_know": "Welche Informationen müssten Sie noch klären?",
            "thinking_notes": "Optionale kurze Notizen, Hypothesen oder Arbeitsannahmen.",
        }
    if language == "pl":
        return {
            "problem_understanding": "2 do 4 zdań. Co jest tu według Ciebie prawdziwym problemem i dlaczego to ważne?",
            "first_move": "Zacznij od: Najpierw zrobił(a)bym...",
            "approach_tradeoffs": "Co teraz byłoby priorytetem, a czego jeszcze byś nie robił(a)?",
            "needs_to_know": "Jakie informacje trzeba jeszcze doprecyzować?",
            "thinking_notes": "Opcjonalne krótkie notatki, hipotezy albo skróty myślowe.",
        }
    return {
        "problem_understanding": "2 to 4 sentences. What is the real problem here and why does it matter?",
        "first_move": "Start with: First I would...",
        "approach_tradeoffs": "What would you prioritize now, and what would you deliberately not do yet?",
        "needs_to_know": "What information would you still need to clarify?",
        "thinking_notes": "Optional short notes, hypotheses, or working assumptions.",
    }


def _build_sections(locale: str) -> list[dict[str, Any]]:
    copy = _copy(locale)
    starters = _section_starter_prompts(locale)
    placeholders = _section_placeholders(locale)
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
                "starter_prompts": starters.get(section_id, []),
                "placeholder": placeholders.get(section_id, ""),
            }
        )
    return sections


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


def _brief_needs_ai(job_row: dict[str, Any]) -> bool:
    description = str(job_row.get("description") or "").strip()
    role_summary = str(job_row.get("role_summary") or "").strip()
    first_reply_prompt = str(job_row.get("first_reply_prompt") or "").strip()
    return len(description) < 180 and len(role_summary) < 60 and len(first_reply_prompt) < 40


def _maybe_ai_brief(job_row: dict[str, Any], locale: str, fallback: dict[str, str], *, force: bool = False) -> tuple[dict[str, str] | None, dict[str, Any]]:
    meta = {
        **_ai_meta_base(),
        "ai_requested": bool(force or _brief_needs_ai(job_row)),
        "ai_used_brief": False,
        "ai_fallback_used": False,
    }
    if not force and not _brief_needs_ai(job_row):
        meta["ai_skip_reason"] = "heuristic_brief_allowed"
        return None, meta
    if not _ai_available():
        meta["ai_skip_reason"] = "provider_credentials_missing"
        return None, meta
    language = _normalize_locale(locale)
    role_title = _compact_role_title(job_row.get("title") or "")
    relevant_excerpt = _build_job_excerpt(job_row)
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
    prompt = f"""
Create one concrete short work-signal task for a job candidate.

Locale: {language}
Role: {role_title}
Company: {job_row.get("company") or ""}
Location: {job_row.get("location") or ""}
Role family: {intelligence.get("role_family") or ""}
Domain: {intelligence.get("domain_key") or ""}
Relevant job context: {relevant_excerpt}

Return STRICT JSON:
{{
  "scenario_title": "string",
  "scenario_context": "string",
  "core_problem": "string"
}}

Rules:
- Use only one realistic first-week situation.
- Make the candidate choose a first step, one priority, and one thing to verify.
- Keep it concrete and readable in under 30 seconds.
- No textbook explanation, no company marketing, no generic HR language.
- Do not repeat the raw title as the task.
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
        title = _clip(parsed.get("scenario_title"), 160)
        context = _clip(parsed.get("scenario_context"), 400)
        problem = _clip(parsed.get("core_problem"), 500)
        if not title or not context or not problem:
            meta["ai_error"] = "brief_payload_incomplete"
            return None, meta
        meta.update({
            "ai_used_brief": True,
            "ai_model_used": result.model_name,
            "ai_fallback_used": bool(fallback_used),
            "ai_tokens_in": result.tokens_in,
            "ai_tokens_out": result.tokens_out,
            "ai_latency_ms": result.latency_ms,
        })
        return {"title": title, "context": context, "problem": problem}, meta
    except (AIClientError, ValueError) as exc:
        meta["ai_error"] = str(exc)
        return None, meta


def _build_job_excerpt(job_row: dict[str, Any]) -> str:
    first_reply_prompt = _plain_excerpt(job_row.get("first_reply_prompt"), 260)
    if first_reply_prompt:
        return first_reply_prompt
    challenge = _plain_excerpt(job_row.get("challenge"), 260)
    if challenge:
        return challenge
    role_summary = _plain_excerpt(job_row.get("role_summary"), 260)
    if role_summary:
        return role_summary
    sentences = _description_sentences(job_row.get("description"))
    if sentences:
        return " ".join(sentences[:2])
    return _plain_excerpt(job_row.get("description"), 220)


def _fallback_starter_payload(locale: str) -> dict[str, str]:
    prompts = _section_starter_prompts(locale)
    language = _normalize_locale(locale)
    if language == "cs":
        return {
            "problem_understanding": "Myslím, že hlavní problém tady není jen samotný úkol, ale hlavně to, jak rychle se podaří najít správnou prioritu a nenechat se stáhnout do příliš širokého řešení.",
            "first_move": "Jako první bych si ověřil(a), kde přesně vzniká největší tření nebo ztráta hodnoty. Bez toho bych nechtěl(a) navrhovat větší řešení naslepo.",
            "approach_tradeoffs": "Teď bych upřednostnil(a) rychlé zpřesnění problému před velkým redesignem. Zatím bych nedělal(a) nic příliš širokého, protože by hrozilo, že budeme optimalizovat špatnou věc.",
            "needs_to_know": "Ještě bych potřeboval(a) vědět, podle čeho tým pozná úspěch, kde je největší tlak a jaká omezení v tomhle kroku opravdu platí.",
            "thinking_notes": prompts.get("thinking_notes", [""])[0],
        }
    if language == "sk":
        return {
            "problem_understanding": "Myslím, že hlavný problém tu nie je len samotná úloha, ale najmä to, ako rýchlo sa podarí nájsť správnu prioritu a nerozbehnúť príliš široké riešenie.",
            "first_move": "Ako prvé by som si overil(a), kde presne vzniká najväčšie trenie alebo strata hodnoty. Bez toho by som nechcel(a) navrhovať väčšie riešenie naslepo.",
            "approach_tradeoffs": "Teraz by som uprednostnil(a) rýchle spresnenie problému pred veľkým redesignom. Zatiaľ by som nerobil(a) nič príliš široké, pretože by hrozilo, že budeme optimalizovať nesprávnu vec.",
            "needs_to_know": "Ešte by som potreboval(a) vedieť, podľa čoho tím spozná úspech, kde je najväčší tlak a aké obmedzenia v tomto kroku naozaj platia.",
            "thinking_notes": prompts.get("thinking_notes", [""])[0],
        }
    if language == "de":
        return {
            "problem_understanding": "Ich glaube, das eigentliche Problem liegt hier nicht nur in der Aufgabe selbst, sondern darin, schnell die richtige Priorität zu finden und nicht in eine zu breite Lösung abzurutschen.",
            "first_move": "Als Erstes würde ich prüfen, wo genau die größte Reibung oder der größte Wertverlust entsteht. Ohne diese Klarheit würde ich keine größere Lösung ins Blaue hinein vorschlagen.",
            "approach_tradeoffs": "Ich würde jetzt eine schnelle Präzisierung des Problems über einen großen Redesign-Ansatz stellen. Bewusst noch nicht tun würde ich etwas zu Breites, weil wir sonst leicht das Falsche optimieren.",
            "needs_to_know": "Ich müsste noch wissen, woran das Team Erfolg misst, wo der größte Druck liegt und welche Einschränkungen in diesem Schritt wirklich gelten.",
            "thinking_notes": prompts.get("thinking_notes", [""])[0],
        }
    if language == "pl":
        return {
            "problem_understanding": "Myślę, że główny problem nie dotyczy tu wyłącznie samego zadania, ale tego, jak szybko znaleźć właściwy priorytet i nie wejść od razu w zbyt szerokie rozwiązanie.",
            "first_move": "Najpierw sprawdził(a)bym, gdzie dokładnie powstaje największe tarcie albo utrata wartości. Bez tego nie chciał(a)bym proponować większego rozwiązania w ciemno.",
            "approach_tradeoffs": "Na tym etapie priorytet dał(a)bym szybkiemu doprecyzowaniu problemu zamiast dużemu redesignowi. Na razie nie robił(a)bym nic zbyt szerokiego, bo łatwo byłoby optymalizować niewłaściwą rzecz.",
            "needs_to_know": "Wciąż potrzebował(a)bym wiedzieć, po czym zespół pozna sukces, gdzie jest największa presja i jakie ograniczenia naprawdę obowiązują w tym kroku.",
            "thinking_notes": prompts.get("thinking_notes", [""])[0],
        }
    return {
        "problem_understanding": "I think the real issue here is not only the task itself, but how quickly the right priority can be found without drifting into a solution that is too broad.",
        "first_move": "First I would verify where the biggest friction or value loss actually happens. Without that, I would not want to propose a larger solution blindly.",
        "approach_tradeoffs": "At this stage I would prioritize clarifying the problem quickly over a bigger redesign. I would not go broad yet, because we could easily end up optimizing the wrong thing.",
        "needs_to_know": "I would still need to know how success is measured, where the biggest pressure sits, and which constraints are actually real in this step.",
        "thinking_notes": prompts.get("thinking_notes", [""])[0],
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
    fallback = _fallback_starter_payload(language)

    if not _ai_available():
        return {"response_payload": fallback, "meta": {**_ai_meta_base(), "used_ai": False, "ai_skip_reason": "provider_credentials_missing"}}

    brief = build_signal_boost_brief(job_row, language, prefer_ai=prefer_ai)
    prompt = f"""
Help a candidate start a short Signal Boost response.

Locale: {language}
Scenario title: {brief.get("scenario_title") or ""}
Core problem: {brief.get("core_problem") or ""}
Current partial answers: {current}

Return STRICT JSON with this exact shape:
{{
  "problem_understanding": "string",
  "first_move": "string",
  "approach_tradeoffs": "string",
  "needs_to_know": "string",
  "thinking_notes": "string"
}}

Rules:
- Write in the requested locale.
- Keep each field short and concrete.
- Make it concrete, imperfect, and believable.
- Use first-person phrasing.
- Do not sound polished, generic, or like a cover letter.
- Include one real first move, one clear priority/trade-off, and one thing that still needs clarification.
- If current partial answers exist, stay aligned with them rather than contradicting them.
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
            section_id: _clip(parsed.get(section_id) or fallback.get(section_id), 700 if section_id != "thinking_notes" else 320)
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


def build_signal_boost_brief(job_row: dict[str, Any], locale: str, *, prefer_ai: bool = False) -> dict[str, Any]:
    language = _normalize_locale(locale, _normalize_locale(job_row.get("language_code"), "en"))
    copy = _copy(language)
    template = _resolve_template(job_row, language)
    force_ai = bool(prefer_ai or _should_prefer_ai_brief(job_row, template))
    ai_template, ai_meta = _maybe_ai_brief(job_row, language, template, force=force_ai)
    effective = ai_template or template
    job_excerpt = _build_job_excerpt(job_row)
    return {
        "kicker": copy["kicker"],
        "timebox": copy["timebox"],
        "candidate_note": copy["note"],
        "anti_generic_hint": copy["anti_generic"],
        "cta_hint": copy["cta_hint"],
        "how_to_title": copy.get("how_to_title"),
        "deliverable_title": copy.get("deliverable_title"),
        "how_to_steps": list(copy.get("how_to_steps") or []),
        "job_excerpt_title": copy.get("job_excerpt_title"),
        "job_excerpt": job_excerpt or None,
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
            **ai_meta,
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
