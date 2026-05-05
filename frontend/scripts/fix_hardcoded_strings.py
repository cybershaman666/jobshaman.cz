#!/usr/bin/env python3
"""Replace hardcoded Czech/English strings in TSX files with t() calls and add keys to all locales."""
import json, os, re

BASE = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(BASE, 'src')
LOCALES_DIR = os.path.join(BASE, 'public', 'locales')

# ── Replacements: (file_relative_to_src, old_string, new_string, translation_key, translations) ──
# translations = {cs, en, de, pl, sk, at}
REPLACEMENTS = [
    # RecruiterShell.tsx
    ("rebuild/recruiter/RecruiterShell.tsx",
     "<option value=\"Hybrid\">Hybridní</option>",
     "<option value=\"Hybrid\">{t('rebuild.recruiter.work_hybrid', { defaultValue: 'Hybridní' })}</option>",
     "rebuild.recruiter.work_hybrid",
     {"cs": "Hybridní", "en": "Hybrid", "de": "Hybrid", "pl": "Hybrydowy", "sk": "Hybridná", "at": "Hybrid"}),

    ("rebuild/recruiter/RecruiterShell.tsx",
     "<option value=\"Remote\">Remote</option>",
     "<option value=\"Remote\">{t('rebuild.recruiter.work_remote', { defaultValue: 'Remote' })}</option>",
     "rebuild.recruiter.work_remote",
     {"cs": "Remote", "en": "Remote", "de": "Remote", "pl": "Zdalnie", "sk": "Remote", "at": "Remote"}),

    ("rebuild/recruiter/RecruiterShell.tsx",
     "<option value=\"On-site\">Na místě</option>",
     "<option value=\"On-site\">{t('rebuild.recruiter.work_onsite', { defaultValue: 'Na místě' })}</option>",
     "rebuild.recruiter.work_onsite",
     {"cs": "Na místě", "en": "On-site", "de": "Vor Ort", "pl": "Na miejscu", "sk": "Na mieste", "at": "Vor Ort"}),

    ("rebuild/recruiter/RecruiterShell.tsx",
     "<span>První úkol - 14denní assessment</span>",
     "<span>{t('rebuild.recruiter.first_task_assessment', { defaultValue: 'První úkol - 14denní assessment' })}</span>",
     "rebuild.recruiter.first_task_assessment",
     {"cs": "První úkol - 14denní assessment", "en": "First task - 14-day assessment", "de": "Erste Aufgabe - 14-Tage-Assessment", "pl": "Pierwsze zadanie - 14-dniowy assessment", "sk": "Prvá úloha - 14-dňový assessment", "at": "Erste Aufgabe - 14-Tage-Assessment"}),

    # RecruiterShell.tsx - nav items
    ("rebuild/recruiter/RecruiterShell.tsx",
     "{ id: 'dashboard', label: 'Přehled', icon: LayoutDashboard, path: '/recruiter' },\n    { id: 'roles', label: 'Role', icon: BookOpen, path: '/recruiter/roles' },\n    { id: 'talent-pool', label: 'Kandidáti', icon: Users, path: '/recruiter/talent-pool' },\n    { id: 'settings', label: 'Firemní profil', icon: Settings2, path: '/recruiter/settings' },",
     "{ id: 'dashboard', label: t('rebuild.recruiter.nav_dashboard', { defaultValue: 'Přehled' }), icon: LayoutDashboard, path: '/recruiter' },\n    { id: 'roles', label: t('rebuild.recruiter.nav_roles', { defaultValue: 'Role' }), icon: BookOpen, path: '/recruiter/roles' },\n    { id: 'talent-pool', label: t('rebuild.recruiter.nav_candidates', { defaultValue: 'Kandidáti' }), icon: Users, path: '/recruiter/talent-pool' },\n    { id: 'settings', label: t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Firemní profil' }), icon: Settings2, path: '/recruiter/settings' },",
     None, None),  # Multiple keys, handled separately

    # RecruiterShell.tsx - workspace titles
    ("rebuild/recruiter/RecruiterShell.tsx",
     "? 'Role'\n    : tab === 'talent-pool'\n      ? 'Kandidáti'\n      : 'Firemní profil'",
     "? t('rebuild.recruiter.nav_roles', { defaultValue: 'Role' })\n    : tab === 'talent-pool'\n      ? t('rebuild.recruiter.nav_candidates', { defaultValue: 'Kandidáti' })\n      : t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Firemní profil' })",
     None, None),

    ("rebuild/recruiter/RecruiterShell.tsx",
     "? 'Zadání rolí, důkazy schopnosti a řízení skill-first výběru.'\n    : tab === 'talent-pool'\n      ? 'Kandidátské profily, recruiter readout a společná vlákna v jednom rozhodovacím prostoru.'\n      : 'Značka, média a kontaktní osoby jako jeden zdroj pravdy.'",
     "? t('rebuild.recruiter.subtitle_roles', { defaultValue: 'Zadání rolí, důkazy schopnosti a řízení skill-first výběru.' })\n    : tab === 'talent-pool'\n      ? t('rebuild.recruiter.subtitle_candidates', { defaultValue: 'Kandidátské profily, recruiter readout a společná vlákna v jednom rozhodovacím prostoru.' })\n      : t('rebuild.recruiter.subtitle_settings', { defaultValue: 'Značka, média a kontaktní osoby jako jeden zdroj pravdy.' })",
     None, None),

    # RecruiterShell.tsx - score labels
    ("rebuild/recruiter/RecruiterShell.tsx",
     "if (score >= 85) return 'Velmi silná shoda';\n    if (score >= 70) return 'Silná shoda';\n    if (score >= 55) return 'Dobrá shoda';\n    if (score > 0) return 'Průzkumná shoda';\n    return 'Zatím bez vyhodnocení';",
     "if (score >= 85) return t('rebuild.recruiter.match_very_strong', { defaultValue: 'Velmi silná shoda' });\n    if (score >= 70) return t('rebuild.recruiter.match_strong', { defaultValue: 'Silná shoda' });\n    if (score >= 55) return t('rebuild.recruiter.match_good', { defaultValue: 'Dobrá shoda' });\n    if (score > 0) return t('rebuild.recruiter.match_exploratory', { defaultValue: 'Průzkumná shoda' });\n    return t('rebuild.recruiter.match_none', { defaultValue: 'Zatím bez vyhodnocení' });",
     None, None),

    # CandidateExperience.tsx
    ("rebuild/candidate/CandidateExperience.tsx",
     "<div><strong>Candidate:</strong>",
     "<div><strong>{t('rebuild.experience.candidate_label', { defaultValue: 'Kandidát' })}:</strong>",
     "rebuild.experience.candidate_label",
     {"cs": "Kandidát", "en": "Candidate", "de": "Kandidat", "pl": "Kandydat", "sk": "Kandidát", "at": "Kandidat"}),

    ("rebuild/candidate/CandidateExperience.tsx",
     "<div><strong>Email:</strong>",
     "<div><strong>{t('rebuild.experience.email_label', { defaultValue: 'E-mail' })}:</strong>",
     "rebuild.experience.email_label",
     {"cs": "E-mail", "en": "Email", "de": "E-Mail", "pl": "E-mail", "sk": "E-mail", "at": "E-Mail"}),

    ("rebuild/candidate/CandidateExperience.tsx",
     "<div><strong>Phone:</strong>",
     "<div><strong>{t('rebuild.experience.phone_label', { defaultValue: 'Telefon' })}:</strong>",
     "rebuild.experience.phone_label",
     {"cs": "Telefon", "en": "Phone", "de": "Telefon", "pl": "Telefon", "sk": "Telefón", "at": "Telefon"}),

    ("rebuild/candidate/CandidateExperience.tsx",
     "<div><strong>LinkedIn:</strong>",
     "<div><strong>{t('rebuild.experience.linkedin_label', { defaultValue: 'LinkedIn' })}:</strong>",
     "rebuild.experience.linkedin_label",
     {"cs": "LinkedIn", "en": "LinkedIn", "de": "LinkedIn", "pl": "LinkedIn", "sk": "LinkedIn", "at": "LinkedIn"}),

    ("rebuild/candidate/CandidateExperience.tsx",
     "<span>Story</span>",
     "<span>{t('rebuild.experience.story_tab', { defaultValue: 'Příběh' })}</span>",
     "rebuild.experience.story_tab",
     {"cs": "Příběh", "en": "Story", "de": "Geschichte", "pl": "Historia", "sk": "Príbeh", "at": "Geschichte"}),

    ("rebuild/candidate/CandidateExperience.tsx",
     "<option value=\"0\">No church tax</option>",
     "<option value=\"0\">{t('rebuild.experience.no_church_tax', { defaultValue: 'Bez církevní daně' })}</option>",
     "rebuild.experience.no_church_tax",
     {"cs": "Bez církevní daně", "en": "No church tax", "de": "Keine Kirchensteuer", "pl": "Bez podatku kościelnego", "sk": "Bez cirkevnej dane", "at": "Keine Kirchensteuer"}),

    # CandidateShell.tsx
    ("rebuild/candidate/CandidateShell.tsx",
     "eyebrow={<SectionEyebrow>Role briefing</SectionEyebrow>}",
     "eyebrow={<SectionEyebrow>{t('rebuild.briefing.role_briefing', { defaultValue: 'Briefing role' })}</SectionEyebrow>}",
     "rebuild.briefing.role_briefing",
     {"cs": "Briefing role", "en": "Role briefing", "de": "Rollenbriefing", "pl": "Briefing roli", "sk": "Briefing roly", "at": "Rollenbriefing"}),

    ("rebuild/candidate/CandidateShell.tsx",
     "<span>Otázka {currentQuestionIndex + 1} z {questions.length}</span>",
     "<span>{t('rebuild.assessment.question_progress', { defaultValue: 'Otázka {{current}} z {{total}}', current: currentQuestionIndex + 1, total: questions.length })}</span>",
     "rebuild.assessment.question_progress",
     {"cs": "Otázka {{current}} z {{total}}", "en": "Question {{current}} of {{total}}", "de": "Frage {{current}} von {{total}}", "pl": "Pytanie {{current}} z {{total}}", "sk": "Otázka {{current}} z {{total}}", "at": "Frage {{current}} von {{total}}"}),

    # CandidateShellSurface.tsx
    ("rebuild/candidate/CandidateShellSurface.tsx",
     "<span>Sebehodnocení</span>",
     "<span>{t('rebuild.surface.self_assessment', { defaultValue: 'Sebehodnocení' })}</span>",
     "rebuild.surface.self_assessment",
     {"cs": "Sebehodnocení", "en": "Self-assessment", "de": "Selbsteinschätzung", "pl": "Samoocena", "sk": "Sebahodnotenie", "at": "Selbsteinschätzung"}),

    ("rebuild/candidate/CandidateShellSurface.tsx",
     "<span>Realita</span>",
     "<span>{t('rebuild.surface.reality', { defaultValue: 'Realita' })}</span>",
     "rebuild.surface.reality",
     {"cs": "Realita", "en": "Reality", "de": "Realität", "pl": "Rzeczywistość", "sk": "Realita", "at": "Realität"}),

    # CandidateLearningPage.tsx
    ("rebuild/candidate/CandidateLearningPage.tsx",
     "eyebrow={<SectionEyebrow>Učení</SectionEyebrow>}",
     "eyebrow={<SectionEyebrow>{t('rebuild.learning.eyebrow', { defaultValue: 'Učení' })}</SectionEyebrow>}",
     "rebuild.learning.eyebrow",
     {"cs": "Učení", "en": "Learning", "de": "Lernen", "pl": "Nauka", "sk": "Učenie", "at": "Lernen"}),

    # CandidateApplicationsPage.tsx
    ("rebuild/candidate/CandidateApplicationsPage.tsx",
     "Žádné generické CV.<br />Jen čistá ukázka tvých schopností.",
     "{t('rebuild.applications.no_generic_cv', { defaultValue: 'Žádné generické CV. Jen čistá ukázka tvých schopností.' })}",
     "rebuild.applications.no_generic_cv",
     {"cs": "Žádné generické CV. Jen čistá ukázka tvých schopností.", "en": "No generic CV. Just a pure showcase of your abilities.", "de": "Kein generischer Lebenslauf. Nur eine reine Demonstration deiner Fähigkeiten.", "pl": "Żadne generyczne CV. Tylko czysta prezentacja twoich umiejętności.", "sk": "Žiadne generické CV. Len čistá ukážka tvojich schopností.", "at": "Kein generischer Lebenslauf. Nur eine reine Demonstration deiner Fähigkeiten."}),

    # AuthPanel.tsx
    ("rebuild/auth/AuthPanel.tsx",
     "<div>Používáme šifrování a moderní zabezpečení.</div>",
     "<div>{t('auth.security_note', { defaultValue: 'Používáme šifrování a moderní zabezpečení.' })}</div>",
     "auth.security_note",
     {"cs": "Používáme šifrování a moderní zabezpečení.", "en": "We use encryption and modern security.", "de": "Wir verwenden Verschlüsselung und moderne Sicherheit.", "pl": "Używamy szyfrowania i nowoczesnych zabezpieczeń.", "sk": "Používame šifrovanie a moderné zabezpečenie.", "at": "Wir verwenden Verschlüsselung und moderne Sicherheit."}),

    ("rebuild/auth/AuthPanel.tsx",
     "<span>Chci dostávat novinky a pracovní příležitosti e-mailem (nepovinné)</span>",
     "<span>{t('auth.newsletter_opt_in', { defaultValue: 'Chci dostávat novinky a pracovní příležitosti e-mailem (nepovinné)' })}</span>",
     "auth.newsletter_opt_in",
     {"cs": "Chci dostávat novinky a pracovní příležitosti e-mailem (nepovinné)", "en": "I want to receive news and job opportunities by email (optional)", "de": "Ich möchte Neuigkeiten und Jobangebote per E-Mail erhalten (optional)", "pl": "Chcę otrzymywać nowości i oferty pracy e-mailem (opcjonalnie)", "sk": "Chcem dostávať novinky a pracovné príležitosti e-mailom (nepovinné)", "at": "Ich möchte Neuigkeiten und Jobangebote per E-Mail erhalten (optional)"}),

    # dialogueUi.tsx
    ("rebuild/shared/dialogueUi.tsx",
     "<strong>Environment fit:</strong>",
     "<strong>{t('rebuild.dialogue.environment_fit', { defaultValue: 'Prostředí' })}:</strong>",
     "rebuild.dialogue.environment_fit",
     {"cs": "Prostředí", "en": "Environment fit", "de": "Umgebungspassung", "pl": "Dopasowanie środowiska", "sk": "Prostredie", "at": "Umgebungspassung"}),

    ("rebuild/shared/dialogueUi.tsx",
     "<strong>Next steps:</strong>",
     "<strong>{t('rebuild.dialogue.next_steps', { defaultValue: 'Další kroky' })}:</strong>",
     "rebuild.dialogue.next_steps",
     {"cs": "Další kroky", "en": "Next steps", "de": "Nächste Schritte", "pl": "Następne kroki", "sk": "Ďalšie kroky", "at": "Nächste Schritte"}),
]

