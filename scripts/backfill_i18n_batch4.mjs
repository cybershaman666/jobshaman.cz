import fs from 'node:fs';
import path from 'node:path';

const localeDir = path.join(process.cwd(), 'public', 'locales');

const adminDashboardBase = {
  partial_data: 'Some admin data could not be loaded. The rest of the overview is available.',
  export: 'Export',
  tabs: {
    crm: 'CRM',
    workspace: 'Board'
  },
  crm: {
    total_entities: 'CRM entities',
    companies: 'Companies',
    users: 'Users',
    leads: 'Leads',
    with_subscription: 'With subscription',
    trialing: 'Trialing',
    add_lead: 'Add company as lead',
    company_name: 'Company',
    contact_name: 'Contact person',
    phone: 'Phone',
    notes: 'Lead note',
    create_lead_cta: 'Save lead',
    search_placeholder: 'Search company or user…',
    kind_all: 'All',
    select_entity: 'Select a record on the left to open CRM detail.',
    lead: 'Lead',
    entity_overview: 'Entity summary',
    position_filter: 'Role filter',
    position_filter_all: 'All roles',
    application_status_breakdown: 'Handshake statuses',
    job_reaction_breakdown: 'Reactions by role',
    position: 'Role',
    people: 'People',
    handshakes: 'Handshakes',
    recent_jobs: 'Recent roles',
    recent_applications: 'Recent handshakes',
    recent_interactions: 'Recent interactions',
    recent_activity: 'Company activity',
    timeline: 'Event timeline',
    timeline_items: 'events',
    timeline_all: 'All',
    lead_detail: 'Sales lead',
    contact_role: 'Contact role',
    city: 'City',
    country: 'Country',
    subscription: 'Subscription',
    period_end: 'Period end',
    no_subscription_period: 'No active period.',
    digest: 'User digest notifications',
    audit: 'Subscription change audit',
    audit_unavailable: 'Audit table is not available.',
    top_positions: 'Top roles by reactions',
    top_positions_hint: 'Last 90 days across companies. The search on the left filters this overview too.',
    positions: 'roles',
    expand: 'Expand',
    collapse: 'Collapse',
    filter_company: 'Filter by company…',
    filter_position: 'Filter by role…',
    top_positions_collapsed: 'Section is collapsed.',
    metrics: {
      days_open: 'Days in pipeline',
      follow_up_scheduled: 'Follow-up scheduled',
      has_email: 'Has email',
      has_phone: 'Has phone',
      linked_company: 'Linked company',
      jobs_active: 'Active roles',
      jobs_total: 'Roles total',
      applications_total: 'Handshakes total',
      members: 'Workspace members',
      jobs_recent: 'New roles 30d',
      applications_recent: 'Handshakes 30d',
      interactions_total: 'Interactions total',
      interactions_recent: 'Interactions 30d',
      apply_clicks: 'Apply clicks 30d',
      member_companies: 'Companies in membership'
    }
  },
  workspace: {
    create: 'New team card',
    unsupported: 'The board is not deployed on the current backend yet.',
    title: 'Task or idea title',
    body: 'Context, opinion, next step, or open question',
    assignee_name: 'Owner',
    create_cta: 'Add card',
    search: 'Search thoughts, tasks, and notes…',
    all_statuses: 'All statuses',
    column_inbox: 'Inbox',
    column_active: 'In progress',
    column_done: 'Done',
    empty: 'Nothing yet.',
    unassigned: 'Unassigned',
    comment_placeholder: 'Add a comment, reaction, or context…',
    add_comment: 'Add comment',
    raise_priority: 'Priority',
    toggle_task: 'Toggle type'
  }
};

