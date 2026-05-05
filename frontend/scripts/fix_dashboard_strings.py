#!/usr/bin/env python3
"""Fix hardcoded strings in RecruiterDashboardV2.tsx"""
import json, os

BASE = os.path.join(os.path.dirname(__file__), '..')
LOCALES_DIR = os.path.join(BASE, 'public', 'locales')
FILE = os.path.join(BASE, 'src', 'rebuild', 'recruiter', 'RecruiterDashboardV2.tsx')

REPLACEMENTS = [
    # RecruiterRadarCard
    (">Talent Intelligence<", ">{t('rebuild.recruiter.talent_intelligence', { defaultValue: 'Talent Intelligence' })}<"),
    (">Týmová kognitivní mapa<", ">{t('rebuild.recruiter.cognitive_map', { defaultValue: 'Týmová kognitivní mapa' })}<"),
    (">Zobrazit detail<", ">{t('rebuild.recruiter.show_detail', { defaultValue: 'Zobrazit detail' })}<"),
    ("Týmová mapa se začne skládat z dokončených assessmentů.", "{t('rebuild.recruiter.radar_empty', { defaultValue: 'Týmová mapa se začne skládat z dokončených assessmentů.' })}"),

    # ActiveRolesCard
    (">Otevřené pozice<", ">{t('rebuild.recruiter.open_positions', { defaultValue: 'Otevřené pozice' })}<"),
    (">Aktivní výzvy<", ">{t('rebuild.recruiter.active_challenges', { defaultValue: 'Aktivní výzvy' })}<"),
    (">Zobrazit všechny<", ">{t('rebuild.recruiter.show_all', { defaultValue: 'Zobrazit všechny' })}<"),
    ("Zatím tu nejsou žádné aktivní role.", "{t('rebuild.recruiter.no_active_roles', { defaultValue: 'Zatím tu nejsou žádné aktivní role.' })}"),
    (">Kandidátů<", ">{t('rebuild.recruiter.candidates_count', { defaultValue: 'Kandidátů' })}<"),

    # ResonanceCard
    (">Kognitivní rezonance<", ">{t('rebuild.recruiter.cognitive_resonance', { defaultValue: 'Kognitivní rezonance' })}<"),
    (">Rezonance napříč týmem<", ">{t('rebuild.recruiter.team_resonance', { defaultValue: 'Rezonance napříč týmem' })}<"),
    ("Rezonance se spočítá po dokončení odpovědí.", "{t('rebuild.recruiter.resonance_empty', { defaultValue: 'Rezonance se spočítá po dokončení odpovědí.' })}"),
    ("> Tip Cybershamana", "> {t('rebuild.recruiter.cybershaman_tip', { defaultValue: 'Tip Cybershamana' })}"),

    # TopCandidatesCard
    (">Talent Insights<", ">{t('rebuild.recruiter.talent_insights', { defaultValue: 'Talent Insights' })}<"),
    (">Top kandidáti<", ">{t('rebuild.recruiter.top_candidates', { defaultValue: 'Top kandidáti' })}<"),
    (">Zobrazit vše<", ">{t('rebuild.recruiter.show_all_short', { defaultValue: 'Zobrazit vše' })}<"),
    ("Zde uvidíte nejvhodnější talenty.", "{t('rebuild.recruiter.top_empty', { defaultValue: 'Zde uvidíte nejvhodnější talenty.' })}"),

    # PipelineCard
    (">Status náboru<", ">{t('rebuild.recruiter.hiring_status', { defaultValue: 'Status náboru' })}<"),
    (">Pipeline přehled<", ">{t('rebuild.recruiter.pipeline_overview', { defaultValue: 'Pipeline přehled' })}<"),
    ("Pipeline zatím neobsahuje data.", "{t('rebuild.recruiter.pipeline_empty', { defaultValue: 'Pipeline zatím neobsahuje data.' })}"),

    # CompositionCard
    (">Archetypy<", ">{t('rebuild.recruiter.archetypes', { defaultValue: 'Archetypy' })}<"),
    (">Týmové složení<", ">{t('rebuild.recruiter.team_composition', { defaultValue: 'Týmové složení' })}<"),
    (">Zobrazit mapu<", ">{t('rebuild.recruiter.show_map', { defaultValue: 'Zobrazit mapu' })}<"),
    ("Složení se zobrazí po nasbírání dat.", "{t('rebuild.recruiter.composition_empty', { defaultValue: 'Složení se zobrazí po nasbírání dat.' })}"),
    (">členů<", ">{t('rebuild.recruiter.members_unit', { defaultValue: 'členů' })}<"),

    # RecruiterActionStrip
    (">Cybershaman ti radí<", ">{t('rebuild.recruiter.cybershaman_advises', { defaultValue: 'Cybershaman ti radí' })}<"),
    ("'Nová doporučení se počítají z odpovědí kandidátů, rolí a firemních signálů v reálném čase.'",
     "t('rebuild.recruiter.advice_live', { defaultValue: 'Nová doporučení se počítají z odpovědí kandidátů, rolí a firemních signálů v reálném čase.' })"),
    ("'Jakmile založíš první roli a dorazí odpovědi, objeví se tady konkrétní kognitivní doporučení pro nábor.'",
     "t('rebuild.recruiter.advice_empty', { defaultValue: 'Jakmile založíš první roli a dorazí odpovědi, objeví se tady konkrétní kognitivní doporučení pro nábor.' })"),
    ("Hledat talenty", "{t('rebuild.recruiter.search_talents', { defaultValue: 'Hledat talenty' })}"),
    ("+ Vytvořit výzvu", "{t('rebuild.recruiter.create_challenge', { defaultValue: '+ Vytvořit výzvu' })}"),

    # Nav items (duplicated from RecruiterShell but in this file)
    ("{ id: 'dashboard', label: 'Přehled'",
     "{ id: 'dashboard', label: t('rebuild.recruiter.nav_dashboard', { defaultValue: 'Přehled' })"),
    ("{ id: 'roles', label: 'Role'",
     "{ id: 'roles', label: t('rebuild.recruiter.nav_roles', { defaultValue: 'Role' })"),
    ("{ id: 'talent-pool', label: 'Kandidáti'",
     "{ id: 'talent-pool', label: t('rebuild.recruiter.nav_candidates', { defaultValue: 'Kandidáti' })"),
    ("{ id: 'settings', label: 'Firemní profil'",
     "{ id: 'settings', label: t('rebuild.recruiter.nav_company_profile', { defaultValue: 'Firemní profil' })"),

    # Metrics labels
    ("label: 'Aktivní role'", "label: t('rebuild.recruiter.metric_active_roles', { defaultValue: 'Aktivní role' })"),
    ("label: 'Kandidáti ve hře'", "label: t('rebuild.recruiter.metric_candidates', { defaultValue: 'Kandidáti ve hře' })"),
    ("label: 'Odpovědi v procesu'", "label: t('rebuild.recruiter.metric_responses', { defaultValue: 'Odpovědi v procesu' })"),
    ("label: 'Úspěšnost hire'", "label: t('rebuild.recruiter.metric_hire_success', { defaultValue: 'Úspěšnost hire' })"),
    ("label: 'Týmová rezonance'", "label: t('rebuild.recruiter.metric_team_resonance', { defaultValue: 'Týmová rezonance' })"),

    # Delta texts
    ("'Zatím bez dat'", "t('rebuild.recruiter.no_data_yet', { defaultValue: 'Zatím bez dat' })"),
    ("'Načítám data'", "t('rebuild.recruiter.loading_data', { defaultValue: 'Načítám data' })"),
]

