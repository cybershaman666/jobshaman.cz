#!/usr/bin/env python3
"""Fix remaining hardcoded strings in RecruiterShell.tsx role creation form."""
import json, os

BASE = os.path.join(os.path.dirname(__file__), '..')
LOCALES_DIR = os.path.join(BASE, 'public', 'locales')
FILE = os.path.join(BASE, 'src', 'rebuild', 'recruiter', 'RecruiterShell.tsx')

REPLACEMENTS = [
    # Back button & heading
    ("Zpět na role", "{t('rebuild.recruiter.back_to_roles', { defaultValue: 'Zpět na role' })}"),
    (">Vytvořte novou výzvu ✨<", ">{t('rebuild.recruiter.create_challenge_title', { defaultValue: 'Vytvořte novou výzvu ✨' })}<"),
    ("Kvalitní výzva přitáhne ty správné lidi. Popište situaci, dopad a první assessment úkol.", "{t('rebuild.recruiter.create_challenge_desc', { defaultValue: 'Kvalitní výzva přitáhne ty správné lidi. Popište situaci, dopad a první assessment úkol.' })}"),
    ("Uložit výzvu", "{t('rebuild.recruiter.save_challenge', { defaultValue: 'Uložit výzvu' })}"),

    # Steps sidebar
    ("'Podstata výzvy', 'Co je cílem a proč je to důležité'", "t('rebuild.recruiter.step1_title', { defaultValue: 'Podstata výzvy' }), t('rebuild.recruiter.step1_desc', { defaultValue: 'Co je cílem a proč je to důležité' })"),
    ("'Oblast a spolupráce', 'Kategorizace a způsob práce'", "t('rebuild.recruiter.step2_title', { defaultValue: 'Oblast a spolupráce' }), t('rebuild.recruiter.step2_desc', { defaultValue: 'Kategorizace a způsob práce' })"),
    ("'Kontext pro kandidáta', 'Pozadí, motivace a očekávání'", "t('rebuild.recruiter.step3_title', { defaultValue: 'Kontext pro kandidáta' }), t('rebuild.recruiter.step3_desc', { defaultValue: 'Pozadí, motivace a očekávání' })"),
    ("'Assessment úkol', 'První test dovedností'", "t('rebuild.recruiter.step4_title', { defaultValue: 'Assessment úkol' }), t('rebuild.recruiter.step4_desc', { defaultValue: 'První test dovedností' })"),
    ("'Náhled a publikace', 'Zkontrolujte a publikujte'", "t('rebuild.recruiter.step5_title', { defaultValue: 'Náhled a publikace' }), t('rebuild.recruiter.step5_desc', { defaultValue: 'Zkontrolujte a publikujte' })"),

    # Section headings
    (">1. Podstata výzvy<", ">{t('rebuild.recruiter.section1_heading', { defaultValue: '1. Podstata výzvy' })}<"),
    ("Mistral pomůže formulovat", "{t('rebuild.recruiter.mistral_assist', { defaultValue: 'Mistral pomůže formulovat' })}"),
    # Form labels
    ("Název výzvy", "{t('rebuild.recruiter.challenge_name', { defaultValue: 'Název výzvy' })}"),
    ("Proč je to důležité?", "{t('rebuild.recruiter.why_important', { defaultValue: 'Proč je to důležité?' })}"),
    ("Popište dopad, kterého chcete dosáhnout.", "{t('rebuild.recruiter.impact_desc', { defaultValue: 'Popište dopad, kterého chcete dosáhnout.' })}"),
    ("Co má kandidát vyřešit?", "{t('rebuild.recruiter.what_to_solve', { defaultValue: 'Co má kandidát vyřešit?' })}"),
    ("Stručně popište, co má kandidát dodat nebo dokázat.", "{t('rebuild.recruiter.solve_desc', { defaultValue: 'Stručně popište, co má kandidát dodat nebo dokázat.' })}"),

    # Shamanova rada
    (">Shamanova rada<", ">{t('rebuild.recruiter.shaman_advice', { defaultValue: 'Shamanova rada' })}<"),
    ("Skvělá výzva je konkrétní, měřitelná a inspirující. Popište výsledek, ne jen úkol.", "{t('rebuild.recruiter.shaman_advice_text', { defaultValue: 'Skvělá výzva je konkrétní, měřitelná a inspirující. Popište výsledek, ne jen úkol.' })}"),

    # Section 2
    (">2. Oblast a spolupráce<", ">{t('rebuild.recruiter.section2_heading', { defaultValue: '2. Oblast a spolupráce' })}<"),
    ("Oblast\n", "{t('rebuild.recruiter.field_area', { defaultValue: 'Oblast' })}\n"),
    ("Typ spolupráce\n", "{t('rebuild.recruiter.collab_type', { defaultValue: 'Typ spolupráce' })}\n"),
    ("Lokalita\n", "{t('rebuild.recruiter.location', { defaultValue: 'Lokalita' })}\n"),
    ("Odměna od\n", "{t('rebuild.recruiter.salary_from', { defaultValue: 'Odměna od' })}\n"),
    ("Odměna do\n", "{t('rebuild.recruiter.salary_to', { defaultValue: 'Odměna do' })}\n"),
    ("Dovednosti\n", "{t('rebuild.recruiter.skills', { defaultValue: 'Dovednosti' })}\n"),

    # AI assistant
    ("AI asistent", "{t('rebuild.recruiter.ai_assistant', { defaultValue: 'AI asistent' })}"),
    (">Skóre výzvy<", ">{t('rebuild.recruiter.challenge_score', { defaultValue: 'Skóre výzvy' })}<"),
    ("Tahle výzva má potenciál přilákat relevantní kandidáty.", "{t('rebuild.recruiter.score_desc', { defaultValue: 'Tahle výzva má potenciál přilákat relevantní kandidáty.' })}"),
    ("Jak zlepšit skóre přes Mistral →", "{t('rebuild.recruiter.improve_score', { defaultValue: 'Jak zlepšit skóre přes Mistral →' })}"),

    # Preview section
    (">Náhled pro kandidáta<", ">{t('rebuild.recruiter.candidate_preview', { defaultValue: 'Náhled pro kandidáta' })}<"),
    (">Zobrazit celý náhled<", ">{t('rebuild.recruiter.full_preview', { defaultValue: 'Zobrazit celý náhled' })}<"),
    ("'Zadejte výzvu, kterou má kandidát řešit'", "t('rebuild.recruiter.enter_challenge', { defaultValue: 'Zadejte výzvu, kterou má kandidát řešit' })"),
    ("'Sem se propíše stručný kontext: co se děje, proč to bolí a jaký výsledek by firmě pomohl.'", "t('rebuild.recruiter.preview_placeholder', { defaultValue: 'Sem se propíše stručný kontext: co se děje, proč to bolí a jaký výsledek by firmě pomohl.' })"),
    ("'Hybridní spolupráce'", "t('rebuild.recruiter.hybrid_collab', { defaultValue: 'Hybridní spolupráce' })"),
    ("'Lokalita bude upřesněna'", "t('rebuild.recruiter.location_tbd', { defaultValue: 'Lokalita bude upřesněna' })"),

    # Bottom bar
    (">Rozpracovaná výzva<", ">{t('rebuild.recruiter.draft_challenge', { defaultValue: 'Rozpracovaná výzva' })}<"),
    ("Automaticky uloženo lokálně", "{t('rebuild.recruiter.auto_saved', { defaultValue: 'Automaticky uloženo lokálně' })}"),
    ("Pokračovat s AI", "{t('rebuild.recruiter.continue_with_ai', { defaultValue: 'Pokračovat s AI' })}"),

    # Published surface
    (">Published Surface<", ">{t('rebuild.recruiter.published_surface', { defaultValue: 'Published Surface' })}<"),
    (">Výzvy a assessment postupy<", ">{t('rebuild.recruiter.challenges_and_assessments', { defaultValue: 'Výzvy a assessment postupy' })}<"),
    ("Zatím nemáte zadanou žádnou výzvu. Jakmile ji uložíte, objeví se tady a kandidát ji může otevřít jako handshake.", "{t('rebuild.recruiter.no_challenges_yet', { defaultValue: 'Zatím nemáte zadanou žádnou výzvu. Jakmile ji uložíte, objeví se tady a kandidát ji může otevřít jako handshake.' })}"),
    ("AI úkoly", "{t('rebuild.recruiter.ai_tasks', { defaultValue: 'AI úkoly' })}"),
    ("Publikovat", "{t('rebuild.recruiter.publish', { defaultValue: 'Publikovat' })}"),

    # Talent pool
    ("|| 'Uchazeč'", "|| t('rebuild.recruiter.applicant', { defaultValue: 'Uchazeč' })"),
    (">Reject<", ">{t('rebuild.recruiter.reject', { defaultValue: 'Odmítnout' })}<"),
    (">Schedule<", ">{t('rebuild.recruiter.schedule', { defaultValue: 'Naplánovat' })}<"),
    (">Hire Flow<", ">{t('rebuild.recruiter.hire_flow', { defaultValue: 'Hire Flow' })}<"),
    (">Schopnosti a kognice<", ">{t('rebuild.recruiter.skills_cognition', { defaultValue: 'Schopnosti a kognice' })}<"),
    (">Osobní příběh a bio<", ">{t('rebuild.recruiter.personal_story', { defaultValue: 'Osobní příběh a bio' })}<"),

    # Dialogue
    ("'Vy'", "t('rebuild.recruiter.you_label', { defaultValue: 'Vy' })"),
    ("|| 'Kandidát')", "|| t('rebuild.recruiter.candidate_label', { defaultValue: 'Kandidát' }))"),
    ("Žádné zprávy k zobrazení.", "{t('rebuild.recruiter.no_messages', { defaultValue: 'Žádné zprávy k zobrazení.' })}"),

    # Internal note
    ("`Relevantní signály vůči aktuálním výzvám: ${overlap}.`", "`${t('rebuild.recruiter.relevant_signals', { defaultValue: 'Relevantní signály vůči aktuálním výzvám' })}: ${overlap}.`"),
    ("'Zatím bez silné vazby na aktivní výzvy.'", "t('rebuild.recruiter.no_strong_link', { defaultValue: 'Zatím bez silné vazby na aktivní výzvy.' })"),
]