const adminDashboardCs = {
  partial_data: 'Část admin dat se nepodařilo načíst. Zbytek přehledu je dostupný.',
  export: 'Export',
  tabs: {
    crm: 'CRM',
    workspace: 'Board'
  },
  crm: {
    total_entities: 'CRM entity',
    companies: 'Firmy',
    users: 'Uživatelé',
    leads: 'Leady',
    with_subscription: 'S předplatným',
    trialing: 'Trialing',
    add_lead: 'Přidat firmu jako lead',
    company_name: 'Firma',
    contact_name: 'Kontaktní osoba',
    phone: 'Telefon',
    notes: 'Poznámka k leadu',
    create_lead_cta: 'Uložit lead',
    search_placeholder: 'Hledat firmu nebo uživatele…',
    kind_all: 'Vše',
    select_entity: 'Vyberte záznam vlevo pro detail CRM.',
    lead: 'Lead',
    entity_overview: 'Souhrn entity',
    position_filter: 'Filtr pozice',
    position_filter_all: 'Všechny pozice',
    application_status_breakdown: 'Statusy handshake',
    job_reaction_breakdown: 'Reakce podle pozice',
    position: 'Pozice',
    people: 'Lidé',
    handshakes: 'Handshake',
    recent_jobs: 'Poslední role',
    recent_applications: 'Poslední handshaky',
    recent_interactions: 'Poslední interakce',
    recent_activity: 'Aktivita firmy',
    timeline: 'Timeline událostí',
    timeline_items: 'událostí',
    timeline_all: 'Vše',
    lead_detail: 'Obchodní lead',
    contact_role: 'Role kontaktu',
    city: 'Město',
    country: 'Země',
    subscription: 'Předplatné',
    period_end: 'Konec období',
    no_subscription_period: 'Bez aktivního období.',
    digest: 'Digest notifikace uživatele',
    audit: 'Audit změn předplatného',
    audit_unavailable: 'Audit tabulka není dostupná.',
    top_positions: 'Top pozice podle reakcí',
    top_positions_hint: 'Posledních 90 dní, napříč firmami. Vyhledávání vlevo filtruje i tento přehled.',
    positions: 'pozic',
    expand: 'Rozbalit',
    collapse: 'Sbalit',
    filter_company: 'Filtrovat podle firmy…',
    filter_position: 'Filtrovat podle pozice…',
    top_positions_collapsed: 'Sekce je sbalená.',
    metrics: {
      days_open: 'Dní v pipeline',
      follow_up_scheduled: 'Naplánovaný follow-up',
      has_email: 'Má e-mail',
      has_phone: 'Má telefon',
      linked_company: 'Navázaná firma',
      jobs_active: 'Aktivní role',
      jobs_total: 'Role celkem',
      applications_total: 'Handshake celkem',
      members: 'Členové workspace',
      jobs_recent: 'Nové role 30d',
      applications_recent: 'Handshake 30d',
      interactions_total: 'Interakce celkem',
      interactions_recent: 'Interakce 30d',
      apply_clicks: 'Apply click 30d',
      member_companies: 'Firmy v členství'
    }
  },
  workspace: {
    create: 'Nová karta pro tým',
    unsupported: 'Board ještě není nasazený na aktuálním backendu.',
    title: 'Nadpis myšlenky nebo úkolu',
    body: 'Kontext, názor, další krok nebo otevřená otázka',
    assignee_name: 'Komu to patří',
    create_cta: 'Přidat kartu',
    search: 'Hledat v myšlenkách, úkolech a poznámkách…',
    all_statuses: 'Všechny stavy',
    column_inbox: 'Inbox',
    column_active: 'Rozpracované',
    column_done: 'Hotovo',
    empty: 'Zatím nic.',
    unassigned: 'Nepřiřazeno',
    comment_placeholder: 'Přidat komentář, reakci nebo doplnění…',
    add_comment: 'Přidat komentář',
    raise_priority: 'Priorita',
    toggle_task: 'Přepnout typ'
  }
};

const profileBase = {
  supporting_context_tab: 'Supporting context',
  supporting_context_tab_caption: 'CV, AI draft, and extra materials',
  settings_title: 'Settings',
  save_success: 'Profile saved.',
  supporting_context_section: 'Supporting context',
  supporting_context_desc: 'Keep an up-to-date CV, AI CV text, and supporting materials ready for applications.',
  save_hint_bottom: 'Changes are saved to your profile and used in applications.',
  account_title: 'Account',
  security_title: 'Security',
  security_desc: 'Manage access, notifications, and destructive account actions from one place.',
  solved_problems: {
    title: 'Solved problems',
    subtitle: 'Short evidence of what you improved, fixed, or shipped.',
    badge: 'Evidence',
    problem: 'Problem',
    solution: 'Solution',
    result: 'Result'
  },
  ai_guide_long_desc: 'AI guide helps turn your experience into a clearer profile and stronger application materials.',
  ai_guide: {
    value_1: 'Clearer profile story',
    value_2: 'Stronger CV output',
    value_3: 'Better application context'
  },
  tax: {
    paywall_hint: 'Advanced tax profile is available in Premium.'
  },
  jcfpm: {
    basic_result_active: 'Basic result is active',
    basic_result_desc: 'You currently share the compact JCFPM result only.',
    unlock_premium_results: 'Unlock Premium results'
  }
};