# All new translation keys
NEW_KEYS = {
    "rebuild.recruiter.talent_intelligence": {"cs": "Talent Intelligence", "en": "Talent Intelligence", "de": "Talent Intelligence", "pl": "Talent Intelligence", "sk": "Talent Intelligence", "at": "Talent Intelligence"},
    "rebuild.recruiter.cognitive_map": {"cs": "Týmová kognitivní mapa", "en": "Team cognitive map", "de": "Kognitive Teamkarte", "pl": "Mapa kognitywna zespołu", "sk": "Tímová kognitívna mapa", "at": "Kognitive Teamkarte"},
    "rebuild.recruiter.show_detail": {"cs": "Zobrazit detail", "en": "Show detail", "de": "Detail anzeigen", "pl": "Pokaż szczegóły", "sk": "Zobraziť detail", "at": "Detail anzeigen"},
    "rebuild.recruiter.radar_empty": {"cs": "Týmová mapa se začne skládat z dokončených assessmentů.", "en": "The team map will start building from completed assessments.", "de": "Die Teamkarte wird aus abgeschlossenen Assessments erstellt.", "pl": "Mapa zespołu zacznie się budować z ukończonych assessmentów.", "sk": "Tímová mapa sa začne skladať z dokončených assessmentov.", "at": "Die Teamkarte wird aus abgeschlossenen Assessments erstellt."},
    "rebuild.recruiter.open_positions": {"cs": "Otevřené pozice", "en": "Open positions", "de": "Offene Positionen", "pl": "Otwarte pozycje", "sk": "Otvorené pozície", "at": "Offene Positionen"},
    "rebuild.recruiter.active_challenges": {"cs": "Aktivní výzvy", "en": "Active challenges", "de": "Aktive Herausforderungen", "pl": "Aktywne wyzwania", "sk": "Aktívne výzvy", "at": "Aktive Herausforderungen"},
    "rebuild.recruiter.show_all": {"cs": "Zobrazit všechny", "en": "Show all", "de": "Alle anzeigen", "pl": "Pokaż wszystkie", "sk": "Zobraziť všetky", "at": "Alle anzeigen"},
    "rebuild.recruiter.no_active_roles": {"cs": "Zatím tu nejsou žádné aktivní role.", "en": "No active roles yet.", "de": "Noch keine aktiven Rollen.", "pl": "Brak aktywnych ról.", "sk": "Zatiaľ tu nie sú žiadne aktívne roly.", "at": "Noch keine aktiven Rollen."},
    "rebuild.recruiter.candidates_count": {"cs": "Kandidátů", "en": "Candidates", "de": "Kandidaten", "pl": "Kandydatów", "sk": "Kandidátov", "at": "Kandidaten"},
    "rebuild.recruiter.cognitive_resonance": {"cs": "Kognitivní rezonance", "en": "Cognitive resonance", "de": "Kognitive Resonanz", "pl": "Rezonans kognitywny", "sk": "Kognitívna rezonancia", "at": "Kognitive Resonanz"},
    "rebuild.recruiter.team_resonance": {"cs": "Rezonance napříč týmem", "en": "Team-wide resonance", "de": "Teamweite Resonanz", "pl": "Rezonans w całym zespole", "sk": "Rezonancia naprieč tímom", "at": "Teamweite Resonanz"},
    "rebuild.recruiter.resonance_empty": {"cs": "Rezonance se spočítá po dokončení odpovědí.", "en": "Resonance will be calculated after responses are completed.", "de": "Die Resonanz wird nach Abschluss der Antworten berechnet.", "pl": "Rezonans zostanie obliczony po ukończeniu odpowiedzi.", "sk": "Rezonancia sa spočíta po dokončení odpovedí.", "at": "Die Resonanz wird nach Abschluss der Antworten berechnet."},
    "rebuild.recruiter.cybershaman_tip": {"cs": "Tip Cybershamana", "en": "Cybershaman tip", "de": "Cybershaman-Tipp", "pl": "Wskazówka Cybershamana", "sk": "Tip Cybershamana", "at": "Cybershaman-Tipp"},
    "rebuild.recruiter.talent_insights": {"cs": "Talent Insights", "en": "Talent Insights", "de": "Talent Insights", "pl": "Talent Insights", "sk": "Talent Insights", "at": "Talent Insights"},
    "rebuild.recruiter.top_candidates": {"cs": "Top kandidáti", "en": "Top candidates", "de": "Top-Kandidaten", "pl": "Najlepsi kandydaci", "sk": "Top kandidáti", "at": "Top-Kandidaten"},
    "rebuild.recruiter.show_all_short": {"cs": "Zobrazit vše", "en": "Show all", "de": "Alle anzeigen", "pl": "Pokaż wszystko", "sk": "Zobraziť všetko", "at": "Alle anzeigen"},
    "rebuild.recruiter.top_empty": {"cs": "Zde uvidíte nejvhodnější talenty.", "en": "You will see the best-matching talents here.", "de": "Hier sehen Sie die am besten passenden Talente.", "pl": "Tutaj zobaczysz najlepiej dopasowane talenty.", "sk": "Tu uvidíte najvhodnejšie talenty.", "at": "Hier sehen Sie die am besten passenden Talente."},
    "rebuild.recruiter.hiring_status": {"cs": "Status náboru", "en": "Hiring status", "de": "Einstellungsstatus", "pl": "Status rekrutacji", "sk": "Status náboru", "at": "Einstellungsstatus"},
    "rebuild.recruiter.pipeline_overview": {"cs": "Pipeline přehled", "en": "Pipeline overview", "de": "Pipeline-Übersicht", "pl": "Przegląd pipeline", "sk": "Pipeline prehľad", "at": "Pipeline-Übersicht"},
    "rebuild.recruiter.pipeline_empty": {"cs": "Pipeline zatím neobsahuje data.", "en": "Pipeline has no data yet.", "de": "Die Pipeline enthält noch keine Daten.", "pl": "Pipeline nie zawiera jeszcze danych.", "sk": "Pipeline zatiaľ neobsahuje dáta.", "at": "Die Pipeline enthält noch keine Daten."},
    "rebuild.recruiter.archetypes": {"cs": "Archetypy", "en": "Archetypes", "de": "Archetypen", "pl": "Archetypy", "sk": "Archetypy", "at": "Archetypen"},
    "rebuild.recruiter.team_composition": {"cs": "Týmové složení", "en": "Team composition", "de": "Teamzusammensetzung", "pl": "Skład zespołu", "sk": "Tímové zloženie", "at": "Teamzusammensetzung"},
    "rebuild.recruiter.show_map": {"cs": "Zobrazit mapu", "en": "Show map", "de": "Karte anzeigen", "pl": "Pokaż mapę", "sk": "Zobraziť mapu", "at": "Karte anzeigen"},
    "rebuild.recruiter.composition_empty": {"cs": "Složení se zobrazí po nasbírání dat.", "en": "Composition will appear after data is collected.", "de": "Die Zusammensetzung wird nach dem Sammeln von Daten angezeigt.", "pl": "Skład wyświetli się po zebraniu danych.", "sk": "Zloženie sa zobrazí po nazbieraní dát.", "at": "Die Zusammensetzung wird nach dem Sammeln von Daten angezeigt."},
    "rebuild.recruiter.members_unit": {"cs": "členů", "en": "members", "de": "Mitglieder", "pl": "członków", "sk": "členov", "at": "Mitglieder"},
    "rebuild.recruiter.cybershaman_advises": {"cs": "Cybershaman ti radí", "en": "Cybershaman advises", "de": "Cybershaman berät", "pl": "Cybershaman radzi", "sk": "Cybershaman ti radí", "at": "Cybershaman berät"},
    "rebuild.recruiter.advice_live": {"cs": "Nová doporučení se počítají z odpovědí kandidátů, rolí a firemních signálů v reálném čase.", "en": "New recommendations are calculated from candidate responses, roles, and company signals in real time.", "de": "Neue Empfehlungen werden in Echtzeit aus Kandidatenantworten, Rollen und Firmensignalen berechnet.", "pl": "Nowe rekomendacje są obliczane z odpowiedzi kandydatów, ról i sygnałów firmowych w czasie rzeczywistym.", "sk": "Nové odporúčania sa počítajú z odpovedí kandidátov, rolí a firemných signálov v reálnom čase.", "at": "Neue Empfehlungen werden in Echtzeit aus Kandidatenantworten, Rollen und Firmensignalen berechnet."},
    "rebuild.recruiter.advice_empty": {"cs": "Jakmile založíš první roli a dorazí odpovědi, objeví se tady konkrétní kognitivní doporučení pro nábor.", "en": "Once you create the first role and responses arrive, specific cognitive hiring recommendations will appear here.", "de": "Sobald Sie die erste Rolle erstellen und Antworten eintreffen, erscheinen hier spezifische kognitive Einstellungsempfehlungen.", "pl": "Gdy utworzysz pierwszą rolę i nadejdą odpowiedzi, pojawią się tutaj konkretne rekomendacje kognitywne dotyczące rekrutacji.", "sk": "Akonáhle založíš prvú rolu a dorazia odpovede, objavia sa tu konkrétne kognitívne odporúčania pre nábor.", "at": "Sobald Sie die erste Rolle erstellen und Antworten eintreffen, erscheinen hier spezifische kognitive Einstellungsempfehlungen."},
    "rebuild.recruiter.search_talents": {"cs": "Hledat talenty", "en": "Search talents", "de": "Talente suchen", "pl": "Szukaj talentów", "sk": "Hľadať talenty", "at": "Talente suchen"},
    "rebuild.recruiter.create_challenge": {"cs": "+ Vytvořit výzvu", "en": "+ Create challenge", "de": "+ Herausforderung erstellen", "pl": "+ Utwórz wyzwanie", "sk": "+ Vytvoriť výzvu", "at": "+ Herausforderung erstellen"},
    "rebuild.recruiter.metric_active_roles": {"cs": "Aktivní role", "en": "Active roles", "de": "Aktive Rollen", "pl": "Aktywne role", "sk": "Aktívne roly", "at": "Aktive Rollen"},
    "rebuild.recruiter.metric_candidates": {"cs": "Kandidáti ve hře", "en": "Candidates in play", "de": "Kandidaten im Spiel", "pl": "Kandydaci w grze", "sk": "Kandidáti v hre", "at": "Kandidaten im Spiel"},
    "rebuild.recruiter.metric_responses": {"cs": "Odpovědi v procesu", "en": "Responses in process", "de": "Antworten in Bearbeitung", "pl": "Odpowiedzi w procesie", "sk": "Odpovede v procese", "at": "Antworten in Bearbeitung"},
    "rebuild.recruiter.metric_hire_success": {"cs": "Úspěšnost hire", "en": "Hire success rate", "de": "Einstellungserfolgsrate", "pl": "Wskaźnik sukcesu rekrutacji", "sk": "Úspešnosť hire", "at": "Einstellungserfolgsrate"},
    "rebuild.recruiter.metric_team_resonance": {"cs": "Týmová rezonance", "en": "Team resonance", "de": "Teamresonanz", "pl": "Rezonans zespołu", "sk": "Tímová rezonancia", "at": "Teamresonanz"},
    "rebuild.recruiter.no_data_yet": {"cs": "Zatím bez dat", "en": "No data yet", "de": "Noch keine Daten", "pl": "Brak danych", "sk": "Zatiaľ bez dát", "at": "Noch keine Daten"},
    "rebuild.recruiter.loading_data": {"cs": "Načítám data", "en": "Loading data", "de": "Daten laden", "pl": "Ładowanie danych", "sk": "Načítavam dáta", "at": "Daten laden"},
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
    with open(FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    replaced = 0
    for old, new in REPLACEMENTS:
        if old in content:
            content = content.replace(old, new, 1)
            replaced += 1
            print(f"  OK: {old[:50]}...")
        else:
            print(f"  MISS: {old[:50]}...")

    with open(FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    # Update locales
    locales = {}
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        with open(os.path.join(LOCALES_DIR, lang, 'translation.json'), encoding='utf-8') as f:
            locales[lang] = json.load(f)

    for key, translations in NEW_KEYS.items():
        for lang, val in translations.items():
            set_nested(locales[lang], key, val)

    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        path = os.path.join(LOCALES_DIR, lang, 'translation.json')
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(locales[lang], f, ensure_ascii=False, indent=2)
            f.write('\n')

    print(f"\nDone! {replaced} replacements in RecruiterDashboardV2.tsx")

if __name__ == '__main__':
    main()
