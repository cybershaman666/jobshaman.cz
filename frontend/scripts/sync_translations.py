#!/usr/bin/env python3
"""
Sync all translation files so every locale has the same key set.
CS is the primary language. This script:
1. Adds EN-only keys to CS (with Czech translations)
2. Adds CS-only keys to EN (with English translations)
3. Fills DE, PL, SK, AT with missing keys (translated)
"""
import json, os, copy

LOCALES_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'locales')

def load_locale(lang):
    with open(os.path.join(LOCALES_DIR, lang, 'translation.json'), encoding='utf-8') as f:
        return json.load(f)

def save_locale(lang, data):
    path = os.path.join(LOCALES_DIR, lang, 'translation.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')

def get_flat(obj, prefix=''):
    out = {}
    for k, v in obj.items():
        full = f'{prefix}.{k}' if prefix else k
        if isinstance(v, dict):
            out.update(get_flat(v, full))
        else:
            out[full] = v
    return out

def set_nested(obj, dotpath, value):
    parts = dotpath.split('.')
    cur = obj
    for p in parts[:-1]:
        if p not in cur:
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value

# ── EN→CS translations (103 keys) ──
EN_TO_CS = {
    "company.calendar.create_event": "Vytvořit událost",
    "company.calendar.empty_shared": "Zatím nejsou nastaveny žádné sdílené týmové kalendáře.",
    "company.calendar.empty_timeline": "Zatím zde nejsou žádné sdílené bloky. Jakmile tým začne plánovat pohovory nebo synchronizace, objeví se zde.",
    "company.calendar.live_sync": "Připraveno ke sdílení s týmem",
    "company.calendar.milestone_focus": "Chraňte rozhodovací okna",
    "company.calendar.milestone_focus_copy": "Rezervujte krátké rozhodovací sloty po závěrečných pohovorech, aby zpětná vazba nestagnovala.",
    "company.calendar.milestone_share": "Sdílejte kalendář s náborovým týmem",
    "company.calendar.milestone_share_copy": "Dejte recruiterům a hiring manažerům jeden společný pohled na bloky pohovorů a dostupnost.",
    "company.calendar.milestone_sync": "Týmová náborová synchronizace",
    "company.calendar.milestone_sync_copy": "Slaďte pohovory, vlastníky dalších kroků a úzká místa napříč aktivními rolemi.",
    "company.calendar.roles_in_motion": "Role v pohybu",
    "company.calendar.share_button": "Sdílet s týmem",
    "company.calendar.shared": "Sdílené kalendáře",
    "company.calendar.shared_calendars": "Sdílené týmové kalendáře",
    "company.calendar.shared_status": "Sdíleno",
    "company.calendar.team_sync": "Týmový režim",
    "company.calendar.team_sync_copy": "Bloky pohovorů, synchronizace a rozhodovací okna lze sdílet napříč recruitery, aby bylo vždy jasné, kdo vlastní další krok.",
    "company.calendar.team_sync_title": "Jeden kalendář pro celý náborový tým",
    "company.calendar.timeline": "Nadcházející náborový plán",
    "company.calendar.timeline_copy": "Pohovory, synchronizace a rozhodovací okna, která vyžadují pozornost.",
    "company.calendar.upcoming": "Nadcházející bloky",
    "company.calendar.visible": "Viditelné pro tým",
    "company.candidates.registered_user_bio": "Registrovaný kandidát na JobShaman.",
    "company.challenges.ai_optimize": "AI optimalizace",
    "company.challenges.archive": "Archivovat",
    "company.challenges.close": "Uzavřít",
    "company.challenges.col_status": "Stav",
    "company.challenges.col_title": "Výzva",
    "company.challenges.col_type": "Typ",
    "company.challenges.col_updated": "Aktualizováno",
    "company.challenges.empty_desc": "Výzva není jen popis práce. Je to reálný problém, který firma řeší. Kandidát ukáže, jak přemýšlí a co umí, nejen co má v CV.",
    "company.challenges.empty_title": "Zatím žádné výzvy",
    "company.challenges.mini_badge": "Mini výzva",
    "company.challenges.pause": "Pozastavit",
    "company.challenges.refresh": "Obnovit",
    "company.challenges.reopen": "Znovu otevřít",
    "company.challenges.resume": "Obnovit",
    "company.challenges.status_active": "Aktivní",
    "company.challenges.status_archived": "Archivováno",
    "company.challenges.status_closed": "Uzavřeno",
    "company.challenges.status_paused": "Pozastaveno",
    "company.challenges.title": "Výzvy",
    "company.challenges.type_mini": "Mini výzva",
    "company.challenges.type_standard": "Výzva",
    "company.overview.active_roles_copy": "Role, které dnes skutečně posouvají pipeline a zaslouží si prioritní pozornost.",
    "company.overview.active_roles_title": "Aktivní role",
    "company.overview.activity_badge": "Nedávná aktivita",
    "company.overview.activity_event": "Událost",
    "company.overview.activity_title": "Poslední pohyb v náboru",
    "company.overview.analytics_copy": "Kolik kandidátů je dnes v pohybu a kam se soustřeďuje pozornost týmu.",
    "company.overview.analytics_title": "Přehled pipeline",
    "company.overview.applicants": "odpovědí",
    "company.overview.applied": "Příchozí odpovědi",
    "company.overview.assessments": "Assessmenty v knihovně",
    "company.overview.avg_signal": "Průměrná shoda signálu",
    "company.overview.explore_matches": "Otevřít všechny silné shody",
    "company.overview.interview": "Připraveno na další krok",
    "company.overview.metric_empty_note": "čekání na živá data",
    "company.overview.metric_match": "Průměrná shoda",
    "company.overview.metric_match_note": "napříč aktuálně nejsilnějšími kandidáty",
    "company.overview.metric_pipelines": "Aktivní pipeline",
    "company.overview.metric_pipelines_note": "role, které se dnes skutečně posouvají",
    "company.overview.metric_pool": "Talent pool",
    "company.overview.metric_pool_note": "profily, se kterými může tým pracovat",
    "company.overview.metric_time": "Time-to-hire",
    "company.overview.metric_time_note": "od otevření aktivních rolí",
    "company.overview.monthly": "Tento měsíc",
    "company.overview.no_active_roles": "Zatím zde nejsou žádné aktivní role. Jakmile otevřete první roli, její signál a kontext pipeline se zde zobrazí.",
    "company.overview.no_activity": "Jakmile tým začne pracovat s kandidáty, rolemi a assessmenty, objeví se zde živá časová osa posledních kroků.",
    "company.overview.no_spotlight": "Jakmile se v talent poolu objeví reálné signály kandidátů, zobrazí se zde aktuálně nejsilnější shoda.",
    "company.overview.screened": "V otevřeném přehledu",
    "company.overview.screening": "V přehledu",
    "company.overview.spotlight_badge": "AI spotlight",
    "company.overview.spotlight_match_copy": "Silný profil pro vaši aktuální náborovou prioritu. Stojí za to otevřít detail a potvrdit další krok.",
    "company.overview.spotlight_title": "Doporučené zaměření na dnes",
    "company.overview.stable": "Stabilní",
    "company.overview.untitled_role": "Nepojmenovaná role",
    "company.overview.view_all_jobs": "Zobrazit všechny role",
    "company.overview.waiting_signal": "Čekání na signál",
    "company.overview.weekly": "Tento týden",
    "company.shell.premium": "Náborový workspace",
    "company.team.admin_count": "adminů",
    "company.team.empty_desc": "Pozvěte kolegy z vašeho náborového týmu. Uvidí role, odpovědi kandidátů a mohou pracovat ve společném firemním dashboardu.",
    "company.team.empty_title": "Váš tým je zatím prázdný",
    "company.team.invite": "Pozvat člena",
    "company.team.invite_email": "E-mail",
    "company.team.invite_name": "Jméno",
    "company.team.invite_role": "Role",
    "company.team.invite_title": "Pozvat nového člena",
    "company.team.members_count": "členů",
    "company.team.recruiter_count": "recruiterů",
    "company.team.role_admin": "Admin",
    "company.team.role_recruiter": "Recruiter",
    "company.team.send_invite": "Odeslat pozvánku",
    "company.team.status_invited": "Pozváno",
    "company.team.title": "Náborový tým",
    "company_landing.features.analysis.desc": "Detailní profilování kandidátů včetně analýzy rizika odchodu a kompatibility s týmem",
    "company_landing.features.analysis.title": "Analýza kandidátů",
    "company_landing.features.analytics.desc": "Detailní přehledy efektivity inzerátů, demografiky kandidátů a nákladů na nábor",
    "company_landing.features.analytics.title": "Pokročilá analytika",
    "company_landing.features.transparent.desc": "Ověřování informací v inzerátech a eliminace klamavých praktik v náboru",
    "company_landing.features.transparent.title": "Transparentnost a Fair Play",
    "seo.marketplace_title": "Pracovní marketplace | JobShaman",
}