const profileCs = {
  supporting_context_tab: 'Podpůrné podklady',
  supporting_context_tab_caption: 'CV, AI draft a další materiály',
  settings_title: 'Nastavení',
  save_success: 'Profil uložen.',
  supporting_context_section: 'Podpůrné podklady',
  supporting_context_desc: 'Mějte připravené aktuální CV, AI CV text a další podklady pro odpovědi na role.',
  save_hint_bottom: 'Změny se uloží do profilu a použijí se při odpovědích na pozice.',
  account_title: 'Účet',
  security_title: 'Zabezpečení',
  security_desc: 'Správa přístupu, notifikací a citlivých akcí nad účtem na jednom místě.',
  solved_problems: {
    title: 'Vyřešené problémy',
    subtitle: 'Stručné důkazy toho, co jste zlepšili, opravili nebo doručili.',
    badge: 'Evidence',
    problem: 'Problém',
    solution: 'Řešení',
    result: 'Výsledek'
  },
  ai_guide_long_desc: 'AI průvodce pomáhá převést zkušenosti do srozumitelnějšího profilu a silnějších podkladů pro odpovědi.',
  ai_guide: {
    value_1: 'Jasnější příběh profilu',
    value_2: 'Silnější výstup CV',
    value_3: 'Lepší kontext pro odpovědi'
  },
  tax: {
    paywall_hint: 'Pokročilý daňový profil je dostupný v Premium.'
  },
  jcfpm: {
    basic_result_active: 'Základní výsledek je aktivní',
    basic_result_desc: 'Momentálně sdílíte jen kompaktní JCFPM výsledek.',
    unlock_premium_results: 'Odemknout Premium výsledky'
  }
};

const savedJobsBase = {
  badge: 'Watchlist'
};

const savedJobsCs = {
  badge: 'Watchlist'
};

const localeOverrides = {
  cs: {
    admin_dashboard: adminDashboardCs,
    profile: {
      job_hub: {
        tab_caption: 'Dialogy a sloty'
      },
      ...profileCs
    },
    saved_jobs_page: savedJobsCs,
    app: {
      edit: 'Upravit'
    }
  },
  en: {
    admin_dashboard: adminDashboardBase,
    profile: {
      job_hub: {
        tab_caption: 'Dialogues and slots'
      },
      ...profileBase
    },
    saved_jobs_page: savedJobsBase,
    app: {
      edit: 'Edit'
    }
  },
  de: {
    admin_dashboard: adminDashboardBase,
    profile: {
      job_hub: {
        tab_caption: 'Dialoge und Slots'
      },
      ...profileBase
    },
    saved_jobs_page: savedJobsBase,
    app: {
      edit: 'Bearbeiten'
    }
  },
  at: {
    admin_dashboard: adminDashboardBase,
    profile: {
      job_hub: {
        tab_caption: 'Dialoge und Slots'
      },
      ...profileBase
    },
    saved_jobs_page: savedJobsBase,
    app: {
      edit: 'Bearbeiten'
    }
  },
  pl: {
    admin_dashboard: adminDashboardBase,
    profile: {
      job_hub: {
        tab_caption: 'Dialogi i sloty'
      },
      ...profileBase
    },
    saved_jobs_page: savedJobsBase,
    app: {
      edit: 'Edytuj'
    }
  },
  sk: {
    admin_dashboard: adminDashboardBase,
    profile: {
      job_hub: {
        tab_caption: 'Dialógy a sloty'
      },
      ...profileBase
    },
    saved_jobs_page: savedJobsBase,
    app: {
      edit: 'Upraviť'
    }
  }
};

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      target[key] = value;
    }
  }
}

for (const locale of Object.keys(localeOverrides)) {
  const file = path.join(localeDir, locale, 'translation.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  deepMerge(json, localeOverrides[locale]);
  fs.writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`updated ${file}`);
}
