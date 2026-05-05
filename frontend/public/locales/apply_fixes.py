import json
import os

locales_dir = "frontend/public/locales"
en_path = os.path.join(locales_dir, "en", "translation.json")
cs_path = os.path.join(locales_dir, "cs", "translation.json")

with open(en_path, "r", encoding="utf-8") as f:
    en_data = json.load(f)
with open(cs_path, "r", encoding="utf-8") as f:
    cs_data = json.load(f)

# Fix Czech in EN
en_rebuild = en_data.get("rebuild", {})
en_rebuild["marketplace"]["loading_more"] = "Loading more offers."
en_rebuild["marketplace"]["no_more_roles"] = "That's all for now."
en_rebuild["marketplace"]["no_more_roles_copy"] = "Try adjusting filters or come back later for more offers."
if "jcfpm" in en_rebuild:
    en_rebuild["jcfpm"]["loading_questions"] = "Loading JCFPM questions from Supabase..."
    en_rebuild["jcfpm"]["no_questions"] = "No JCFPM questions are currently available in the database."
    en_rebuild["jcfpm"]["answer_all"] = "Respond to all statements to unlock your archetype and role recommendations."
if "dashboard" in en_rebuild:
    en_rebuild["dashboard"]["onboarding_pending_title"] = "Cybershaman Guide is not complete"
    en_rebuild["dashboard"]["onboarding_pending_desc"] = "Go through the awakening ritual so we can more accurately aim your work compass."
    en_rebuild["dashboard"]["start_ritual"] = "Start ritual"

# Mass translate some namespaces in CS
cs_translations = {
    "rebuild.nav.home": "Domů",
    "rebuild.nav.profile": "Profil",
    "rebuild.nav.jcfpm": "Sebepoznání",
    "rebuild.nav.work": "Práce",
    "rebuild.nav.applications": "Žádosti",
    "rebuild.nav.learning": "Učení",
    "rebuild.nav.marketplace": "Marketplace",
    "rebuild.nav.settings": "Nastavení",
    "rebuild.nav.recruiter_dashboard": "Dashboard náboráře",
    "rebuild.nav.talent_pool": "Talent pool",
    "rebuild.nav.active_roles": "Aktivní role",
    
    "rebuild.dashboard.greeting": "Ahoj, {{name}} 👋",
    "rebuild.dashboard.tagline": "Pojďme najít práci, která ti sedí.",
    "rebuild.dashboard.save_profile": "Uložit profil",
    "rebuild.dashboard.save_top_role": "Uložit top roli",
    "rebuild.dashboard.growth_title": "Zlepšete své {{source}}",
    "rebuild.dashboard.growth_copy_ready": "Trénink zaměřený na hlubší analýzu, práci s předpoklady a přesnější rozhodování.",
    "rebuild.dashboard.growth_copy_pending": "Dokončete svůj JCFPM profil a Cybershaman vám doporučí přesný trénink pro růst.",
    "rebuild.dashboard.growth_meta_ready": "2 týdny • 5 lekcí • 30 min denně",
    "rebuild.dashboard.growth_meta_pending": "Přesná mapa se odemkne po JCFPM",
    "rebuild.dashboard.active_submissions": "Aktivní žádosti",
    "rebuild.dashboard.free_slots": "Volné sloty",
    "rebuild.dashboard.saved_roles": "Uložené role",
    "rebuild.dashboard.data_status": "Stav dat",
    "rebuild.dashboard.status_actual": "Aktuální",
    "rebuild.dashboard.status_sync": "Synchronizace",
    
    "rebuild.dimensions.cognitive_flex": "Kognitivní flexibilita",
    "rebuild.dimensions.social_intelligence": "Sociální inteligence",
    "rebuild.dimensions.motivation": "Motivace",
    "rebuild.dimensions.stress_resilience": "Odolnost vůči stresu",
    "rebuild.dimensions.values": "Hodnoty",
    "rebuild.dimensions.tech_adaptability": "Technologická adaptabilita",
    "rebuild.dimensions.cognitive_reflection": "Kognitivní reflexe",
    "rebuild.dimensions.digital_eq": "Digitální EQ",
    "rebuild.dimensions.systems_thinking": "Systémové myšlení",
    "rebuild.dimensions.ambiguity_handling": "Zvládání ambiguity",
    "rebuild.dimensions.strategic_thinking": "Strategické myšlení",
    "rebuild.dimensions.moral_compass": "Morální kompas",
}

def set_key(data, key, value):
    parts = key.split('.')
    curr = data
    for part in parts[:-1]:
        if part not in curr: curr[part] = {}
        curr = curr[part]
    curr[parts[-1]] = value

for key, val in cs_translations.items():
    set_key(cs_data, key, val)

with open(en_path, "w", encoding="utf-8") as f:
    json.dump(en_data, f, ensure_ascii=False, indent=2)
with open(cs_path, "w", encoding="utf-8") as f:
    json.dump(cs_data, f, ensure_ascii=False, indent=2)
