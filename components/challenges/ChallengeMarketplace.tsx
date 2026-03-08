import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  Briefcase,
  Globe,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  TrainFront
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CandidateDialogueCapacity, Job, JobSearchFilters, SearchLanguageCode, UserProfile } from '../../types';
import { buildCandidateSearchPresets } from '../../services/searchProfilePresets';
import { fetchMyDialogueCapacity } from '../../services/jobApplicationService';
import { isRemoteJob } from '../../services/commuteService';
import MobileSwipeJobBrowser from '../MobileSwipeJobBrowser';
import { SavedFiltersMenu } from '../SavedFiltersMenu';
import { EmptyState, FilterChip, MetricTile, PageHeader, SurfaceCard, Toolbar, cn } from '../ui/primitives';

interface ChallengeMarketplaceProps {
  hasNativeChallenges: boolean;
  jobs: Job[];
  selectedJobId: string | null;
  savedJobIds: string[];
  userProfile: UserProfile;
  lane: 'challenges' | 'imports';
  setLane: (lane: 'challenges' | 'imports') => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  loadMoreJobs: () => void;
  applyInteractionState: (jobId: string, eventType: 'swipe_left' | 'swipe_right' | 'save' | 'unsave') => void;
  theme: 'light' | 'dark';
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  performSearch: (term: string) => void;
  filterCity: string;
  setFilterCity: (city: string) => void;
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  filterBenefits: string[];
  setFilterBenefits: (benefits: string[]) => void;
  toggleBenefitFilter: (benefit: string) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  globalSearch: boolean;
  setGlobalSearch: (enabled: boolean) => void;
  abroadOnly: boolean;
  setAbroadOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  filterContractType: string[];
  setFilterContractType: (types: string[]) => void;
  toggleContractTypeFilter: (type: string) => void;
  filterDate: string;
  setFilterDate: (date: string) => void;
  filterExperience: string[];
  setFilterExperience: (levels: string[]) => void;
  filterLanguageCodes: SearchLanguageCode[];
  setFilterLanguageCodes: (codes: SearchLanguageCode[]) => void;
  handleJobSelect: (jobId: string | null) => void;
  handleToggleSave: (jobId: string) => void;
  onOpenPremium: (featureLabel: string) => void;
}

const ROLE_TYPES = [
  { key: 'hpp', labels: { cs: 'HPP', en: 'Full-time' } },
  { key: 'part-time', labels: { cs: 'Zkrácený úvazek', en: 'Part-time' } },
  { key: 'ico', labels: { cs: 'IČO', en: 'Contract' } }
];

const BENEFIT_FILTERS = [
  { key: 'home_office', labels: { cs: 'Home office', en: 'Home office' } },
  { key: 'dog_friendly', labels: { cs: 'Dog-friendly', en: 'Dog-friendly' } },
  { key: 'child_friendly', labels: { cs: 'Pro rodiče', en: 'Child-friendly' } },
  { key: 'flex_time', labels: { cs: 'Flexibilita', en: 'Flex time' } },
  { key: 'childcare_support', labels: { cs: 'Podpora péče o děti', en: 'Childcare support' } },
  { key: 'meal_allowance', labels: { cs: 'Stravování', en: 'Meals' } },
  { key: 'car_personal', labels: { cs: 'Služební auto', en: 'Company car' } },
  { key: 'transport_support', labels: { cs: 'Doprava / parkování', en: 'Transport / parking' } },
  { key: 'health_care', labels: { cs: 'Zdravotní péče', en: 'Healthcare' } },
  { key: 'pension', labels: { cs: 'Penzijko / spoření', en: 'Pension / retirement' } },
  { key: 'vacation_5w', labels: { cs: 'Extra dovolená', en: 'Extra vacation' } },
  { key: 'multisport', labels: { cs: 'Sport / wellness', en: 'Sport / wellness' } },
  { key: 'education', labels: { cs: 'Vzdělávání', en: 'Education' } },
  { key: 'relocation_support', labels: { cs: 'Relokace / bydlení', en: 'Relocation / housing' } },
  { key: 'employee_shares', labels: { cs: 'Akcie / ESOP', en: 'Equity / ESOP' } }
];

const EXPERIENCE_LEVELS = [
  { key: 'junior', labels: { cs: 'Junior', en: 'Junior' } },
  { key: 'medior', labels: { cs: 'Medior', en: 'Mid-level' } },
  { key: 'senior', labels: { cs: 'Senior', en: 'Senior' } }
];

const REMOTE_LANGUAGE_OPTIONS: Array<{ key: SearchLanguageCode; labels: { cs: string; en: string } }> = [
  { key: 'cs', labels: { cs: 'Čeština', en: 'Czech' } },
  { key: 'en', labels: { cs: 'Angličtina', en: 'English' } },
  { key: 'de', labels: { cs: 'Němčina', en: 'German' } },
  { key: 'sk', labels: { cs: 'Slovenština', en: 'Slovak' } },
  { key: 'pl', labels: { cs: 'Polština', en: 'Polish' } }
];

const simplifyDescription = (value: string | null | undefined): string => {
  const plain = String(value || '')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
  if (plain.length <= 180) return plain;
  return `${plain.slice(0, 177).trim()}...`;
};

const getChallengePreview = (job: Job): string => {
  const source = String(job.challenge || job.aiAnalysis?.summary || job.description || '').trim();
  const sentence = source.split(/(?<=[.!?])\s+/)[0] || source;
  return simplifyDescription(sentence || job.title);
};

const getRiskPreview = (job: Job): string => {
  const source =
    job.risk ||
    job.aiAnalysis?.culturalFit ||
    (Array.isArray(job.noiseMetrics?.keywords) ? job.noiseMetrics.keywords.join(', ') : '') ||
    job.description;
  return simplifyDescription(source);
};

const isRemoteListing = (job: Job): boolean => {
  return isRemoteJob(job);
};

const hasBenefit = (job: Job, benefitKey: string): boolean =>
  Array.isArray(job.benefits) && job.benefits.some((benefit) => String(benefit).toLowerCase() === benefitKey);

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) {
    return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  }
  if (from || to) {
    return `${(from || to).toLocaleString(locale)} ${currency}`;
  }
  return isCsLike ? 'Mzda neuvedena' : 'Salary not specified';
};

const getWorkModel = (job: Job, isCsLike: boolean): string => {
  const raw = String(job.work_model || job.type || '').trim();
  if (!raw) return isCsLike ? 'Model neuveden' : 'Work model TBD';
  return raw;
};

const getExperienceLabel = (job: Job, isCsLike: boolean): string | null => {
  const source = `${(job as any).seniority || ''} ${(job as any).experience_level || ''} ${job.title || ''}`.toLowerCase();
  if (!source) return null;
  if (/junior|entry/.test(source)) return isCsLike ? 'Junior' : 'Junior';
  if (/senior|lead|principal|staff/.test(source)) return isCsLike ? 'Senior+' : 'Senior+';
  if (/medior|mid/.test(source)) return isCsLike ? 'Medior' : 'Mid-level';
  return null;
};