# ── CS→EN translations (211 keys) ──
CS_TO_EN = {
    "admin_dashboard.backend_ping": "Backend ping",
    "admin_dashboard.cockpit": "Cockpit",
    "admin_dashboard.description": "Admin dashboard",
    "admin_dashboard.export_pack": "Export pack",
    "admin_dashboard.refresh": "Refresh",
    "admin_dashboard.title": "Admin Dashboard",
    "careeros.learning.duration.days": "days",
    "careeros.learning.duration.flexible": "Flexible",
    "careeros.learning.duration.hours": "hours",
    "careeros.learning.format.location_based": "On-site",
    "careeros.learning.level.advanced": "Advanced",
    "careeros.learning.level.beginner": "Beginner",
    "careeros.learning.level.intermediate": "Intermediate",
    "careeros.learning.marketplace_note.default_real": "Real opportunity from verified partner",
    "careeros.learning.marketplace_note.funded": "Government-funded program",
    "careeros.learning.marketplace_note.location": "Location-based course",
    "careeros.learning.marketplace_note.partner": "Partner resource",
    "careeros.learning.pricing.free": "Free",
    "careeros.learning.pricing.funded": "Funded",
    "careeros.learning.resource_reason.domain": "Matches your career domain",
    "careeros.learning.resource_reason.role": "Relevant for your target role",
    "careeros.learning.resource_reason.skills": "Builds on your skills",
    "company.benefits.5_weeks_holiday": "5 weeks holiday",
    "company.benefits.education": "Education budget",
    "company.benefits.flex_hours": "Flexible hours",
    "company.benefits.home_office": "Home office",
    "company.benefits.laptop_private": "Laptop for private use",
    "company.benefits.meal_allowance": "Meal allowance",
    "company.benefits.multisport": "Multisport card",
    "company.benefits.phone_private": "Phone for private use",
    "company.benefits.sick_days": "Sick days",
    "company.benefits.snacks": "Snacks & drinks",
    "company.candidates.breadcrumb": "Candidates",
    "company.candidates.empty": "No candidates yet",
    "company.candidates.loading": "Loading candidates...",
    "company.candidates.next_step_schedule": "Schedule next step",
    "company.candidates.next_step_signal": "Next step signal",
    "company.candidates.no_match": "No match found",
    "company.candidates.profile": "Profile",
    "company.dashboard.ai_insights.no_data_yet": "No data yet",
    "company.dashboard.stats.awaiting_hires": "Awaiting hires",
    "company.dashboard.stats.days_unit": "days",
    "company.dashboard.stats.no_data_yet": "No data yet",
    "company.learning.add_resource": "Add resource",
    "company.learning.archive": "Archive",
    "company.learning.badge": "Learning",
    "company.learning.body": "Manage and curate learning resources for your team and candidates.",
    "company.learning.catalog_body": "Browse available learning resources from verified providers.",
    "company.learning.catalog_title": "Learning catalog",
    "company.learning.create_resource": "Create resource",
    "company.learning.create_title": "Create new resource",
    "company.learning.difficulty.advanced": "Advanced",
    "company.learning.difficulty.beginner": "Beginner",
    "company.learning.difficulty.intermediate": "Intermediate",
    "company.learning.edit": "Edit",
    "company.learning.edit_title": "Edit resource",
    "company.learning.empty": "No learning resources yet",
    "company.learning.fields.currency": "Currency",
    "company.learning.fields.description": "Description",
    "company.learning.fields.difficulty": "Difficulty",
    "company.learning.fields.duration": "Duration",
    "company.learning.fields.location": "Location",
    "company.learning.fields.partner_name": "Partner name",
    "company.learning.fields.price": "Price",
    "company.learning.fields.provider": "Provider",
    "company.learning.fields.rating": "Rating",
    "company.learning.fields.reviews": "Reviews",
    "company.learning.fields.skill_tags": "Skill tags",
    "company.learning.fields.skill_tags_hint": "Comma-separated skill tags",
    "company.learning.fields.status": "Status",
    "company.learning.fields.title": "Title",
    "company.learning.fields.url": "URL",
    "company.learning.form_body": "Fill in the details for this learning resource.",
    "company.learning.metrics.active": "Active",
    "company.learning.metrics.archived": "Archived",
    "company.learning.metrics.draft": "Draft",
    "company.learning.metrics.total": "Total",
    "company.learning.new_resource": "New resource",
    "company.learning.no_description": "No description",
    "company.learning.refresh": "Refresh",
    "company.learning.restore": "Restore",
    "company.learning.save_changes": "Save changes",
    "company.learning.status.active": "Active",
    "company.learning.status.archived": "Archived",
    "company.learning.status.draft": "Draft",
    "company.learning.title": "Learning Hub",
    "footer.seo.assessment_description": "Complete your personal career assessment and discover your strengths.",
    "footer.seo.assessment_title": "Career Assessment | JobShaman",
    "footer.seo.marketplace_description": "Browse curated job opportunities matched to your skills and preferences.",
    "footer.seo.marketplace_title": "Job Marketplace | JobShaman",
    "footer.seo.saved_description": "Your saved job opportunities and shortlisted roles.",
    "footer.seo.saved_title": "Saved Jobs | JobShaman",
    "footer.seo.services_description": "Professional career development services, consulting, and job opportunities.",
    "footer.seo.services_title": "Services | JobShaman",
    "landing.jcfpm_promo.cta_register": "Register for full results",
    "landing.jcfpm_promo.cta_try_it": "Try JCFPM for free",
    "landing.jcfpm_promo.free_results": "Get a free overview of your strongest areas.",
    "landing.jcfpm_promo.learn_more": "Learn more about the methodology",
    "landing.jcfpm_promo.premium_badge": "PREMIUM",
    "landing.jcfpm_promo.premium_results": "With a Premium account, get a detailed 15-page report, professional strengths analysis, best-fit role recommendations, and skills gap identification.",
    "landing.jcfpm_promo.subtitle": "The JCFPM test reveals how you fit modern job roles and what your digital quotient is.",
    "landing.jcfpm_promo.title": "Discover your Career Fit potential",
    "landing.jcfpm_promo.what_is_it": "JobShaman Career Fit & Potential Matrix (JCFPM) is a unique methodology that analyzes cognitive, social, and technological skills in the context of the modern job market.",
    "profile.skills_count_few": "{{count}} skills",
    "profile.skills_count_one": "1 skill",
    "profile.skills_count_other": "{{count}} skills",
    "rebuild.actions.send": "Send",
    "rebuild.applications.active_handshakes": "Active handshakes",
    "rebuild.applications.saved_roles": "Saved roles",
    "rebuild.briefing.company_gallery": "Company gallery",
    "rebuild.briefing.handshake_materials": "Materials for the handshake",
    "rebuild.dashboard.browse_jobs": "Browse jobs",
    "rebuild.dashboard.company_profile": "Company profile",
    "rebuild.dashboard.greeting": "Hello, {{name}} 👋",
    "rebuild.dashboard.my_profile": "My profile",
    "rebuild.detail.company": "Company",
    "rebuild.detail.company_signal": "Company inside view",
    "rebuild.detail.company_signal_body": "The branded JobShaman detail links the role, team, and handshake materials so you can picture a real working day.",
    "rebuild.detail.compensation_unknown": "Not specified",
    "rebuild.detail.encounter_title": "Who you will meet",
    "rebuild.detail.external_source": "External source",
    "rebuild.detail.external_source_title": "Offer source",
    "rebuild.detail.fit_signal": "Fit before clicking",
    "rebuild.detail.fit_signal_body": "JHI, salary, taxes, and commute are calculated before starting the handshake, not after a wasted afternoon.",
    "rebuild.detail.imported_label": "Imported",
    "rebuild.detail.native": "JobShaman native",
    "rebuild.detail.next_step_signal": "Next step",
    "rebuild.detail.reality_heading": "Real work, money, commute, and energy in one view.",
    "rebuild.detail.reality_title": "Decision reality",
    "rebuild.detail.salary": "Salary in offer",
    "rebuild.detail.source": "Source",
    "rebuild.detail.tax": "Tax regime",
    "rebuild.insights.ai_story_guide": "AI Story Guide",
    "rebuild.lifestory.ai_guide": "AI Life Story Guide",
    "rebuild.lifestory.back": "Back",
    "rebuild.lifestory.context_prompt": "Describe your current work situation. What do you do? What would you like to change?",
    "rebuild.lifestory.context_title": "Current situation",
    "rebuild.lifestory.craft_prompt": "What skills have you acquired outside work? Certificates, self-study, informal leadership?",
    "rebuild.lifestory.craft_title": "Skills and courses",
    "rebuild.lifestory.generate": "Complete the story",
    "rebuild.lifestory.growth_prompt": "When did you first feel you excel at something? First jobs, schools — what did you enjoy about it?",
    "rebuild.lifestory.growth_title": "First steps",
    "rebuild.lifestory.next": "Continue",
    "rebuild.lifestory.placeholder": "Feel free to write in bullet points...",
    "rebuild.lifestory.roots_prompt": "What did you dream about as a child? What fascinated you?",
    "rebuild.lifestory.roots_title": "Childhood and dreams",
    "rebuild.lifestory.signals_prompt": "Recall moments when you were 'in the zone'. What activity was it? And what drained your energy?",
    "rebuild.lifestory.signals_title": "What worked",
    "rebuild.lifestory.vision_prompt": "If there were no obstacles, what direction would you like to pursue for the next 5 years?",
    "rebuild.lifestory.vision_title": "Where next?",
    "rebuild.marketplace.activity": "Activity",
    "rebuild.marketplace.activity_dialogues": "Open dialogues",
    "rebuild.marketplace.activity_loaded": "Loaded offers",
    "rebuild.marketplace.activity_recommended": "In current selection",
    "rebuild.marketplace.activity_saved": "Saved roles",
    "rebuild.marketplace.activity_title": "Activity",
    "rebuild.marketplace.activity_view_all": "View all",
    "rebuild.marketplace.benefit_13th_salary": "13th salary",
    "rebuild.marketplace.benefit_accommodation": "Accommodation",
    "rebuild.marketplace.benefit_car": "Company car",
    "rebuild.marketplace.benefit_child_friendly": "Child-friendly office",
    "rebuild.marketplace.benefit_dog_friendly": "Dog-friendly office",
    "rebuild.marketplace.benefit_education": "Education",
    "rebuild.marketplace.benefit_flex_hours": "Flexible hours",
    "rebuild.marketplace.benefit_home_office": "Home office",
    "rebuild.marketplace.benefit_meal_vouchers": "Meal vouchers",
    "rebuild.marketplace.benefit_multisport": "Multisport",
    "rebuild.marketplace.benefit_part_time": "Part time",
    "rebuild.marketplace.benefit_transport": "Transport allowance",
    "rebuild.marketplace.current_selection": "In current selection",
    "rebuild.marketplace.default_location": "Czech Republic",
    "rebuild.marketplace.default_shifts": "2 shifts",
    "rebuild.marketplace.loaded_offers": "Loaded offers",
    "rebuild.marketplace.location_label": "Work location",
    "rebuild.marketplace.match": "Match",
    "rebuild.marketplace.min_salary": "Minimum salary",
    "rebuild.marketplace.no_local_jobs": "There are currently no active challenges near {{location}} within {{radius}} km.",
    "rebuild.marketplace.no_more_recommendations": "No more suitable offers in the current radius. Try increasing the commute range in your profile or enable broader search.",
    "rebuild.marketplace.open_dialogues": "Open dialogues",
    "rebuild.marketplace.relevant_count": "Relevant results",
    "rebuild.marketplace.remaining_in_batch": "Remaining in batch",
    "rebuild.marketplace.saved_roles": "Saved roles",
    "rebuild.marketplace.summary_hint": "Summary hint",
    "rebuild.prep.compensation_unknown": "Not specified",
    "rebuild.prep.decision_room": "Decision detail",
    "rebuild.prep.imported_challenge": "Reality first, then external response.",
    "rebuild.prep.open_listing_title": "Original listing",
    "rebuild.prep.source_missing": "Source not available",
    "rebuild.prep.source_warning_body": "An imported offer may have changed conditions. Before responding, open the original server and verify the current text, validity, and contact.",
    "rebuild.recruiter.add_gallery": "Add photo",
    "rebuild.recruiter.add_material": "Add material",
    "rebuild.recruiter.gallery": "Company gallery",
    "rebuild.recruiter.gallery_empty": "Add office, production or team photos that candidates should see before the handshake.",
    "rebuild.recruiter.handshake_materials": "Handshake materials",
    "rebuild.recruiter.materials_empty": "Upload decks, process docs, videos or briefs that should be visible before or during the handshake.",
    "rebuild.recruiter.new_problem": "New problem",
    "rebuild.recruiter.remove_material": "Remove",
    "rebuild.recruiter.remove_media": "Remove",
    "rebuild.recruiter.reviewer_avatar": "Reviewer photo",
    "rebuild.recruiter.upload_cover": "Upload cover image",
    "rebuild.recruiter.upload_logo": "Upload logo",
    "rebuild.recruiter.uploading_media": "Uploading media...",
    "rebuild.recruiter.v2_greeting": "Welcome to the recruiter workspace",
    "rebuild.recruiter.v2_subtitle": "Overview of talents, projects, and team resonance in your organization.",
    "rebuild.search.marketplace_placeholder": "Position, field, location, benefits...",
    "rebuild.search.open": "Open search",
    "rebuild.talent_pool.copy": "Unified decision interface for managing candidates, readouts, and shared communication threads.",
    "rebuild.talent_pool.empty": "The talent pool has no loaded candidates yet.",
    "rebuild.talent_pool.export": "Export pool",
    "rebuild.talent_pool.no_bio": "The candidate hasn't filled in their personal story yet.",
    "saved_jobs_page.count_few": "{{count}} saved jobs",
}