# Build keys from replacements (extract key from defaultValue pattern)
import re
NEW_KEYS = {}
for old, new in REPLACEMENTS:
    matches = re.findall(r"t\('([^']+)',\s*\{\s*defaultValue:\s*'([^']+)'\s*\}", new)
    for key, cs_val in matches:
        if key not in NEW_KEYS:
            NEW_KEYS[key] = {"cs": cs_val}

# Add EN/DE/PL/SK/AT translations for all keys
EN_TRANSLATIONS = {
    "rebuild.recruiter.back_to_roles": "Back to roles",
    "rebuild.recruiter.create_challenge_title": "Create a new challenge ✨",
    "rebuild.recruiter.create_challenge_desc": "A quality challenge attracts the right people. Describe the situation, impact, and first assessment task.",
    "rebuild.recruiter.save_challenge": "Save challenge",
    "rebuild.recruiter.step1_title": "Challenge essence",
    "rebuild.recruiter.step1_desc": "What is the goal and why it matters",
    "rebuild.recruiter.step2_title": "Area and collaboration",
    "rebuild.recruiter.step2_desc": "Categorization and work model",
    "rebuild.recruiter.step3_title": "Context for the candidate",
    "rebuild.recruiter.step3_desc": "Background, motivation, and expectations",
    "rebuild.recruiter.step4_title": "Assessment task",
    "rebuild.recruiter.step4_desc": "First skills test",
    "rebuild.recruiter.step5_title": "Preview and publish",
    "rebuild.recruiter.step5_desc": "Review and publish",
    "rebuild.recruiter.section1_heading": "1. Challenge essence",
    "rebuild.recruiter.mistral_assist": "Mistral will help formulate",
    "rebuild.recruiter.challenge_name": "Challenge name",
    "rebuild.recruiter.why_important": "Why is this important?",
    "rebuild.recruiter.impact_desc": "Describe the impact you want to achieve.",
    "rebuild.recruiter.what_to_solve": "What should the candidate solve?",
    "rebuild.recruiter.solve_desc": "Briefly describe what the candidate should deliver or demonstrate.",
    "rebuild.recruiter.shaman_advice": "Shaman's advice",
    "rebuild.recruiter.shaman_advice_text": "A great challenge is specific, measurable, and inspiring. Describe the outcome, not just the task.",
    "rebuild.recruiter.section2_heading": "2. Area and collaboration",
    "rebuild.recruiter.field_area": "Area",
    "rebuild.recruiter.collab_type": "Collaboration type",
    "rebuild.recruiter.location": "Location",
    "rebuild.recruiter.salary_from": "Salary from",
    "rebuild.recruiter.salary_to": "Salary to",
    "rebuild.recruiter.skills": "Skills",
    "rebuild.recruiter.ai_assistant": "AI assistant",
    "rebuild.recruiter.challenge_score": "Challenge score",
    "rebuild.recruiter.score_desc": "This challenge has the potential to attract relevant candidates.",
    "rebuild.recruiter.improve_score": "How to improve score via Mistral →",
    "rebuild.recruiter.candidate_preview": "Preview for candidate",
    "rebuild.recruiter.full_preview": "Show full preview",
    "rebuild.recruiter.enter_challenge": "Enter the challenge for the candidate to solve",
    "rebuild.recruiter.preview_placeholder": "Brief context will appear here: what's happening, why it hurts, and what result would help the company.",
    "rebuild.recruiter.hybrid_collab": "Hybrid collaboration",
    "rebuild.recruiter.location_tbd": "Location to be specified",
    "rebuild.recruiter.draft_challenge": "Draft challenge",
    "rebuild.recruiter.auto_saved": "Automatically saved locally",
    "rebuild.recruiter.continue_with_ai": "Continue with AI",
    "rebuild.recruiter.published_surface": "Published Surface",
    "rebuild.recruiter.challenges_and_assessments": "Challenges and assessment processes",
    "rebuild.recruiter.no_challenges_yet": "You have no challenges yet. Once you save one, it will appear here and candidates can open it as a handshake.",
    "rebuild.recruiter.ai_tasks": "AI tasks",
    "rebuild.recruiter.publish": "Publish",
    "rebuild.recruiter.applicant": "Applicant",
    "rebuild.recruiter.reject": "Reject",
    "rebuild.recruiter.schedule": "Schedule",
    "rebuild.recruiter.hire_flow": "Hire Flow",
    "rebuild.recruiter.skills_cognition": "Skills and cognition",
    "rebuild.recruiter.personal_story": "Personal story and bio",
    "rebuild.recruiter.you_label": "You",
    "rebuild.recruiter.candidate_label": "Candidate",
    "rebuild.recruiter.no_messages": "No messages to display.",
    "rebuild.recruiter.relevant_signals": "Relevant signals to current challenges",
    "rebuild.recruiter.no_strong_link": "No strong link to active challenges yet.",
}

def set_nested(obj, dotpath, value):
    parts = dotpath.split('.')
    cur = obj
    for p in parts[:-1]:
        if p not in cur: cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value

def main():
    with open(FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    replaced = 0
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new, 1)
            replaced += 1
        else:
            print(f"  MISS: {old[:60]}...")

    with open(FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    # Update locales
    locales = {}
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        with open(os.path.join(LOCALES_DIR, lang, 'translation.json'), encoding='utf-8') as f:
            locales[lang] = json.load(f)

    for key, data in NEW_KEYS.items():
        cs_val = data["cs"]
        en_val = EN_TRANSLATIONS.get(key, cs_val)
        set_nested(locales['cs'], key, cs_val)
        set_nested(locales['en'], key, en_val)
        # For DE/PL/SK/AT use EN as fallback
        for lang in ['de', 'pl', 'sk', 'at']:
            set_nested(locales[lang], key, en_val)

    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        path = os.path.join(LOCALES_DIR, lang, 'translation.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(locales[lang], f, ensure_ascii=False, indent=2)
            f.write('\n')

    print(f"\nDone! {replaced} replacements in RecruiterShell.tsx")

if __name__ == '__main__':
    main()