const ChallengeMarketplace: React.FC<ChallengeMarketplaceProps> = ({
  hasNativeChallenges,
  jobs,
  selectedJobId,
  savedJobIds,
  userProfile,
  lane,
  setLane,
  loading,
  loadingMore,
  hasMore,
  loadMoreJobs,
  applyInteractionState,
  theme,
  searchTerm,
  setSearchTerm,
  performSearch,
  filterCity,
  setFilterCity,
  filterMinSalary,
  setFilterMinSalary,
  filterBenefits,
  setFilterBenefits,
  toggleBenefitFilter,
  remoteOnly,
  setRemoteOnly,
  globalSearch,
  setGlobalSearch,
  abroadOnly,
  setAbroadOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  filterContractType,
  setFilterContractType,
  toggleContractTypeFilter,
  filterDate,
  setFilterDate,
  filterExperience,
  setFilterExperience,
  filterLanguageCodes,
  setFilterLanguageCodes,
  handleJobSelect,
  handleToggleSave,
  onOpenPremium
}) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en';
  const isCsLike = language === 'cs' || language === 'sk';
  const [dialogueCapacity, setDialogueCapacity] = useState<CandidateDialogueCapacity | null>(null);
  const [mobileViewMode, setMobileViewMode] = useState<'swipe' | 'list'>('swipe');
  const hasPremiumAccess = ['premium', 'pro', 'business'].includes(String(userProfile.subscription?.tier || 'free').toLowerCase());

  const copy = ({
    cs: {
      eyebrow: 'Hledání',
      title: 'Přehled výzev podle vaší situace',
      body: 'Nabídky, filtry podle reality a chytrý předvýběr na jednom místě.',
      toolbarSearch: 'Hledat nabídky, firmy, typy rolí nebo důležité signály',
      toolbarLocation: 'Město, region, práce na dálku',
      search: 'Hledat',
      location: 'Místo',
      laneChallenges: 'Výzvy',
      laneImports: 'Importované nabídky',
      results: 'výsledků',
      filters: 'Filtry podle reality',
      cockpitTitle: 'Chytrý předvýběr',
      cockpitBody: 'Přednastavení převádí životní situaci do praktického hledání. Výsledkem není nekonečný seznam, ale použitelný výběr.',
      laneBadge: lane === 'imports' ? 'Importovaný přehled' : 'Hlavní přehled',
      laneBody:
          lane === 'imports'
            ? 'Širší importovaný přehled, stále čtený přes to, co bude potřeba zvládnout.'
            : 'Vlastní role s doplněnými importy tam, kde trhu chybí podrobnější zadání.',
      personalPresets: 'Nastavení pro moji situaci',
      mySetup: 'Moje nastavení',
      mySetupBody: 'Přehled začíná rolemi, které odpovídají vašemu nastavení a aktuálním filtrům.',
      matchesNow: 'Sedí právě teď',
      setupEmpty: 'Přidejte filtry nebo preference a přehled se začne skládat podle vaší reality.',
      setupSection: 'Podle mého nastavení',
      setupSectionBody: 'Nejrelevantnější role podle aktivních filtrů a uložených preferencí.',
      remoteSection: 'Práce na dálku',
      remoteSectionBody: 'Role, kde je práce na dálku součástí samotného způsobu práce.',
      dogSection: 'Kanceláře vstřícné ke psům',
      dogSectionBody: 'Týmy, kde kancelářský režim není v konfliktu s péčí o psa.',
      moreSection: 'Další zajímavé nabídky',
      moreSectionBody: 'Další výběr, když chceš rozšířit záběr bez návratu do nekonečného seznamu.',
      remote: 'Práce na dálku',
      commute: 'Dojíždění',
      commuteHint: 'Bez adresy zůstává výpočet dojezdu vypnutý, ale práce na dálku se pořád zobrazí správně.',
      scope: 'Záběr',
      roleType: 'Typ spolupráce',
      experience: 'Zkušenost',
      remoteLanguages: 'Jazyky pro práci na dálku',
      benefits: 'Benefity',
      minSalary: 'Minimální mzda',
      date: 'Jak je nabídka čerstvá',
      saveSearches: 'Uložená hledání',
      allMarkets: 'Široký záběr',
      border: 'Příhraničí / zahraničí',
      domestic: 'Jen tuzemsko',
      remoteOnly: 'Jen práce na dálku',
      allWorkModels: 'Všechny modely',
      anySalary: 'Bez minima',
      allDates: 'Kdykoliv',
      last3Days: 'Poslední 3 dny',
      last7Days: 'Poslední týden',
      last30Days: 'Poslední měsíc',
      detail: 'Otevřít detail',
      shortlist: 'Uložit si',
      shortlisted: 'Uloženo',
      sourceImported: 'Import',
      sourceNative: 'Vlastní výzva',
      fit: 'Shoda podle JHI',
      workModel: 'Způsob práce',
      emptyTitle: 'Teď nic dobře nesedí',
      emptyBody: 'Rozšiř záběr, vypni část filtrů nebo zkus jiné nastavení. Přehled má vracet použitelný výběr, ne prázdno.',
      noNative: 'Vlastních výzev je zatím málo, proto se doplňují importovanými nabídkami.',
      openPreview: 'Zobrazit ukázku',
      selected: 'Vybráno',
      scoreLabel: 'Skóre shody',
      fitNote: 'Systém zvýrazní role s největší šancí, že budou opravdu dávat smysl pro vaši situaci.',
      challengeLabel: 'Co bude potřeba zvládnout',
      riskLabel: 'Na co si dát pozor',
      openCard: 'Otevřít nabídku',
      slotsTitle: 'Dialogové sloty',
      slotsBody: 'Každá odpověď otevírá omezený počet aktivních dialogů. Díky tomu se z výběru nestane nekonečný funnel bez reakce.',
      slotsEmpty: 'Po přihlášení uvidíš, kolik aktivních dialogů ti ještě zbývá.',
      slotsValue: '{{active}} / {{limit}} obsazeno',
      slotsRemaining: '{{remaining}} volných',
      slotsRemainingLabel: 'Volná kapacita',
      premiumTitle: hasPremiumAccess ? 'Premium je aktivní' : 'Co odemyká premium',
      premiumBody: hasPremiumAccess
        ? 'Máte odemčené širší rozhodovací vrstvu včetně detailnější podpory a větší kapacity pro odpovědi.'
        : 'Premium dává víc prostoru pro odpovědi, chytřejší vedení profilem a přesnější doporučení podle vaší reality.',
      premiumCta: hasPremiumAccess ? 'Spravovat premium' : 'Zobrazit premium',
      premiumBullets: [
        'Více dialogových slotů pro aktivní odpovědi',
        'AI průvodce profilem a životní situací',
        'Personalizovaný JHI index',
        'Detailní report JCFPM testu'
      ],
      mobileSwipe: 'Karty',
      mobileList: 'Seznam',
      mobileSwipeBody: 'Na mobilu můžeš procházet nabídky tahem doleva nebo doprava.'
    },
    sk: {
      eyebrow: 'Hľadanie',
      title: 'Prehľad výziev podľa vašej situácie',
      body: 'Ponuky, filtre podľa reality a múdry predvýber na jednom mieste.',
      toolbarSearch: 'Hľadať ponuky, firmy, typy rolí alebo dôležité signály',
      toolbarLocation: 'Mesto, región, práca na diaľku',
      search: 'Hľadať',
      location: 'Miesto',
      laneChallenges: 'Výzvy',
      laneImports: 'Importované ponuky',
      results: 'výsledkov',
      filters: 'Filtre podľa reality',
      cockpitTitle: 'Múdry predvýber',
      cockpitBody: 'Prednastavenia prevádzajú životnú situáciu do praktického hľadania. Výsledkom nie je nekonečný zoznam, ale použiteľný výber.',
      laneBadge: lane === 'imports' ? 'Importovaný prehľad' : 'Hlavný prehľad',
      laneBody: lane === 'imports' ? 'Širší importovaný prehľad, stále čítaný cez to, čo bude treba zvládnuť.' : 'Vlastné výzvy doplnené importmi tam, kde trhu chýba podrobnejšie zadanie.',
      personalPresets: 'Nastavenie pre moju situáciu',
      mySetup: 'Moje nastavenie',
      mySetupBody: 'Prehľad začína rolami, ktoré zodpovedajú vášmu nastaveniu a aktuálnym filtrom.',
      matchesNow: 'Sedí práve teraz',
      setupEmpty: 'Pridajte filtre alebo preferencie a prehľad sa začne skladať podľa vašej reality.',
      setupSection: 'Podľa môjho nastavenia',
      setupSectionBody: 'Najrelevantnejšie roly podľa aktívnych filtrov a uložených preferencií.',
      remoteSection: 'Práca na diaľku',
      remoteSectionBody: 'Roly, kde je práca na diaľku súčasťou samotného spôsobu práce.',
      dogSection: 'Kancelárie priateľské ku psom',
      dogSectionBody: 'Tímy, kde kancelársky režim nie je v konflikte so starostlivosťou o psa.',
      moreSection: 'Ďalšie zaujímavé ponuky',
      moreSectionBody: 'Ďalší výber, keď chceš rozšíriť záber bez návratu do nekonečného zoznamu.',
      remote: 'Práca na diaľku',
      commute: 'Dochádzanie',
      commuteHint: 'Bez adresy zostáva výpočet dochádzania vypnutý, ale práca na diaľku sa stále zobrazí správne.',
      scope: 'Záber',
      roleType: 'Typ spolupráce',
      experience: 'Skúsenosť',
      remoteLanguages: 'Jazyky pre prácu na diaľku',
      benefits: 'Benefity',
      minSalary: 'Minimálna mzda',
      date: 'Ako je ponuka čerstvá',
      saveSearches: 'Uložené hľadania',
      allMarkets: 'Široký záber',
      border: 'Pohraničie / zahraničie',
      domestic: 'Len domáci trh',
      remoteOnly: 'Len práca na diaľku',
      allWorkModels: 'Všetky modely',
      anySalary: 'Bez minima',
      allDates: 'Kedykoľvek',
      last3Days: 'Posledné 3 dni',
      last7Days: 'Posledný týždeň',
      last30Days: 'Posledný mesiac',
      detail: 'Otvoriť detail',
      shortlist: 'Uložiť si',
      shortlisted: 'Uložené',
      sourceImported: 'Import',
      sourceNative: 'Vlastná výzva',
      fit: 'Zhoda podľa JHI',
      workModel: 'Spôsob práce',
      emptyTitle: 'Teraz nič dobre nesedí',
      emptyBody: 'Rozšír záber, vypni časť filtrov alebo skús iné nastavenie. Prehľad má vracať použiteľný výber, nie prázdno.',
      noNative: 'Vlastných výziev je zatiaľ málo, preto sa dopĺňajú importovanými ponukami.',
      openPreview: 'Zobraziť ukážku',
      selected: 'Vybrané',
      scoreLabel: 'Skóre zhody',
      fitNote: 'Systém zvýrazní roly s najväčšou šancou, že budú naozaj dávať zmysel.',
      challengeLabel: 'Čo bude treba zvládnuť',
      riskLabel: 'Na čo si dať pozor',
      openCard: 'Otvoriť ponuku',
      slotsTitle: 'Dialógové sloty',
      slotsBody: 'Každá odpoveď otvára obmedzený počet aktívnych dialógov. Vďaka tomu sa z výberu nestane nekonečný funnel bez reakcie.',
      slotsEmpty: 'Po prihlásení uvidíš, koľko aktívnych dialógov ti ešte zostáva.',
      slotsValue: '{{active}} / {{limit}} obsadené',
      slotsRemaining: '{{remaining}} voľných',
      slotsRemainingLabel: 'Voľná kapacita',
      premiumTitle: hasPremiumAccess ? 'Premium je aktívne' : 'Čo odomyká premium',
      premiumBody: hasPremiumAccess
        ? 'Máte odomknutú silnejšiu rozhodovaciu vrstvu vrátane detailnejšej podpory a väčšej kapacity pre odpovede.'
        : 'Premium dáva viac priestoru na odpovede, múdrejšie vedenie profilom a presnejšie odporúčania podľa vašej reality.',
      premiumCta: hasPremiumAccess ? 'Spravovať premium' : 'Zobraziť premium',
      premiumBullets: [
        'Viac dialógových slotov pre aktívne odpovede',
        'AI sprievodca profilom a životnou situáciou',
        'Personalizovaný JHI index',
        'Detailný report JCFPM testu'
      ],
      mobileSwipe: 'Karty',
      mobileList: 'Zoznam',
      mobileSwipeBody: 'Na mobile môžeš ponuky prechádzať ťahom doľava alebo doprava.'
    },
    de: {
      eyebrow: 'Suche',
      title: 'Aufgaben passend zu deiner Situation',
      body: 'Rollen, alltagsnahe Filter und eine klügere Vorauswahl an einem Ort.',
      toolbarSearch: 'Rollen, Firmen, Arbeitsmodelle oder wichtige Signale suchen',
      toolbarLocation: 'Stadt, Region, Remote',
      search: 'Suchen',
      location: 'Ort',
      laneChallenges: 'Aufgaben',
      laneImports: 'Importierte Rollen',
      results: 'Ergebnisse',
      filters: 'Filter für den Alltag',
      cockpitTitle: 'Kluge Vorauswahl',
      cockpitBody: 'Voreinstellungen übersetzen deine Lebenssituation in eine praktische Suche. Das Ergebnis ist kein endloser Feed, sondern eine brauchbare Auswahl.',
      laneBadge: lane === 'imports' ? 'Importierte Rollen' : 'Eigene Aufgaben',
      laneBody: lane === 'imports' ? 'Breiter importierter Überblick, weiterhin gelesen über die eigentliche Aufgabe.' : 'Eigene Aufgaben mit importierten Ergänzungen dort, wo dem Markt klare Aufgabenbeschreibungen fehlen.',
      personalPresets: 'Einstellungen für meine Situation',
      mySetup: 'Meine Einstellungen',
      mySetupBody: 'Die Übersicht beginnt mit Rollen, die zu deinen Einstellungen und aktuellen Filtern passen.',
      matchesNow: 'Passt gerade',
      setupEmpty: 'Füge Filter oder Präferenzen hinzu, dann richtet sich die Übersicht nach deiner Realität aus.',
      setupSection: 'Passende Aufgaben für mich',
      setupSectionBody: 'Die relevantesten Rollen auf Basis aktiver Filter und gespeicherter Präferenzen.',
      remoteSection: 'Remote-Möglichkeiten',
      remoteSectionBody: 'Rollen, bei denen Remote-Arbeit Teil des tatsächlichen Arbeitsmodells ist.',
      dogSection: 'Hundefreundliche Büros',
      dogSectionBody: 'Teams, bei denen Büroarbeit nicht im Konflikt mit Hundebetreuung steht.',
      moreSection: 'Weitere interessante Rollen',
      moreSectionBody: 'Mehr Auswahl, wenn du den Blick erweitern willst, ohne in einen endlosen Feed zurückzugehen.',
      remote: 'Remote',
      commute: 'Pendeln',
      commuteHint: 'Ohne Adresse bleibt die Pendelberechnung aus, Remote-Rollen werden aber weiterhin korrekt angezeigt.',
      scope: 'Umfang',
      roleType: 'Arbeitsform',
      experience: 'Erfahrung',
      remoteLanguages: 'Sprachen für Remote-Arbeit',
      benefits: 'Benefits',
      minSalary: 'Mindestgehalt',
      date: 'Aktualität',
      saveSearches: 'Gespeicherte Suchen',
      allMarkets: 'Breiter Fokus',
      border: 'Grenzregion / Ausland',
      domestic: 'Nur Inland',
      remoteOnly: 'Nur Remote',
      allWorkModels: 'Alle Modelle',
      anySalary: 'Kein Minimum',
      allDates: 'Jederzeit',
      last3Days: 'Letzte 3 Tage',
      last7Days: 'Letzte Woche',
      last30Days: 'Letzter Monat',
      detail: 'Detail öffnen',
      shortlist: 'Merken',
      shortlisted: 'Gemerkt',
      sourceImported: 'Importiert',
      sourceNative: 'Eigene Aufgabe',
      fit: 'JHI-Passung',
      workModel: 'Arbeitsweise',
      emptyTitle: 'Im Moment passt nichts richtig',
      emptyBody: 'Erweitere den Fokus, schalte Filter ab oder probiere andere Einstellungen. Die Übersicht soll brauchbare Auswahl liefern, nicht Leere.',
      noNative: 'Es gibt noch wenige eigene Aufgaben, deshalb wird mit importierten Rollen ergänzt.',
      openPreview: 'Vorschau öffnen',
      selected: 'Ausgewählt',
      scoreLabel: 'Passungswert',
      fitNote: 'Das System hebt die Rollen hervor, die am wahrscheinlichsten wirklich passen.',
      challengeLabel: 'Was gelöst werden soll',
      riskLabel: 'Worauf man achten sollte',
      openCard: 'Rolle öffnen',
      slotsTitle: 'Dialog-Slots',
      slotsBody: 'Jede Antwort öffnet nur eine begrenzte Zahl aktiver Dialoge. So wird die Auswahl nicht zu einem endlosen Funnel ohne Rückmeldung.',
      slotsEmpty: 'Nach dem Anmelden siehst du, wie viele aktive Dialoge dir noch bleiben.',
      slotsValue: '{{active}} / {{limit}} belegt',
      slotsRemaining: '{{remaining}} frei',
      slotsRemainingLabel: 'Freie Kapazität',
      premiumTitle: hasPremiumAccess ? 'Premium ist aktiv' : 'Was Premium freischaltet',
      premiumBody: hasPremiumAccess
        ? 'Die erweiterte Entscheidungsebene ist aktiv, mit mehr Unterstützung und mehr Raum für laufende Antworten.'
        : 'Premium gibt mehr Raum für Antworten, bessere Profilführung und präzisere Empfehlungen passend zu deiner Realität.',
      premiumCta: hasPremiumAccess ? 'Premium verwalten' : 'Premium ansehen',
      premiumBullets: [
        'Mehr Dialog-Slots für aktive Antworten',
        'KI-Begleitung für Profil und Lebenssituation',
        'Personalisierter JHI-Index',
        'Detaillierter JCFPM-Bericht'
      ],
      mobileSwipe: 'Karten',
      mobileList: 'Liste',
      mobileSwipeBody: 'Auf dem Handy kannst du Rollen per Wischen nach links oder rechts durchgehen.'
    },
    at: {} as any,
    pl: {
      eyebrow: 'Wyszukiwanie',
      title: 'Oferty dopasowane do twojej sytuacji',
      body: 'Role, filtry oparte na realnym życiu i mądrzejszy wstępny wybór w jednym miejscu.',
      toolbarSearch: 'Szukaj ofert, firm, typów pracy lub ważnych sygnałów',
      toolbarLocation: 'Miasto, region, zdalnie',
      search: 'Szukaj',
      location: 'Miejsce',
      laneChallenges: 'Wyzwania',
      laneImports: 'Importowane oferty',
      results: 'wyników',
      filters: 'Filtry dopasowane do życia',
      cockpitTitle: 'Mądry wstępny wybór',
      cockpitBody: 'Ustawienia zamieniają twoją sytuację życiową w praktyczne wyszukiwanie. Efektem nie jest nieskończona lista, ale użyteczny wybór.',
      laneBadge: lane === 'imports' ? 'Importowane oferty' : 'Własne wyzwania',
      laneBody: lane === 'imports' ? 'Szerszy importowany przegląd, nadal czytany przez pryzmat tego, co naprawdę trzeba ogarnąć.' : 'Własne wyzwania uzupełnione importami tam, gdzie brakuje dokładniejszego opisu pracy.',
      personalPresets: 'Ustawienia dla mojej sytuacji',
      mySetup: 'Moje ustawienia',
      mySetupBody: 'Przegląd zaczyna się od ról, które pasują do twoich ustawień i bieżących filtrów.',
      matchesNow: 'Pasuje teraz',
      setupEmpty: 'Dodaj filtry lub preferencje, a przegląd zacznie układać się pod twoją rzeczywistość.',
      setupSection: 'Oferty dla mojej sytuacji',
      setupSectionBody: 'Najbardziej trafne role według aktywnych filtrów i zapisanych preferencji.',
      remoteSection: 'Praca zdalna',
      remoteSectionBody: 'Role, w których praca zdalna jest częścią realnego modelu pracy.',
      dogSection: 'Biura przyjazne psom',
      dogSectionBody: 'Zespoły, w których tryb biurowy nie koliduje z opieką nad psem.',
      moreSection: 'Więcej ciekawych ofert',
      moreSectionBody: 'Dalszy wybór, gdy chcesz poszerzyć zakres bez wracania do nieskończonej listy.',
      remote: 'Zdalnie',
      commute: 'Dojazd',
      commuteHint: 'Bez adresu wyliczenie dojazdu pozostaje wyłączone, ale role zdalne nadal pokazują się poprawnie.',
      scope: 'Zakres',
      roleType: 'Forma współpracy',
      experience: 'Doświadczenie',
      remoteLanguages: 'Języki do pracy zdalnej',
      benefits: 'Benefity',
      minSalary: 'Minimalne wynagrodzenie',
      date: 'Aktualność',
      saveSearches: 'Zapisane wyszukiwania',
      allMarkets: 'Szeroki zakres',
      border: 'Pogranicze / zagranica',
      domestic: 'Tylko kraj',
      remoteOnly: 'Tylko zdalnie',
      allWorkModels: 'Wszystkie modele',
      anySalary: 'Bez minimum',
      allDates: 'Dowolnie',
      last3Days: 'Ostatnie 3 dni',
      last7Days: 'Ostatni tydzień',
      last30Days: 'Ostatni miesiąc',
      detail: 'Otwórz szczegóły',
      shortlist: 'Zapisz',
      shortlisted: 'Zapisane',
      sourceImported: 'Import',
      sourceNative: 'Własne wyzwanie',
      fit: 'Dopasowanie JHI',
      workModel: 'Sposób pracy',
      emptyTitle: 'Na razie nic dobrze nie pasuje',
      emptyBody: 'Poszerz zakres, wyłącz część filtrów albo spróbuj innych ustawień. Ta lista ma dawać użyteczny wybór, nie pustkę.',
      noNative: 'Własnych wyzwań jest jeszcze mało, dlatego lista uzupełnia się importowanymi ofertami.',
      openPreview: 'Pokaż podgląd',
      selected: 'Wybrane',
      scoreLabel: 'Wynik dopasowania',
      fitNote: 'System podświetla role z największą szansą, że naprawdę będą miały sens.',
      challengeLabel: 'Co trzeba ogarnąć',
      riskLabel: 'Na co uważać',
      openCard: 'Otwórz ofertę',
      slotsTitle: 'Sloty rozmów',
      slotsBody: 'Każda odpowiedź otwiera ograniczoną liczbę aktywnych rozmów. Dzięki temu proces nie zamienia się w nieskończony lejek bez reakcji.',
      slotsEmpty: 'Po zalogowaniu zobaczysz, ile aktywnych rozmów jeszcze ci zostało.',
      slotsValue: '{{active}} / {{limit}} zajęte',
      slotsRemaining: '{{remaining}} wolnych',
      slotsRemainingLabel: 'Wolna pojemność',
      premiumTitle: hasPremiumAccess ? 'Premium jest aktywne' : 'Co odblokowuje premium',
      premiumBody: hasPremiumAccess
        ? 'Masz aktywną rozszerzoną warstwę decyzji z większym wsparciem i większą pojemnością na odpowiedzi.'
        : 'Premium daje więcej miejsca na odpowiedzi, mądrzejsze prowadzenie profilu i trafniejsze rekomendacje względem twojej sytuacji.',
      premiumCta: hasPremiumAccess ? 'Zarządzaj premium' : 'Pokaż premium',
      premiumBullets: [
        'Więcej slotów rozmów dla aktywnych odpowiedzi',
        'Przewodnik AI dla profilu i sytuacji życiowej',
        'Spersonalizowany indeks JHI',
        'Szczegółowy raport JCFPM'
      ],
      mobileSwipe: 'Karty',
      mobileList: 'Lista',
      mobileSwipeBody: 'Na telefonie możesz przeglądać oferty przesunięciem w lewo albo w prawo.'
    },
    en: {
        eyebrow: 'Discovery cockpit',
        title: 'Challenge marketplace built around your life reality',
        body: 'Challenges, reality filters, and a decision engine in one clean workspace.',
        toolbarSearch: 'Search challenges, teams, role types, or signal words',
        toolbarLocation: 'City, region, remote',
        search: 'Search',
        location: 'Location',
        laneChallenges: 'Challenge marketplace',
        laneImports: 'Imported listings',
        results: 'results',
        filters: 'Reality filters',
        cockpitTitle: 'Decision engine',
        cockpitBody: 'Presets translate real life into filterable scenarios. The output is not just a feed, but a shortlist with the highest chance of actual fit.',
        laneBadge: lane === 'imports' ? 'Imported view' : 'Main view',
        laneBody:
          lane === 'imports'
            ? 'A broader imported feed, still rendered challenge-first.'
            : 'The native challenge lane with imported fallback whenever the market lacks native challenges.',
        personalPresets: 'Presets for my situation',
        mySetup: 'My setup',
        mySetupBody: 'The feed starts with roles that match your setup and current filters.',
        matchesNow: 'Matching now',
        setupEmpty: 'Add filters or preferences and the feed will start shaping around your reality.',
        setupSection: 'Matching your setup',
        setupSectionBody: 'The strongest roles based on active filters and saved preferences.',
        remoteSection: 'Remote opportunities',
        remoteSectionBody: 'Roles where remote reality is part of the actual work model.',
        dogSection: 'Dog-friendly offices',
        dogSectionBody: 'Office-based roles that still work with dog care in real life.',
        moreSection: 'More high-signal challenges',
        moreSectionBody: 'A broader shortlist when you want more options without going back to one long feed.',
        remote: 'Remote',
        commute: 'Commute',
        commuteHint: 'Without an address commute heuristics stay off, but remote roles still render correctly.',
        scope: 'Market scope',
        roleType: 'Role type',
        experience: 'Experience',
        remoteLanguages: 'Remote languages',
        benefits: 'Benefits',
        minSalary: 'Minimum salary',
        date: 'Freshness',
        saveSearches: 'Saved searches',
        allMarkets: 'Global scope',
        border: 'Cross-border',
        domestic: 'Domestic',
        remoteOnly: 'Remote only',
        allWorkModels: 'All work models',
        anySalary: 'No minimum',
        allDates: 'Any time',
        last3Days: 'Last 3 days',
        last7Days: 'Last week',
        last30Days: 'Last month',
        detail: 'Open detail',
        shortlist: 'Save to shortlist',
        shortlisted: 'Shortlisted',
        sourceImported: 'Imported',
        sourceNative: 'Challenge',
        fit: 'JHI fit',
        workModel: 'Work model',
        emptyTitle: 'Nothing matches the current reality yet',
        emptyBody: 'Broaden the scope, disable some filters, or switch presets. The marketplace should return a realistic shortlist, not noise.',
        noNative: 'There are no native challenges yet, so the marketplace currently uses imported fallback roles.',
        openPreview: 'Open challenge preview',
        selected: 'Selected',
        scoreLabel: 'Decision score',
        fitNote: 'The decision engine preselects roles with the strongest fit signal.',
        challengeLabel: 'Challenge',
        riskLabel: 'Risk',
        openCard: 'Open challenge',
        slotsTitle: 'Dialogue slots',
        slotsBody: 'Each reply opens a limited number of active dialogues, so the process does not turn into an endless funnel with no response.',
        slotsEmpty: 'After signing in, you will see how many active dialogues you still have left.',
        slotsValue: '{{active}} / {{limit}} in use',
        slotsRemaining: '{{remaining}} left',
        slotsRemainingLabel: 'Open capacity',
        premiumTitle: hasPremiumAccess ? 'Premium is active' : 'What premium unlocks',
        premiumBody: hasPremiumAccess
          ? 'Your stronger decision layer is active, including deeper support and more room for active replies.'
          : 'Premium adds more room for replies, a smarter life-context guide, and sharper prioritization around your own reality.',
        premiumCta: hasPremiumAccess ? 'Manage premium' : 'See premium',
        premiumBullets: [
          'More dialogue slots for active replies',
          'AI guide for profile and life context',
          'Personalized JHI score',
          'Detailed JCFPM report'
        ],
        mobileSwipe: 'Cards',
        mobileList: 'List',
        mobileSwipeBody: 'On mobile you can browse roles by swiping left or right.'
      }
  } as const)[language === 'at' ? 'de' : language];

  useEffect(() => {
    let cancelled = false;

    const loadDialogueCapacity = async () => {
      if (!userProfile.isLoggedIn || !userProfile.id) {
        setDialogueCapacity(null);
        return;
      }
      const capacity = await fetchMyDialogueCapacity();
      if (!cancelled) {
        setDialogueCapacity(capacity);
      }
    };

    void loadDialogueCapacity();
    return () => {
      cancelled = true;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

  const personalPresets = useMemo(
    () => buildCandidateSearchPresets(userProfile, locale),
    [locale, userProfile]
  );

  const hasActiveFilters = Boolean(
    searchTerm ||
      filterCity ||
      filterMinSalary > 0 ||
      filterBenefits.length > 0 ||
      filterContractType.length > 0 ||
      filterLanguageCodes.length > 0 ||
      enableCommuteFilter ||
      globalSearch ||
      abroadOnly ||
      remoteOnly ||
      filterDate !== 'all' ||
      filterExperience.length > 0
  );

  const applyFilterSnapshot = (filters: JobSearchFilters) => {
    const nextRemoteOnly = Boolean(filters.remoteOnly);
    const nextCommuteEnabled = nextRemoteOnly ? false : Boolean(filters.enableCommuteFilter);
    setSearchTerm(filters.searchTerm || '');
    setFilterCity(filters.filterCity || '');
    setFilterMinSalary(filters.filterMinSalary || 0);
    setFilterBenefits(filters.filterBenefits || []);
    setFilterContractType(filters.filterContractTypes || []);
    setFilterDate(filters.filterDatePosted || 'all');
    setFilterExperience(filters.filterExperienceLevels || []);
    setFilterLanguageCodes((filters.filterLanguageCodes || []) as SearchLanguageCode[]);
    setEnableCommuteFilter(nextCommuteEnabled);
    setFilterMaxDistance(filters.filterMaxDistance || 50);
    setGlobalSearch(Boolean(filters.globalSearch));
    setAbroadOnly(Boolean(filters.abroadOnly));
    setRemoteOnly(nextRemoteOnly);
  };

  const jobsInLane = useMemo(() => {
    const nativeJobs = jobs.filter((job) => job.listingKind !== 'imported');
    const importedJobs = jobs.filter((job) => job.listingKind === 'imported');
    const byWorkMode = (items: Job[]) => items.filter((job) => (!remoteOnly ? true : isRemoteListing(job)));
    const nativeMatches = byWorkMode(nativeJobs);
    const importedMatches = byWorkMode(importedJobs);
    const useImportedFallback = lane === 'challenges' && (nativeMatches.length === 0 || !hasNativeChallenges);
    if (lane === 'imports') return importedMatches;
    return useImportedFallback ? importedMatches : nativeMatches;
  }, [jobs, lane, remoteOnly, hasNativeChallenges]);

  const hasCommuteProfile = Boolean(userProfile.address || userProfile.coordinates?.lat);

  const currentFilters: JobSearchFilters = {
    searchTerm,
    filterCity,
    filterMinSalary,
    filterBenefits,
    filterContractTypes: filterContractType,
    filterDatePosted: filterDate,
    filterExperienceLevels: filterExperience,
    filterLanguageCodes,
    filterMaxDistance,
    enableCommuteFilter,
    globalSearch,
    abroadOnly,
    remoteOnly
  };

  const setupSignals = useMemo(() => {
    const signals: string[] = [];
    const searchProfile = userProfile.preferences.searchProfile;
    const activeLanguageCodes = filterLanguageCodes.length > 0 ? filterLanguageCodes : searchProfile?.remoteLanguageCodes || [];
    const preferredBenefits = Array.from(new Set(searchProfile?.preferredBenefitKeys || []));

    if (filterContractType.includes('ico') || searchProfile?.wantsContractorRoles) {
      signals.push(isCsLike ? 'IČO / kontrakt' : 'Contract / freelance');
    }
    if (remoteOnly || searchProfile?.wantsRemoteRoles) {
      signals.push(copy.remoteOnly);
    }
    if (filterBenefits.includes('dog_friendly') || searchProfile?.wantsDogFriendlyOffice) {
      signals.push(isCsLike ? 'Dog-friendly office' : 'Dog-friendly office');
    }
    if (
      filterBenefits.includes('child_friendly') ||
      filterBenefits.includes('childcare_support') ||
      preferredBenefits.includes('child_friendly') ||
      preferredBenefits.includes('childcare_support')
    ) {
      signals.push(isCsLike ? 'Pro rodiče' : 'Child-friendly');
    }
    preferredBenefits
      .filter((benefit) => !['dog_friendly', 'child_friendly', 'childcare_support'].includes(benefit))
      .slice(0, 3)
      .forEach((benefitKey) => {
        const label = BENEFIT_FILTERS.find((benefit) => benefit.key === benefitKey)?.labels[isCsLike ? 'cs' : 'en'];
        if (label) signals.push(label);
      });
    if (activeLanguageCodes.length > 0) {
      const formattedLanguages = activeLanguageCodes
        .map((code) => REMOTE_LANGUAGE_OPTIONS.find((option) => option.key === code)?.labels[isCsLike ? 'cs' : 'en'] || code.toUpperCase())
        .join(' / ');
      signals.push(formattedLanguages);
    }
    if (remoteOnly) {
      // Remote-first mode should not surface commute as an active reality signal.
    } else if (enableCommuteFilter) {
      signals.push(`≤ ${filterMaxDistance} km`);
    } else if (searchProfile?.defaultEnableCommuteFilter && searchProfile?.defaultMaxDistanceKm) {
      signals.push(`≤ ${searchProfile.defaultMaxDistanceKm} km`);
    } else if (userProfile.preferences.commuteTolerance) {
      signals.push(`≤ ${userProfile.preferences.commuteTolerance} min`);
    }
    if (userProfile.jhiPreferences?.hardConstraints.excludeShift) {
      signals.push(isCsLike ? 'Bez směn' : 'No shifts');
    }
    if (filterMinSalary > 0 || userProfile.preferences.desired_salary_min) {
      const salaryFloor = filterMinSalary || userProfile.preferences.desired_salary_min || 0;
      signals.push(`≥ ${Number(salaryFloor).toLocaleString(i18n.language)} ${(isCsLike ? 'CZK' : 'EUR')}`);
    }
    if (globalSearch) {
      signals.push(copy.allMarkets);
    } else if (abroadOnly || searchProfile?.nearBorder) {
      signals.push(copy.border);
    }
    if (searchTerm) {
      signals.push(`"${searchTerm}"`);
    }

    return signals.slice(0, 8);
  }, [
    abroadOnly,
    copy.allMarkets,
    copy.border,
    copy.remoteOnly,
    enableCommuteFilter,
    filterBenefits,
    filterContractType,
    filterLanguageCodes,
    filterMaxDistance,
    filterMinSalary,
    globalSearch,
    i18n.language,
    isCsLike,
    remoteOnly,
    searchTerm,
    userProfile.jhiPreferences?.hardConstraints.excludeShift,
    userProfile.preferences.commuteTolerance,
    userProfile.preferences.desired_salary_min,
    userProfile.preferences.searchProfile
  ]);

  const feedSections = useMemo(() => {
    const used = new Set<string>();
    const sections: Array<{ key: string; title: string; body: string; jobs: Job[] }> = [];

    const takeSection = (key: string, title: string, body: string, predicate: (job: Job) => boolean, count: number) => {
      const sectionJobs = jobsInLane.filter((job) => !used.has(job.id) && predicate(job)).slice(0, count);
      if (sectionJobs.length === 0) return;
      sectionJobs.forEach((job) => used.add(job.id));
      sections.push({ key, title, body, jobs: sectionJobs });
    };

    takeSection('setup', copy.setupSection, copy.setupSectionBody, () => true, 3);
    takeSection('remote', copy.remoteSection, copy.remoteSectionBody, (job) => isRemoteListing(job), 3);
    takeSection('dog', copy.dogSection, copy.dogSectionBody, (job) => hasBenefit(job, 'dog_friendly'), 2);
    takeSection('more', copy.moreSection, copy.moreSectionBody, () => true, jobsInLane.length);

    return sections;
  }, [
    copy.dogSection,
    copy.dogSectionBody,
    copy.moreSection,
    copy.moreSectionBody,
    copy.remoteSection,
    copy.remoteSectionBody,
    copy.setupSection,
    copy.setupSectionBody,
    jobsInLane
  ]);

  const toggleRemoteOnly = (enabled: boolean) => {
    setRemoteOnly(enabled);
    if (enabled) {
      setEnableCommuteFilter(false);
    }
  };

  return (
    <section className="space-y-5">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        body={copy.body}
        actions={
          <>
            <div className="app-eyebrow !bg-white/72 !text-[var(--text-muted)] dark:!bg-white/5">
              <Sparkles size={12} />
              {jobsInLane.length} {copy.results}
            </div>
            <div className="app-eyebrow !bg-white/72 !text-[var(--text-muted)] dark:!bg-white/5">
              <ShieldCheck size={12} />
              {copy.fitNote}
            </div>
          </>
        }
      />

      <Toolbar sticky className="space-y-4">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_auto]">
          <div className="app-command-field">
            <Search size={16} className="text-[var(--text-faint)]" />
            <input
              id="challenge-discovery-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') performSearch(searchTerm);
              }}
              placeholder={copy.toolbarSearch}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>
          <div className="app-command-field">
            <MapPin size={16} className="text-[var(--text-faint)]" />
            <input
              value={filterCity}
              onChange={(event) => setFilterCity(event.target.value)}
              placeholder={copy.toolbarLocation}
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
            />
          </div>
          <button type="button" onClick={() => performSearch(searchTerm)} className="app-button-primary min-w-[130px]">
            <Search size={16} />
            {copy.search}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterChip active={lane === 'challenges'} onClick={() => setLane('challenges')}>
            {copy.laneChallenges}
          </FilterChip>
          <FilterChip active={lane === 'imports'} onClick={() => setLane('imports')}>
            {copy.laneImports}
          </FilterChip>
          <FilterChip active={remoteOnly} onClick={() => toggleRemoteOnly(!remoteOnly)}>
            {copy.remoteOnly}
          </FilterChip>
          <FilterChip active={enableCommuteFilter} onClick={() => setEnableCommuteFilter(!enableCommuteFilter)}>
            <TrainFront size={14} />
            {copy.commute}
          </FilterChip>
          <FilterChip active={globalSearch} onClick={() => { setGlobalSearch(true); setAbroadOnly(false); }}>
            <Globe size={14} />
            {copy.allMarkets}
          </FilterChip>
          <FilterChip active={abroadOnly} onClick={() => { setAbroadOnly(true); setGlobalSearch(false); }}>
            {copy.border}
          </FilterChip>
        </div>
      </Toolbar>

      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-[var(--app-sticky-stack-offset)] xl:self-start">
          <div className="space-y-5 xl:max-h-[calc(100dvh-var(--app-sticky-stack-offset)-1.5rem)] xl:overflow-y-auto xl:pr-2 xl:pb-4">
            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-[var(--accent)]" />
                <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.mySetup}</div>
              </div>
              <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.mySetupBody}</p>
              {setupSignals.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {setupSignals.map((signal) => (
                    <FilterChip key={signal} active className="justify-start">
                      {signal}
                    </FilterChip>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.setupEmpty}</p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                <MetricTile label={copy.matchesNow} value={jobsInLane.length} tone="accent" />
                <MetricTile
                  label={copy.remoteSection}
                  value={jobsInLane.filter((job) => isRemoteListing(job)).length}
                />
              </div>
              <SavedFiltersMenu onLoadFilter={applyFilterSnapshot} currentFilters={currentFilters} hasActiveFilters={hasActiveFilters} />
            </SurfaceCard>

            <SurfaceCard className="space-y-4">
              <div className="flex items-center gap-2">
                <SlidersHorizontal size={16} className="text-[var(--accent)]" />
                <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.personalPresets}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {personalPresets.map((preset) => (
                  <FilterChip key={preset.id} onClick={() => applyFilterSnapshot(preset.filters)} className="justify-start">
                    {preset.name}
                  </FilterChip>
                ))}
              </div>
            </SurfaceCard>

            <SurfaceCard className="space-y-5">
              <FilterSection title={copy.scope}>
                <div className="flex flex-wrap gap-2">
                  <FilterChip active={!globalSearch && !abroadOnly} onClick={() => { setGlobalSearch(false); setAbroadOnly(false); }}>
                    {copy.domestic}
                  </FilterChip>
                  <FilterChip active={globalSearch && !abroadOnly} onClick={() => { setGlobalSearch(true); setAbroadOnly(false); }}>
                    {copy.allMarkets}
                  </FilterChip>
                  <FilterChip active={abroadOnly} onClick={() => { setGlobalSearch(false); setAbroadOnly(true); }}>
                    {copy.border}
                  </FilterChip>
                </div>
              </FilterSection>

              <FilterSection title={copy.remote}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={remoteOnly} onClick={() => toggleRemoteOnly(true)}>
                      {copy.remoteOnly}
                    </FilterChip>
                    <FilterChip active={!remoteOnly} onClick={() => toggleRemoteOnly(false)}>
                      {copy.allWorkModels}
                    </FilterChip>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REMOTE_LANGUAGE_OPTIONS.map((option) => {
                      const active = filterLanguageCodes.includes(option.key);
                      return (
                        <FilterChip
                          key={option.key}
                          active={active}
                          onClick={() =>
                            setFilterLanguageCodes(
                              active
                                ? filterLanguageCodes.filter((code) => code !== option.key)
                                : [...filterLanguageCodes, option.key]
                            )
                          }
                        >
                          {option.labels[isCsLike ? 'cs' : 'en']}
                        </FilterChip>
                      );
                    })}
                  </div>
                </div>
              </FilterSection>

              <FilterSection title={copy.commute}>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <FilterChip active={enableCommuteFilter} onClick={() => setEnableCommuteFilter(true)}>
                      {copy.commute}
                    </FilterChip>
                    <FilterChip active={!enableCommuteFilter} onClick={() => setEnableCommuteFilter(false)}>
                      {hasCommuteProfile ? copy.allWorkModels : copy.commuteHint}
                    </FilterChip>
                  </div>
                  {enableCommuteFilter ? (
                    <label className="block space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                        {filterMaxDistance} km
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={200}
                        step={5}
                        value={filterMaxDistance}
                        onChange={(event) => setFilterMaxDistance(Number(event.target.value))}
                        className="w-full accent-[var(--accent)]"
                      />
                    </label>
                  ) : (
                    <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.commuteHint}</p>
                  )}
                </div>
              </FilterSection>

              <FilterSection title={copy.minSalary}>
                <label className="block space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                    {filterMinSalary > 0 ? filterMinSalary.toLocaleString(i18n.language) : copy.anySalary}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={250000}
                    step={5000}
                    value={filterMinSalary}
                    onChange={(event) => setFilterMinSalary(Number(event.target.value))}
                    className="w-full accent-[var(--accent)]"
                  />
                </label>
              </FilterSection>

              <FilterSection title={copy.roleType}>
                <div className="flex flex-wrap gap-2">
                  {ROLE_TYPES.map((type) => (
                    <FilterChip
                      key={type.key}
                      active={filterContractType.includes(type.key)}
                      onClick={() => toggleContractTypeFilter(type.key)}
                    >
                      {type.labels[isCsLike ? 'cs' : 'en']}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title={copy.experience}>
                <div className="flex flex-wrap gap-2">
                  {EXPERIENCE_LEVELS.map((level) => (
                    <FilterChip
                      key={level.key}
                      active={filterExperience.includes(level.key)}
                      onClick={() =>
                        setFilterExperience(
                          filterExperience.includes(level.key)
                            ? filterExperience.filter((item) => item !== level.key)
                            : [...filterExperience, level.key]
                        )
                      }
                    >
                      {level.labels[isCsLike ? 'cs' : 'en']}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title={copy.benefits}>
                <div className="flex flex-wrap gap-2">
                  {BENEFIT_FILTERS.map((benefit) => (
                    <FilterChip
                      key={benefit.key}
                      active={filterBenefits.includes(benefit.key)}
                      onClick={() => toggleBenefitFilter(benefit.key)}
                    >
                      {benefit.labels[isCsLike ? 'cs' : 'en']}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title={copy.date}>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'all', label: copy.allDates },
                    { key: '3d', label: copy.last3Days },
                    { key: '7d', label: copy.last7Days },
                    { key: '30d', label: copy.last30Days }
                  ].map((option) => (
                    <FilterChip key={option.key} active={filterDate === option.key} onClick={() => setFilterDate(option.key)}>
                      {option.label}
                    </FilterChip>
                  ))}
                </div>
              </FilterSection>
            </SurfaceCard>
          </div>
        </div>

        <div className="space-y-4">
          <SurfaceCard className="space-y-4 xl:hidden">
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.laneChallenges}</div>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{copy.mobileSwipeBody}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={mobileViewMode === 'swipe'} onClick={() => setMobileViewMode('swipe')}>
                  {copy.mobileSwipe}
                </FilterChip>
                <FilterChip active={mobileViewMode === 'list'} onClick={() => setMobileViewMode('list')}>
                  {copy.mobileList}
                </FilterChip>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,248,230,0.98),rgba(255,255,255,0.98))] shadow-[0_28px_70px_-50px_rgba(217,119,6,0.55)] dark:bg-[linear-gradient(135deg,rgba(255,248,230,0.98),rgba(255,255,255,0.98))]">
            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
              <div className="space-y-3">
                <div className="app-eyebrow w-fit !bg-white !text-[var(--accent-strong)]">
                  <Sparkles size={12} />
                  {copy.premiumTitle}
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold tracking-[-0.03em] text-slate-950">
                    {isCsLike
                      ? 'Více prostoru pro odpovědi, chytřejší vedení a přesnější doporučení'
                      : 'More room for replies, sharper guidance, and stronger decision support'}
                  </h3>
                  <p className="max-w-3xl text-sm leading-7 text-slate-700">{copy.premiumBody}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(copy.premiumBullets as string[]).map((item: string) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-amber-200 bg-white/92 px-3 py-1.5 text-sm font-medium text-slate-700"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                {!hasPremiumAccess ? (
                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      className="app-button-primary justify-center"
                      onClick={() => onOpenPremium(copy.premiumTitle)}
                    >
                      <Sparkles size={16} />
                      {copy.premiumCta}
                    </button>
                    <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                      {isCsLike ? 'Více slotů • AI průvodce • JHI • JCFPM' : 'More slots • AI guide • JHI • JCFPM'}
                    </p>
                  </div>
                ) : null}
              </div>
              <div className="space-y-3 rounded-[var(--radius-xl)] border border-white/80 bg-white/88 p-4 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.35)]">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[var(--accent)]" />
                  <div className="text-sm font-semibold text-slate-900">{copy.slotsTitle}</div>
                </div>
                <p className="text-sm leading-6 text-slate-700">{copy.slotsBody}</p>
                {dialogueCapacity ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <MetricTile
                      label={copy.slotsTitle}
                      value={copy.slotsValue
                        .replace('{{active}}', String(dialogueCapacity.active))
                        .replace('{{limit}}', String(dialogueCapacity.limit))}
                      tone="accent"
                    />
                    <MetricTile
                      label={copy.slotsRemainingLabel}
                      value={copy.slotsRemaining.replace('{{remaining}}', String(dialogueCapacity.remaining))}
                    />
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-slate-700">{copy.slotsEmpty}</p>
                )}
                {hasPremiumAccess ? (
                  <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                    {isCsLike ? 'Premium je aktivní' : 'Premium is active'}
                  </div>
                ) : null}
              </div>
            </div>
          </SurfaceCard>

          {mobileViewMode === 'swipe' ? (
            <div className="xl:hidden">
              <MobileSwipeJobBrowser
                jobs={jobsInLane}
                swipeStateStorageKey={`marketplace:${lane}:${remoteOnly ? 'remote' : 'all'}`}
                savedJobIds={savedJobIds}
                onToggleSave={handleToggleSave}
                onRejectJob={(jobId) => applyInteractionState(jobId, 'swipe_left')}
                onOpenDetails={handleJobSelect}
                onSwitchToList={() => setMobileViewMode('list')}
                isLoadingMore={loadingMore}
                isLoading={loading}
                hasMore={hasMore}
                onLoadMore={loadMoreJobs}
                theme={theme}
              />
            </div>
          ) : null}

          <div className={cn(mobileViewMode === 'swipe' && 'hidden xl:block')}>
          <SurfaceCard className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <div className="app-eyebrow w-fit">
                  <Briefcase size={12} />
                  {copy.laneBadge}
                </div>
                <h2 className="text-2xl font-semibold tracking-[-0.035em] text-[var(--text-strong)]">
                  {lane === 'imports' ? copy.laneImports : copy.laneChallenges}
                </h2>
                <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{copy.laneBody}</p>
              </div>
              <MetricTile label={copy.results} value={`${jobsInLane.length}`} className="min-w-[140px]" />
            </div>
          </SurfaceCard>

          {jobsInLane.length === 0 ? (
            <EmptyState title={copy.emptyTitle} body={copy.emptyBody} />
          ) : (
            <div className="space-y-4">
              {feedSections.map((section) => (
                <SurfaceCard key={section.key} className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1.5">
                      <h3 className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{section.title}</h3>
                      <p className="max-w-3xl text-sm leading-6 text-[var(--text-muted)]">{section.body}</p>
                    </div>
                    <div className="text-sm font-medium text-[var(--text-faint)]">{section.jobs.length}</div>
                  </div>

                  <div className="space-y-3">
                    {section.jobs.map((job) => {
                      const isSaved = savedJobIds.includes(job.id);
                      const isSelected = selectedJobId === job.id;
                      const experienceLabel = getExperienceLabel(job, isCsLike);
                      const sourceBadge = job.listingKind === 'imported' ? copy.sourceImported : copy.sourceNative;
                      return (
                        <article
                          key={job.id}
                          onClick={() => handleJobSelect(job.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleJobSelect(job.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className={cn(
                            'app-surface w-full rounded-[var(--radius-xl)] border p-5 text-left shadow-[var(--shadow-soft)] transition hover:-translate-y-[1px] hover:shadow-[var(--shadow-card)]',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--accent-rgb),0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]',
                            isSelected && 'border-[rgba(var(--accent-rgb),0.26)] bg-[var(--accent-soft)]'
                          )}
                        >
                            <div className="space-y-4">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-base font-semibold tracking-[-0.02em] text-[var(--text-strong)] md:text-lg">
                                  {job.title}
                                </div>
                                <div className="mt-1 text-sm text-[var(--text-muted)]">{job.company}</div>
                              </div>
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <span className="app-eyebrow !py-1">{sourceBadge}</span>
                                {isSelected ? (
                                  <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-semibold text-[var(--accent)]">
                                    {copy.selected}
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                                  {copy.challengeLabel}
                                </div>
                                <h4 className="mt-2 max-w-4xl text-xl font-semibold leading-snug tracking-[-0.04em] text-[var(--text-strong)] md:text-[1.7rem]">
                                  {getChallengePreview(job)}
                                </h4>
                              </div>

                              <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                                  {copy.riskLabel}
                                </div>
                                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{getRiskPreview(job)}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <MetaBadge>{job.location || (isCsLike ? 'Lokalita TBD' : 'Location TBD')}</MetaBadge>
                              <MetaBadge>{formatSalary(job, i18n.language, isCsLike)}</MetaBadge>
                              <MetaBadge tone="accent">{copy.fit} {Math.round(job.jhi?.score || 0)}</MetaBadge>
                              <MetaBadge>{getWorkModel(job, isCsLike)}</MetaBadge>
                              {experienceLabel ? <MetaBadge>{experienceLabel}</MetaBadge> : null}
                              {job.url ? <MetaBadge>{copy.openPreview}</MetaBadge> : null}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
                              <button
                                type="button"
                                className="app-button-primary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleJobSelect(job.id);
                                }}
                              >
                                {copy.openCard}
                                <ArrowRight size={15} />
                              </button>
                              <button
                                type="button"
                                className="app-button-secondary"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleToggleSave(job.id);
                                }}
                              >
                                <Bookmark size={15} className={isSaved ? 'fill-current' : ''} />
                                {isSaved ? copy.shortlisted : copy.shortlist}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>
    </section>
  );
};

const FilterSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-3">
    <div className="flex items-center gap-2">
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{title}</div>
      <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    </div>
    {children}
  </section>
);

const MetaBadge: React.FC<{ children: React.ReactNode; tone?: 'default' | 'accent' }> = ({ children, tone = 'default' }) => (
  <span
    className={cn(
      'rounded-full px-3 py-1 text-xs font-medium',
      tone === 'accent'
        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
        : 'bg-[var(--surface-muted)] text-[var(--text-muted)]'
    )}
  >
    {children}
  </span>
);

export default ChallengeMarketplace;