def main():
    locales = {}
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        locales[lang] = load_locale(lang)

    # Step 1: Add EN-only keys to CS
    cs_flat = get_flat(locales['cs'])
    added_cs = 0
    for key, cs_val in EN_TO_CS.items():
        if key not in cs_flat:
            set_nested(locales['cs'], key, cs_val)
            added_cs += 1
    print(f"Added {added_cs} keys to CS")

    # Step 2: Add CS-only keys to EN
    en_flat = get_flat(locales['en'])
    added_en = 0
    for key, en_val in CS_TO_EN.items():
        if key not in en_flat:
            set_nested(locales['en'], key, en_val)
            added_en += 1
    print(f"Added {added_en} keys to EN")

    # Step 3: For DE, PL, SK, AT - copy missing keys from EN (as fallback text)
    # This ensures keys exist even if in English - better than showing raw keys
    # Rebuild the flat maps after updates
    cs_flat_new = get_flat(locales['cs'])
    en_flat_new = get_flat(locales['en'])
    
    # Build the full superset of keys
    all_keys = set(cs_flat_new.keys()) | set(en_flat_new.keys())
    
    for lang in ['de', 'pl', 'sk', 'at']:
        lang_flat = get_flat(locales[lang])
        added = 0
        for key in sorted(all_keys):
            if key not in lang_flat:
                # Use EN value as placeholder (better than missing key)
                val = en_flat_new.get(key) or cs_flat_new.get(key, key)
                set_nested(locales[lang], key, val)
                added += 1
        print(f"Added {added} keys to {lang.upper()}")

    # Save all
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        save_locale(lang, locales[lang])
    
    print("\nAll locale files updated!")

    # Verify
    counts = {}
    for lang in ['cs', 'en', 'de', 'pl', 'sk', 'at']:
        counts[lang] = len(get_flat(locales[lang]))
    print(f"\nKey counts: {counts}")
    
    # Check all match
    ref = counts['cs']
    for lang, cnt in counts.items():
        if cnt != ref:
            print(f"WARNING: {lang} has {cnt} keys, CS has {ref}")

if __name__ == '__main__':
    main()