# Additional keys for nav items and other multi-key replacements
EXTRA_KEYS = {
    "rebuild.recruiter.nav_dashboard": {"cs": "Přehled", "en": "Overview", "de": "Übersicht", "pl": "Przegląd", "sk": "Prehľad", "at": "Übersicht"},
    "rebuild.recruiter.nav_roles": {"cs": "Role", "en": "Roles", "de": "Rollen", "pl": "Role", "sk": "Roly", "at": "Rollen"},
    "rebuild.recruiter.nav_candidates": {"cs": "Kandidáti", "en": "Candidates", "de": "Kandidaten", "pl": "Kandydaci", "sk": "Kandidáti", "at": "Kandidaten"},
    "rebuild.recruiter.nav_company_profile": {"cs": "Firemní profil", "en": "Company profile", "de": "Firmenprofil", "pl": "Profil firmy", "sk": "Firemný profil", "at": "Firmenprofil"},
    "rebuild.recruiter.subtitle_roles": {"cs": "Zadání rolí, důkazy schopnosti a řízení skill-first výběru.", "en": "Role briefs, competency evidence, and skill-first selection management.", "de": "Rollenbeschreibungen, Kompetenznachweise und kompetenzbasierte Auswahlsteuerung.", "pl": "Opisy ról, dowody kompetencji i zarządzanie selekcją opartą na umiejętnościach.", "sk": "Zadania rolí, dôkazy schopností a riadenie skill-first výberu.", "at": "Rollenbeschreibungen, Kompetenznachweise und kompetenzbasierte Auswahlsteuerung."},
    "rebuild.recruiter.subtitle_candidates": {"cs": "Kandidátské profily, recruiter readout a společná vlákna v jednom rozhodovacím prostoru.", "en": "Candidate profiles, recruiter readout, and shared threads in one decision space.", "de": "Kandidatenprofile, Recruiter-Readout und gemeinsame Threads in einem Entscheidungsraum.", "pl": "Profile kandydatów, readout rekrutera i wspólne wątki w jednej przestrzeni decyzyjnej.", "sk": "Kandidátske profily, recruiter readout a spoločné vlákna v jednom rozhodovacom priestore.", "at": "Kandidatenprofile, Recruiter-Readout und gemeinsame Threads in einem Entscheidungsraum."},
    "rebuild.recruiter.subtitle_settings": {"cs": "Značka, média a kontaktní osoby jako jeden zdroj pravdy.", "en": "Brand, media, and contacts as a single source of truth.", "de": "Marke, Medien und Kontaktpersonen als eine Quelle der Wahrheit.", "pl": "Marka, media i kontakty jako jedno źródło prawdy.", "sk": "Značka, médiá a kontaktné osoby ako jeden zdroj pravdy.", "at": "Marke, Medien und Kontaktpersonen als eine Quelle der Wahrheit."},
    "rebuild.recruiter.match_very_strong": {"cs": "Velmi silná shoda", "en": "Very strong match", "de": "Sehr starke Übereinstimmung", "pl": "Bardzo silne dopasowanie", "sk": "Veľmi silná zhoda", "at": "Sehr starke Übereinstimmung"},
    "rebuild.recruiter.match_strong": {"cs": "Silná shoda", "en": "Strong match", "de": "Starke Übereinstimmung", "pl": "Silne dopasowanie", "sk": "Silná zhoda", "at": "Starke Übereinstimmung"},
    "rebuild.recruiter.match_good": {"cs": "Dobrá shoda", "en": "Good match", "de": "Gute Übereinstimmung", "pl": "Dobre dopasowanie", "sk": "Dobrá zhoda", "at": "Gute Übereinstimmung"},
    "rebuild.recruiter.match_exploratory": {"cs": "Průzkumná shoda", "en": "Exploratory match", "de": "Explorative Übereinstimmung", "pl": "Eksploracyjne dopasowanie", "sk": "Prieskumná zhoda", "at": "Explorative Übereinstimmung"},
    "rebuild.recruiter.match_none": {"cs": "Zatím bez vyhodnocení", "en": "Not yet evaluated", "de": "Noch nicht bewertet", "pl": "Jeszcze nie oceniono", "sk": "Zatiaľ bez vyhodnotenia", "at": "Noch nicht bewertet"},
}

def set_nested(obj, dotpath, value):
    parts = dotpath.split('.')
    cur = obj
    for p in parts[:-1]:
        if p not in cur:
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value

def main():
    # Load all locales
    locales = {}
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        with open(os.path.join(LOCALES_DIR, lang, 'translation.json'), encoding='utf-8') as f:
            locales[lang] = json.load(f)

    # Apply text replacements in source files
    replaced = 0
    for item in REPLACEMENTS:
        filepath, old, new, key, translations = item
        fullpath = os.path.join(SRC, filepath)
        if not os.path.exists(fullpath):
            print(f"  SKIP (not found): {filepath}")
            continue
        with open(fullpath, 'r', encoding='utf-8') as f:
            content = f.read()
        if old in content:
            content = content.replace(old, new, 1)
            with open(fullpath, 'w', encoding='utf-8') as f:
                f.write(content)
            replaced += 1
            print(f"  REPLACED in {filepath}: {key or '(multi-key)'}")
        else:
            print(f"  NOT FOUND in {filepath}: {repr(old[:60])}")

        # Add translation keys
        if key and translations:
            for lang, val in translations.items():
                set_nested(locales[lang], key, val)

    # Add extra keys
    for key, translations in EXTRA_KEYS.items():
        for lang, val in translations.items():
            set_nested(locales[lang], key, val)

    # Save locales
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        path = os.path.join(LOCALES_DIR, lang, 'translation.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(locales[lang], f, ensure_ascii=False, indent=2)
            f.write('\n')

    print(f"\nDone! Replaced {replaced} hardcoded strings, added translation keys to all locales.")

if __name__ == '__main__':
    main()
