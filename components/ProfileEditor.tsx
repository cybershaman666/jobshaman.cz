import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { CandidateDomainKey, CandidateSearchProfile, CandidateSeniority, CompanyApplicationRow, DialogueDossier, SearchLanguageCode, UserProfile, UserPostedMiniChallenge, WorkExperience, Education, TransportMode, Job, TaxProfile, JHIPreferences, HappinessAuditInput, HappinessAuditOutput, JcfpmSnapshotV1, SolutionSnapshot } from '../types';
import {
  User,
  Upload,
  X,
  Camera,
  Lock,
  Briefcase,
  GraduationCap,
  Award,
  Plus,
  Trash2,
  Save,
  Link,
  ExternalLink,
  Edit,
  FileText,
  MapPin,
  CheckCircle,
  AlertCircle,
  Bookmark,
  Sparkles,
  Mail,
  Bell,
  Calculator,
  SlidersHorizontal,
  Zap,
  ArrowRight,
  LogOut
} from 'lucide-react';
import CreateMiniChallengeModal from './challenges/CreateMiniChallengeModal';
import { updateCurrentUserPassword, uploadProfilePhoto } from '../services/supabaseService';
import { validateCvFile, uploadAndParseCv, mergeProfileWithParsedCv } from '../services/cvUploadService';
import { resolveAddressToCoordinates } from '../services/commuteService';
import { authenticatedFetch } from '../services/csrfService';
import { BACKEND_URL } from '../constants';
import { FEATURE_HAPPINESS_AUDIT_THREE } from '../constants';
import PremiumFeaturesPreview from './PremiumFeaturesPreview';
import AIGuidedProfileWizard from './AIGuidedProfileWizard';
import CVManager from './CVManager';
import { redirectToCheckout } from '../services/stripeService';
import { getSubscriptionStatus } from '../services/serverSideBillingService';
import { getCurrentSubscription, getPushPermission, isPushSupported, registerPushSubscription, subscribeToPush, unsubscribeFromPush } from '../services/pushNotificationsService';

import TransportModeSelector from './TransportModeSelector';
import { createDefaultCandidateSearchProfile, createDefaultJHIPreferences, createDefaultTaxProfileByCountry } from '../services/profileDefaults';
import { enrichSearchProfileWithInference, getCandidateIntentDomainLabel, getCandidateIntentDomainOptions, getCandidateIntentSignals, resolveCandidateIntentProfile } from '../services/candidateIntentService';
import { getPremiumPriceDisplay } from '../services/premiumPricingService';
import { simulateHappinessAudit } from '../services/assessmentThreeService';
import { fetchJobsByIds } from '../services/jobService';
import { useSceneCapability } from '../hooks/useSceneCapability';
import SceneShell from './three/SceneShell';
import LifeSustainabilityOrbit from './three/LifeSustainabilityOrbit';
import CareerAnchorDrift from './three/CareerAnchorDrift';
import NebulaOfPotential from './three/NebulaOfPotential';
import CulturalNorthstarCompass from './three/CulturalNorthstarCompass';
import AnalyticsService from '../services/analyticsService';
import JcfpmEntryCard from './jcfpm/JcfpmEntryCard';
import JcfpmReportPanel from './jcfpm/JcfpmReportPanel';
import { readJcfpmDraft } from '../services/jcfpmSessionState';
import { clearJcfpmDraft } from '../services/jcfpmSessionState';
import { fetchMySolutionSnapshots } from '../services/jobApplicationService';
import {
  createProfileMiniChallenge,
  fetchProfileMiniChallengeDialogueDetail,
  fetchProfileMiniChallengeDialogues,
  fetchProfileMiniChallengeDialogueMessages,
  listProfileMiniChallenges,
  sendProfileMiniChallengeDialogueMessage,
  updateProfileMiniChallengeDialogueStatus,
  updateProfileMiniChallengeLifecycle,
} from '../services/profileMiniChallengeService';
import { GrowthSignal } from './ui/primitives';
import AppShellAtmosphere from './ui/AppShellAtmosphere';
import ApplicationMessageCenter from './ApplicationMessageCenter';

import { useTranslation } from 'react-i18next';

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile, persist?: boolean) => void | Promise<void>;
  onSave: () => void | Promise<boolean>;
  onRefreshProfile?: () => void | Promise<void>;
  onSignOut?: () => void | Promise<void>;
  savedJobs?: Job[];
  savedJobIds?: string[];
  onToggleSave?: (jobId: string) => void;
  onJobSelect?: (jobId: string) => void;
  onApplyToJob?: (job: Job) => void;
  selectedJobId?: string | null;
  onDeleteAccount?: () => Promise<boolean>;
}

const ProfileJobManager = lazy(() => import('./ProfileJobManager'));
type ProfileTabKey = 'profile' | 'evidence' | 'work' | 'account' | 'challenges' | 'saved';
type ProfileLocale = 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en';
type ProfileLocaleLabels = { cs: string; en: string; sk?: string; de?: string; at?: string; pl?: string };
const PROFILE_INITIAL_TAB_STORAGE_KEY = 'jobshaman.profile.initialTab';

const normalizeProfileTabKey = (value: string | null | undefined): ProfileTabKey | null => {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (normalized === 'personal') return 'profile';
  if (normalized === 'cv' || normalized === 'jcfpm') return 'evidence';
  if (normalized === 'settings') return 'work';
  if (normalized === 'profile' || normalized === 'evidence' || normalized === 'work' || normalized === 'account' || normalized === 'challenges' || normalized === 'saved') {
    return normalized as ProfileTabKey;
  }
  return null;
};

const getProfileLocale = (localeBase: string): ProfileLocale => (
  ['cs', 'sk', 'de', 'at', 'pl'].includes(localeBase) ? (localeBase as ProfileLocale) : 'en'
);

const getProfileLocaleLabel = (labels: ProfileLocaleLabels, locale: ProfileLocale): string => (
  labels[locale] || labels.en
);

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onChange,
  onSave,
  onRefreshProfile,
  onSignOut,
  savedJobs = [],
  savedJobIds = [],
  onToggleSave,
  onJobSelect,
  onApplyToJob,
  selectedJobId,
  onDeleteAccount
}) => {
  const { t, i18n } = useTranslation();
  const localeBase = (i18n.language || 'cs').split('-')[0];
  const profileLocale = getProfileLocale(localeBase);
  const isCsLikeProfile = localeBase === 'cs' || localeBase === 'sk';
  const supportingContextCopy = ({
    cs: {
      tabLabel: 'Podklady',
      tabCaption: 'CV a doplňky',
      aiDraftTitle: 'Uložený AI draft profilu',
      aiDraftDesc: 'Můžete si ručně upravit a uložit AI draft, aby se nemusel generovat znovu.',
      aiDraftLoad: 'Načíst základní CV text',
      aiDraftPlaceholder: 'Vložte nebo upravte AI draft profilu...',
      aiDraftSave: 'Uložit AI draft',
      aiDraftSaved: 'AI draft byl uložen.',
      sectionTitle: 'Podklady a CV',
      sectionIntro: 'CV je tady jen volitelný podpůrný dokument. Můžete si uložit klasické CV, AI draft nebo další materiály pro chvíli, kdy si firma vyžádá kontext navíc.',
      uploadedTitle: 'Podklad je připravený',
      uploadedDesc: 'Dokument zůstane připravený jako volitelný kontext pro budoucí dialogy.',
      replaceLabel: 'Nahradit dokument',
      emptyTitle: 'Přidat CV nebo podpůrný dokument',
      emptyDesc: 'Uložte si sem životopis nebo doplňující dokument pro firmy, které chtějí další kontext.',
      selectLabel: 'Vybrat dokument',
      libraryTitle: 'Knihovna dokumentů'
    },
    sk: {
      tabLabel: 'Podklady',
      tabCaption: 'CV a doplnky',
      aiDraftTitle: 'Uložený AI draft profilu',
      aiDraftDesc: 'AI draft si môžete ručne upraviť a uložiť, aby sa nemusel generovať znova.',
      aiDraftLoad: 'Načítať základný CV text',
      aiDraftPlaceholder: 'Vložte alebo upravte AI draft profilu...',
      aiDraftSave: 'Uložiť AI draft',
      aiDraftSaved: 'AI draft bol uložený.',
      sectionTitle: 'Podklady a CV',
      sectionIntro: 'CV je tu len voliteľný podporný dokument. Môžete si uložiť klasické CV, AI draft alebo ďalšie materiály pre chvíľu, keď si firma vyžiada viac kontextu.',
      uploadedTitle: 'Podklad je pripravený',
      uploadedDesc: 'Dokument zostane pripravený ako voliteľný kontext pre budúce dialógy.',
      replaceLabel: 'Nahradiť dokument',
      emptyTitle: 'Pridať CV alebo podporný dokument',
      emptyDesc: 'Uložte si sem životopis alebo doplňujúci dokument pre firmy, ktoré chcú viac kontextu.',
      selectLabel: 'Vybrať dokument',
      libraryTitle: 'Knižnica dokumentov'
    },
    de: {
      tabLabel: 'Unterlagen',
      tabCaption: 'CV und Zusatzunterlagen',
      aiDraftTitle: 'Gespeicherter KI-Profilentwurf',
      aiDraftDesc: 'Sie können den KI-Entwurf manuell bearbeiten und speichern, damit er nicht erneut generiert werden muss.',
      aiDraftLoad: 'Grundtext aus CV laden',
      aiDraftPlaceholder: 'KI-Profilentwurf hier einfügen oder bearbeiten...',
      aiDraftSave: 'KI-Entwurf speichern',
      aiDraftSaved: 'KI-Entwurf gespeichert.',
      sectionTitle: 'Unterlagen und CV',
      sectionIntro: 'Ihr CV ist hier nur optionaler Kontext. Halten Sie Lebenslauf, KI-Entwurf oder weitere Unterlagen bereit, falls ein Team mehr Details anfragt.',
      uploadedTitle: 'Unterlage ist bereit',
      uploadedDesc: 'Diese Datei bleibt als optionaler Kontext für zukünftige Dialoge verfügbar.',
      replaceLabel: 'Dokument ersetzen',
      emptyTitle: 'CV oder Unterlage hinzufügen',
      emptyDesc: 'Speichern Sie hier Ihren Lebenslauf oder zusätzliche Unterlagen für Teams, die mehr Kontext möchten.',
      selectLabel: 'Dokument auswählen',
      libraryTitle: 'Dokumentenbibliothek'
    },
    at: {
      tabLabel: 'Unterlagen',
      tabCaption: 'CV und Zusatzunterlagen',
      aiDraftTitle: 'Gespeicherter KI-Profilentwurf',
      aiDraftDesc: 'Sie können den KI-Entwurf manuell bearbeiten und speichern, damit er nicht erneut generiert werden muss.',
      aiDraftLoad: 'Grundtext aus CV laden',
      aiDraftPlaceholder: 'KI-Profilentwurf hier einfügen oder bearbeiten...',
      aiDraftSave: 'KI-Entwurf speichern',
      aiDraftSaved: 'KI-Entwurf gespeichert.',
      sectionTitle: 'Unterlagen und CV',
      sectionIntro: 'Ihr CV ist hier nur optionaler Kontext. Halten Sie Lebenslauf, KI-Entwurf oder weitere Unterlagen bereit, falls ein Team mehr Details anfragt.',
      uploadedTitle: 'Unterlage ist bereit',
      uploadedDesc: 'Diese Datei bleibt als optionaler Kontext für zukünftige Dialoge verfügbar.',
      replaceLabel: 'Dokument ersetzen',
      emptyTitle: 'CV oder Unterlage hinzufügen',
      emptyDesc: 'Speichern Sie hier Ihren Lebenslauf oder zusätzliche Unterlagen für Teams, die mehr Kontext möchten.',
      selectLabel: 'Dokument auswählen',
      libraryTitle: 'Dokumentenbibliothek'
    },
    pl: {
      tabLabel: 'Materiały',
      tabCaption: 'CV i dodatki',
      aiDraftTitle: 'Zapisany szkic profilu AI',
      aiDraftDesc: 'Możesz ręcznie edytować i zapisać szkic AI, żeby nie trzeba było generować go ponownie.',
      aiDraftLoad: 'Wczytaj bazowy tekst CV',
      aiDraftPlaceholder: 'Wklej lub edytuj szkic profilu AI...',
      aiDraftSave: 'Zapisz szkic AI',
      aiDraftSaved: 'Szkic AI został zapisany.',
      sectionTitle: 'Materiały i CV',
      sectionIntro: 'CV jest tutaj opcjonalnym materiałem wspierającym. Trzymaj gotowe CV, szkic AI lub inne materiały, jeśli firma poprosi o dodatkowy kontekst.',
      uploadedTitle: 'Materiał jest gotowy',
      uploadedDesc: 'Ten plik pozostaje dostępny jako opcjonalny kontekst do przyszłych dialogów.',
      replaceLabel: 'Zamień dokument',
      emptyTitle: 'Dodaj CV lub materiał wspierający',
      emptyDesc: 'Zapisz tutaj CV lub dodatkowy plik dla firm, które proszą o więcej kontekstu.',
      selectLabel: 'Wybierz dokument',
      libraryTitle: 'Biblioteka dokumentów'
    },
    en: {
      tabLabel: 'Supporting context',
      tabCaption: 'CV and supporting docs',
      aiDraftTitle: 'Saved AI profile draft',
      aiDraftDesc: 'You can edit and save the AI draft manually so it does not need to be generated again.',
      aiDraftLoad: 'Load base CV text',
      aiDraftPlaceholder: 'Paste or edit your AI profile draft here...',
      aiDraftSave: 'Save AI draft',
      aiDraftSaved: 'AI draft saved.',
      sectionTitle: 'Supporting context and CV',
      sectionIntro: 'Your CV is optional supporting context here. Keep a resume, AI draft, or other background material ready for teams that ask for extra detail.',
      uploadedTitle: 'Supporting document is ready',
      uploadedDesc: 'This file stays available as optional context for future dialogues.',
      replaceLabel: 'Replace document',
      emptyTitle: 'Add a CV or supporting document',
      emptyDesc: 'Store a resume or extra background file here for teams that ask for more context.',
      selectLabel: 'Select document',
      libraryTitle: 'Document library'
    }
  } as const)[profileLocale];
  const profilePremiumCopy = {
    cs: {
      aiGuideBadge: 'Prémiový pomocník',
      aiGuideDesc: 'Jednou popište svůj pracovní příběh. AI z něj vytáhne silné stránky, doplní profil a připraví lepší základ pro CV.',
      aiGuideStart: 'Spustit vedený průvodce',
      aiGuideUpgrade: 'Premium odemkne AI průvodce i chytřejší úpravy CV.',
      jcfpmSummary: '108 otázek • 12 dimenzí • základní výstup pro všechny • plný rozbor v Premium',
      jcfpmBasicTitle: 'Základní výsledek je připravený',
      jcfpmBasicDesc: 'Test už teď zpřesňuje vaši interní interpretaci JHI. Premium odemkne podrobný rozbor, vysvětlení změn a sdílení výsledků s firmou.',
      jcfpmUnlock: 'Odemknout plný rozbor',
    },
    en: {
      aiGuideBadge: 'Premium helper',
      aiGuideDesc: 'Tell your work story once. AI pulls out your strengths, enriches your profile, and prepares a better CV starting point.',
      aiGuideStart: 'Start guided setup',
      aiGuideUpgrade: 'Premium unlocks the AI guide and smarter CV improvements.',
      jcfpmSummary: '108 questions • 12 dimensions • basic results for everyone • full analysis in Premium',
      jcfpmBasicTitle: 'Your basic result is ready',
      jcfpmBasicDesc: 'The test already sharpens your internal JHI interpretation. Premium unlocks the full breakdown, explains what changed, and lets you share results with employers.',
      jcfpmUnlock: 'Unlock full analysis',
    },
    de: {
      aiGuideBadge: 'Premium-Helfer',
      aiGuideDesc: 'Erzählen Sie Ihre berufliche Geschichte einmal. Die KI erkennt Stärken, ergänzt Ihr Profil und bereitet eine bessere Grundlage für Ihren Lebenslauf vor.',
      aiGuideStart: 'Geführten Start öffnen',
      aiGuideUpgrade: 'Premium schaltet den KI-Assistenten und intelligentere Lebenslauf-Verbesserungen frei.',
      jcfpmSummary: '108 Fragen • 12 Dimensionen • Basis-Ergebnis für alle • volle Analyse in Premium',
      jcfpmBasicTitle: 'Ihr Basis-Ergebnis ist bereit',
      jcfpmBasicDesc: 'Der Test schärft bereits Ihre interne JHI-Interpretation. Premium schaltet die vollständige Auswertung, die Erklärung der Änderungen und das Teilen mit Arbeitgebern frei.',
      jcfpmUnlock: 'Volle Analyse freischalten',
    },
    at: {
      aiGuideBadge: 'Premium-Helfer',
      aiGuideDesc: 'Erzählen Sie Ihre berufliche Geschichte einmal. Die KI erkennt Stärken, ergänzt Ihr Profil und bereitet eine bessere Grundlage für Ihren Lebenslauf vor.',
      aiGuideStart: 'Geführten Start öffnen',
      aiGuideUpgrade: 'Premium schaltet den KI-Assistenten und intelligentere Lebenslauf-Verbesserungen frei.',
      jcfpmSummary: '108 Fragen • 12 Dimensionen • Basis-Ergebnis für alle • volle Analyse in Premium',
      jcfpmBasicTitle: 'Ihr Basis-Ergebnis ist bereit',
      jcfpmBasicDesc: 'Der Test schärft bereits Ihre interne JHI-Interpretation. Premium schaltet die vollständige Auswertung, die Erklärung der Änderungen und das Teilen mit Arbeitgebern frei.',
      jcfpmUnlock: 'Volle Analyse freischalten',
    },
    pl: {
      aiGuideBadge: 'Pomocnik Premium',
      aiGuideDesc: 'Opowiedz raz swoją historię zawodową. AI wyciągnie mocne strony, uzupełni profil i przygotuje lepszą bazę do CV.',
      aiGuideStart: 'Uruchom przewodnik',
      aiGuideUpgrade: 'Premium odblokowuje przewodnik AI i inteligentniejsze ulepszenia CV.',
      jcfpmSummary: '108 pytań • 12 wymiarów • podstawowy wynik dla wszystkich • pełna analiza w Premium',
      jcfpmBasicTitle: 'Podstawowy wynik jest gotowy',
      jcfpmBasicDesc: 'Test już teraz doprecyzowuje Twoją wewnętrzną interpretację JHI. Premium odblokowuje pełny rozkład, wyjaśnia zmiany i pozwala udostępnić wynik pracodawcom.',
      jcfpmUnlock: 'Odblokuj pełną analizę',
    },
    sk: {
      aiGuideBadge: 'Prémiový pomocník',
      aiGuideDesc: 'Raz opíšte svoj pracovný príbeh. AI z neho vytiahne silné stránky, doplní profil a pripraví lepší základ pre CV.',
      aiGuideStart: 'Spustiť sprievodcu',
      aiGuideUpgrade: 'Premium odomkne AI sprievodcu aj inteligentnejšie úpravy CV.',
      jcfpmSummary: '108 otázok • 12 dimenzií • základný výsledok pre všetkých • plná analýza v Premium',
      jcfpmBasicTitle: 'Základný výsledok je pripravený',
      jcfpmBasicDesc: 'Test už teraz spresňuje vašu internú interpretáciu JHI. Premium odomkne plný rozbor, vysvetlenie zmien a zdieľanie výsledkov so zamestnávateľom.',
      jcfpmUnlock: 'Odomknúť plný rozbor',
    }
  }[localeBase] || {
    aiGuideBadge: 'Premium helper',
    aiGuideDesc: 'Tell your work story once. AI pulls out your strengths, enriches your profile, and prepares a better CV starting point.',
    aiGuideStart: 'Start guided setup',
    aiGuideUpgrade: 'Premium unlocks the AI guide and smarter CV improvements.',
    jcfpmSummary: '108 questions • 12 dimensions • basic results for everyone • full analysis in Premium',
    jcfpmBasicTitle: 'Your basic result is ready',
    jcfpmBasicDesc: 'The test already sharpens your internal JHI interpretation. Premium unlocks the full breakdown, explains what changed, and lets you share results with employers.',
    jcfpmUnlock: 'Unlock full analysis',
  };
  const profileCountryCopy = {
    cs: {
      label: 'Preferovaná země pro nabídky',
      help: 'Používá se pro výchozí záběr trhu a cílení denního digestu, pokud adresa chybí nebo je jen přibližná.',
      countries: { CZ: 'Česko', SK: 'Slovensko', PL: 'Polsko', DE: 'Německo', AT: 'Rakousko' },
    },
    en: {
      label: 'Preferred country for jobs',
      help: 'Used for default market scope and daily digest targeting when your address is missing or approximate.',
      countries: { CZ: 'Czechia', SK: 'Slovakia', PL: 'Poland', DE: 'Germany', AT: 'Austria' },
    },
    de: {
      label: 'Bevorzugtes Land für Jobs',
      help: 'Wird für den Standard-Marktfokus und den täglichen Digest verwendet, wenn Ihre Adresse fehlt oder nur ungefähr ist.',
      countries: { CZ: 'Tschechien', SK: 'Slowakei', PL: 'Polen', DE: 'Deutschland', AT: 'Österreich' },
    },
    at: {
      label: 'Bevorzugtes Land für Jobs',
      help: 'Wird für den Standard-Marktfokus und den täglichen Digest verwendet, wenn Ihre Adresse fehlt oder nur ungefähr ist.',
      countries: { CZ: 'Tschechien', SK: 'Slowakei', PL: 'Polen', DE: 'Deutschland', AT: 'Österreich' },
    },
    pl: {
      label: 'Preferowany kraj ofert',
      help: 'Używane do domyślnego zakresu rynku i kierowania dziennego digestu, gdy adres jest brakujący lub tylko przybliżony.',
      countries: { CZ: 'Czechy', SK: 'Słowacja', PL: 'Polska', DE: 'Niemcy', AT: 'Austria' },
    },
    sk: {
      label: 'Preferovaná krajina pre ponuky',
      help: 'Používa sa na predvolený záber trhu a cielenie denného digestu, keď adresa chýba alebo je len približná.',
      countries: { CZ: 'Česko', SK: 'Slovensko', PL: 'Poľsko', DE: 'Nemecko', AT: 'Rakúsko' },
    },
  }[localeBase] || {
    label: 'Preferred country for jobs',
    help: 'Used for default market scope and daily digest targeting when your address is missing or approximate.',
    countries: { CZ: 'Czechia', SK: 'Slovakia', PL: 'Poland', DE: 'Germany', AT: 'Austria' },
  };
  const profileUiCopy = ({
    cs: {
      premiumLifeContext: 'Premium odemyká životní situaci, dopravu, benefity a jemnější výchozí nastavení feedu.',
      freePlanLine: 'Ve free verzi zůstává zdarma váš obor a cílová role. Premium přidává životní situaci, preferovanou dopravu, benefity a detailnější rozhodovací vrstvu.',
      auditQuest1: 'Úkol 1 · Únik zdrojů',
      auditQuest2: 'Úkol 2 · Zrcadlo příběhu',
      auditQuest3: 'Úkol 3 · Kulturní severka',
      pipeOn: 'Zapnuto',
      pipeOff: 'Vypnuto',
      disconnected: 'Odpojeno rour',
      noConstellation: 'Zatím bez rozsvíceného souhvězdí.',
      live3dOff: 'Živé 3D je vypnuté.',
      fallback3d: '3D náhradní režim.',
      orbitTitle: 'Orbit životní udržitelnosti',
      anchorTitle: 'Kariérní kotva vs. drift',
      mirrorTitle: 'Zrcadlo příběhu',
      northstarTitle: 'Kulturní severka',
      alignmentLabel: 'Kulturní sladění',
      mismatchLabel: 'nesoulad',
      timeRing: 'Časový okruh',
      energyRing: 'Energetický okruh',
      sustainability: 'Udržitelnost',
      drift: 'Drift',
      premiumBadge: 'Premium',
      happinessTitle: 'Personal Happiness Audit (Premium)',
      happinessSubtitle: 'Orbit životní udržitelnosti + kariérní kotva vs. drift',
      live3dOn: 'Živé 3D: zapnuto',
      live3dOffButton: 'Živé 3D: vypnuto',
      premiumRequired: 'Happiness audit je dostupný pouze v Premium.',
      quest1Body: 'Když se podíváte na svůj měsíční výpis z účtu a odečtete čas strávený v kolonách, kolik energie vám reálně zbývá na věci, které vás definují?',
      quest2Body: 'Kdybyste měli vymazat všechna formální buzzwordy ze svého životopisu, který moment vaší kariéry je ten, kdy jste byli nezastavitelní a dělali přesně to, co umíte nejlíp?',
      quest3Body: 'Představte si, že váš šéf udělá zásadní chybu. Jaká reakce firmy je vám bližší: upřímná omluva, nebo tiché opravení procesu?',
      commute: 'Dojíždění',
      taxes: 'Daně',
      fixedCosts: 'Fixní náklady',
      storyPlaceholder: 'Nadiktujte svůj příběh...',
      individualVsTeam: 'Individualismus ↔ Tým',
      chaosVsStructure: 'Chaos ↔ Struktura',
      companyOffNorth: 'Aktuální firma je mimo sever o {{value}} %.',
      simulating: 'Simuluji...',
      auditOutput: 'Výstup auditu',
      advisoryDisclaimer: 'Jde jen o doporučení. Finální rozhodnutí zůstává na vás.',
      monthlyGrossSalary: 'Hrubá měsíční mzda',
      monthlyCommuteCost: 'Měsíční náklady na dojíždění',
      homeOfficeDays: 'Dny práce z domova / týden',
      commuteMinutes: 'Minuty dojíždění za den',
      subjectiveEnergy: 'Subjektivní energie',
      roleDrift: 'Ukazatel driftu role',
      minutesPerDay: 'min/den',
      pushActive: 'aktivní',
      pushInactive: 'neaktivní',
      newPassword: 'Nové heslo',
      confirmNewPassword: 'Potvrzení hesla',
      setNewPassword: 'Nastavit nové heslo',
    },
    sk: {
      premiumLifeContext: 'Premium odomyká životnú situáciu, dopravu, benefity a jemnejšie predvolené nastavenie feedu.',
      freePlanLine: 'Vo free verzii zostáva zdarma váš odbor a cieľová rola. Premium pridáva životnú situáciu, preferovanú dopravu, benefity a detailnejšiu rozhodovaciu vrstvu.',
      auditQuest1: 'Úloha 1 · Únik zdrojov',
      auditQuest2: 'Úloha 2 · Zrkadlo príbehu',
      auditQuest3: 'Úloha 3 · Kultúrna severka',
      pipeOn: 'Zapnuté',
      pipeOff: 'Vypnuté',
      disconnected: 'Odpojené rúry',
      noConstellation: 'Zatiaľ bez rozsvieteného súhvezdia.',
      live3dOff: 'Živé 3D je vypnuté.',
      fallback3d: '3D náhradný režim.',
      orbitTitle: 'Orbit životnej udržateľnosti',
      anchorTitle: 'Kariérna kotva vs. drift',
      mirrorTitle: 'Zrkadlo príbehu',
      northstarTitle: 'Kultúrna severka',
      alignmentLabel: 'Kultúrne zladenie',
      mismatchLabel: 'nesúlad',
      timeRing: 'Časový okruh',
      energyRing: 'Energetický okruh',
      sustainability: 'Udržateľnosť',
      drift: 'Drift',
      premiumBadge: 'Premium',
      happinessTitle: 'Personal Happiness Audit (Premium)',
      happinessSubtitle: 'Orbit životnej udržateľnosti + kariérna kotva vs. drift',
      live3dOn: 'Živé 3D: zapnuté',
      live3dOffButton: 'Živé 3D: vypnuté',
      premiumRequired: 'Happiness audit je dostupný iba v Premium.',
      quest1Body: 'Keď sa pozriete na svoj mesačný výpis z účtu a odpočítate čas strávený v zápchach, koľko energie vám reálne zostáva na veci, ktoré vás definujú?',
      quest2Body: 'Keby ste mali vymazať všetky formálne buzzwordy zo svojho životopisu, ktorý moment vašej kariéry bol ten, keď ste boli nezastaviteľní a robili presne to, čo viete najlepšie?',
      quest3Body: 'Predstavte si, že váš šéf urobí zásadnú chybu. Ktorá reakcia firmy je vám bližšia: úprimné ospravedlnenie alebo tichá oprava procesu?',
      commute: 'Dochádzanie',
      taxes: 'Dane',
      fixedCosts: 'Fixné náklady',
      storyPlaceholder: 'Nadiktujte svoj príbeh...',
      individualVsTeam: 'Individualizmus ↔ Tím',
      chaosVsStructure: 'Chaos ↔ Štruktúra',
      companyOffNorth: 'Aktuálna firma je mimo severu o {{value}} %.',
      simulating: 'Simulujem...',
      auditOutput: 'Výstup auditu',
      advisoryDisclaimer: 'Ide len o odporúčanie. Konečné rozhodnutie zostáva na vás.',
      monthlyGrossSalary: 'Hrubá mesačná mzda',
      monthlyCommuteCost: 'Mesačné náklady na dochádzanie',
      homeOfficeDays: 'Dni práce z domu / týždeň',
      commuteMinutes: 'Minúty dochádzania za deň',
      subjectiveEnergy: 'Subjektívna energia',
      roleDrift: 'Ukazovateľ driftu roly',
      minutesPerDay: 'min/deň',
      pushActive: 'aktívne',
      pushInactive: 'neaktívne',
      newPassword: 'Nové heslo',
      confirmNewPassword: 'Potvrdenie hesla',
      setNewPassword: 'Nastaviť nové heslo',
    },
    de: {
      premiumLifeContext: 'Premium schaltet Lebenskontext, Mobilität, Benefits und feinere Feed-Defaults frei.',
      freePlanLine: 'Im Free-Tarif bleiben Bereich und Zielrolle kostenlos. Premium ergänzt Lebenskontext, bevorzugte Mobilität, Benefits und eine tiefere Entscheidungsebene.',
      auditQuest1: 'Quest 1 · Das Leck der Ressourcen',
      auditQuest2: 'Quest 2 · Der Spiegel der Erzählung',
      auditQuest3: 'Quest 3 · Der kulturelle Nordstern',
      pipeOn: 'Aktiv',
      pipeOff: 'Aus',
      disconnected: 'Getrennte Leitungen',
      noConstellation: 'Noch kein aufleuchtendes Sternbild.',
      live3dOff: 'Live-3D ist deaktiviert.',
      fallback3d: '3D-Ersatzmodus.',
      orbitTitle: 'Life-Sustainability Orbit',
      anchorTitle: 'Career Anchor vs Drift',
      mirrorTitle: 'The Narrative Mirror',
      northstarTitle: 'The Cultural Northstar',
      alignmentLabel: 'Kulturelle Passung',
      mismatchLabel: 'Abweichung',
      timeRing: 'Zeitring',
      energyRing: 'Energiering',
      sustainability: 'Nachhaltigkeit',
      drift: 'Drift',
      premiumBadge: 'Premium',
      happinessTitle: 'Personal Happiness Audit (Premium)',
      happinessSubtitle: 'Life-Sustainability Orbit + Career Anchor vs Drift',
      live3dOn: 'Live-3D: an',
      live3dOffButton: 'Live-3D: aus',
      premiumRequired: 'Der Happiness Audit ist nur in Premium verfügbar.',
      quest1Body: 'Wenn Sie Ihren monatlichen Kontoauszug ansehen und die Zeit im Stau abziehen, wie viel Energie bleibt Ihnen real für die Dinge, die Sie ausmachen?',
      quest2Body: 'Wenn Sie alle formellen Buzzwords aus Ihrem Lebenslauf löschen würden: Welcher Moment Ihrer Laufbahn war der, in dem Sie unaufhaltbar waren und genau das getan haben, was Sie am besten können?',
      quest3Body: 'Stellen Sie sich vor, Ihre Führungskraft macht einen gravierenden Fehler. Welche Reaktion des Unternehmens passt eher zu Ihnen: eine ehrliche Entschuldigung oder eine stille Prozesskorrektur?',
      commute: 'Pendeln',
      taxes: 'Steuern',
      fixedCosts: 'Fixkosten',
      storyPlaceholder: 'Erzählen Sie Ihre Geschichte...',
      individualVsTeam: 'Individualismus ↔ Team',
      chaosVsStructure: 'Chaos ↔ Struktur',
      companyOffNorth: 'Das aktuelle Unternehmen liegt um {{value}} % neben Ihrem Nordstern.',
      simulating: 'Simulation läuft...',
      auditOutput: 'Audit-Ergebnis',
      advisoryDisclaimer: 'Dies ist nur Orientierung. Die finale Entscheidung bleibt bei Ihnen.',
      monthlyGrossSalary: 'Monatliches Bruttogehalt',
      monthlyCommuteCost: 'Monatliche Pendelkosten',
      homeOfficeDays: 'Homeoffice-Tage / Woche',
      commuteMinutes: 'Pendeln in Minuten pro Tag',
      subjectiveEnergy: 'Subjektive Energie',
      roleDrift: 'Rollen-Drift-Indikator',
      minutesPerDay: 'Min./Tag',
      pushActive: 'aktiv',
      pushInactive: 'inaktiv',
      newPassword: 'Neues Passwort',
      confirmNewPassword: 'Passwort bestätigen',
      setNewPassword: 'Neues Passwort setzen',
    },
    at: {
      premiumLifeContext: 'Premium schaltet Lebenskontext, Mobilität, Benefits und feinere Feed-Defaults frei.',
      freePlanLine: 'Im Free-Tarif bleiben Bereich und Zielrolle kostenlos. Premium ergänzt Lebenskontext, bevorzugte Mobilität, Benefits und eine tiefere Entscheidungsebene.',
      auditQuest1: 'Quest 1 · Das Leck der Ressourcen',
      auditQuest2: 'Quest 2 · Der Spiegel der Erzählung',
      auditQuest3: 'Quest 3 · Der kulturelle Nordstern',
      pipeOn: 'Aktiv',
      pipeOff: 'Aus',
      disconnected: 'Getrennte Leitungen',
      noConstellation: 'Noch kein aufleuchtendes Sternbild.',
      live3dOff: 'Live-3D ist deaktiviert.',
      fallback3d: '3D-Ersatzmodus.',
      orbitTitle: 'Life-Sustainability Orbit',
      anchorTitle: 'Career Anchor vs Drift',
      mirrorTitle: 'The Narrative Mirror',
      northstarTitle: 'The Cultural Northstar',
      alignmentLabel: 'Kulturelle Passung',
      mismatchLabel: 'Abweichung',
      timeRing: 'Zeitring',
      energyRing: 'Energiering',
      sustainability: 'Nachhaltigkeit',
      drift: 'Drift',
      premiumBadge: 'Premium',
      happinessTitle: 'Personal Happiness Audit (Premium)',
      happinessSubtitle: 'Life-Sustainability Orbit + Career Anchor vs Drift',
      live3dOn: 'Live-3D: an',
      live3dOffButton: 'Live-3D: aus',
      premiumRequired: 'Der Happiness Audit ist nur in Premium verfügbar.',
      quest1Body: 'Wenn Sie Ihren monatlichen Kontoauszug ansehen und die Zeit im Stau abziehen, wie viel Energie bleibt Ihnen real für die Dinge, die Sie ausmachen?',
      quest2Body: 'Wenn Sie alle formellen Buzzwords aus Ihrem Lebenslauf löschen würden: Welcher Moment Ihrer Laufbahn war der, in dem Sie unaufhaltbar waren und genau das getan haben, was Sie am besten können?',
      quest3Body: 'Stellen Sie sich vor, Ihre Führungskraft macht einen gravierenden Fehler. Welche Reaktion des Unternehmens passt eher zu Ihnen: eine ehrliche Entschuldigung oder eine stille Prozesskorrektur?',
      commute: 'Pendeln',
      taxes: 'Steuern',
      fixedCosts: 'Fixkosten',
      storyPlaceholder: 'Erzählen Sie Ihre Geschichte...',
      individualVsTeam: 'Individualismus ↔ Team',
      chaosVsStructure: 'Chaos ↔ Struktur',
      companyOffNorth: 'Das aktuelle Unternehmen liegt um {{value}} % neben Ihrem Nordstern.',
      simulating: 'Simulation läuft...',
      auditOutput: 'Audit-Ergebnis',
      advisoryDisclaimer: 'Dies ist nur Orientierung. Die finale Entscheidung bleibt bei Ihnen.',
      monthlyGrossSalary: 'Monatliches Bruttogehalt',
      monthlyCommuteCost: 'Monatliche Pendelkosten',
      homeOfficeDays: 'Homeoffice-Tage / Woche',
      commuteMinutes: 'Pendeln in Minuten pro Tag',
      subjectiveEnergy: 'Subjektive Energie',
      roleDrift: 'Rollen-Drift-Indikator',
      minutesPerDay: 'Min./Tag',
      pushActive: 'aktiv',
      pushInactive: 'inaktiv',
      newPassword: 'Neues Passwort',
      confirmNewPassword: 'Passwort bestätigen',
      setNewPassword: 'Neues Passwort setzen',
    },
    pl: {
      premiumLifeContext: 'Premium odblokowuje kontekst życiowy, transport, benefity i dokładniejsze ustawienia feedu.',
      freePlanLine: 'W planie free bezpłatnie zostają Twoja branża i docelowa rola. Premium dodaje kontekst życiowy, preferowany transport, benefity i głębszą warstwę decyzyjną.',
      auditQuest1: 'Quest 1 · Wyciek zasobów',
      auditQuest2: 'Quest 2 · Lustro narracji',
      auditQuest3: 'Quest 3 · Kulturowa północ',
      pipeOn: 'Włączone',
      pipeOff: 'Wyłączone',
      disconnected: 'Odłączone rury',
      noConstellation: 'Na razie bez rozświetlonego gwiazdozbioru.',
      live3dOff: 'Live 3D jest wyłączone.',
      fallback3d: 'Tryb zastępczy 3D.',
      orbitTitle: 'Orbita życiowej trwałości',
      anchorTitle: 'Career Anchor vs Drift',
      mirrorTitle: 'Narrative Mirror',
      northstarTitle: 'Cultural Northstar',
      alignmentLabel: 'Dopasowanie kulturowe',
      mismatchLabel: 'niedopasowanie',
      timeRing: 'Pierścień czasu',
      energyRing: 'Pierścień energii',
      sustainability: 'Trwałość',
      drift: 'Drift',
      premiumBadge: 'Premium',
      happinessTitle: 'Personal Happiness Audit (Premium)',
      happinessSubtitle: 'Orbita życiowej trwałości + kotwica kariery vs drift',
      live3dOn: 'Live 3D: włączone',
      live3dOffButton: 'Live 3D: wyłączone',
      premiumRequired: 'Happiness audit jest dostępny tylko w Premium.',
      quest1Body: 'Gdy spojrzysz na swój miesięczny wyciąg z konta i odejmiesz czas spędzony w korkach, ile energii realnie zostaje Ci na rzeczy, które Cię definiują?',
      quest2Body: 'Gdyby usunąć wszystkie formalne buzzwordy z Twojego CV, który moment kariery był tym, w którym czułeś_aś się nie do zatrzymania i robiłeś_aś dokładnie to, co umiesz najlepiej?',
      quest3Body: 'Wyobraź sobie, że Twój szef popełnia poważny błąd. Która reakcja firmy jest Ci bliższa: szczere przeprosiny czy cicha korekta procesu?',
      commute: 'Dojazd',
      taxes: 'Podatki',
      fixedCosts: 'Koszty stałe',
      storyPlaceholder: 'Opowiedz swoją historię...',
      individualVsTeam: 'Indywidualizm ↔ Zespół',
      chaosVsStructure: 'Chaos ↔ Struktura',
      companyOffNorth: 'Obecna firma jest oddalona od północy o {{value}}%.',
      simulating: 'Symulacja...',
      auditOutput: 'Wynik audytu',
      advisoryDisclaimer: 'To tylko wskazówka. Ostateczna decyzja należy do Ciebie.',
      monthlyGrossSalary: 'Miesięczne wynagrodzenie brutto',
      monthlyCommuteCost: 'Miesięczny koszt dojazdu',
      homeOfficeDays: 'Dni home office / tydzień',
      commuteMinutes: 'Minuty dojazdu dziennie',
      subjectiveEnergy: 'Subiektywna energia',
      roleDrift: 'Wskaźnik dryfu roli',
      minutesPerDay: 'min/dzień',
      pushActive: 'aktywne',
      pushInactive: 'nieaktywne',
      newPassword: 'Nowe hasło',
      confirmNewPassword: 'Potwierdzenie hasła',
      setNewPassword: 'Ustaw nowe hasło',
    },
    en: {
      premiumLifeContext: 'Premium unlocks life-context setup, transport preferences, benefits and finer feed defaults.',
      freePlanLine: 'The free plan keeps your domain and target role. Premium adds life-context setup, transport preferences, benefits and a deeper decision layer.',
      auditQuest1: 'Quest 1 · The Resource Leak',
      auditQuest2: 'Quest 2 · The Narrative Mirror',
      auditQuest3: 'Quest 3 · The Cultural Northstar',
      pipeOn: 'Pipe ON',
      pipeOff: 'Pipe OFF',
      disconnected: 'Disconnected pipes',
      noConstellation: 'No illuminated constellation yet.',
      live3dOff: 'Live 3D disabled.',
      fallback3d: '3D fallback mode.',
      orbitTitle: 'Life-Sustainability Orbit',
      anchorTitle: 'Career Anchor vs Drift',
      mirrorTitle: 'The Narrative Mirror',
      northstarTitle: 'The Cultural Northstar',
      alignmentLabel: 'Cultural alignment',
      mismatchLabel: 'mismatch',
      timeRing: 'Time ring',
      energyRing: 'Energy ring',
      sustainability: 'Sustainability',
      drift: 'Drift',
      premiumBadge: 'Premium',
      happinessTitle: 'Personal Happiness Audit (Premium)',
      happinessSubtitle: 'Life-Sustainability Orbit + Career Anchor vs Drift',
      live3dOn: 'Live 3D: on',
      live3dOffButton: 'Live 3D: off',
      premiumRequired: 'The happiness audit is available in Premium only.',
      quest1Body: 'When you look at your monthly bank statement and subtract the time spent in traffic, how much energy is actually left for the things that define you?',
      quest2Body: 'If you removed all formal buzzwords from your resume, which moment in your career was the one where you felt unstoppable and were doing exactly what you do best?',
      quest3Body: 'Imagine your manager makes a serious mistake. Which company reaction feels more right to you: an honest apology or a quiet process fix?',
      commute: 'Commute',
      taxes: 'Taxes',
      fixedCosts: 'Fixed costs',
      storyPlaceholder: 'Dictate your story...',
      individualVsTeam: 'Individualism ↔ Team',
      chaosVsStructure: 'Chaos ↔ Structure',
      companyOffNorth: 'Your current company is {{value}}% off your north star.',
      simulating: 'Simulating...',
      auditOutput: 'Audit output',
      advisoryDisclaimer: 'This is guidance only. The final decision remains yours.',
      monthlyGrossSalary: 'Monthly gross salary',
      monthlyCommuteCost: 'Monthly commute cost',
      homeOfficeDays: 'Home office days / week',
      commuteMinutes: 'Commute minutes per day',
      subjectiveEnergy: 'Subjective energy',
      roleDrift: 'Role drift indicator',
      minutesPerDay: 'min/day',
      pushActive: 'active',
      pushInactive: 'inactive',
      newPassword: 'New password',
      confirmNewPassword: 'Confirm new password',
      setNewPassword: 'Set new password',
    }
  } as const)[profileLocale];
  const searchProfileCopy = ({
    cs: {
      title: 'Výchozí nastavení hledání',
      intro: 'Nastavte hledání tak, aby odpovídalo vaší skutečné situaci: typu práce, dojíždění, rodině, psům i benefitům, na kterých vám opravdu záleží.',
      nearBorder: 'Chci snadno hledat i přes hranice',
      contractor: 'Primárně hledám práci na IČO / živnost',
      dogFriendly: 'Chci upřednostňovat kanceláře, kam mohou psi',
      childFriendly: 'Potřebuji role vhodné pro rodiče',
      avoidShift: 'Chci se vyhýbat směnnému a nočnímu provozu',
      remote: 'Chci mít připravené hledání práce na dálku',
      workArrangement: 'Preferovaný režim práce',
      remoteOption: 'Remote',
      hybridOption: 'Hybrid',
      onsiteOption: 'Na místě',
      languages: 'Jazyky nabídky',
      commuteTitle: 'Dojíždění a způsob dopravy',
      commuteIntro: 'Toto nastavení se použije při výchozím filtrování dojezdu a při vyhodnocení, zda je nabídka z hlediska cesty pro vás reálně zvládnutelná.',
      commuteOrigin: 'Výchozí adresa pro dojíždění',
      commuteOriginMissing: 'Adresa zatím chybí. Doplňte ji v osobních údajích, aby šel dojezd počítat správně.',
      commuteToggle: 'Používat dojíždění jako výchozí filtr',
      commuteRadius: 'Výchozí vzdálenost dojezdu',
      benefitPriorities: 'Další benefity důležité pro vaši situaci',
      activeSignals: 'Aktivní preference',
      impactTitle: 'Kde se to projeví',
      impactMarketplace: 'Přednastavená hledání',
      impactSaved: 'Uložená hledání',
      impactFeed: 'Váš hlavní přehled nabídek',
      helper: 'Tyto preference se promítnou do přednastavených hledání, uložených filtrů i hlavního přehledu nabídek.',
    },
    sk: {
      title: 'Predvolené nastavenie hľadania',
      intro: 'Nastavte hľadanie tak, aby zodpovedalo vašej skutočnej situácii: typu práce, dochádzaniu, rodine, psom aj benefitom, na ktorých vám naozaj záleží.',
      nearBorder: 'Chcem jednoducho hľadať aj cez hranice',
      contractor: 'Primárne hľadám prácu na živnosť / kontrakt',
      dogFriendly: 'Chcem uprednostňovať kancelárie, kam môžu psy',
      childFriendly: 'Potrebujem roly vhodné pre rodičov',
      avoidShift: 'Chcem sa vyhýbať zmenovej a nočnej prevádzke',
      remote: 'Chcem mať pripravené hľadanie práce na diaľku',
      workArrangement: 'Preferovaný režim práce',
      remoteOption: 'Remote',
      hybridOption: 'Hybrid',
      onsiteOption: 'Na mieste',
      languages: 'Jazyky ponuky',
      commuteTitle: 'Dochádzanie a spôsob dopravy',
      commuteIntro: 'Toto nastavenie sa použije pri predvolenom filtrovaní dochádzania a pri vyhodnotení, či je ponuka z pohľadu cesty pre vás reálne zvládnuteľná.',
      commuteOrigin: 'Východisková adresa pre dochádzanie',
      commuteOriginMissing: 'Adresa zatiaľ chýba. Doplňte ju v osobných údajoch, aby sa dochádzanie dalo počítať správne.',
      commuteToggle: 'Používať dochádzanie ako predvolený filter',
      commuteRadius: 'Predvolená vzdialenosť dochádzania',
      benefitPriorities: 'Ďalšie benefity dôležité pre vašu situáciu',
      activeSignals: 'Aktívne preferencie',
      impactTitle: 'Kde sa to prejaví',
      impactMarketplace: 'Prednastavené hľadania',
      impactSaved: 'Uložené hľadania',
      impactFeed: 'Váš hlavný prehľad ponúk',
      helper: 'Tieto preferencie sa premietnu do prednastavených hľadaní, uložených filtrov aj hlavného prehľadu ponúk.',
    },
    de: {
      title: 'Suchvorgaben',
      intro: 'Stellen Sie die Suche so ein, dass sie Ihrer realen Situation entspricht: Arbeitsmodell, Pendeln, Familie, Hunde und Benefits, die Ihnen wirklich wichtig sind.',
      nearBorder: 'Ich möchte auch grenznah und grenzüberschreitend suchen können',
      contractor: 'Ich suche primär nach Freelance- / Vertragsrollen',
      dogFriendly: 'Hundefreundliche Büros bevorzugen',
      childFriendly: 'Ich brauche familienfreundliche Rollen',
      avoidShift: 'Schicht- und Nachtdienste vermeiden',
      remote: 'Ein Remote-Preset bereithalten',
      workArrangement: 'Bevorzugtes Arbeitsmodell',
      remoteOption: 'Remote',
      hybridOption: 'Hybrid',
      onsiteOption: 'Vor Ort',
      languages: 'Sprachen der Anzeige',
      commuteTitle: 'Pendeln und Verkehrsmittel',
      commuteIntro: 'Diese Einstellung wird für den Standard-Pendelfilter und für die Einschätzung verwendet, ob ein Angebot realistisch erreichbar ist.',
      commuteOrigin: 'Startadresse für Pendeln',
      commuteOriginMissing: 'Ihre Adresse fehlt noch. Ergänzen Sie sie in den persönlichen Angaben, damit das Pendeln korrekt berechnet werden kann.',
      commuteToggle: 'Pendeln als Standardfilter verwenden',
      commuteRadius: 'Standard-Pendelradius',
      benefitPriorities: 'Weitere Benefits, die zu Ihrer Situation passen',
      activeSignals: 'Aktive Präferenzen',
      impactTitle: 'Wo sich das auswirkt',
      impactMarketplace: 'Marketplace-Vorgaben',
      impactSaved: 'Gespeicherte Suchen',
      impactFeed: 'Ihr Hauptfeed',
      helper: 'Diese Präferenzen fließen in Marketplace-Vorgaben, gespeicherte Suchen und Ihren Hauptfeed ein.',
    },
    at: {
      title: 'Suchvorgaben',
      intro: 'Stellen Sie die Suche so ein, dass sie Ihrer realen Situation entspricht: Arbeitsmodell, Pendeln, Familie, Hunde und Benefits, die Ihnen wirklich wichtig sind.',
      nearBorder: 'Ich möchte auch grenznah und grenzüberschreitend suchen können',
      contractor: 'Ich suche primär nach Freelance- / Vertragsrollen',
      dogFriendly: 'Hundefreundliche Büros bevorzugen',
      childFriendly: 'Ich brauche familienfreundliche Rollen',
      avoidShift: 'Schicht- und Nachtdienste vermeiden',
      remote: 'Ein Remote-Preset bereithalten',
      workArrangement: 'Bevorzugtes Arbeitsmodell',
      remoteOption: 'Remote',
      hybridOption: 'Hybrid',
      onsiteOption: 'Vor Ort',
      languages: 'Sprachen der Anzeige',
      commuteTitle: 'Pendeln und Verkehrsmittel',
      commuteIntro: 'Diese Einstellung wird für den Standard-Pendelfilter und für die Einschätzung verwendet, ob ein Angebot realistisch erreichbar ist.',
      commuteOrigin: 'Startadresse für Pendeln',
      commuteOriginMissing: 'Ihre Adresse fehlt noch. Ergänzen Sie sie in den persönlichen Angaben, damit das Pendeln korrekt berechnet werden kann.',
      commuteToggle: 'Pendeln als Standardfilter verwenden',
      commuteRadius: 'Standard-Pendelradius',
      benefitPriorities: 'Weitere Benefits, die zu Ihrer Situation passen',
      activeSignals: 'Aktive Präferenzen',
      impactTitle: 'Wo sich das auswirkt',
      impactMarketplace: 'Marketplace-Vorgaben',
      impactSaved: 'Gespeicherte Suchen',
      impactFeed: 'Ihr Hauptfeed',
      helper: 'Diese Präferenzen fließen in Marketplace-Vorgaben, gespeicherte Suchen und Ihren Hauptfeed ein.',
    },
    pl: {
      title: 'Ustawienia wyszukiwania',
      intro: 'Ustaw wyszukiwanie tak, aby odpowiadało Twojej realnej sytuacji: modelowi pracy, dojazdom, rodzinie, psom i benefitom, które naprawdę mają znaczenie.',
      nearBorder: 'Chcę łatwo szukać także po drugiej stronie granicy',
      contractor: 'Szukam głównie ofert B2B / kontraktowych',
      dogFriendly: 'Preferuj biura przyjazne psom',
      childFriendly: 'Potrzebuję ról przyjaznych rodzicom',
      avoidShift: 'Unikaj pracy zmianowej i nocnej',
      remote: 'Miej gotowy preset pod pracę zdalną',
      workArrangement: 'Preferowany tryb pracy',
      remoteOption: 'Remote',
      hybridOption: 'Hybryda',
      onsiteOption: 'Na miejscu',
      languages: 'Języki ogłoszenia',
      commuteTitle: 'Dojazd i środek transportu',
      commuteIntro: 'To ustawienie będzie używane przy domyślnym filtrowaniu dojazdu i przy ocenie, czy oferta jest realnie osiągalna.',
      commuteOrigin: 'Adres startowy dojazdu',
      commuteOriginMissing: 'Brakuje adresu. Uzupełnij go w danych osobowych, aby dojazd był liczony poprawnie.',
      commuteToggle: 'Używaj dojazdu jako domyślnego filtra',
      commuteRadius: 'Domyślny promień dojazdu',
      benefitPriorities: 'Dodatkowe benefity ważne w mojej sytuacji',
      activeSignals: 'Aktywne preferencje',
      impactTitle: 'Gdzie to działa',
      impactMarketplace: 'Presety marketplace',
      impactSaved: 'Zapisane wyszukiwania',
      impactFeed: 'Mój feed',
      helper: 'Te preferencje trafiają do presetów marketplace, zapisanych wyszukiwań i głównego feedu.',
    },
    en: {
      title: 'Search setup',
      intro: 'Set search defaults around the actual reality of your life: work mode, commute, family context, dogs, and benefits that matter.',
      nearBorder: 'I live near a border and want cross-border search to stay easy',
      contractor: 'I primarily want contractor / self-employed roles',
      dogFriendly: 'Prefer dog-friendly offices',
      childFriendly: 'I need parent-friendly / child-friendly roles',
      avoidShift: 'Avoid shift-based and night roles',
      remote: 'Keep a remote-focused preset ready',
      workArrangement: 'Preferred work arrangement',
      remoteOption: 'Remote',
      hybridOption: 'Hybrid',
      onsiteOption: 'On-site',
      languages: 'Listing languages',
      commuteTitle: 'Commute and transport mode',
      commuteIntro: 'This becomes part of your commute preset and marketplace reality checks.',
      commuteOrigin: 'Starting address for commute',
      commuteOriginMissing: 'Your address is missing. Add it in personal details so commute can be calculated correctly.',
      commuteToggle: 'Use commute as a default filter',
      commuteRadius: 'Default commute radius',
      benefitPriorities: 'Additional benefits relevant to my situation',
      activeSignals: 'Active signals',
      impactTitle: 'Where this applies',
      impactMarketplace: 'Marketplace presets',
      impactSaved: 'Saved searches',
      impactFeed: 'My feed',
      helper: 'These preferences feed marketplace presets, saved searches, and your main overview.',
    }
  } as const)[profileLocale];
  const intentProfileCopy = ({
    cs: {
      title: 'Můj obor a role',
      intro: 'Tahle část určuje, co má být v přehledu opravdu vaše. Nejdřív obor a cílová role, až potom životní filtry.',
      primaryDomain: 'Hlavní obor',
      secondaryDomains: 'Příbuzné obory',
      avoidDomains: 'Vyhnout se těmto oborům',
      avoidDomainsHint: 'Použijte pro směry, kam už nechcete padat ani jako širší přesah.',
      targetRole: 'Cílová role',
      targetRolePlaceholder: 'Např. Product Manager, Recepční, Finanční účetní',
      seniority: 'Seniorita',
      includeAdjacent: 'Zobrazovat i příbuzné role',
      inferredTitle: 'Odhad podle CV a historie',
      inferredBody: 'Systém našel pravděpodobný obor a cílovou roli. Můžete je jedním klikem použít do svého feedu.',
      useSuggestion: 'Použít návrh',
      manualWins: 'Ruční nastavení má vždy přednost před automatickým odhadem.',
      none: 'Bez omezení',
      activeIntent: 'Aktivní směr',
    },
    sk: {
      title: 'Môj odbor a rola',
      intro: 'Táto časť určuje, čo má byť v prehľade naozaj vaše. Najprv odbor a cieľová rola, až potom životné filtre.',
      primaryDomain: 'Hlavný odbor',
      secondaryDomains: 'Príbuzné odbory',
      avoidDomains: 'Vyhnúť sa týmto odborom',
      avoidDomainsHint: 'Použite pre smery, kam už nechcete padať ani ako širší presah.',
      targetRole: 'Cieľová rola',
      targetRolePlaceholder: 'Napr. Product Manager, Recepčná, Finančná účtovníčka',
      seniority: 'Seniorita',
      includeAdjacent: 'Zobrazovať aj príbuzné roly',
      inferredTitle: 'Odhad podľa CV a histórie',
      inferredBody: 'Systém našiel pravdepodobný odbor a cieľovú rolu. Môžete ich jedným klikom použiť vo svojom feede.',
      useSuggestion: 'Použiť návrh',
      manualWins: 'Ručné nastavenie má vždy prednosť pred automatickým odhadom.',
      none: 'Bez obmedzenia',
      activeIntent: 'Aktívny smer',
    },
    de: {
      title: 'Mein Bereich und meine Rolle',
      intro: 'Dieser Bereich entscheidet, was sich im Feed wirklich nach Ihnen anfühlen soll: zuerst Fachbereich und Zielrolle, dann Lebenskontext-Filter.',
      primaryDomain: 'Hauptbereich',
      secondaryDomains: 'Verwandte Bereiche',
      avoidDomains: 'Diese Bereiche vermeiden',
      avoidDomainsHint: 'Nutzen Sie das für Richtungen, in die Sie auch als breiter Stretch nicht mehr rutschen wollen.',
      targetRole: 'Zielrolle',
      targetRolePlaceholder: 'Zum Beispiel Product Manager, Rezeption, Finanzbuchhaltung',
      seniority: 'Seniorität',
      includeAdjacent: 'Auch verwandte Rollen anzeigen',
      inferredTitle: 'Erkannt aus CV und Verlauf',
      inferredBody: 'Das System hat einen wahrscheinlichen Bereich und eine Zielrolle erkannt. Sie können den Vorschlag mit einem Klick für Ihren Feed übernehmen.',
      useSuggestion: 'Vorschlag verwenden',
      manualWins: 'Manuelle Einstellungen haben immer Vorrang vor der automatischen Schätzung.',
      none: 'Keine Einschränkung',
      activeIntent: 'Aktive Richtung',
    },
    at: {
      title: 'Mein Bereich und meine Rolle',
      intro: 'Dieser Bereich entscheidet, was sich im Feed wirklich nach Ihnen anfühlen soll: zuerst Fachbereich und Zielrolle, dann Lebenskontext-Filter.',
      primaryDomain: 'Hauptbereich',
      secondaryDomains: 'Verwandte Bereiche',
      targetRole: 'Zielrolle',
      targetRolePlaceholder: 'Zum Beispiel Product Manager, Rezeption, Finanzbuchhaltung',
      seniority: 'Seniorität',
      includeAdjacent: 'Auch verwandte Rollen anzeigen',
      inferredTitle: 'Erkannt aus CV und Verlauf',
      inferredBody: 'Das System hat einen wahrscheinlichen Bereich und eine Zielrolle erkannt. Sie können den Vorschlag mit einem Klick für Ihren Feed übernehmen.',
      useSuggestion: 'Vorschlag verwenden',
      manualWins: 'Manuelle Einstellungen haben immer Vorrang vor der automatischen Schätzung.',
      none: 'Keine Einschränkung',
      activeIntent: 'Aktive Richtung',
    },
    pl: {
      title: 'Mój obszar i rola',
      intro: 'Ta sekcja decyduje, co naprawdę powinno być „Twoim” feedem: najpierw obszar i rola docelowa, dopiero potem filtry życiowe.',
      primaryDomain: 'Główny obszar',
      secondaryDomains: 'Powiązane obszary',
      avoidDomains: 'Unikaj tych obszarów',
      avoidDomainsHint: 'Użyj tego dla kierunków, do których nie chcesz już wpadać nawet jako szeroki overlap.',
      targetRole: 'Rola docelowa',
      targetRolePlaceholder: 'Na przykład Product Manager, Recepcjonista, Księgowa',
      seniority: 'Poziom seniority',
      includeAdjacent: 'Pokazuj też role pokrewne',
      inferredTitle: 'Wykryto na podstawie CV i historii',
      inferredBody: 'System wykrył prawdopodobny obszar i rolę docelową. Możesz użyć tej sugestii w feedzie jednym kliknięciem.',
      useSuggestion: 'Użyj sugestii',
      manualWins: 'Ręczne ustawienia zawsze mają pierwszeństwo przed automatycznym oszacowaniem.',
      none: 'Bez ograniczeń',
      activeIntent: 'Aktywny kierunek',
    },
    en: {
      title: 'My domain and role',
      intro: 'This section decides what should actually feel like your feed: first domain and target role, then life-context filters.',
      primaryDomain: 'Primary domain',
      secondaryDomains: 'Adjacent domains',
      avoidDomains: 'Avoid these domains',
      avoidDomainsHint: 'Use this for directions you no longer want surfacing even as a broader overlap.',
      targetRole: 'Target role',
      targetRolePlaceholder: 'For example Product Manager, Receptionist, Financial Accountant',
      seniority: 'Seniority',
      includeAdjacent: 'Show adjacent roles too',
      inferredTitle: 'Detected from CV and history',
      inferredBody: 'The system detected a likely domain and target role. You can use them for your feed with one click.',
      useSuggestion: 'Use suggestion',
      manualWins: 'Manual setup always overrides the automatic estimate.',
      none: 'No limit',
      activeIntent: 'Active direction',
    }
  } as const)[profileLocale];
  const remoteLanguageOptions: Array<{ code: SearchLanguageCode; label: string }> = [
    { code: 'cs', label: getProfileLocaleLabel({ cs: 'Čeština', sk: 'Čeština', de: 'Tschechisch', at: 'Tschechisch', pl: 'Czeski', en: 'Czech' }, profileLocale) },
    { code: 'en', label: getProfileLocaleLabel({ cs: 'Angličtina', sk: 'Angličtina', de: 'Englisch', at: 'Englisch', pl: 'Angielski', en: 'English' }, profileLocale) },
    { code: 'de', label: getProfileLocaleLabel({ cs: 'Němčina', sk: 'Nemčina', de: 'Deutsch', at: 'Deutsch', pl: 'Niemiecki', en: 'German' }, profileLocale) },
    { code: 'sk', label: getProfileLocaleLabel({ cs: 'Slovenština', sk: 'Slovenčina', de: 'Slowakisch', at: 'Slowakisch', pl: 'Słowacki', en: 'Slovak' }, profileLocale) },
    { code: 'pl', label: getProfileLocaleLabel({ cs: 'Polština', sk: 'Poľština', de: 'Polnisch', at: 'Polnisch', pl: 'Polski', en: 'Polish' }, profileLocale) },
  ];
  const searchBenefitOptions: Array<{ key: string; label: string }> = [
    { key: 'childcare_support', label: getProfileLocaleLabel({ cs: 'Podpora péče o děti', sk: 'Podpora starostlivosti o deti', de: 'Kinderbetreuung', at: 'Kinderbetreuung', pl: 'Wsparcie opieki nad dziećmi', en: 'Childcare support' }, profileLocale) },
    { key: 'child_friendly', label: getProfileLocaleLabel({ cs: 'Pro rodiče', sk: 'Pre rodičov', de: 'Familienfreundlich', at: 'Familienfreundlich', pl: 'Przyjazne rodzicom', en: 'Child-friendly environment' }, profileLocale) },
    { key: 'home_office', label: getProfileLocaleLabel({ cs: 'Home office', sk: 'Home office', de: 'Homeoffice', at: 'Homeoffice', pl: 'Home office', en: 'Home office' }, profileLocale) },
    { key: 'flex_time', label: getProfileLocaleLabel({ cs: 'Flexibilní režim', sk: 'Flexibilný režim', de: 'Flexible Zeiten', at: 'Flexible Zeiten', pl: 'Elastyczny czas', en: 'Flexible schedule' }, profileLocale) },
    { key: 'meal_allowance', label: getProfileLocaleLabel({ cs: 'Stravování', sk: 'Stravovanie', de: 'Verpflegung', at: 'Verpflegung', pl: 'Posiłki', en: 'Meals' }, profileLocale) },
    { key: 'transport_support', label: getProfileLocaleLabel({ cs: 'Doprava / parkování', sk: 'Doprava / parkovanie', de: 'Transport / Parken', at: 'Transport / Parken', pl: 'Dojazd / parking', en: 'Transport / parking' }, profileLocale) },
    { key: 'health_care', label: getProfileLocaleLabel({ cs: 'Zdravotní péče', sk: 'Zdravotná starostlivosť', de: 'Gesundheitsbenefity', at: 'Gesundheitsbenefity', pl: 'Opieka zdrowotna', en: 'Healthcare' }, profileLocale) },
    { key: 'pension', label: getProfileLocaleLabel({ cs: 'Penzijko / spoření', sk: 'Dôchodok / sporenie', de: 'Vorsorge / Pension', at: 'Vorsorge / Pension', pl: 'Emerytura / oszczędzanie', en: 'Pension / retirement' }, profileLocale) },
    { key: 'vacation_5w', label: getProfileLocaleLabel({ cs: 'Extra dovolená', sk: 'Extra dovolenka', de: 'Mehr Urlaub', at: 'Mehr Urlaub', pl: 'Dodatkowy urlop', en: 'Extra vacation' }, profileLocale) },
    { key: 'education', label: getProfileLocaleLabel({ cs: 'Vzdělávání', sk: 'Vzdelávanie', de: 'Weiterbildung', at: 'Weiterbildung', pl: 'Rozwój / szkolenia', en: 'Education' }, profileLocale) },
    { key: 'multisport', label: getProfileLocaleLabel({ cs: 'Sport / wellness', sk: 'Šport / wellness', de: 'Sport / Wellness', at: 'Sport / Wellness', pl: 'Sport / wellness', en: 'Sport / wellness' }, profileLocale) },
    { key: 'car_personal', label: getProfileLocaleLabel({ cs: 'Služební auto', sk: 'Služobné auto', de: 'Firmenwagen', at: 'Firmenwagen', pl: 'Samochód służbowy', en: 'Company car' }, profileLocale) },
  ];
  const intentDomainOptions = getCandidateIntentDomainOptions(i18n.language || 'cs');
  const seniorityOptions: Array<{ key: CandidateSeniority; label: string }> = [
    { key: 'entry', label: getProfileLocaleLabel({ cs: 'Entry / trainee', sk: 'Entry / trainee', de: 'Einstieg / Trainee', at: 'Einstieg / Trainee', pl: 'Entry / trainee', en: 'Entry / trainee' }, profileLocale) },
    { key: 'junior', label: getProfileLocaleLabel({ cs: 'Junior', sk: 'Junior', de: 'Junior', at: 'Junior', pl: 'Junior', en: 'Junior' }, profileLocale) },
    { key: 'medior', label: getProfileLocaleLabel({ cs: 'Medior', sk: 'Medior', de: 'Mittelstufe', at: 'Mittelstufe', pl: 'Mid', en: 'Mid-level' }, profileLocale) },
    { key: 'senior', label: getProfileLocaleLabel({ cs: 'Senior', sk: 'Senior', de: 'Senior', at: 'Senior', pl: 'Senior', en: 'Senior' }, profileLocale) },
    { key: 'lead', label: getProfileLocaleLabel({ cs: 'Lead / manažer', sk: 'Lead / manažér', de: 'Lead / Management', at: 'Lead / Management', pl: 'Lead / manager', en: 'Lead / manager' }, profileLocale) },
  ];
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePhotoFailed, setProfilePhotoFailed] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [isRepairingPhoto, setIsRepairingPhoto] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('profile');
  const [pendingEvidenceScrollTarget, setPendingEvidenceScrollTarget] = useState<'jcfpm' | null>(null);
  const [isProfileChallengeModalOpen, setIsProfileChallengeModalOpen] = useState(false);
  const [savedJobsSearchTerm, setSavedJobsSearchTerm] = useState('');
  const [savedJobsFallback, setSavedJobsFallback] = useState<Job[]>([]);
  const [solutionSnapshots, setSolutionSnapshots] = useState<SolutionSnapshot[]>([]);
  const [solutionSnapshotsLoading, setSolutionSnapshotsLoading] = useState(false);
  const [showAIGuide, setShowAIGuide] = useState(false);
  const [showIntentNudge, setShowIntentNudge] = useState(false);
  const [editableCvAiText, setEditableCvAiText] = useState(profile.cvAiText || '');
  const [isSavingCvAiText, setIsSavingCvAiText] = useState(false);
  const [effectiveTier, setEffectiveTier] = useState<string | null>(profile.subscription?.tier || null);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default');
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ nextPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [publishedMiniChallenges, setPublishedMiniChallenges] = useState<Job[]>([]);
  const [publishedMiniChallengesLoading, setPublishedMiniChallengesLoading] = useState(false);
  const [publishedMiniChallengesError, setPublishedMiniChallengesError] = useState<string | null>(null);
  const [selectedPublishedMiniChallengeId, setSelectedPublishedMiniChallengeId] = useState<string | null>(null);
  const [selectedPublishedDialogueId, setSelectedPublishedDialogueId] = useState<string | null>(null);
  const [publishedMiniChallengeDialogues, setPublishedMiniChallengeDialogues] = useState<Record<string, CompanyApplicationRow[]>>({});
  const [publishedMiniChallengeDialogueDetail, setPublishedMiniChallengeDialogueDetail] = useState<DialogueDossier | null>(null);
  const [publishedMiniChallengeDialogueLoading, setPublishedMiniChallengeDialogueLoading] = useState(false);
  const [publishedMiniChallengeUpdatingIds, setPublishedMiniChallengeUpdatingIds] = useState<Record<string, boolean>>({});
  const postedMiniChallenges = (Array.isArray(profile.preferences?.postedMiniChallenges)
    ? [...profile.preferences.postedMiniChallenges]
    : []
  )
    .filter((challenge): challenge is UserPostedMiniChallenge => Boolean(challenge?.id && challenge?.title))
    .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime());

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const requestedTab = window.sessionStorage.getItem(PROFILE_INITIAL_TAB_STORAGE_KEY);
      const normalizedTab = normalizeProfileTabKey(requestedTab);
      if (normalizedTab) {
        setActiveTab(normalizedTab);
        if (requestedTab === 'jcfpm') {
          setPendingEvidenceScrollTarget('jcfpm');
        }
      }
      window.sessionStorage.removeItem(PROFILE_INITIAL_TAB_STORAGE_KEY);
    } catch {
      // Ignore storage issues and keep the default profile tab.
    }
  }, []);

  useEffect(() => {
    if (activeTab !== 'evidence' || pendingEvidenceScrollTarget !== 'jcfpm') return;
    const timeoutId = window.setTimeout(() => {
      document.getElementById('profile-jcfpm-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingEvidenceScrollTarget(null);
    }, 120);
    return () => window.clearTimeout(timeoutId);
  }, [activeTab, pendingEvidenceScrollTarget]);

  const loadPublishedMiniChallenges = async (options?: { focusJobId?: string | null }) => {
    if (!profile.isLoggedIn) {
      setPublishedMiniChallenges([]);
      setPublishedMiniChallengeDialogues({});
      setPublishedMiniChallengeDialogueDetail(null);
      return;
    }
    setPublishedMiniChallengesLoading(true);
    setPublishedMiniChallengesError(null);
    try {
      const jobs = await listProfileMiniChallenges();
      setPublishedMiniChallenges(jobs);
      const focusJobId = options?.focusJobId || selectedPublishedMiniChallengeId || jobs[0]?.id || null;
      setSelectedPublishedMiniChallengeId(focusJobId);
      if (focusJobId) {
        const dialogues = await fetchProfileMiniChallengeDialogues(focusJobId);
        setPublishedMiniChallengeDialogues((current) => ({ ...current, [focusJobId]: dialogues }));
        const nextDialogueId = selectedPublishedDialogueId && dialogues.some((item) => item.id === selectedPublishedDialogueId)
          ? selectedPublishedDialogueId
          : dialogues[0]?.id || null;
        setSelectedPublishedDialogueId(nextDialogueId);
        if (nextDialogueId) {
          setPublishedMiniChallengeDialogueLoading(true);
          try {
            const detail = await fetchProfileMiniChallengeDialogueDetail(nextDialogueId);
            setPublishedMiniChallengeDialogueDetail(detail);
          } finally {
            setPublishedMiniChallengeDialogueLoading(false);
          }
        } else {
          setPublishedMiniChallengeDialogueDetail(null);
        }
      } else {
        setSelectedPublishedDialogueId(null);
        setPublishedMiniChallengeDialogueDetail(null);
      }
    } catch (error) {
      console.error('Failed to load published mini challenges:', error);
      setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Failed to load mini challenges.');
    } finally {
      setPublishedMiniChallengesLoading(false);
    }
  };

  const openPublishedMiniChallenge = async (jobId: string) => {
    setSelectedPublishedMiniChallengeId(jobId);
    setPublishedMiniChallengeDialogueLoading(true);
    setPublishedMiniChallengeDialogueDetail(null);
    try {
      const dialogues = await fetchProfileMiniChallengeDialogues(jobId);
      setPublishedMiniChallengeDialogues((current) => ({ ...current, [jobId]: dialogues }));
      const nextDialogueId = dialogues[0]?.id || null;
      setSelectedPublishedDialogueId(nextDialogueId);
      if (nextDialogueId) {
        const detail = await fetchProfileMiniChallengeDialogueDetail(nextDialogueId);
        setPublishedMiniChallengeDialogueDetail(detail);
      }
    } catch (error) {
      console.error('Failed to open mini challenge replies:', error);
      setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Failed to load replies.');
    } finally {
      setPublishedMiniChallengeDialogueLoading(false);
    }
  };

  const openPublishedDialogue = async (dialogueId: string) => {
    setSelectedPublishedDialogueId(dialogueId);
    setPublishedMiniChallengeDialogueLoading(true);
    try {
      const detail = await fetchProfileMiniChallengeDialogueDetail(dialogueId);
      setPublishedMiniChallengeDialogueDetail(detail);
    } catch (error) {
      console.error('Failed to load mini challenge reply detail:', error);
      setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Failed to load reply detail.');
    } finally {
      setPublishedMiniChallengeDialogueLoading(false);
    }
  };

  const setMiniChallengeUpdating = (id: string, value: boolean) => {
    setPublishedMiniChallengeUpdatingIds((current) => ({ ...current, [id]: value }));
  };

  useEffect(() => {
    if (activeTab !== 'challenges' || !profile.isLoggedIn) return;
    void loadPublishedMiniChallenges();
  }, [activeTab, profile.isLoggedIn]);

  const activePublishedMiniChallenges = publishedMiniChallenges.filter((challenge) => {
    const status = String(challenge.status || 'active').toLowerCase();
    return status === 'active' || status === 'paused';
  });
  const closedPublishedMiniChallenges = publishedMiniChallenges.filter((challenge) => {
    const status = String(challenge.status || 'active').toLowerCase();
    return status === 'closed' || status === 'archived';
  });
  const [activeExperienceId, setActiveExperienceId] = useState<string | null>(null);
  const [activeEducationId, setActiveEducationId] = useState<string | null>(null);
  const [happinessAuditInput, setHappinessAuditInput] = useState<HappinessAuditInput>({
    salary: 60000,
    tax_profile: profile.taxProfile,
    commute_minutes_daily: 105,
    commute_cost: 8100,
    work_mode: 'onsite',
    subjective_energy: 45,
    home_office_days: 0,
    role_shift: 55,
  });
  const [happinessAuditOutput, setHappinessAuditOutput] = useState<HappinessAuditOutput | null>(null);
  const [isSimulatingAudit, setIsSimulatingAudit] = useState(false);
  const [enableLive3D, setEnableLive3D] = useState(true);
  const [resourceLeakToggles, setResourceLeakToggles] = useState({
    commute: true,
    taxes: true,
    fixed: true,
  });
  const [narrativeStory, setNarrativeStory] = useState('');
  const [jcfpmSnapshot, setJcfpmSnapshot] = useState<JcfpmSnapshotV1 | null>(
    profile.preferences?.jcfpm_v1 || null
  );
  const jcfpmShareEnabled = profile.preferences?.signal_boost_share_jcfpm !== false;
  const jcfpmShareCopy = getProfileLocaleLabel({
    cs: 'Zpřístupnit zkrácený JCFPM signal recruiterům ve veřejných Signal Boost odkazech',
    sk: 'Sprístupniť skrátený JCFPM signal recruiterom vo verejných Signal Boost odkazoch',
    de: 'Verkürztes JCFPM-Signal für Recruiter in öffentlichen Signal-Boost-Links freigeben',
    at: 'Verkürztes JCFPM-Signal für Recruiter in öffentlichen Signal-Boost-Links freigeben',
    pl: 'Udostępnij skrócony sygnał JCFPM rekruterom w publicznych linkach Signal Boost',
    en: 'Allow recruiters to see a concise JCFPM signal inside public Signal Boost links',
  }, profileLocale);
  const jcfpmShareHintCopy = getProfileLocaleLabel({
    cs: 'Nejde o celý report. Ve veřejném linku se ukáže jen kompaktní profilový signal: archetyp, několik silných stránek, vhodné prostředí a pár nejvýraznějších dimenzí.',
    sk: 'Nejde o celý report. Vo verejnom linku sa ukáže len kompaktný profilový signal: archetyp, niekoľko silných stránok, vhodné prostredie a pár najsilnejších dimenzií.',
    de: 'Es wird nicht der ganze Bericht geteilt. Im öffentlichen Link erscheint nur ein kompaktes Profilsignal: Archetyp, einige Stärken, passendes Umfeld und wenige markante Dimensionen.',
    at: 'Es wird nicht der ganze Bericht geteilt. Im öffentlichen Link erscheint nur ein kompaktes Profilsignal: Archetyp, einige Stärken, passendes Umfeld und wenige markante Dimensionen.',
    pl: 'To nie jest cały raport. W publicznym linku pokaże się tylko zwięzły sygnał profilu: archetyp, kilka mocnych stron, preferowane środowisko i kilka najmocniejszych wymiarów.',
    en: 'This does not share the full report. Public links only show a compact profile signal: archetype, a few strengths, preferred environment, and a few standout dimensions.',
  }, profileLocale);
  const jcfpmReasonLocale = (i18n.language || 'cs').toLowerCase();
  const jcfpmReasonLocaleBase = jcfpmReasonLocale.split('-')[0];
  const translateLegacyJhiReason = (reason?: string) => {
    const value = (reason || '').trim();
    if (!value) return value;
    if (jcfpmReasonLocaleBase !== 'cs') return value;

    const legacyCsMap: Record<string, string> = {
      'Higher D5 (values) increases weight of value alignment in job scoring.':
        'Vyšší D5 (hodnoty) zvyšuje váhu hodnotového souladu při skórování pracovních nabídek.',
      'Combined D3 (motivation) + D6 (AI readiness) drives growth priority.':
        'Kombinace D3 (motivace) + D6 (technologická adaptabilita) posouvá prioritu na profesní růst.',
      'Combined D3 (motivation) + D6 (technology adaptability) drives growth priority.':
        'Kombinace D3 (motivace) + D6 (technologická adaptabilita) posouvá prioritu na profesní růst.',
      'Higher D4 (energy) lowers time-cost penalty; lower D4 raises it.':
        'Vyšší D4 (energie) snižuje penalizaci za časovou náročnost, nižší D4 ji naopak zvyšuje.',
      'Mapped directly from D2 (social orientation).':
        'Mapováno přímo z D2 (sociální orientace).',
      'Derived from average of D3 (motivation) and D6 (AI readiness).':
        'Odvozeno z průměru D3 (motivace) a D6 (technologická adaptabilita).',
      'Derived from average of D3 (motivation) and D6 (technology adaptability).':
        'Odvozeno z průměru D3 (motivace) a D6 (technologická adaptabilita).',
      'Higher when D2 and D4 are lower (preference for calmer, solo/remote setup).':
        'Je vyšší, když jsou D2 a D4 nižší (preference klidnějšího, samostatného/remote režimu).',
    };

    return legacyCsMap[value] || value;
  };
  const formatJhiFieldLabel = (field: string) => {
    if (jcfpmReasonLocaleBase !== 'cs') return field;
    const map: Record<string, string> = {
      'pillarWeights.values': 'Váha: hodnotový soulad',
      'pillarWeights.growth': 'Váha: růst a rozvoj',
      'pillarWeights.timeCost': 'Váha: časová náročnost',
      'workStyle.peopleIntensity': 'Styl práce: sociální intenzita',
      'workStyle.careerGrowthPreference': 'Styl práce: preference kariérního růstu',
      'workStyle.homeOfficePreference': 'Styl práce: preference home office',
    };
    return map[field] || field;
  };
  const [hasJcfpmDraft, setHasJcfpmDraft] = useState<boolean>(() => Boolean(readJcfpmDraft(profile.id)));
  const [culturalCompass, setCulturalCompass] = useState({
    individualVsTeam: 52,
    chaosVsStructure: 58,
    companyIndividualVsTeam: 36,
    companyChaosVsStructure: 68,
  });
  const sceneCapability = useSceneCapability();

  const extractNarrativeSkills = (text: string): string[] => {
    const t = (text || '').toLowerCase();
    const map: Array<[string, string[]]> = [
      ['Building from Zero', ['from zero', 'od nuly', 'start', 'setup']],
      ['Crisis Management', ['krize', 'incident', 'urgent', 'stres']],
      ['Stakeholder Communication', ['stakeholder', 'ceo', 'management', 'vedení']],
      ['Process Architecture', ['proces', 'framework', 'systém', 'standard']],
      ['Team Leadership', ['tým', 'lead', 'mentoring', 'koučink']],
      ['Value Communication', ['hodnota', 'value', 'dopad', 'outcome']],
    ];
    return map
      .filter(([, keys]) => keys.some((key) => t.includes(key)))
      .map(([skill]) => skill);
  };

  const disconnectedPipes = Object.values(resourceLeakToggles).filter((v) => !v).length;
  const monthlyCommuteHours = Number(((happinessAuditInput.commute_minutes_daily * 22) / 60).toFixed(1));
  const narrativeSkills = extractNarrativeSkills(narrativeStory);
  const narrativeFrame = {
    timestamp: new Date().toISOString(),
    unlocked_skills: narrativeSkills,
    narrative_integrity: Math.max(15, Math.min(95, 38 + narrativeSkills.length * 12 + Math.round(narrativeStory.length / 40))),
    confidence: Math.max(25, Math.min(92, 30 + narrativeSkills.length * 10)),
    evidence: narrativeSkills,
  };
  const culturalMismatch = Math.round((
    Math.abs(culturalCompass.individualVsTeam - culturalCompass.companyIndividualVsTeam) +
    Math.abs(culturalCompass.chaosVsStructure - culturalCompass.companyChaosVsStructure)
  ) / 2);
  const culturalAlignment = Math.max(0, 100 - culturalMismatch);

  // Address Verification State
  const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
  const [addressVerificationStatus, setAddressVerificationStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cvInputRef = useRef<HTMLInputElement>(null);

  const isExternalProfilePhotoUrl = (url?: string | null): boolean => {
    if (!url) return false;
    const value = url.toLowerCase();
    if (value.includes('/profile-photos/')) return false;
    if (value.includes('/avatars/')) return false;
    return value.startsWith('http://') || value.startsWith('https://');
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const intentSetupRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    let isMounted = true;

    const refreshSubscriptionTier = async () => {
      if (!profile.isLoggedIn || !profile.id) {
        if (isMounted) setEffectiveTier(profile.subscription?.tier || null);
        return;
      }

      try {
        const status = await getSubscriptionStatus(profile.id);
        if (isMounted) {
          setEffectiveTier(status?.tier || profile.subscription?.tier || 'free');
        }
      } catch {
        if (isMounted) setEffectiveTier(profile.subscription?.tier || 'free');
      }
    };

    refreshSubscriptionTier();
    return () => {
      isMounted = false;
    };
  }, [profile.id, profile.isLoggedIn, profile.subscription?.tier]);

  const resolvedTier = String(effectiveTier || profile.subscription?.tier || 'free').toLowerCase();
  const hasPremiumAccess = !!resolvedTier && resolvedTier !== 'free' && resolvedTier !== 'null' && resolvedTier !== 'undefined';
  const normalizedCandidateTier: 'free' | 'premium' = hasPremiumAccess ? 'premium' : 'free';
  const isPremium = normalizedCandidateTier === 'premium';
  const premiumPrice = getPremiumPriceDisplay(i18n.language || 'cs');
  const aiCvParsingEnabled = String(import.meta.env.VITE_ENABLE_AI_CV_PARSER || 'true').toLowerCase() !== 'false';

  const profileWithResolvedSubscription: UserProfile = {
    ...profile,
    subscription: {
      ...(profile.subscription || {}),
      tier: normalizedCandidateTier
    }
  };

  useEffect(() => {
    setEditableCvAiText(profile.cvAiText || '');
  }, [profile.cvAiText]);

  useEffect(() => {
    setJcfpmSnapshot(profile.preferences?.jcfpm_v1 || null);
    setHasJcfpmDraft(Boolean(readJcfpmDraft(profile.id)));
  }, [profile.preferences]);


  const buildFormDataFromProfile = (sourceProfile: UserProfile) => {
    const resolvedSearchProfile = enrichSearchProfileWithInference(sourceProfile);
    return {
      personal: {
        name: sourceProfile.name || '',
        jobTitle: sourceProfile.jobTitle || '',
        email: sourceProfile.email || '',
        phone: sourceProfile.phone || '',
        address: sourceProfile.address || '',
        preferredCountryCode: sourceProfile.preferredCountryCode || sourceProfile.taxProfile?.countryCode || 'CZ',
        linkedIn: sourceProfile.preferences?.linkedIn || (sourceProfile as any).linkedIn || '',
        portfolio: sourceProfile.preferences?.portfolio || (sourceProfile as any).portfolio || '',
        github: sourceProfile.preferences?.github || (sourceProfile as any).github || ''
      },
      notifications: {
        dailyDigestEnabled: sourceProfile.dailyDigestEnabled ?? true,
        dailyDigestPushEnabled: sourceProfile.dailyDigestPushEnabled ?? true,
        dailyDigestTime: sourceProfile.dailyDigestTime || '07:30',
        dailyDigestTimezone: sourceProfile.dailyDigestTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague'
      },
      searchProfile: {
        ...createDefaultCandidateSearchProfile(),
        ...resolvedSearchProfile,
        remoteLanguageCodes: (
          resolvedSearchProfile.remoteLanguageCodes &&
            resolvedSearchProfile.remoteLanguageCodes.length > 0
            ? resolvedSearchProfile.remoteLanguageCodes
            : createDefaultCandidateSearchProfile().remoteLanguageCodes
        ) as SearchLanguageCode[],
      },
      experience: sourceProfile.workHistory || [],
      education: sourceProfile.education || [],
      skills: sourceProfile.skills || [],
      taxProfile: sourceProfile.taxProfile || createDefaultTaxProfileByCountry('CZ'),
      jhiPreferences: sourceProfile.jhiPreferences || createDefaultJHIPreferences()
    };
  };


  // Form state for different sections
  const [formData, setFormData] = useState(() => buildFormDataFromProfile(profile));
  const commuteOriginAddress = String(formData.personal.address || profile.address || '').trim();

  useEffect(() => {
    setFormData(buildFormDataFromProfile(profile));
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'saved') return;
    if (savedJobs.length > 0 || savedJobIds.length === 0) {
      setSavedJobsFallback([]);
      return;
    }

    (async () => {
      try {
        const fetched = await fetchJobsByIds(savedJobIds.map((id) => String(id)));
        if (!cancelled) {
          setSavedJobsFallback(fetched || []);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to hydrate saved jobs in profile tab:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, savedJobs, savedJobIds]);

  useEffect(() => {
    let cancelled = false;
    if (activeTab !== 'evidence') return;

    (async () => {
      setSolutionSnapshotsLoading(true);
      try {
        const rows = await fetchMySolutionSnapshots(12);
        if (!cancelled) {
          setSolutionSnapshots(rows);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn('Failed to hydrate solution snapshots in profile:', error);
          setSolutionSnapshots([]);
        }
      } finally {
        if (!cancelled) {
          setSolutionSnapshotsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, profile.id]);

  const displaySavedJobs = savedJobs.length > 0 ? savedJobs : savedJobsFallback;
  const showSolvedProblemsSection = solutionSnapshotsLoading || solutionSnapshots.length > 0;
  const profileDateLocale =
    localeBase === 'cs'
      ? 'cs-CZ'
      : localeBase === 'sk'
        ? 'sk-SK'
        : localeBase === 'de' || localeBase === 'at'
          ? 'de-AT'
          : localeBase === 'pl'
            ? 'pl-PL'
            : 'en-US';
  const profileTabs: Array<{
    key: ProfileTabKey;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    caption?: string;
  }> = [
      {
        key: 'profile',
        icon: User,
        label: t('profile.personal_info', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Profil',
            sk: 'Profil',
            de: 'Profil',
            at: 'Profil',
            pl: 'Profil',
            en: 'Profile'
          }, profileLocale)
        }),
        caption: t('profile.tab_profile_caption', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Osobní údaje a historie',
            sk: 'Osobné údaje a história',
            de: 'Persönliche Daten und Verlauf',
            at: 'Persönliche Daten und Verlauf',
            pl: 'Dane i historia',
            en: 'Personal details and history'
          }, profileLocale)
        })
      },
      {
        key: 'evidence',
        icon: FileText,
        label: t('profile.evidence_tab', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Důkazy',
            sk: 'Dôkazy',
            de: 'Nachweise',
            at: 'Nachweise',
            pl: 'Dowody',
            en: 'Evidence'
          }, profileLocale)
        }),
        caption: t('profile.evidence_tab_caption', {
          defaultValue: getProfileLocaleLabel({
            cs: 'CV, testy a výstupy',
            sk: 'CV, testy a výstupy',
            de: 'CV, Tests und Outputs',
            at: 'CV, Tests und Outputs',
            pl: 'CV, testy i wyniki',
            en: 'CV, tests and outputs'
          }, profileLocale)
        })
      },
      {
        key: 'work',
        icon: SlidersHorizontal,
        label: t('profile.work_settings_title', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Pracovní nastavení',
            sk: 'Pracovné nastavenia',
            de: 'Arbeitspräferenzen',
            at: 'Arbeitspräferenzen',
            pl: 'Ustawienia pracy',
            en: 'Work settings'
          }, profileLocale)
        }),
        caption: t('profile.work_settings_caption', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Feed, směr a podmínky',
            sk: 'Feed, smer a podmienky',
            de: 'Feed, Richtung und Rahmen',
            at: 'Feed, Richtung und Rahmen',
            pl: 'Feed, kierunek i warunki',
            en: 'Feed, direction and constraints'
          }, profileLocale)
        })
      },
      {
        key: 'account',
        icon: Bell,
        label: t('profile.account_tab_title', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Účet',
            sk: 'Účet',
            de: 'Konto',
            at: 'Konto',
            pl: 'Konto',
            en: 'Account'
          }, profileLocale)
        }),
        caption: t('profile.account_tab_caption', {
          defaultValue: getProfileLocaleLabel({
            cs: 'E-mail, notifikace a bezpečnost',
            sk: 'E-mail, notifikácie a bezpečnosť',
            de: 'E-Mail, Benachrichtigungen und Sicherheit',
            at: 'E-Mail, Benachrichtigungen und Sicherheit',
            pl: 'E-mail, powiadomienia i bezpieczeństwo',
            en: 'Email, notifications, and security'
          }, profileLocale)
        })
      },
      {
        key: 'saved',
        icon: Bookmark,
        label: t('profile.job_hub.badge', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Dialogové centrum',
            sk: 'Dialógové centrum',
            de: 'Dialogzentrum',
            at: 'Dialogzentrum',
            pl: 'Centrum dialogów',
            en: 'Dialogue hub'
          }, profileLocale)
        }),
        caption: t('profile.job_hub.tab_caption', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Dialogy a sloty',
            sk: 'Dialógy a sloty',
            de: 'Dialoge und Slots',
            at: 'Dialoge und Slots',
            pl: 'Dialogi i sloty',
            en: 'Dialogues and slots'
          }, profileLocale)
        })
      },
      {
        key: 'challenges',
        icon: Briefcase,
        label: t('profile.mini_challenges.badge', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Mini výzvy',
            sk: 'Mini výzvy',
            de: 'Mini-Herausforderungen',
            at: 'Mini-Herausforderungen',
            pl: 'Mini wyzwania',
            en: 'Mini challenges'
          }, profileLocale)
        }),
        caption: t('profile.mini_challenges.tab_caption', {
          defaultValue: getProfileLocaleLabel({
            cs: 'Zadat a spravovat',
            en: 'Post and manage'
          }, profileLocale)
        })
      },
    ];
  const isProfileTab = activeTab === 'profile';
  const isEvidenceTab = activeTab === 'evidence';
  const isWorkTab = activeTab === 'work';
  const isAccountTab = activeTab === 'account';
  const isChallengesTab = activeTab === 'challenges';
  const profileInputClass = 'w-full rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-[var(--text-strong)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.22)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.06)] dark:[color-scheme:dark]';
  const profileCompactInputClass = 'w-full rounded-[0.85rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[var(--text-strong)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.22)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.06)] dark:[color-scheme:dark]';
  const profileIconButtonClass = 'rounded-[0.85rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition hover:bg-[var(--surface-elevated)] hover:text-[var(--text-strong)]';
  const profilePrimaryButtonClass = 'app-button-primary app-organic-cta disabled:cursor-not-allowed disabled:opacity-60';
  const profileSurfaceClass = 'overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)]';
  const jcfpmSurfaceClass = 'app-organic-shell overflow-hidden rounded-[28px] border border-slate-200/80 bg-white/88 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.28)] dark:border-slate-800/80 dark:bg-slate-950/70';
  const jcfpmInnerCardClass = 'rounded-[24px] border border-slate-200/80 bg-white/86 p-4 shadow-[0_18px_46px_-36px_rgba(15,23,42,0.24)] dark:border-slate-800/80 dark:bg-slate-950/60';
  const profileAccentIconShellClass = 'rounded-[12px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2';
  const profileAccentIconClass = 'h-5 w-5 text-[var(--text-strong)]';
  const profileAccentPanelClass = 'rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4';
  const profileAccentBadgeClass = 'inline-flex items-center rounded-[999px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]';

  const profileHeroCopy = ({
    cs: {
      eyebrow: 'Profil kandidáta',
      subtitle: 'Udržujte profil připravený pro první kontakt. Jasný kontext, stručné podklady a aktualizované preference.',
      readiness: 'Připravenost profilu',
      sections: 'Aktivní sekce',
      docs: 'Podklady'
    },
    sk: {
      eyebrow: 'Profil kandidáta',
      subtitle: 'Udržiavajte profil pripravený na prvý kontakt. Jasný kontext, stručné podklady a aktualizované preferencie.',
      readiness: 'Pripravenosť profilu',
      sections: 'Aktívne sekcie',
      docs: 'Podklady'
    },
    de: {
      eyebrow: 'Kandidatenprofil',
      subtitle: 'Halten Sie Ihr Profil für den ersten Kontakt bereit: klarer Kontext, knappe Unterlagen und aktuelle Präferenzen.',
      readiness: 'Profilbereitschaft',
      sections: 'Aktive Bereiche',
      docs: 'Unterlagen'
    },
    at: {
      eyebrow: 'Kandidatenprofil',
      subtitle: 'Halten Sie Ihr Profil für den ersten Kontakt bereit: klarer Kontext, knappe Unterlagen und aktuelle Präferenzen.',
      readiness: 'Profilbereitschaft',
      sections: 'Aktive Bereiche',
      docs: 'Unterlagen'
    },
    pl: {
      eyebrow: 'Profil kandydata',
      subtitle: 'Utrzymuj profil gotowy do pierwszego kontaktu: jasny kontekst, zwięzłe materiały i aktualne preferencje.',
      readiness: 'Gotowość profilu',
      sections: 'Aktywne sekcje',
      docs: 'Materiały'
    },
    en: {
      eyebrow: 'Candidate profile',
      subtitle: 'Keep your profile ready for first contact: clear context, concise supporting docs, and up-to-date preferences.',
      readiness: 'Profile readiness',
      sections: 'Active sections',
      docs: 'Documents'
    }
  } as const)[(['cs', 'sk', 'de', 'at', 'pl'].includes(localeBase) ? localeBase : 'en') as 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en'];

  const profileSignals = [
    Boolean(formData.personal.name?.trim()),
    Boolean(formData.personal.jobTitle?.trim()),
    Boolean(formData.personal.email?.trim()),
    Boolean(formData.personal.phone?.trim()),
    Boolean(formData.personal.address?.trim()),
    formData.experience.length > 0,
    formData.education.length > 0,
    formData.skills.length > 0,
    Boolean(profile.cvUrl),
    Boolean(editableCvAiText.trim())
  ];
  const profileReadinessScore = Math.round((profileSignals.filter(Boolean).length / profileSignals.length) * 100);
  const profileTotalSections = [formData.experience.length, formData.education.length, formData.skills.length].reduce((sum, value) => sum + value, 0);
  const profileDocumentsReady = [Boolean(profile.cvUrl), Boolean(editableCvAiText.trim())].filter(Boolean).length;
  const searchSetupSignalCount = [
    formData.searchProfile.primaryDomain,
    formData.searchProfile.targetRole,
    formData.searchProfile.seniority,
    (formData.searchProfile.avoidDomains || []).length > 0,
    formData.searchProfile.nearBorder,
    formData.searchProfile.wantsContractorRoles,
    formData.searchProfile.wantsDogFriendlyOffice,
    formData.searchProfile.preferredBenefitKeys.includes('child_friendly') || formData.searchProfile.preferredBenefitKeys.includes('childcare_support'),
    formData.searchProfile.wantsRemoteRoles,
    formData.searchProfile.preferredWorkArrangement,
    formData.searchProfile.remoteLanguageCodes.length > 0,
    formData.searchProfile.defaultEnableCommuteFilter,
    formData.jhiPreferences.hardConstraints.excludeShift,
    formData.searchProfile.preferredBenefitKeys.length > 0
  ].filter(Boolean).length;
  const searchSetupAreas = [
    searchProfileCopy.impactMarketplace,
    searchProfileCopy.impactSaved,
    searchProfileCopy.impactFeed
  ];
  const resolvedIntentProfile = resolveCandidateIntentProfile({
    ...profile,
    jobTitle: formData.personal.jobTitle,
    workHistory: formData.experience,
    education: formData.education,
    skills: formData.skills,
    preferences: {
      ...profile.preferences,
      searchProfile: formData.searchProfile,
    },
  });
  const onboardingSignal = String(profile.preferences?.candidate_onboarding_v2?.interest_reveal || '').trim();
  const onboardingIntentSignals = getCandidateIntentSignals({
    ...profile,
    jobTitle: formData.personal.jobTitle,
    workHistory: formData.experience,
    education: formData.education,
    skills: formData.skills,
    preferences: {
      ...profile.preferences,
      searchProfile: formData.searchProfile,
    },
  }, i18n.language || 'en').slice(0, 3);
  const inferredIntentAvailable = Boolean(resolvedIntentProfile.inferredPrimaryDomain || resolvedIntentProfile.inferredTargetRole);
  const hasManualIntent = Boolean(formData.searchProfile.primaryDomain || formData.searchProfile.targetRole || formData.searchProfile.seniority);
  const focusIntentSetup = () => {
    setActiveTab('work');
    window.setTimeout(() => {
      intentSetupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  };
  const applyInferredIntentSuggestion = () => {
    handleSearchProfileChange('primaryDomain', resolvedIntentProfile.inferredPrimaryDomain);
    handleSearchProfileChange('secondaryDomains', resolvedIntentProfile.secondaryDomains.slice(0, 2));
    if (resolvedIntentProfile.inferredTargetRole) {
      handleSearchProfileChange('targetRole', resolvedIntentProfile.inferredTargetRole);
    }
    if (resolvedIntentProfile.seniority) {
      handleSearchProfileChange('seniority', resolvedIntentProfile.seniority);
    }
    setShowIntentNudge(false);
  };

  useEffect(() => {
    if (hasManualIntent) {
      setShowIntentNudge(false);
    }
  }, [hasManualIntent]);

  const renderAiGuidePanel = isEvidenceTab ? (
    <div className="h-full overflow-hidden rounded-[1.05rem] border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(180deg,rgba(255,250,240,0.96),rgba(255,255,255,0.98))] shadow-[var(--shadow-card)] dark:bg-[linear-gradient(180deg,rgba(29,21,7,0.32),rgba(10,18,32,0.96))]">
      <div className="border-b border-[rgba(var(--accent-rgb),0.16)] bg-white/70 px-5 py-4 dark:bg-[rgba(var(--accent-rgb),0.04)]">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Premium
          </div>
          <span className={profileAccentBadgeClass}>
            {t('profile.ai_guide_core_badge', { defaultValue: profilePremiumCopy.aiGuideBadge })}
          </span>
        </div>
        <h2 className="mt-3 text-xl font-semibold text-slate-900 dark:text-white">
          {t('profile.ai_guide.title')}
        </h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t('profile.ai_guide_short_desc', { defaultValue: profilePremiumCopy.aiGuideDesc })}
        </p>
      </div>

      <div className="p-5 space-y-5">
        {onboardingSignal ? (
          <div className="rounded-[1rem] border border-[rgba(var(--accent-rgb),0.18)] bg-white/85 p-4 dark:bg-slate-900/70">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('profile.onboarding_signal.label', { defaultValue: 'Signál z onboardingu' })}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('profile.onboarding_signal.title', { defaultValue: 'Tady zůstává zachycené, co tě přirozeně táhne.' })}
                  </h3>
                  <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                    {onboardingSignal}
                  </p>
                </div>
                {onboardingIntentSignals.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {onboardingIntentSignals.map((signal) => (
                      <span
                        key={signal}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        {signal}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              {isPremium ? (
                <button
                  type="button"
                  onClick={() => setShowAIGuide(true)}
                  className="app-button-secondary"
                >
                  {t('profile.onboarding_signal.cta', { defaultValue: 'Rozpracovat v AI guide' })}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {[
            t('profile.ai_guide.value_1', { defaultValue: 'Vytáhne silné stránky a skryté talenty' }),
            t('profile.ai_guide.value_2', { defaultValue: 'Doplní profil a připraví lepší CV základ' }),
            t('profile.ai_guide.value_3', { defaultValue: 'Pomůže s prémiovým positioningem pro firmy' })
          ].map((item) => (
            <div key={item} className="rounded-full border border-white/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              {item}
            </div>
          ))}
        </div>

        <div className="rounded-[1rem] border border-[rgba(var(--accent-rgb),0.16)] bg-white/80 p-4 dark:bg-slate-900/70">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('profile.ai_guide_long_desc', {
              defaultValue: 'Nadiktujte svůj příběh a AI z něj sestaví použitelný profilový narativ, doporučení pro CV i konkrétní text, který můžete dál ručně ladit.'
            })}
          </p>

          <div className="mt-4">
            {isPremium ? (
              <button
                onClick={() => setShowAIGuide(true)}
                className={`${profilePrimaryButtonClass} inline-flex w-full items-center justify-center gap-2 rounded-[0.95rem] px-4 py-2.5 text-sm`}
              >
                <Sparkles className="h-4 w-4" />
                {t('profile.ai_guide_start', { defaultValue: profilePremiumCopy.aiGuideStart })}
              </button>
            ) : (
              <div className={`${profileAccentPanelClass} space-y-3`}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {t('alerts.premium_only_feature')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {t('profile.ai_guide_upgrade_hint', { defaultValue: profilePremiumCopy.aiGuideUpgrade })}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (profile.id) {
                      redirectToCheckout('premium', profile.id);
                    }
                  }}
                  className={`${profilePrimaryButtonClass} inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm`}
                >
                  {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurLabel}`}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-[1rem] border border-slate-200/80 bg-white/90 p-4 dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('profile.ai_cv_editor.title', { defaultValue: supportingContextCopy.aiDraftTitle })}
              </h3>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                {t('profile.ai_cv_editor.desc', { defaultValue: supportingContextCopy.aiDraftDesc })}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setEditableCvAiText(profile.cvText || '')}
                type="button"
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t('profile.ai_cv_editor.load_cv', { defaultValue: supportingContextCopy.aiDraftLoad })}
              </button>
              <button
                onClick={() => setEditableCvAiText('')}
                type="button"
                className="rounded-md border border-slate-300 px-2.5 py-1.5 text-xs dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t('app.clear', {
                  defaultValue: getProfileLocaleLabel({
                    cs: 'Vymazat',
                    sk: 'Vymazať',
                    de: 'Leeren',
                    at: 'Leeren',
                    pl: 'Wyczyść',
                    en: 'Clear'
                  }, profileLocale)
                })}
              </button>
            </div>
          </div>

          <textarea
            value={editableCvAiText}
            onChange={(e) => setEditableCvAiText(e.target.value)}
            rows={5}
            className={`${profileInputClass} mt-4 min-h-[140px] px-3 py-3`}
            placeholder={t('profile.ai_cv_editor.placeholder', { defaultValue: supportingContextCopy.aiDraftPlaceholder })}
          />

          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {t('profile.ai_cv_editor.count', {
                defaultValue: getProfileLocaleLabel({
                  cs: '{{count}} znaků',
                  sk: '{{count}} znakov',
                  de: '{{count}} Zeichen',
                  at: '{{count}} Zeichen',
                  pl: '{{count}} znaków',
                  en: '{{count}} characters'
                }, profileLocale),
                count: editableCvAiText.length
              })}
            </span>
            <button
              type="button"
              disabled={isSavingCvAiText}
              onClick={async () => {
                if (!profile.id) return;
                setIsSavingCvAiText(true);
                try {
                  await Promise.resolve(onChange({ ...profile, cvAiText: editableCvAiText.trim() }, true));
                  if (onRefreshProfile) {
                    await onRefreshProfile();
                  }
                  alert(t('profile.ai_cv_editor.saved', { defaultValue: supportingContextCopy.aiDraftSaved }));
                } catch (error) {
                  console.error('Saving AI CV text failed:', error);
                  alert(t('profile.save_error'));
                } finally {
                  setIsSavingCvAiText(false);
                }
              }}
              className="inline-flex items-center justify-center rounded-[0.95rem] bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              {isSavingCvAiText
                ? t('profile.ai_cv_editor.saving', {
                  defaultValue: getProfileLocaleLabel({
                    cs: 'Ukládám...',
                    sk: 'Ukladám...',
                    de: 'Speichern...',
                    at: 'Speichern...',
                    pl: 'Zapisywanie...',
                    en: 'Saving...'
                  }, profileLocale)
                })
                : t('profile.ai_cv_editor.save', { defaultValue: supportingContextCopy.aiDraftSave })}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const renderIntentSetupPanel = isWorkTab ? (
    <div
      ref={intentSetupRef}
      className="rounded-[1.1rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[var(--accent)] shadow-sm">
            <Briefcase className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="app-eyebrow w-fit">{intentProfileCopy.title}</div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">{intentProfileCopy.intro}</p>
          </div>
        </div>
        <div className="rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
            {intentProfileCopy.activeIntent}
          </div>
          <div className="mt-2 flex max-w-[320px] flex-wrap gap-2">
            {[formData.searchProfile.primaryDomain ? getCandidateIntentDomainLabel(formData.searchProfile.primaryDomain, i18n.language) : '', formData.searchProfile.targetRole, formData.searchProfile.seniority].filter(Boolean).map((item) => (
              <span key={String(item)} className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                {item}
              </span>
            ))}
            {!formData.searchProfile.primaryDomain && !formData.searchProfile.targetRole && !formData.searchProfile.seniority ? (
              <span className="text-sm text-[var(--text-muted)]">{intentProfileCopy.none}</span>
            ) : null}
          </div>
        </div>
      </div>

      {(inferredIntentAvailable && !hasManualIntent) || showIntentNudge ? (
        <div className="mt-4 rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.14)] bg-[var(--surface-muted)] p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                {showIntentNudge
                  ? getProfileLocaleLabel({
                    cs: 'Doporučené doplnění po nahrání CV',
                    sk: 'Odporúčané doplnenie po nahraní CV',
                    de: 'Empfohlene Ergänzung nach dem CV-Upload',
                    at: 'Empfohlene Ergänzung nach dem CV-Upload',
                    pl: 'Sugerowane uzupełnienie po wgraniu CV',
                    en: 'Suggested update after CV upload'
                  }, profileLocale)
                  : intentProfileCopy.inferredTitle}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                {showIntentNudge
                  ? (isCsLikeProfile
                    ? 'Z životopisu jsme doplnili pravděpodobný obor a cílovou roli. Potvrďte je jedním klikem, aby feed začal fungovat jako váš feed.'
                    : 'We inferred a likely domain and target role from your CV. Confirm them in one click so the feed starts behaving like your feed.')
                  : intentProfileCopy.inferredBody}
              </p>
              <div className="flex flex-wrap gap-2">
                {resolvedIntentProfile.inferredPrimaryDomain ? (
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
                    {getCandidateIntentDomainLabel(resolvedIntentProfile.inferredPrimaryDomain, i18n.language)}
                  </span>
                ) : null}
                {resolvedIntentProfile.inferredTargetRole ? (
                  <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text)]">
                    {resolvedIntentProfile.inferredTargetRole}
                  </span>
                ) : null}
                {resolvedIntentProfile.seniority ? (
                  <span className="rounded-full bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text)]">
                    {resolvedIntentProfile.seniority}
                  </span>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={applyInferredIntentSuggestion}
              className="app-button-primary shrink-0 justify-center"
            >
              {intentProfileCopy.useSuggestion}
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-3 rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3.5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">{intentProfileCopy.primaryDomain}</label>
            <select
              value={formData.searchProfile.primaryDomain || ''}
              onChange={(event) => handleSearchProfileChange('primaryDomain', (event.target.value || null) as CandidateDomainKey | null)}
              className={profileInputClass}
            >
              <option value="">{intentProfileCopy.none}</option>
              {intentDomainOptions.map((option) => (
                <option key={option.key} value={option.key}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">{intentProfileCopy.targetRole}</label>
            <input
              type="text"
              value={formData.searchProfile.targetRole || ''}
              onChange={(event) => handleSearchProfileChange('targetRole', event.target.value)}
              className={profileInputClass}
              placeholder={intentProfileCopy.targetRolePlaceholder}
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">{intentProfileCopy.seniority}</label>
            <div className="flex flex-wrap gap-2">
              {seniorityOptions.map((option) => {
                const active = formData.searchProfile.seniority === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleSearchProfileChange('seniority', active ? null : option.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                      ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                      }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3.5">
          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">{intentProfileCopy.secondaryDomains}</label>
            <div className="flex flex-wrap gap-2">
              {intentDomainOptions
                .filter((option) => option.key !== formData.searchProfile.primaryDomain)
                .map((option) => {
                  const active = (formData.searchProfile.secondaryDomains || []).includes(option.key);
                  const disabled = !active && (formData.searchProfile.secondaryDomains || []).length >= 2;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const current = formData.searchProfile.secondaryDomains || [];
                        const next = active
                          ? current.filter((item) => item !== option.key)
                          : [...current, option.key];
                        handleSearchProfileChange('secondaryDomains', next);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                        ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                        } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-[var(--text-strong)]">{intentProfileCopy.avoidDomains}</label>
            <div className="flex flex-wrap gap-2">
              {intentDomainOptions
                .filter((option) => option.key !== formData.searchProfile.primaryDomain && !(formData.searchProfile.secondaryDomains || []).includes(option.key))
                .map((option) => {
                  const active = (formData.searchProfile.avoidDomains || []).includes(option.key);
                  const disabled = !active && (formData.searchProfile.avoidDomains || []).length >= 3;
                  return (
                    <button
                      key={`avoid-${option.key}`}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        const current = formData.searchProfile.avoidDomains || [];
                        const next = active
                          ? current.filter((item) => item !== option.key)
                          : [...current, option.key];
                        handleSearchProfileChange('avoidDomains', next);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                        ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300'
                        : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-rose-200 hover:bg-rose-50/70 dark:hover:border-rose-900/30 dark:hover:bg-rose-950/20'
                        } ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
            </div>
            <div className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
              {intentProfileCopy.avoidDomainsHint}
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={formData.searchProfile.includeAdjacentDomains ?? true}
              onChange={(event) => handleSearchProfileChange('includeAdjacentDomains', event.target.checked)}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>{intentProfileCopy.includeAdjacent}</span>
          </label>

          <div className="rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.14)] bg-[rgba(var(--accent-rgb),0.05)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
            {intentProfileCopy.manualWins}
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const renderPremiumSearchSetupPanel = isWorkTab ? (
    <div className="rounded-[1.1rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[var(--accent)] shadow-sm">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="app-eyebrow w-fit">{searchProfileCopy.title}</div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-muted)]">
              {isPremium
                ? searchProfileCopy.intro
                : profileUiCopy.premiumLifeContext}
            </p>
          </div>
        </div>
        {isPremium ? (
          <div className="rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2.5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {searchProfileCopy.activeSignals}
            </div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
              {searchSetupSignalCount}
            </div>
          </div>
        ) : (
          <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
            Premium
          </span>
        )}
      </div>

      {isPremium ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              { field: 'nearBorder' as const, label: searchProfileCopy.nearBorder, active: formData.searchProfile.nearBorder },
              { field: 'wantsContractorRoles' as const, label: searchProfileCopy.contractor, active: formData.searchProfile.wantsContractorRoles },
              { field: 'wantsRemoteRoles' as const, label: searchProfileCopy.remote, active: formData.searchProfile.wantsRemoteRoles }
            ].map((item) => (
              <label
                key={item.field}
                className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${item.active
                  ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--text-strong)]'
                  : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={(e) => handleSearchProfileChange(item.field, e.target.checked)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>{item.label}</span>
              </label>
            ))}
            <label
              className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${formData.searchProfile.wantsDogFriendlyOffice
                ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--text-strong)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                }`}
            >
              <input
                type="checkbox"
                checked={formData.searchProfile.wantsDogFriendlyOffice}
                onChange={(e) => syncDogFriendlySetup(e.target.checked)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>{searchProfileCopy.dogFriendly}</span>
            </label>
            <label
              className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${formData.searchProfile.preferredBenefitKeys.includes('child_friendly') || formData.searchProfile.preferredBenefitKeys.includes('childcare_support')
                ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--text-strong)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                }`}
            >
              <input
                type="checkbox"
                checked={formData.searchProfile.preferredBenefitKeys.includes('child_friendly') || formData.searchProfile.preferredBenefitKeys.includes('childcare_support')}
                onChange={(e) => syncChildFriendlySetup(e.target.checked)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>{searchProfileCopy.childFriendly}</span>
            </label>
            <label
              className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${formData.jhiPreferences.hardConstraints.excludeShift
                ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--text-strong)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                }`}
            >
              <input
                type="checkbox"
                checked={formData.jhiPreferences.hardConstraints.excludeShift}
                onChange={(e) => handleJhiConstraintChange('excludeShift', e.target.checked)}
                className="mt-1 accent-[var(--accent)]"
              />
              <span>{searchProfileCopy.avoidShift}</span>
            </label>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-[var(--text-strong)]">{searchProfileCopy.workArrangement}</label>
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'remote', label: searchProfileCopy.remoteOption },
                { key: 'hybrid', label: searchProfileCopy.hybridOption },
                { key: 'onsite', label: searchProfileCopy.onsiteOption },
              ].map((option) => {
                const active = formData.searchProfile.preferredWorkArrangement === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => handleSearchProfileChange('preferredWorkArrangement', active ? null : option.key as CandidateSearchProfile['preferredWorkArrangement'])}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                      ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                      }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3.5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-xl space-y-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                  {searchProfileCopy.commuteTitle}
                </div>
                <p className="text-sm leading-6 text-[var(--text-muted)]">{searchProfileCopy.commuteIntro}</p>
              </div>
              <div className="grid min-w-[220px] gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {getProfileLocaleLabel({
                      cs: 'Výchozí dojezd',
                      sk: 'Predvolený dojazd',
                      de: 'Standard-Pendeln',
                      at: 'Standard-Pendeln',
                      pl: 'Domyślny dojazd',
                      en: 'Default commute'
                    }, profileLocale)}
                  </div>
                  <div className="mt-1 text-base font-semibold text-[var(--text-strong)]">
                    {formData.searchProfile.defaultEnableCommuteFilter
                      ? `${formData.searchProfile.defaultMaxDistanceKm} km`
                      : getProfileLocaleLabel({
                        cs: 'Vypnuto',
                        sk: 'Vypnuté',
                        de: 'Aus',
                        at: 'Aus',
                        pl: 'Wyłączone',
                        en: 'Off'
                      }, profileLocale)}
                  </div>
                </div>
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {getProfileLocaleLabel({
                      cs: 'Forma dopravy',
                      sk: 'Forma dopravy',
                      de: 'Verkehrsmittel',
                      at: 'Verkehrsmittel',
                      pl: 'Środek transportu',
                      en: 'Transport mode'
                    }, profileLocale)}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text-strong)]">
                    {t(`profile.transport_mode.${profile.transportMode || 'public'}`)}
                  </div>
                </div>
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5 sm:col-span-2 xl:col-span-1">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {searchProfileCopy.commuteOrigin}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-[var(--text-strong)] break-words">
                    {commuteOriginAddress || getProfileLocaleLabel({
                      cs: 'Neuvedeno',
                      sk: 'Neuvedené',
                      de: 'Nicht gesetzt',
                      at: 'Nicht gesetzt',
                      pl: 'Nie ustawiono',
                      en: 'Not set'
                    }, profileLocale)}
                  </div>
                  {!commuteOriginAddress ? (
                    <div className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                      {searchProfileCopy.commuteOriginMissing}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.15fr)]">
              <label className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${formData.searchProfile.defaultEnableCommuteFilter
                ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--text-strong)]'
                : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                }`}>
                <input
                  type="checkbox"
                  checked={formData.searchProfile.defaultEnableCommuteFilter}
                  onChange={(e) => handleSearchProfileChange('defaultEnableCommuteFilter', e.target.checked)}
                  className="mt-1 accent-[var(--accent)]"
                />
                <span>{searchProfileCopy.commuteToggle}</span>
              </label>
              <div className="rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-[var(--text-strong)]">
                    {searchProfileCopy.commuteRadius}
                  </label>
                  <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--accent)]">
                    {formData.searchProfile.defaultMaxDistanceKm} km
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={120}
                  step={5}
                  value={formData.searchProfile.defaultMaxDistanceKm}
                  onChange={(e) => handleSearchProfileChange('defaultMaxDistanceKm', Number(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
              <div className="rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface)] p-3">
                <TransportModeSelector
                  selectedMode={profile.transportMode || 'public'}
                  onModeChange={(mode: TransportMode) => onChange({ ...profile, transportMode: mode })}
                  compact
                />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-[var(--text-strong)]">{searchProfileCopy.languages}</label>
            <div className="flex flex-wrap gap-2">
              {remoteLanguageOptions.map((option) => {
                const active = formData.searchProfile.remoteLanguageCodes.includes(option.code);
                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      const next = active
                        ? formData.searchProfile.remoteLanguageCodes.filter((code) => code !== option.code)
                        : [...formData.searchProfile.remoteLanguageCodes, option.code];
                      handleSearchProfileChange('remoteLanguageCodes', next as SearchLanguageCode[]);
                    }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                      ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                      }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm font-medium text-[var(--text-strong)]">{searchProfileCopy.benefitPriorities}</label>
            <div className="flex flex-wrap gap-2">
              {searchBenefitOptions.map((option) => {
                const active = formData.searchProfile.preferredBenefitKeys.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => toggleBenefitPriority(option.key)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${active
                      ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'border-[var(--border-subtle)] bg-[var(--surface)] text-[var(--text)] hover:border-[rgba(var(--accent-rgb),0.16)]'
                      }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-[0.95rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {searchProfileCopy.impactTitle}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {searchSetupAreas.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]"
                >
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{searchProfileCopy.helper}</p>
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-[0.95rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--surface-muted)] p-4">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {[
                  searchProfileCopy.nearBorder,
                  searchProfileCopy.contractor,
                  searchProfileCopy.remote,
                  searchProfileCopy.dogFriendly,
                  searchProfileCopy.childFriendly,
                  searchProfileCopy.commuteTitle,
                ].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <p className="text-sm leading-6 text-[var(--text-muted)]">
                {profileUiCopy.freePlanLine}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (profile.id) {
                  redirectToCheckout('premium', profile.id);
                }
              }}
              className={`${profilePrimaryButtonClass} w-full px-4 py-2.5 text-sm lg:w-auto`}
            >
              {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurLabel}`}
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  useEffect(() => {
    if (!FEATURE_HAPPINESS_AUDIT_THREE || !isPremium) return;

    const timer = window.setTimeout(async () => {
      setIsSimulatingAudit(true);
      try {
        AnalyticsService.trackEvent('happiness_audit_parameter_changed', {
          commute_minutes_daily: happinessAuditInput.commute_minutes_daily,
          home_office_days: happinessAuditInput.home_office_days,
          role_shift: happinessAuditInput.role_shift,
        });
        const result = await simulateHappinessAudit({
          ...happinessAuditInput,
          commute_cost: resourceLeakToggles.commute ? happinessAuditInput.commute_cost : 0,
          subjective_energy: Math.min(100, happinessAuditInput.subjective_energy + disconnectedPipes * 8),
          role_shift: Math.max(0, Math.min(100, happinessAuditInput.role_shift + Math.round(culturalMismatch * 0.2) - narrativeSkills.length * 3)),
          tax_profile: formData.taxProfile,
        });
        AnalyticsService.trackEvent('happiness_audit_simulation_run', {
          sustainability: result.sustainability_score,
          drift: result.drift_score,
        });
        setHappinessAuditOutput(result);
      } catch {
        const timeRing = Math.min(100, Math.round((happinessAuditInput.commute_minutes_daily / 120) * 100));
        const energyRing = Math.min(100, Math.round((100 - happinessAuditInput.subjective_energy) * 0.7));
        const sustainability = Math.max(0, 100 - Math.round(timeRing * 0.45 + energyRing * 0.55));
        setHappinessAuditOutput({
          time_ring: timeRing,
          energy_ring: energyRing,
          sustainability_score: sustainability,
          drift_score: Math.round((happinessAuditInput.role_shift * 0.6) + (timeRing * 0.2)),
          recommendations: [
            'Lokální fallback režim: ověřte čísla po obnovení backendu.',
            'Jde o orientační výstup. Finální rozhodnutí zůstává na vás.',
          ],
          advisory_disclaimer: 'Jde o orientační výstup.',
        });
      } finally {
        setIsSimulatingAudit(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [happinessAuditInput, isPremium, formData.taxProfile, resourceLeakToggles, disconnectedPipes, culturalMismatch, narrativeSkills.length]);

  useEffect(() => {
    if (formData.experience.length === 0) {
      setActiveExperienceId(null);
      return;
    }
    if (!activeExperienceId || !formData.experience.some(exp => exp.id === activeExperienceId)) {
      setActiveExperienceId(formData.experience[0].id);
    }
  }, [formData.experience, activeExperienceId]);

  useEffect(() => {
    if (formData.education.length === 0) {
      setActiveEducationId(null);
      return;
    }
    if (!activeEducationId || !formData.education.some(edu => edu.id === activeEducationId)) {
      setActiveEducationId(formData.education[0].id);
    }
  }, [formData.education, activeEducationId]);

  useEffect(() => {
    const checkPushState = async () => {
      const supported = isPushSupported();
      setPushSupported(supported);
      if (!supported) return;
      setPushPermission(getPushPermission());
      const existing = await getCurrentSubscription();
      setPushSubscribed(Boolean(existing));
    };
    checkPushState();
  }, []);

  const jhiWeightEntries = (Object.entries(formData.jhiPreferences.pillarWeights) as Array<[keyof JHIPreferences['pillarWeights'], number]>)
    .sort((a, b) => b[1] - a[1]);
  const topJhiWeights = jhiWeightEntries.slice(0, 2);
  const activeJhiConstraintsCount = [
    formData.jhiPreferences.hardConstraints.mustRemote,
    formData.jhiPreferences.hardConstraints.excludeShift,
    formData.jhiPreferences.hardConstraints.growthRequired,
    formData.jhiPreferences.hardConstraints.maxCommuteMinutes != null,
    formData.jhiPreferences.hardConstraints.minNetMonthly != null
  ].filter(Boolean).length;

  // Photo upload handler
  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isUploadingPhoto) return;

    if (!file.type.startsWith('image/')) {
      alert(t('profile.photo_type_error'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert(t('profile.photo_size_error'));
      return;
    }

    setIsUploadingPhoto(true);

    try {
      const photoUrl = await uploadProfilePhoto(profile.id || '', file);

      if (photoUrl) {
        onChange({ ...profile, photo: photoUrl }, true);
        alert(t('profile.photo_upload_success'));
      }
    } catch (error) {
      console.error('Photo upload failed:', error);
      alert(t('profile.photo_upload_error'));
    } finally {
      setIsUploadingPhoto(false);
      if (photoInputRef.current) {
        photoInputRef.current.value = '';
      }
    }
  };

  const handlePhotoRepair = async () => {
    if (!profile.photo || !isExternalProfilePhotoUrl(profile.photo)) return;
    if (isRepairingPhoto) return;
    setIsRepairingPhoto(true);
    try {
      const response = await authenticatedFetch(`${BACKEND_URL}/profile/photo/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: profile.photo })
      });
      if (!response.ok) {
        throw new Error(`Import failed: ${response.status}`);
      }
      const data = await response.json().catch(() => ({}));
      if (data?.photo_url) {
        onChange({ ...profile, photo: data.photo_url }, true);
        setProfilePhotoFailed(false);
      }
    } catch (error) {
      console.error('Profile photo repair failed:', error);
      alert(t('profile.photo_upload_error'));
    } finally {
      setIsRepairingPhoto(false);
    }
  };

  // CV upload handler
  const handleCVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (isUploadingCV) return;

    const validationError = validateCvFile(file);
    if (validationError === 'type') {
      alert(t('profile.cv_type_error'));
      return;
    }
    if (validationError === 'size') {
      alert(t('profile.cv_size_error'));
      return;
    }

    setIsUploadingCV(true);

    try {
      const { cvUrl, parsedData } = await uploadAndParseCv(profile, file, {
        isPremium,
        aiCvParsingEnabled
      });

      // Merge parsed data into profile
      const updatedProfile = mergeProfileWithParsedCv(profile, cvUrl, parsedData);
      const updatedSearchProfile = enrichSearchProfileWithInference(updatedProfile);

      // Update local form data to sync UI immediately
      setFormData(prev => ({
        ...prev,
        personal: {
          ...prev.personal,
          name: parsedData.name || prev.personal.name,
          email: parsedData.email || prev.personal.email,
          phone: parsedData.phone || prev.personal.phone,
          jobTitle: parsedData.jobTitle || prev.personal.jobTitle,
        },
        experience: (parsedData.workHistory && parsedData.workHistory.length > 0) ? parsedData.workHistory : prev.experience,
        education: (parsedData.education && parsedData.education.length > 0) ? parsedData.education : prev.education,
        skills: (parsedData.skills && parsedData.skills.length > 0) ? parsedData.skills : prev.skills
      }));

      // Save the updated profile with parsed data
      onChange({
        ...updatedProfile,
        preferences: {
          ...updatedProfile.preferences,
          searchProfile: updatedSearchProfile,
        }
      }, true);
      if (!profile.preferences?.searchProfile?.primaryDomain && !profile.preferences?.searchProfile?.targetRole && (updatedSearchProfile.inferredPrimaryDomain || updatedSearchProfile.inferredTargetRole)) {
        setShowIntentNudge(true);
        focusIntentSetup();
      }
      alert(t('profile.cv_upload_success'));

      // Trigger profile refresh after a short delay to allow UI to sync
      setTimeout(() => {
        if (onRefreshProfile) {
          onRefreshProfile();
        }
      }, 1000);
    } catch (error) {
      console.error('CV upload failed:', error);
      alert(t('profile.cv_upload_error'));
    } finally {
      setIsUploadingCV(false);
      if (cvInputRef.current) {
        cvInputRef.current.value = '';
      }
    }
  };

  // Personal info update handlers
  const handlePersonalInfoChange = (field: string, value: string) => {
    const newFormData = {
      ...formData,
      personal: { ...formData.personal, [field]: value }
    };
    setFormData(newFormData);
    const nextPersonal = { ...formData.personal, [field]: value };
    const inferredSearchProfile = enrichSearchProfileWithInference({
      ...profile,
      jobTitle: nextPersonal.jobTitle,
      address: nextPersonal.address,
      phone: nextPersonal.phone,
      preferences: {
        ...profile.preferences,
        searchProfile: formData.searchProfile,
        linkedIn: nextPersonal.linkedIn,
        portfolio: nextPersonal.portfolio,
        github: nextPersonal.github,
      },
      workHistory: formData.experience,
      education: formData.education,
      skills: formData.skills,
    });
    onChange({
      ...profile,
      name: nextPersonal.name,
      jobTitle: nextPersonal.jobTitle,
      email: nextPersonal.email,
      phone: nextPersonal.phone,
      address: nextPersonal.address,
      preferredCountryCode: nextPersonal.preferredCountryCode,
      preferences: {
        ...profile.preferences,
        searchProfile: inferredSearchProfile,
        linkedIn: nextPersonal.linkedIn,
        portfolio: nextPersonal.portfolio,
        github: nextPersonal.github,
      },
    });

    // Reset verification if address changes
    if (field === 'address') {
      setAddressVerificationStatus('idle');
    }
  };

  const handleSearchProfileChange = <K extends keyof CandidateSearchProfile>(
    field: K,
    value: CandidateSearchProfile[K]
  ) => {
    const nextSearchProfile: CandidateSearchProfile = {
      ...formData.searchProfile,
      [field]: value
    };

    if (field === 'remoteLanguageCodes') {
      const uniqueCodes = Array.from(new Set((value as SearchLanguageCode[]) || []));
      nextSearchProfile.remoteLanguageCodes = (uniqueCodes.length > 0 ? uniqueCodes : ['cs']) as SearchLanguageCode[];
    }

    if (field === 'wantsRemoteRoles') {
      const wantsRemoteRoles = Boolean(value);
      nextSearchProfile.wantsRemoteRoles = wantsRemoteRoles;
      nextSearchProfile.preferredWorkArrangement = wantsRemoteRoles
        ? 'remote'
        : (nextSearchProfile.preferredWorkArrangement === 'remote' ? null : nextSearchProfile.preferredWorkArrangement);
    }

    if (field === 'preferredWorkArrangement') {
      const arrangement = value as CandidateSearchProfile['preferredWorkArrangement'];
      nextSearchProfile.preferredWorkArrangement = arrangement;
      nextSearchProfile.wantsRemoteRoles = arrangement === 'remote';
      if (arrangement === 'remote') {
        nextSearchProfile.defaultEnableCommuteFilter = false;
      }
    }

    if (field === 'preferredBenefitKeys') {
      nextSearchProfile.preferredBenefitKeys = Array.from(new Set(((value as string[]) || []).map((item) => String(item || '').trim()).filter(Boolean)));
    }

    if (field === 'secondaryDomains') {
      nextSearchProfile.secondaryDomains = Array.from(new Set(((value as CandidateDomainKey[]) || []).filter(Boolean))).slice(0, 2);
    }

    if (field === 'avoidDomains') {
      nextSearchProfile.avoidDomains = Array.from(new Set(((value as CandidateDomainKey[]) || []).filter(Boolean))).slice(0, 3);
    }

    if (field === 'defaultMaxDistanceKm') {
      nextSearchProfile.defaultMaxDistanceKm = Math.max(5, Number(value) || 5);
    }

    if (field === 'targetRole') {
      nextSearchProfile.targetRole = String(value || '').trim();
    }

    const nextProfileDraft: UserProfile = {
      ...profile,
      jobTitle: formData.personal.jobTitle,
      workHistory: formData.experience,
      education: formData.education,
      skills: formData.skills,
      preferences: {
        ...profile.preferences,
        searchProfile: nextSearchProfile
      }
    };
    const enrichedSearchProfile = enrichSearchProfileWithInference(nextProfileDraft);

    setFormData(prev => ({ ...prev, searchProfile: { ...nextSearchProfile, ...enrichedSearchProfile } }));
    onChange({
      ...nextProfileDraft,
      preferences: {
        ...nextProfileDraft.preferences,
        searchProfile: { ...nextSearchProfile, ...enrichedSearchProfile }
      }
    });
  };

  const toggleBenefitPriority = (benefitKey: string) => {
    const current = formData.searchProfile.preferredBenefitKeys || [];
    const next = current.includes(benefitKey)
      ? current.filter((item) => item !== benefitKey)
      : [...current, benefitKey];
    handleSearchProfileChange('preferredBenefitKeys', next);
  };

  const syncDogFriendlySetup = (checked: boolean) => {
    const current = formData.searchProfile.preferredBenefitKeys || [];
    const nextBenefitKeys = checked
      ? Array.from(new Set([...current, 'dog_friendly']))
      : current.filter((item) => item !== 'dog_friendly');
    const nextSearchProfile: CandidateSearchProfile = {
      ...formData.searchProfile,
      wantsDogFriendlyOffice: checked,
      preferredBenefitKeys: nextBenefitKeys,
    };
    const nextProfileDraft: UserProfile = {
      ...profile,
      jobTitle: formData.personal.jobTitle,
      workHistory: formData.experience,
      education: formData.education,
      skills: formData.skills,
      preferences: {
        ...profile.preferences,
        searchProfile: nextSearchProfile,
      },
    };
    const enrichedSearchProfile = enrichSearchProfileWithInference(nextProfileDraft);
    setFormData((prev) => ({
      ...prev,
      searchProfile: { ...nextSearchProfile, ...enrichedSearchProfile },
    }));
    onChange({
      ...nextProfileDraft,
      preferences: {
        ...nextProfileDraft.preferences,
        searchProfile: { ...nextSearchProfile, ...enrichedSearchProfile },
      },
    });
  };

  const syncChildFriendlySetup = (checked: boolean) => {
    const childKeys = ['child_friendly', 'childcare_support'];
    const current = formData.searchProfile.preferredBenefitKeys || [];
    const nextSearchProfile: CandidateSearchProfile = {
      ...formData.searchProfile,
      preferredBenefitKeys: checked
        ? Array.from(new Set([...current, ...childKeys]))
        : current.filter((item) => !childKeys.includes(item)),
    };
    const nextProfileDraft: UserProfile = {
      ...profile,
      jobTitle: formData.personal.jobTitle,
      workHistory: formData.experience,
      education: formData.education,
      skills: formData.skills,
      preferences: {
        ...profile.preferences,
        searchProfile: nextSearchProfile,
      },
    };
    const enrichedSearchProfile = enrichSearchProfileWithInference(nextProfileDraft);
    setFormData((prev) => ({
      ...prev,
      searchProfile: { ...nextSearchProfile, ...enrichedSearchProfile },
    }));
    onChange({
      ...nextProfileDraft,
      preferences: {
        ...nextProfileDraft.preferences,
        searchProfile: { ...nextSearchProfile, ...enrichedSearchProfile },
      },
    });
  };

  const handleNotificationChange = (field: string, value: string | boolean) => {
    const newNotifications = { ...formData.notifications, [field]: value };
    const newFormData = { ...formData, notifications: newNotifications };
    setFormData(newFormData);
    onChange({
      ...profile,
      dailyDigestEnabled: newNotifications.dailyDigestEnabled,
      dailyDigestPushEnabled: newNotifications.dailyDigestPushEnabled,
      dailyDigestTime: newNotifications.dailyDigestTime,
      dailyDigestTimezone: newNotifications.dailyDigestTimezone
    });
  };

  const handleTaxProfileChange = <K extends keyof TaxProfile>(field: K, value: TaxProfile[K]) => {
    const updatedTaxProfile: TaxProfile = { ...formData.taxProfile, [field]: value };
    setFormData(prev => ({ ...prev, taxProfile: updatedTaxProfile }));
    onChange({ ...profile, taxProfile: updatedTaxProfile });
  };

  const handleTaxCountryChange = (nextCountry: TaxProfile['countryCode']) => {
    const defaults = createDefaultTaxProfileByCountry(nextCountry, formData.taxProfile.taxYear);
    const updatedTaxProfile: TaxProfile = {
      ...defaults,
      employmentType: formData.taxProfile.employmentType,
      maritalStatus: formData.taxProfile.maritalStatus,
      spouseAnnualIncome: formData.taxProfile.spouseAnnualIncome || 0,
      childrenCount: formData.taxProfile.childrenCount || 0,
      isSingleParent: formData.taxProfile.isSingleParent || false,
    };
    setFormData(prev => ({ ...prev, taxProfile: updatedTaxProfile }));
    onChange({ ...profile, taxProfile: updatedTaxProfile });
  };

  const handleJhiPreferenceWeightChange = (field: keyof JHIPreferences['pillarWeights'], value: number) => {
    if (!isPremium) return;
    const updated: JHIPreferences = {
      ...formData.jhiPreferences,
      pillarWeights: {
        ...formData.jhiPreferences.pillarWeights,
        [field]: Math.max(0, Math.min(1, value))
      }
    };
    setFormData(prev => ({ ...prev, jhiPreferences: updated }));
    onChange({ ...profile, jhiPreferences: updated });
  };

  const handleJhiConstraintChange = <K extends keyof JHIPreferences['hardConstraints']>(
    field: K,
    value: JHIPreferences['hardConstraints'][K]
  ) => {
    if (!isPremium) return;
    const updated: JHIPreferences = {
      ...formData.jhiPreferences,
      hardConstraints: {
        ...formData.jhiPreferences.hardConstraints,
        [field]: value
      }
    };
    setFormData(prev => ({ ...prev, jhiPreferences: updated }));
    onChange({ ...profile, jhiPreferences: updated });
  };

  const handleJhiWorkStyleChange = <K extends keyof JHIPreferences['workStyle']>(
    field: K,
    value: JHIPreferences['workStyle'][K]
  ) => {
    if (!isPremium) return;
    const updated: JHIPreferences = {
      ...formData.jhiPreferences,
      workStyle: {
        ...formData.jhiPreferences.workStyle,
        [field]: value
      }
    };
    setFormData(prev => ({ ...prev, jhiPreferences: updated }));
    onChange({ ...profile, jhiPreferences: updated });
  };

  const sliderTrackStyle = (value: number) => ({
    background: `linear-gradient(90deg, rgb(6 182 212) ${value}%, rgb(203 213 225) ${value}%)`
  });

  const applyJhiPreset = (preset: 'balanced' | 'money' | 'calm') => {
    if (!isPremium) return;
    const next: JHIPreferences = preset === 'money'
      ? {
        pillarWeights: {
          financial: 0.5,
          timeCost: 0.15,
          mentalLoad: 0.1,
          growth: 0.15,
          values: 0.1
        },
        hardConstraints: {
          mustRemote: false,
          maxCommuteMinutes: 60,
          minNetMonthly: formData.jhiPreferences.hardConstraints.minNetMonthly,
          excludeShift: false,
          growthRequired: false
        },
        workStyle: {
          peopleIntensity: 55,
          careerGrowthPreference: 75,
          homeOfficePreference: 55
        }
      }
      : preset === 'calm'
        ? {
          pillarWeights: {
            financial: 0.15,
            timeCost: 0.35,
            mentalLoad: 0.3,
            growth: 0.05,
            values: 0.15
          },
          hardConstraints: {
            mustRemote: false,
            maxCommuteMinutes: 35,
            minNetMonthly: formData.jhiPreferences.hardConstraints.minNetMonthly,
            excludeShift: true,
            growthRequired: false
          },
          workStyle: {
            peopleIntensity: 35,
            careerGrowthPreference: 35,
            homeOfficePreference: 80
          }
        }
        : createDefaultJHIPreferences();

    setFormData(prev => ({ ...prev, jhiPreferences: next }));
    onChange({ ...profile, jhiPreferences: next });
  };

  const handleEnablePush = async () => {
    if (!pushSupported || pushBusy) return;
    setPushBusy(true);
    try {
      const subscription = await subscribeToPush();
      if (!subscription) {
        setPushPermission(getPushPermission());
        return;
      }
      await registerPushSubscription(subscription);
      setPushSubscribed(true);
      setPushPermission('granted');
      const updatedProfile = {
        ...profile,
        dailyDigestPushEnabled: true
      };
      setFormData(prev => ({
        ...prev,
        notifications: { ...prev.notifications, dailyDigestPushEnabled: true }
      }));
      onChange(updatedProfile, true);
    } catch (error) {
      console.error('Push subscription failed:', error);
    } finally {
      setPushBusy(false);
    }
  };

  const handleDisablePush = async () => {
    if (!pushSupported || pushBusy) return;
    setPushBusy(true);
    try {
      await unsubscribeFromPush();
      setPushSubscribed(false);
      const updatedProfile = {
        ...profile,
        dailyDigestPushEnabled: false
      };
      setFormData(prev => ({
        ...prev,
        notifications: { ...prev.notifications, dailyDigestPushEnabled: false }
      }));
      onChange(updatedProfile, true);
    } catch (error) {
      console.error('Push unsubscribe failed:', error);
    } finally {
      setPushBusy(false);
    }
  };

  const handleVerifyAddress = async () => {
    if (!formData.personal.address) return;

    setIsVerifyingAddress(true);
    setAddressVerificationStatus('idle');

    try {
      const coords = await resolveAddressToCoordinates(formData.personal.address);
      if (coords) {
        setAddressVerificationStatus('success');
        // Update profile with new coordinates
        onChange({
          ...profile,
          name: formData.personal.name,
          jobTitle: formData.personal.jobTitle,
          email: formData.personal.email,
          phone: formData.personal.phone,
          address: formData.personal.address,
          coordinates: coords
        }, true);
      } else {
        setAddressVerificationStatus('error');
      }
    } catch (e) {
      console.error("Address verification failed", e);
      setAddressVerificationStatus('error');
    } finally {
      setIsVerifyingAddress(false);
    }
  };

  // Experience handlers
  const handleAddExperience = () => {
    const newExperience: WorkExperience = {
      id: Date.now().toString(),
      company: '',
      role: '',
      duration: '',
      description: ''
    };
    const newFormData = {
      ...formData,
      experience: [...formData.experience, newExperience]
    };
    setFormData(newFormData);
    setActiveExperienceId(newExperience.id);
    onChange({ ...profile, workHistory: newFormData.experience });
  };

  const handleUpdateExperience = (id: string, field: keyof WorkExperience, value: string) => {
    const updatedExperience = formData.experience.map(exp =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    const newFormData = { ...formData, experience: updatedExperience };
    setFormData(newFormData);
    onChange({ ...profile, workHistory: updatedExperience });
  };

  const handleRemoveExperience = (id: string) => {
    const updatedExperience = formData.experience.filter(exp => exp.id !== id);
    const newFormData = { ...formData, experience: updatedExperience };
    setFormData(newFormData);
    if (activeExperienceId === id) {
      setActiveExperienceId(updatedExperience.length > 0 ? updatedExperience[0].id : null);
    }
    onChange({ ...profile, workHistory: updatedExperience });
  };

  // Education handlers
  const handleAddEducation = () => {
    const newEducation: Education = {
      id: Date.now().toString(),
      school: '',
      degree: '',
      field: '',
      year: ''
    };
    const newFormData = {
      ...formData,
      education: [...formData.education, newEducation]
    };
    setFormData(newFormData);
    setActiveEducationId(newEducation.id);
    onChange({ ...profile, education: newFormData.education });
  };

  const handleUpdateEducation = (id: string, field: keyof Education, value: string) => {
    const updatedEducation = formData.education.map(edu =>
      edu.id === id ? { ...edu, [field]: value } : edu
    );
    const newFormData = { ...formData, education: updatedEducation };
    setFormData(newFormData);
    onChange({ ...profile, education: updatedEducation });
  };

  const handleRemoveEducation = (id: string) => {
    const updatedEducation = formData.education.filter(edu => edu.id !== id);
    const newFormData = { ...formData, education: updatedEducation };
    setFormData(newFormData);
    if (activeEducationId === id) {
      setActiveEducationId(updatedEducation.length > 0 ? updatedEducation[0].id : null);
    }
    onChange({ ...profile, education: updatedEducation });
  };

  // Skills handlers
  const handleAddSkill = () => {
    const newSkill = prompt(t('profile.add_skill_prompt'));
    if (newSkill && newSkill.trim()) {
      const updatedSkills = [...formData.skills, newSkill.trim()];
      const newFormData = { ...formData, skills: updatedSkills };
      setFormData(newFormData);
      onChange({ ...profile, skills: updatedSkills });
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updatedSkills = formData.skills.filter(skill => skill !== skillToRemove);
    const newFormData = { ...formData, skills: updatedSkills };
    setFormData(newFormData);
    onChange({ ...profile, skills: updatedSkills });
  };

  const handleSaveClick = async () => {
    if (isSavingProfile) return;
    setIsSavingProfile(true);
    setSaveFeedback(null);
    try {
      const result = await Promise.resolve(onSave());
      if (result === false) {
        setSaveFeedback({
          type: 'error',
          text: t('profile.save_error', { defaultValue: 'Uložení se nepodařilo.' })
        });
        return;
      }
      setSaveFeedback({
        type: 'success',
        text: t('profile.save_success', { defaultValue: 'Změny byly uloženy.' })
      });
      setTimeout(() => setSaveFeedback(null), 3500);
    } catch (error) {
      console.error('Profile save failed in editor:', error);
      setSaveFeedback({
        type: 'error',
        text: t('profile.save_error', { defaultValue: 'Uložení se nepodařilo.' })
      });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSignOutClick = async () => {
    if (!onSignOut || isSigningOut) return;
    setIsSigningOut(true);
    try {
      await onSignOut();
    } catch (error) {
      console.error('Profile sign out failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  };


  const handlePasswordChange = async () => {
    if (isChangingPassword) return;
    setPasswordFeedback(null);

    if (!profile.isLoggedIn) {
      setPasswordFeedback({
        type: 'error',
        text: t('auth.login', { defaultValue: 'Přihlaste se prosím.' })
      });
      return;
    }

    if (!passwordForm.nextPassword || passwordForm.nextPassword.length < 6) {
      setPasswordFeedback({
        type: 'error',
        text: t('auth.password_too_short', { defaultValue: 'Heslo musí mít alespoň 6 znaků.' })
      });
      return;
    }

    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      setPasswordFeedback({
        type: 'error',
        text: t('auth.passwords_mismatch', { defaultValue: 'Hesla se neshodují.' })
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await updateCurrentUserPassword(passwordForm.nextPassword);
      setPasswordForm({ nextPassword: '', confirmPassword: '' });
      setPasswordFeedback({
        type: 'success',
        text: t('auth.password_reset_success', { defaultValue: 'Heslo bylo úspěšně změněno.' })
      });
    } catch (error: any) {
      console.error('Password change failed:', error);
      setPasswordFeedback({
        type: 'error',
        text: error?.message || t('auth.reset_password_failed', { defaultValue: 'Nepodařilo se změnit heslo.' })
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="app-shell-bg relative min-h-screen overflow-x-clip bg-white dark:bg-slate-950">
      <AppShellAtmosphere />
      <div className="relative mx-auto w-full max-w-[1680px] space-y-6 px-3 pb-10 pt-6 sm:px-5 lg:px-8">
        {/* Header */}
        <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_14px_34px_-28px_rgba(15,23,42,0.16)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full items-start gap-4 sm:w-auto sm:items-center">
              <div className="relative">
                {profile.photo && !profilePhotoFailed ? (
                  <img
                    src={profile.photo}
                    alt="Profile"
                    className="h-20 w-20 rounded-[18px] border border-[var(--border)] object-cover sm:h-24 sm:w-24"
                    onError={() => setProfilePhotoFailed(true)}
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-[18px] border border-[var(--border)] bg-[var(--surface-muted)] sm:h-24 sm:w-24">
                    <Camera size={32} className="text-[var(--text-muted)]" />
                  </div>
                )}

                <label className="absolute bottom-0 right-0 cursor-pointer rounded-[10px] border border-[var(--border-subtle)] bg-white p-2 text-slate-700 transition-colors hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    disabled={isUploadingPhoto}
                    className="hidden"
                  />
                  <Upload size={14} />
                </label>
              </div>

              <div className="min-w-0">
                <span className="app-eyebrow">
                  {profileHeroCopy.eyebrow}
                </span>
                <h1 className="mt-2 break-words text-2xl font-semibold text-[var(--text-strong)] sm:text-3xl">
                  {profile.name || t('profile.placeholder_name')}
                </h1>
                <p className="break-words text-sm text-[var(--text-muted)] sm:text-base">
                  {profile.jobTitle || t('profile.placeholder_job')}
                </p>
                <p className="mt-2 max-w-2xl text-xs text-[var(--text-muted)] sm:text-sm">
                  {profileHeroCopy.subtitle}
                </p>
                {isExternalProfilePhotoUrl(profile.photo) && (
                  <button
                    onClick={handlePhotoRepair}
                    disabled={isRepairingPhoto}
                  className="mt-2 inline-flex items-center gap-2 rounded-[999px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    {isRepairingPhoto ? t('profile.photo_uploading') : t('profile.photo_repair')}
                  </button>
                )}
              </div>
            </div>

            <div className="w-full max-w-[34rem] space-y-3 lg:w-auto">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="min-w-0 break-words text-[10px] leading-tight text-[var(--text-faint)]">{profileHeroCopy.readiness}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-strong)]">{profileReadinessScore}%</div>
                </div>
                <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="min-w-0 break-words text-[10px] leading-tight text-[var(--text-faint)]">{profileHeroCopy.sections}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-strong)]">{profileTotalSections}</div>
                </div>
                <div className="rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="min-w-0 break-words text-[10px] leading-tight text-[var(--text-faint)]">{profileHeroCopy.docs}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-strong)]">{profileDocumentsReady}/2</div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={handleSignOutClick}
                  disabled={!onSignOut || isSigningOut}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-elevated)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut size={17} />
                  {isSigningOut ? t('app.loading', { defaultValue: 'Loading...' }) : t('common.logout', { defaultValue: 'Logout' })}
                </button>
                <button
                  onClick={handleSaveClick}
                  disabled={isSavingProfile}
                  className={`${profilePrimaryButtonClass} w-full px-6 py-3`}
                >
                  <Save size={18} />
                  {isSavingProfile ? t('app.saving') : t('profile.save_profile')}
                </button>
              </div>
            </div>
          </div>
          {saveFeedback && (
            <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${saveFeedback.type === 'success'
              ? 'text-amber-600 dark:text-amber-300'
              : 'text-rose-600 dark:text-rose-300'
              }`}>
              <CheckCircle size={16} />
              <span>{saveFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className={`${profileSurfaceClass} p-2.5`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            {profileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-[14px] border px-3 py-3 text-left transition-all ${isActive
                    ? 'border-[var(--border)] bg-white text-[var(--text-strong)] shadow-[0_10px_24px_-18px_rgba(15,23,42,0.18)] dark:bg-slate-950'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text)] hover:-translate-y-[1px] hover:border-[var(--border)] hover:bg-[var(--surface-elevated)]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-[10px] p-2 ${isActive ? 'bg-[var(--surface-muted)] text-[var(--text-strong)]' : 'bg-[var(--surface-elevated)] text-[var(--text-muted)]'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-tight">{tab.label}</div>
                      {tab.caption ? (
                        <div className={`mt-0.5 text-[11px] leading-tight ${isActive ? 'text-[var(--text-muted)]' : 'text-[var(--text-faint)]'}`}>
                          {tab.caption}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab !== 'saved' ? (
          <>

            {isProfileTab && (
              <>
                {/* Personal Information Section */}
                <div className={profileSurfaceClass}>
                  <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={profileAccentIconShellClass}>
                          <User className={profileAccentIconClass} />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.personal_info')}</h2>
                      </div>
                      <button
                        onClick={() => setEditingSection(editingSection === 'personal' ? null : 'personal')}
                        className={profileIconButtonClass}
                      >
                        <Edit size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.full_name')}</label>
                        <input
                          type="text"
                          value={formData.personal.name}
                          onChange={(e) => handlePersonalInfoChange('name', e.target.value)}
                          className={profileInputClass}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.job_title')}</label>
                        <input
                          type="text"
                          value={formData.personal.jobTitle}
                          onChange={(e) => handlePersonalInfoChange('jobTitle', e.target.value)}
                          className={profileInputClass}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.phone')}</label>
                        <input
                          type="tel"
                          value={formData.personal.phone}
                          onChange={(e) => handlePersonalInfoChange('phone', e.target.value)}
                          className={profileInputClass}
                        />
                      </div>
                    </div>

                    <div className="mt-6">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.address')}</label>
                      <input
                        type="text"
                        value={formData.personal.address}
                        onChange={(e) => handlePersonalInfoChange('address', e.target.value)}
                        className={`w-full rounded-[0.95rem] border bg-[var(--surface-muted)] px-4 py-2.5 text-[var(--text-strong)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] ${addressVerificationStatus === 'success' ? 'border-amber-500 pr-12' :
                          addressVerificationStatus === 'error' ? 'border-rose-500' :
                            'border-[var(--border)]'
                          }`}
                        placeholder={t('profile.address_placeholder')}
                      />
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={handleVerifyAddress}
                          disabled={isVerifyingAddress || !formData.personal.address}
                          className={`text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors ${addressVerificationStatus === 'success'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                        >
                          {isVerifyingAddress ? (
                            <>
                              <span className="animate-spin">⌛</span> {t('profile.verifying')}
                            </>
                          ) : addressVerificationStatus === 'success' ? (
                            <>
                              <CheckCircle size={14} /> {t('profile.address_verified')}
                            </>
                          ) : (
                            <>
                              <MapPin size={14} /> {t('profile.verify_address')}
                            </>
                          )}
                        </button>

                        {addressVerificationStatus === 'error' && (
                          <span className="text-xs text-rose-500 flex items-center gap-1">
                            <AlertCircle size={12} /> {t('profile.verification_failed')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.linkedin')}</label>
                        <div className="relative">
                          <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input
                            type="url"
                            value={formData.personal.linkedIn}
                            onChange={(e) => handlePersonalInfoChange('linkedIn', e.target.value)}
                            className={`${profileInputClass} py-2.5 pl-10 pr-4`}
                            placeholder={t('profile.linkedin_placeholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.portfolio')}</label>
                        <div className="relative">
                          <ExternalLink className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input
                            type="url"
                            value={formData.personal.portfolio}
                            onChange={(e) => handlePersonalInfoChange('portfolio', e.target.value)}
                            className={`${profileInputClass} py-2.5 pl-10 pr-4`}
                            placeholder={t('profile.portfolio_placeholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.github')}</label>
                        <div className="relative">
                          <Link className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                          <input
                            type="url"
                            value={formData.personal.github}
                            onChange={(e) => handlePersonalInfoChange('github', e.target.value)}
                            className={`${profileInputClass} py-2.5 pl-10 pr-4`}
                            placeholder={t('profile.github_placeholder')}
                          />
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </>
            )}

            {isEvidenceTab && (
              <>
                <div className="grid grid-cols-1 2xl:grid-cols-5 gap-6 items-start">
                  <div className="2xl:col-span-2">
                    {renderAiGuidePanel}
                  </div>
                  <div className="2xl:col-span-3">
                    {/* Supporting Context Section */}
                    <div className={profileSurfaceClass}>
                      <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="flex items-start gap-3">
                          <div className={profileAccentIconShellClass}>
                            <FileText className={profileAccentIconClass} />
                          </div>
                          <div>
                            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                              {t('profile.supporting_context_section', { defaultValue: supportingContextCopy.sectionTitle })}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                              {t('profile.supporting_context_desc', { defaultValue: supportingContextCopy.sectionIntro })}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="p-6">
                        <input
                          ref={cvInputRef}
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleCVUpload}
                          className="hidden"
                        />

                        <div className={`w-full rounded-lg border-2 border-dashed p-5 transition-colors ${profile.cvUrl ? 'border-[rgba(var(--accent-rgb),0.42)] bg-[rgba(var(--accent-rgb),0.08)]' : 'border-slate-300 hover:border-[rgba(var(--accent-rgb),0.3)]'
                          }`}>
                          <div className="text-center">
                            <FileText className={`mx-auto mb-3 h-10 w-10 ${profile.cvUrl ? 'text-[var(--accent)]' : 'text-slate-400'}`} />

                            {profile.cvUrl ? (
                              <div>
                                <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                  {t('profile.cv_uploaded', { defaultValue: supportingContextCopy.uploadedTitle })}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 flex items-center justify-center gap-2">
                                  <CheckCircle className="w-4 h-4 text-amber-500" />
                                  <span>{t('profile.cv_upload_success', { defaultValue: supportingContextCopy.uploadedDesc })}</span>
                                </p>
                                <button
                                  onClick={() => cvInputRef.current?.click()}
                                  disabled={isUploadingCV}
                                  className={`${profilePrimaryButtonClass} px-4 py-2 text-sm`}
                                >
                                  {t('profile.replace_cv', { defaultValue: supportingContextCopy.replaceLabel })}
                                </button>
                              </div>
                            ) : (
                              <div>
                                <p className="text-lg font-medium text-slate-900 dark:text-white mb-2">
                                  {t('profile.upload_cv', { defaultValue: supportingContextCopy.emptyTitle })}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                                  {t('profile.upload_cv_desc', { defaultValue: supportingContextCopy.emptyDesc })}
                                </p>
                                <button
                                  onClick={() => cvInputRef.current?.click()}
                                  disabled={isUploadingCV}
                                  className={`${profilePrimaryButtonClass} px-6 py-3 ${isUploadingCV ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  {isUploadingCV ? t('profile.uploading') : t('profile.select_cv_file', { defaultValue: supportingContextCopy.selectLabel })}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {profile.id && (
                          <div className="mt-6 border-t border-slate-200 dark:border-slate-700 pt-6">
                            <h4 className="font-semibold text-slate-900 dark:text-white mb-3">
                              {t('cv_manager.title', { defaultValue: supportingContextCopy.libraryTitle })}
                            </h4>
                            <CVManager userId={profile.id} isPremium={isPremium} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {isProfileTab && (
              <>
                {/* Work Experience Section */}
                <div className={profileSurfaceClass}>
                  <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={profileAccentIconShellClass}>
                          <Briefcase className={profileAccentIconClass} />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.experience')}</h2>
                      </div>
                      <button
                        onClick={handleAddExperience}
                        className={profileIconButtonClass}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {formData.experience.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('profile.no_experience')}</p>
                        <button
                          onClick={handleAddExperience}
                          className="mt-4 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                        >
                          {t('profile.add_first_experience')}
                        </button>
                      </div>
                    ) : (
                      formData.experience.map((experience, index) => (
                        <div key={`${experience.id || 'exp'}-${index}`} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                              {experience.role || t('profile.new_role')} {experience.company && `@ ${experience.company}`}
                            </h3>
                            <div className="flex items-center gap-2">
                              {activeExperienceId !== experience.id && (
                                <button
                                  onClick={() => setActiveExperienceId(experience.id)}
                                  className="px-2.5 py-1.5 text-xs rounded-md border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[rgba(var(--accent-rgb),0.12)]"
                                >
                                  {t('app.edit', { defaultValue: 'Upravit' })}
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveExperience(experience.id)}
                                className="text-red-500 hover:text-red-600 transition-colors"
                                title={t('app.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {activeExperienceId === experience.id ? (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.company')}</label>
                                  <input
                                    type="text"
                                    value={experience.company}
                                    onChange={(e) => handleUpdateExperience(experience.id, 'company', e.target.value)}
                                    className={profileCompactInputClass}
                                    placeholder={t('profile.company_placeholder')}
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.role')}</label>
                                  <input
                                    type="text"
                                    value={experience.role}
                                    onChange={(e) => handleUpdateExperience(experience.id, 'role', e.target.value)}
                                    className={profileCompactInputClass}
                                    placeholder={t('profile.role_placeholder')}
                                  />
                                </div>
                              </div>

                              <div className="mt-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.duration')}</label>
                                <input
                                  type="text"
                                  value={experience.duration}
                                  onChange={(e) => handleUpdateExperience(experience.id, 'duration', e.target.value)}
                                  className={profileCompactInputClass}
                                  placeholder={t('profile.duration_placeholder')}
                                />
                              </div>

                              <div className="mt-4">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.description')}</label>
                                <textarea
                                  value={experience.description}
                                  onChange={(e) => handleUpdateExperience(experience.id, 'description', e.target.value)}
                                  className={`${profileCompactInputClass} resize-none`}
                                  rows={3}
                                  placeholder={t('profile.description_placeholder')}
                                />
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              <div>{experience.duration || t('profile.duration_placeholder')}</div>
                              {experience.description && (
                                <p className="mt-2">{experience.description}</p>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Education Section */}
                <div className={profileSurfaceClass}>
                  <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={profileAccentIconShellClass}>
                          <GraduationCap className={profileAccentIconClass} />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.education')}</h2>
                      </div>
                      <button
                        onClick={handleAddEducation}
                        className={profileIconButtonClass}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 space-y-4">
                    {formData.education.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <GraduationCap className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('profile.no_education')}</p>
                        <button
                          onClick={handleAddEducation}
                          className="mt-4 font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                        >
                          {t('profile.add_first_education')}
                        </button>
                      </div>
                    ) : (
                      formData.education.map((edu, index) => (
                        <div key={`${edu.id || 'edu'}-${index}`} className="border border-slate-200 dark:border-slate-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-slate-900 dark:text-white">
                              {edu.degree || t('profile.new_education')} {edu.school && `@ ${edu.school}`}
                            </h3>
                            <div className="flex items-center gap-2">
                              {activeEducationId !== edu.id && (
                                <button
                                  onClick={() => setActiveEducationId(edu.id)}
                                  className="px-2.5 py-1.5 text-xs rounded-md border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[rgba(var(--accent-rgb),0.12)]"
                                >
                                  {t('app.edit', { defaultValue: 'Upravit' })}
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveEducation(edu.id)}
                                className="text-red-500 hover:text-red-600 transition-colors"
                                title={t('app.delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {activeEducationId === edu.id ? (
                            <>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.school')}</label>
                                  <input
                                    type="text"
                                    value={edu.school}
                                    onChange={(e) => handleUpdateEducation(edu.id, 'school', e.target.value)}
                                    className={profileCompactInputClass}
                                    placeholder={t('profile.school_placeholder')}
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.degree')}</label>
                                  <input
                                    type="text"
                                    value={edu.degree}
                                    onChange={(e) => handleUpdateEducation(edu.id, 'degree', e.target.value)}
                                    className={profileCompactInputClass}
                                    placeholder={t('profile.degree_placeholder')}
                                  />
                                </div>
                              </div>

                              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.field')}</label>
                                  <input
                                    type="text"
                                    value={edu.field}
                                    onChange={(e) => handleUpdateEducation(edu.id, 'field', e.target.value)}
                                    className={profileCompactInputClass}
                                    placeholder={t('profile.field_placeholder')}
                                  />
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('profile.year')}</label>
                                  <input
                                    type="text"
                                    value={edu.year}
                                    onChange={(e) => handleUpdateEducation(edu.id, 'year', e.target.value)}
                                    className={profileCompactInputClass}
                                    placeholder={t('profile.year_placeholder')}
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              <div>{edu.field || t('profile.field_placeholder')}</div>
                              <div>{edu.year || t('profile.year_placeholder')}</div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Skills Section */}
                <div className={profileSurfaceClass}>
                  <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={profileAccentIconShellClass}>
                          <Award className={profileAccentIconClass} />
                        </div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{t('profile.skills')}</h2>
                        <span className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-2 py-1 text-sm text-[var(--accent)]">
                          {t('profile.skills_count', { count: formData.skills.length })}
                        </span>
                      </div>
                      <button
                        onClick={handleAddSkill}
                        className={profileIconButtonClass}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6">
                    {formData.skills.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                        <Award className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('profile.no_skills')}</p>
                        <p className="text-sm mt-2 mb-4">{t('profile.skills_key_desc')}</p>
                        <button
                          onClick={handleAddSkill}
                          className="font-medium text-[var(--accent)] transition-colors hover:text-[var(--accent-hover)]"
                        >
                          {t('profile.add_first_skill')}
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {formData.skills.map((skill, index) => (
                            <div key={index} className="group relative">
                              <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-1 text-sm text-[var(--accent)]">
                                {skill}
                                <button
                                  onClick={() => handleRemoveSkill(skill)}
                                  className="ml-2 text-[var(--accent)] transition-colors hover:text-red-500"
                                  title={t('app.delete')}
                                >
                                  <X size={14} />
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>

                        <div className={profileAccentPanelClass}>
                          <h4 className="mb-2 font-medium text-[var(--text-strong)]">{t('profile.skills_importance_title')}</h4>
                          <ul className="space-y-1 text-sm text-[var(--text-muted)]">
                            <li>• {t('profile.skills_importance_1')}</li>
                            <li>• {t('profile.skills_importance_2')}</li>
                            <li>• {t('profile.skills_importance_3')}</li>
                            <li>• {t('profile.skills_importance_4')}</li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {showAIGuide && (
              <AIGuidedProfileWizard
                profile={profile}
                onClose={() => setShowAIGuide(false)}
                onApply={async (updates) => {
                  const updated = { ...profile, ...updates };
                  await Promise.resolve(onChange(updated, true));
                  if (onRefreshProfile) {
                    await onRefreshProfile();
                  }
                  setShowAIGuide(false);
                }}
              />
            )}

            {isWorkTab && (
              <>
                {renderIntentSetupPanel}
                {renderPremiumSearchSetupPanel}

                <div className={profileSurfaceClass}>
                  <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <div className={profileAccentIconShellClass}>
                        <Calculator className={profileAccentIconClass} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('profile.tax.title')}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {isPremium
                            ? `${formData.taxProfile.countryCode} • ${formData.taxProfile.taxYear} • ${t(`profile.tax.${formData.taxProfile.employmentType}`)} • ${t('profile.tax.children')}: ${formData.taxProfile.childrenCount}`
                            : t('profile.tax.paywall_hint', { defaultValue: 'Daňový profil zpřesní čistý příjem, srovnání HPP vs. IČO a realističtější výpočet vaší pracovní situace.' })}
                        </p>
                      </div>
                    </div>
                  </div>
                  {isPremium ? (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.tax.country')}</label>
                        <select
                          value={formData.taxProfile.countryCode}
                          onChange={(e) => handleTaxCountryChange(e.target.value as TaxProfile['countryCode'])}
                          className={profileCompactInputClass}
                        >
                          <option value="CZ">CZ</option>
                          <option value="SK">SK</option>
                          <option value="PL">PL</option>
                          <option value="DE">DE</option>
                          <option value="AT">AT</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.tax.year')}</label>
                        <input
                          type="number"
                          value={formData.taxProfile.taxYear}
                          onChange={(e) => handleTaxProfileChange('taxYear', Number(e.target.value) || 2026)}
                          className={profileCompactInputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.tax.employment_type')}</label>
                        <select
                          value={formData.taxProfile.employmentType}
                          onChange={(e) => handleTaxProfileChange('employmentType', e.target.value as TaxProfile['employmentType'])}
                          className={profileCompactInputClass}
                        >
                          <option value="employee">{t('profile.tax.employee')}</option>
                          <option value="contractor">{t('profile.tax.contractor')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.tax.marital_status')}</label>
                        <select
                          value={formData.taxProfile.maritalStatus}
                          onChange={(e) => handleTaxProfileChange('maritalStatus', e.target.value as TaxProfile['maritalStatus'])}
                          className={profileCompactInputClass}
                        >
                          <option value="single">{t('profile.tax.single')}</option>
                          <option value="married">{t('profile.tax.married')}</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.tax.children')}</label>
                        <input
                          type="number"
                          min={0}
                          value={formData.taxProfile.childrenCount}
                          onChange={(e) => handleTaxProfileChange('childrenCount', Math.max(0, Number(e.target.value) || 0))}
                          className={profileCompactInputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.tax.spouse_income')}</label>
                        <input
                          type="number"
                          min={0}
                          value={formData.taxProfile.spouseAnnualIncome || 0}
                          onChange={(e) => handleTaxProfileChange('spouseAnnualIncome', Math.max(0, Number(e.target.value) || 0))}
                          className={profileCompactInputClass}
                        />
                      </div>
                      {formData.taxProfile.countryCode === 'DE' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              {t('profile.tax.de_tax_class', { defaultValue: 'Daňová třída (DE)' })}
                            </label>
                            <select
                              value={formData.taxProfile.deTaxClass || (formData.taxProfile.maritalStatus === 'married' ? 'IV' : 'I')}
                              onChange={(e) => handleTaxProfileChange('deTaxClass', e.target.value as TaxProfile['deTaxClass'])}
                              className={profileCompactInputClass}
                            >
                              <option value="I">I</option>
                              <option value="II">II</option>
                              <option value="III">III</option>
                              <option value="IV">IV</option>
                              <option value="V">V</option>
                              <option value="VI">VI</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              {t('profile.tax.de_church_tax', { defaultValue: 'Církevní daň (DE)' })}
                            </label>
                            <select
                              value={formData.taxProfile.deChurchTaxRate ?? 0}
                              onChange={(e) => handleTaxProfileChange('deChurchTaxRate', Number(e.target.value))}
                              className={profileCompactInputClass}
                            >
                              <option value={0}>{t('profile.tax.de_church_none', { defaultValue: 'Ne' })}</option>
                              <option value={0.08}>8 %</option>
                              <option value={0.09}>9 %</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              {t('profile.tax.de_kvz', { defaultValue: 'KVZ (DE) – Zusatzbeitragssatz %' })}
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              value={formData.taxProfile.deKvzRate ?? 2.9}
                              onChange={(e) => handleTaxProfileChange('deKvzRate', Number(e.target.value) || 0)}
                              className={profileCompactInputClass}
                            />
                          </div>
                        </>
                      )}
                      {formData.taxProfile.countryCode === 'AT' && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            {t('profile.tax.at_13_14', { defaultValue: '13./14. plat (AT)' })}
                          </label>
                          <select
                            value={formData.taxProfile.atHas13th14th === false ? 'no' : 'yes'}
                            onChange={(e) => handleTaxProfileChange('atHas13th14th', e.target.value === 'yes')}
                            className={profileCompactInputClass}
                          >
                            <option value="yes">{t('profile.tax.at_13_14_yes', { defaultValue: 'Ano (standard)' })}</option>
                            <option value="no">{t('profile.tax.at_13_14_no', { defaultValue: 'Ne' })}</option>
                          </select>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-6">
                      <div className={`${profileAccentPanelClass} rounded-[1rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--surface-muted)] p-5`}>
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <span className="inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                              Premium
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                {t('alerts.premium_only_feature')}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">
                                {t('profile.tax.paywall_hint', { defaultValue: 'Daňový profil zpřesní čistý příjem, srovnání HPP vs. IČO a realističtější výpočet vaší pracovní situace.' })}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {[
                                t('profile.tax.country', { defaultValue: 'Země a daňový rok' }),
                                t('profile.tax.employment_type', { defaultValue: 'Typ spolupráce' }),
                                t('profile.tax.children', { defaultValue: 'Děti a rodinná situace' }),
                              ].map((item) => (
                                <span key={item} className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1 text-[11px] font-medium text-[var(--text-muted)]">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              if (profile.id) {
                                redirectToCheckout('premium', profile.id);
                              }
                            }}
                            className={`${profilePrimaryButtonClass} w-full px-4 py-2.5 text-sm lg:w-auto`}
                          >
                            {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurLabel}`}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div id="jhi" className={profileSurfaceClass}>
                  <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="flex items-center gap-3">
                      <div className={profileAccentIconShellClass}>
                        <SlidersHorizontal className={profileAccentIconClass} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('profile.jhi.title')}</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {topJhiWeights.map(([key, value]) => `${t(`profile.jhi.weights.${key}`)} ${Math.round(value * 100)}%`).join(' · ')}
                          {activeJhiConstraintsCount > 0 ? ` · ${activeJhiConstraintsCount} ${t('profile.jhi.constraints.label', { defaultValue: 'omezení' })}` : ''}
                        </p>
                      </div>
                      <span className="ml-auto inline-flex items-center rounded-full border border-amber-300/80 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Premium
                      </span>
                    </div>
                  </div>
                  <div className="p-6 space-y-4">
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {t('profile.jhi.explainer')}
                    </p>
                    {!isPremium && (
                      <div className={`${profileAccentPanelClass} flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4`}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {t('alerts.premium_only_feature')}
                          </p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">
                            {t('profile.jhi.paywall_hint', { defaultValue: 'Personalizace JHI skóre je dostupná pouze v Premium.' })}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            if (profile.id) {
                              redirectToCheckout('premium', profile.id);
                            }
                          }}
                          className={`${profilePrimaryButtonClass} w-full px-3 py-2 text-sm sm:w-auto`}
                        >
                          {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurLabel}`}
                        </button>
                      </div>
                    )}
                    <fieldset disabled={!isPremium} className={!isPremium ? 'opacity-60' : ''}>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => applyJhiPreset('balanced')}
                          className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:bg-[rgba(var(--accent-rgb),0.12)] disabled:cursor-not-allowed"
                        >
                          {t('profile.jhi.presets.balanced')}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyJhiPreset('money')}
                          className="px-3 py-1.5 text-xs font-semibold rounded-full border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:cursor-not-allowed"
                        >
                          {t('profile.jhi.presets.money')}
                        </button>
                        <button
                          type="button"
                          onClick={() => applyJhiPreset('calm')}
                          className="px-3 py-1.5 text-xs font-semibold rounded-full border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40 disabled:cursor-not-allowed"
                        >
                          {t('profile.jhi.presets.calm')}
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-4">
                        {(['financial', 'timeCost', 'mentalLoad', 'growth', 'values'] as const).map((weightKey) => (
                          <div key={weightKey}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              {t(`profile.jhi.weights.${weightKey}`)}
                            </label>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {Math.round(formData.jhiPreferences.pillarWeights[weightKey] * 100)} %
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={Math.round(formData.jhiPreferences.pillarWeights[weightKey] * 100)}
                              onChange={(e) => handleJhiPreferenceWeightChange(weightKey, (Number(e.target.value) || 0) / 100)}
                              className="w-full jhi-slider disabled:cursor-not-allowed"
                              style={sliderTrackStyle(Math.round(formData.jhiPreferences.pillarWeights[weightKey] * 100))}
                            />
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                        {t('profile.jhi.weights_auto_normalized')}
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-3">
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.jhiPreferences.hardConstraints.mustRemote}
                            onChange={(e) => handleJhiConstraintChange('mustRemote', e.target.checked)}
                          />
                          {t('profile.jhi.constraints.must_remote')}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.jhiPreferences.hardConstraints.excludeShift}
                            onChange={(e) => handleJhiConstraintChange('excludeShift', e.target.checked)}
                          />
                          {t('profile.jhi.constraints.exclude_shift')}
                        </label>
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          <input
                            type="checkbox"
                            checked={formData.jhiPreferences.hardConstraints.growthRequired}
                            onChange={(e) => handleJhiConstraintChange('growthRequired', e.target.checked)}
                          />
                          {t('profile.jhi.constraints.growth_required')}
                        </label>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.jhi.constraints.max_commute')}</label>
                          <input
                            type="number"
                            min={0}
                            value={formData.jhiPreferences.hardConstraints.maxCommuteMinutes ?? ''}
                            onChange={(e) => handleJhiConstraintChange('maxCommuteMinutes', e.target.value ? Number(e.target.value) : null)}
                            className={`${profileCompactInputClass} disabled:cursor-not-allowed`}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.jhi.constraints.min_net')}</label>
                          <input
                            type="number"
                            min={0}
                            value={formData.jhiPreferences.hardConstraints.minNetMonthly ?? ''}
                            onChange={(e) => handleJhiConstraintChange('minNetMonthly', e.target.value ? Number(e.target.value) : null)}
                            className={`${profileCompactInputClass} disabled:cursor-not-allowed`}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {(['peopleIntensity', 'careerGrowthPreference', 'homeOfficePreference'] as const).map((key) => (
                          <div key={key}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                              {t(`profile.jhi.work_style.${key}`)}
                            </label>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                              {formData.jhiPreferences.workStyle[key]} %
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={5}
                              value={formData.jhiPreferences.workStyle[key]}
                              onChange={(e) => handleJhiWorkStyleChange(key, Number(e.target.value) || 0)}
                              className="w-full jhi-slider disabled:cursor-not-allowed"
                              style={sliderTrackStyle(formData.jhiPreferences.workStyle[key])}
                            />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  </div>
                </div>

                {FEATURE_HAPPINESS_AUDIT_THREE && (
                  <div className={profileSurfaceClass}>
                    <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {t('happiness_audit_3d.title', { defaultValue: profileUiCopy.happinessTitle })}
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {t('happiness_audit_3d.subtitle', { defaultValue: profileUiCopy.happinessSubtitle })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            {profileUiCopy.premiumBadge}
                          </span>
                          <button
                            onClick={() => setEnableLive3D((prev) => !prev)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${enableLive3D
                              ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                              }`}
                          >
                            {enableLive3D
                              ? t('happiness_audit_3d.live_on', { defaultValue: profileUiCopy.live3dOn })
                              : t('happiness_audit_3d.live_off', { defaultValue: profileUiCopy.live3dOffButton })}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="p-6 space-y-4">
                      {!isPremium && (
                        <div className="text-sm text-amber-700 dark:text-amber-300">
                          {t('happiness_audit_3d.premium_required', { defaultValue: profileUiCopy.premiumRequired })}
                        </div>
                      )}
                      <fieldset disabled={!isPremium} className={!isPremium ? 'opacity-60' : ''}>
                        <div className="space-y-4">
                          <div className="rounded-xl border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] p-4">
                            <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                              {profileUiCopy.auditQuest1}
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {profileUiCopy.quest1Body} ({monthlyCommuteHours} h)
                            </p>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                              {([
                                ['commute', profileUiCopy.commute],
                                ['taxes', profileUiCopy.taxes],
                                ['fixed', profileUiCopy.fixedCosts],
                              ] as const).map(([key, label]) => (
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => setResourceLeakToggles((prev) => ({ ...prev, [key]: !prev[key] }))}
                                  className={`px-3 py-2 rounded-lg text-sm border ${resourceLeakToggles[key]
                                    ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300'
                                    }`}
                                >
                                  {resourceLeakToggles[key]
                                    ? `${profileUiCopy.pipeOn}: ${label}`
                                    : `${profileUiCopy.pipeOff}: ${label}`}
                                </button>
                              ))}
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {profileUiCopy.disconnected}: {disconnectedPipes} / 3
                            </div>
                          </div>

                          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2">
                              {profileUiCopy.auditQuest2}
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {profileUiCopy.quest2Body}
                            </p>
                            <textarea
                              value={narrativeStory}
                              onChange={(e) => setNarrativeStory(e.target.value)}
                              placeholder={profileUiCopy.storyPlaceholder}
                              className="mt-3 w-full h-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                            />
                            <div className="mt-2 flex flex-wrap gap-2">
                              {narrativeSkills.length > 0 ? narrativeSkills.map((skill, index) => (
                                <span key={`${skill}-${index}`} className="px-2 py-1 text-xs rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  {skill}
                                </span>
                              )) : (
                                <span className="text-xs text-slate-500 dark:text-slate-400">{profileUiCopy.noConstellation}</span>
                              )}
                            </div>
                          </div>

                          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/20 p-4">
                            <div className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">
                              {profileUiCopy.auditQuest3}
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">
                              {profileUiCopy.quest3Body}
                            </p>
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                              <label className="text-xs text-slate-600 dark:text-slate-300">
                                {profileUiCopy.individualVsTeam} ({culturalCompass.individualVsTeam})
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={culturalCompass.individualVsTeam}
                                  onChange={(e) => setCulturalCompass((prev) => ({ ...prev, individualVsTeam: Number(e.target.value) || 0 }))}
                                  className="mt-1 w-full"
                                />
                              </label>
                              <label className="text-xs text-slate-600 dark:text-slate-300">
                                {profileUiCopy.chaosVsStructure} ({culturalCompass.chaosVsStructure})
                                <input
                                  type="range"
                                  min={0}
                                  max={100}
                                  step={5}
                                  value={culturalCompass.chaosVsStructure}
                                  onChange={(e) => setCulturalCompass((prev) => ({ ...prev, chaosVsStructure: Number(e.target.value) || 0 }))}
                                  className="mt-1 w-full"
                                />
                              </label>
                            </div>
                            <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              {profileUiCopy.companyOffNorth.replace('{{value}}', String(culturalMismatch))}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <label className="text-sm text-slate-700 dark:text-slate-300">
                              {t('happiness_audit_3d.salary', { defaultValue: profileUiCopy.monthlyGrossSalary })}
                              <input
                                type="number"
                                min={0}
                                value={happinessAuditInput.salary}
                                onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, salary: Number(e.target.value) || 0 }))}
                                className={`mt-1 ${profileCompactInputClass}`}
                              />
                            </label>
                            <label className="text-sm text-slate-700 dark:text-slate-300">
                              {t('happiness_audit_3d.commute_cost', { defaultValue: profileUiCopy.monthlyCommuteCost })}
                              <input
                                type="number"
                                min={0}
                                value={happinessAuditInput.commute_cost}
                                onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, commute_cost: Number(e.target.value) || 0 }))}
                                className={`mt-1 ${profileCompactInputClass}`}
                              />
                            </label>
                            <label className="text-sm text-slate-700 dark:text-slate-300">
                              {t('happiness_audit_3d.home_office_days', { defaultValue: profileUiCopy.homeOfficeDays })}
                              <input
                                type="range"
                                min={0}
                                max={5}
                                step={1}
                                value={happinessAuditInput.home_office_days}
                                onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, home_office_days: Number(e.target.value) || 0 }))}
                                className="mt-2 w-full"
                              />
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{happinessAuditInput.home_office_days} / 5</div>
                            </label>
                            <label className="text-sm text-slate-700 dark:text-slate-300">
                              {t('happiness_audit_3d.commute_minutes', { defaultValue: profileUiCopy.commuteMinutes })}
                              <input
                                type="range"
                                min={0}
                                max={180}
                                step={5}
                                value={happinessAuditInput.commute_minutes_daily}
                                onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, commute_minutes_daily: Number(e.target.value) || 0 }))}
                                className="mt-2 w-full"
                              />
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{happinessAuditInput.commute_minutes_daily} {profileUiCopy.minutesPerDay}</div>
                            </label>
                            <label className="text-sm text-slate-700 dark:text-slate-300">
                              {t('happiness_audit_3d.energy', { defaultValue: profileUiCopy.subjectiveEnergy })}
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={happinessAuditInput.subjective_energy}
                                onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, subjective_energy: Number(e.target.value) || 0 }))}
                                className="mt-2 w-full"
                              />
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{happinessAuditInput.subjective_energy}/100</div>
                            </label>
                            <label className="text-sm text-slate-700 dark:text-slate-300">
                              {t('happiness_audit_3d.role_shift', { defaultValue: profileUiCopy.roleDrift })}
                              <input
                                type="range"
                                min={0}
                                max={100}
                                step={5}
                                value={happinessAuditInput.role_shift}
                                onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, role_shift: Number(e.target.value) || 0 }))}
                                className="mt-2 w-full"
                              />
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{happinessAuditInput.role_shift}/100</div>
                            </label>
                          </div>
                        </div>
                      </fieldset>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                          <div className="mb-2 text-xs uppercase tracking-wider text-[var(--accent)]">
                            {profileUiCopy.orbitTitle}
                          </div>
                          {enableLive3D ? (
                            <SceneShell
                              capability={sceneCapability}
                              enableControls
                              fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{profileUiCopy.fallback3d}</div>}
                            >
                              <LifeSustainabilityOrbit output={happinessAuditOutput} />
                            </SceneShell>
                          ) : (
                            <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                              {profileUiCopy.live3dOff}
                            </div>
                          )}
                        </div>
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                          <div className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                            {profileUiCopy.anchorTitle}
                          </div>
                          {enableLive3D ? (
                            <SceneShell
                              capability={sceneCapability}
                              fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{profileUiCopy.fallback3d}</div>}
                            >
                              <CareerAnchorDrift output={happinessAuditOutput} />
                            </SceneShell>
                          ) : (
                            <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                              {profileUiCopy.live3dOff}
                            </div>
                          )}
                        </div>
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                          <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                            {profileUiCopy.mirrorTitle}
                          </div>
                          {enableLive3D ? (
                            <SceneShell
                              capability={sceneCapability}
                              fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{profileUiCopy.fallback3d}</div>}
                            >
                              <NebulaOfPotential frame={narrativeFrame} />
                            </SceneShell>
                          ) : (
                            <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                              {profileUiCopy.live3dOff}
                            </div>
                          )}
                        </div>
                        <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                          <div className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                            {profileUiCopy.northstarTitle}
                          </div>
                          {enableLive3D ? (
                            <SceneShell
                              capability={sceneCapability}
                              fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{profileUiCopy.fallback3d}</div>}
                            >
                              <CulturalNorthstarCompass
                                alignmentScore={culturalAlignment}
                                individualVsTeam={culturalCompass.individualVsTeam}
                                chaosVsStructure={culturalCompass.chaosVsStructure}
                              />
                            </SceneShell>
                          ) : (
                            <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                              {profileUiCopy.live3dOff}
                            </div>
                          )}
                          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                            {`${profileUiCopy.alignmentLabel}: ${culturalAlignment}% · ${profileUiCopy.mismatchLabel}: ${culturalMismatch}%`}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                          {isSimulatingAudit
                            ? t('happiness_audit_3d.simulating', { defaultValue: profileUiCopy.simulating })
                            : t('happiness_audit_3d.results', { defaultValue: profileUiCopy.auditOutput })}
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div><span className="text-slate-500">{profileUiCopy.timeRing}</span><div className="font-bold">{happinessAuditOutput?.time_ring ?? 0}/100</div></div>
                          <div><span className="text-slate-500">{profileUiCopy.energyRing}</span><div className="font-bold">{happinessAuditOutput?.energy_ring ?? 0}/100</div></div>
                          <div><span className="text-slate-500">{profileUiCopy.sustainability}</span><div className="font-bold">{happinessAuditOutput?.sustainability_score ?? 0}/100</div></div>
                          <div><span className="text-slate-500">{profileUiCopy.drift}</span><div className="font-bold">{happinessAuditOutput?.drift_score ?? 0}/100</div></div>
                        </div>
                        <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                          {(happinessAuditOutput?.recommendations || []).map((item, index) => (
                            <li key={`${item}-${index}`}>• {item}</li>
                          ))}
                        </ul>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                          {happinessAuditOutput?.advisory_disclaimer || t('ai_advisory.default', { defaultValue: profileUiCopy.advisoryDisclaimer })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </>
            )}

            {isEvidenceTab && (
              <div id="jcfpm-card" className={jcfpmSurfaceClass}>
                <div className="border-b border-slate-200/80 bg-gradient-to-r from-white/92 via-cyan-50/70 to-slate-50 p-5 dark:border-slate-800/80 dark:bg-gradient-to-r dark:from-slate-950/80 dark:via-slate-900/80 dark:to-slate-950/70">
                  <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-900 dark:text-white">
                    Career Fit & Potential Test
                    <span className="ml-2 inline-block rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-medium text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-100">
                      &bull; test
                    </span>
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
                    {profilePremiumCopy.jcfpmSummary}
                  </p>
                </div>
                <div className="space-y-5 bg-[linear-gradient(180deg,rgba(247,252,255,0.92),rgba(248,250,252,0.98))] p-6 dark:bg-[linear-gradient(180deg,rgba(14,28,36,0.3),rgba(10,18,32,0.96))]">
                  <JcfpmEntryCard
                    isPremium={isPremium}
                    sceneCapability={sceneCapability}
                    hasDraft={hasJcfpmDraft}
                    hasSnapshot={Boolean(jcfpmSnapshot)}
                    lastUpdatedAt={jcfpmSnapshot?.completed_at}
                    onResume={() => {
                      const lng = (i18n.language || 'cs').split('-')[0];
                      window.location.href = `/${lng}/profile/jcfpm?mode=resume`;
                    }}
                    onRestart={() => {
                      clearJcfpmDraft(profile.id);
                      const lng = (i18n.language || 'cs').split('-')[0];
                      window.location.href = `/${lng}/profile/jcfpm?mode=restart`;
                    }}
                    onStartCore={() => {
                      const lng = (i18n.language || 'cs').split('-')[0];
                      window.location.href = `/${lng}/profile/jcfpm?mode=start`;
                    }}
                    onStartDeep={() => {
                      const lng = (i18n.language || 'cs').split('-')[0];
                      window.location.href = `/${lng}/profile/jcfpm?section=deep_dive&mode=start`;
                    }}
                    onView={() => {
                      window.requestAnimationFrame(() => {
                        document.getElementById('profile-jcfpm-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      });
                    }}
                    onUpgrade={() => {
                      if (profile.id) {
                        redirectToCheckout('premium', profile.id);
                      }
                    }}
                  />
                  {jcfpmSnapshot ? (
                    <div className={jcfpmInnerCardClass}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={jcfpmShareEnabled}
                          onChange={(event) => {
                            onChange({
                              ...profile,
                              preferences: {
                                ...profile.preferences,
                                signal_boost_share_jcfpm: event.target.checked,
                              },
                            }, true);
                          }}
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 dark:border-slate-600 dark:bg-slate-900"
                        />
                        <div>
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {jcfpmShareCopy}
                          </div>
                          <p className="mt-1 text-xs leading-6 text-slate-600 dark:text-slate-400">
                            {jcfpmShareHintCopy}
                          </p>
                        </div>
                      </label>
                    </div>
                  ) : null}
                  {jcfpmSnapshot && (
                    <div id="profile-jcfpm-report" className={jcfpmInnerCardClass}>
                      <JcfpmReportPanel snapshot={jcfpmSnapshot} showAdvancedReport={isPremium} />
                    </div>
                  )}
                  {profile.preferences?.jcfpm_jhi_adjustment_v1 && isPremium && (
                    <div className={jcfpmInnerCardClass}>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                        Jak test upravil JHI preference
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                        Úpravy vycházejí hlavně z dimenzí D2, D3, D4, D5 a D6. Níže je přesně co se změnilo a proč.
                      </p>
                      <div className="space-y-2">
                        {profile.preferences.jcfpm_jhi_adjustment_v1.changes.slice(0, 6).map((change, idx) => (
                          <div key={`${change.field}-${idx}`} className="text-xs text-slate-700 dark:text-slate-300">
                            {(() => {
                              const reasonText =
                                change.reason_i18n?.[jcfpmReasonLocale] ||
                                change.reason_i18n?.[jcfpmReasonLocaleBase] ||
                                translateLegacyJhiReason(change.reason);
                              return (
                                <>
                                  <span className="font-semibold">{formatJhiFieldLabel(change.field)}</span>: {change.from} → {change.to}
                                  <span className="text-slate-500 dark:text-slate-400"> ({reasonText})</span>
                                </>
                              );
                            })()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {profile.preferences?.jcfpm_jhi_adjustment_v1 && !isPremium && (
                    <div className={jcfpmInnerCardClass}>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                        {t('profile.jcfpm.basic_result_active', { defaultValue: profilePremiumCopy.jcfpmBasicTitle })}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {t('profile.jcfpm.basic_result_desc', {
                          defaultValue: profilePremiumCopy.jcfpmBasicDesc
                        })}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          if (profile.id) {
                            redirectToCheckout('premium', profile.id);
                          }
                        }}
                        className="mt-3 inline-flex items-center gap-2 rounded-[0.9rem] border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                      >
                        {t('profile.jcfpm.unlock_premium_results', { defaultValue: profilePremiumCopy.jcfpmUnlock })}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="rounded-[1.05rem] border border-slate-200 bg-white/95 p-4 shadow-[0_20px_38px_-32px_rgba(15,23,42,0.22)] dark:border-slate-700 dark:bg-slate-800/95 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t('profile.save_hint_bottom', {
                    defaultValue: ({
                      cs: 'Po úpravách profilu změny uložte.',
                      sk: 'Po úpravách profilu zmeny uložte.',
                      de: 'Speichern Sie Ihre Änderungen nach der Bearbeitung des Profils.',
                      at: 'Speichern Sie Ihre Änderungen nach der Bearbeitung des Profils.',
                      pl: 'Po edycji profilu zapisz zmiany.',
                      en: 'Save your changes after editing the profile.'
                    } as const)[(['cs', 'sk', 'de', 'at', 'pl'].includes(localeBase) ? localeBase : 'en') as 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en']
                  })}
                </p>
                <button
                  onClick={handleSaveClick}
                  disabled={isSavingProfile}
                  className={`${profilePrimaryButtonClass} w-full sm:w-auto px-6 py-3`}
                >
                  <Save size={18} />
                  {isSavingProfile ? t('app.saving') : t('profile.save_profile')}
                </button>
              </div>
              {saveFeedback && (
                <div className={`mt-3 text-sm font-medium flex items-center gap-2 ${saveFeedback.type === 'success'
                  ? 'text-amber-700 dark:text-amber-300'
                  : 'text-rose-700 dark:text-rose-300'
                  }`}>
                  <CheckCircle size={16} />
                  <span>{saveFeedback.text}</span>
                </div>
              )}
            </div>

            {isChallengesTab && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className={profileAccentIconShellClass}>
                        <Zap className={profileAccentIconClass} />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                          {t('profile.mini_challenges.title', { defaultValue: 'Moje mini výzvy' })}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t('profile.mini_challenges.desc', { defaultValue: 'Zde můžete zadávat nové řešitelské výzvy nebo spravovat ty stávající.' })}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsProfileChallengeModalOpen(true)}
                      className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 hover:shadow-lg active:scale-95"
                    >
                      <Plus size={18} />
                      {t('profile.mini_challenges.post_btn', { defaultValue: 'Nová výzva' })}
                    </button>
                  </div>
                </div>

                <div className="p-6 space-y-8">
                  {publishedMiniChallengesError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
                      {publishedMiniChallengesError}
                    </div>
                  ) : null}

                  {publishedMiniChallengesLoading && publishedMiniChallenges.length === 0 ? (
                    <div className="rounded-2xl border border-slate-200 bg-white/85 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-400">
                      {t('profile.mini_challenges.loading', { defaultValue: 'Načítám živé mini výzvy…' })}
                    </div>
                  ) : null}

                  {activePublishedMiniChallenges.length === 0 && !publishedMiniChallengesLoading ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center dark:border-slate-800">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900">
                        <Briefcase className="h-8 w-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {t('profile.mini_challenges.empty_title', { defaultValue: 'Moje zadané výzvy' })}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {t('profile.mini_challenges.empty_desc', { defaultValue: 'Zatím jste nezadali žádnou vlastní výzvu pro ostatní.' })}
                      </p>
                      <button
                        onClick={() => setIsProfileChallengeModalOpen(true)}
                        className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-teal-600 hover:text-teal-700"
                      >
                        {t('profile.mini_challenges.first_btn', { defaultValue: 'Vytvořit novou výzvu' })}
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      {activePublishedMiniChallenges.map((challenge) => {
                        const isPaused = challenge.status === 'paused';
                        const rewardLabel = challenge.micro_job_reward || challenge.salaryRange || null;
                        const selected = selectedPublishedMiniChallengeId === challenge.id;
                        const updating = Boolean(publishedMiniChallengeUpdatingIds[challenge.id]);
                        return (
                          <div key={challenge.id} className={`rounded-[1.1rem] border p-4 shadow-sm transition ${selected ? 'border-teal-300 bg-teal-50/60 dark:border-teal-700 dark:bg-teal-950/20' : 'border-slate-200 bg-white/85 dark:border-slate-700 dark:bg-slate-900/70'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">{challenge.title}</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                  {new Date(challenge.scrapedAt || Date.now()).toLocaleDateString(i18n.language || localeBase)}
                                </div>
                              </div>
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isPaused ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'}`}>
                                {isPaused
                                  ? t('profile.mini_challenges.status_paused', { defaultValue: 'POZASTAVENO' })
                                  : t('profile.mini_challenges.status_active', { defaultValue: 'AKTIVNÍ' })}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                              {challenge.challenge || challenge.description}
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {challenge.micro_job_time_estimate ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                                  {challenge.micro_job_time_estimate}
                                </span>
                              ) : null}
                              {challenge.location ? (
                                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300">
                                  {challenge.location}
                                </span>
                              ) : null}
                              {rewardLabel ? (
                                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300">
                                  {rewardLabel}
                                </span>
                              ) : null}
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                                {t('profile.mini_challenges.reply_count', { defaultValue: '{{count}} replies', count: challenge.reply_count || 0 })}
                              </span>
                              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-300">
                                {t('profile.mini_challenges.open_dialogues', { defaultValue: '{{count}} active', count: challenge.open_dialogues_count || 0 })}
                              </span>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => void openPublishedMiniChallenge(challenge.id)}
                                className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-teal-700"
                              >
                                {t('profile.mini_challenges.manage_replies', { defaultValue: 'Spravovat reakce' })}
                              </button>
                              <button
                                disabled={updating}
                                onClick={async () => {
                                  setMiniChallengeUpdating(challenge.id, true);
                                  try {
                                    await updateProfileMiniChallengeLifecycle(challenge.id, isPaused ? 'active' : 'paused');
                                    await loadPublishedMiniChallenges({ focusJobId: challenge.id });
                                  } catch (error) {
                                    setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Lifecycle update failed.');
                                  } finally {
                                    setMiniChallengeUpdating(challenge.id, false);
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {isPaused
                                  ? t('profile.mini_challenges.reopen', { defaultValue: 'Znovu otevřít' })
                                  : t('profile.mini_challenges.pause', { defaultValue: 'Pozastavit' })}
                              </button>
                              <button
                                disabled={updating}
                                onClick={async () => {
                                  setMiniChallengeUpdating(challenge.id, true);
                                  try {
                                    await updateProfileMiniChallengeLifecycle(challenge.id, 'closed');
                                    await loadPublishedMiniChallenges();
                                  } catch (error) {
                                    setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Lifecycle update failed.');
                                  } finally {
                                    setMiniChallengeUpdating(challenge.id, false);
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 transition hover:bg-amber-100 disabled:opacity-60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
                              >
                                {t('profile.mini_challenges.close', { defaultValue: 'Uzavřít' })}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {selectedPublishedMiniChallengeId ? (
                    <div className="rounded-[1.15rem] border border-slate-200 bg-white/90 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/75">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {publishedMiniChallenges.find((item) => item.id === selectedPublishedMiniChallengeId)?.title || t('profile.mini_challenges.manage_replies', { defaultValue: 'Spravovat reakce' })}
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {t('profile.mini_challenges.replies_desc', { defaultValue: 'Tady vidíte reálné handshaky a můžete na ně navázat další odpovědí nebo změnou stavu.' })}
                          </p>
                        </div>
                      </div>

                      {(publishedMiniChallengeDialogues[selectedPublishedMiniChallengeId] || []).length === 0 ? (
                        <div className="mt-4 rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                          {t('profile.mini_challenges.no_replies_yet', { defaultValue: 'Zatím sem nepřišla žádná reakce.' })}
                        </div>
                      ) : (
                        <div className="mt-4 grid gap-4 lg:grid-cols-[280px,minmax(0,1fr)]">
                          <div className="space-y-2">
                            {(publishedMiniChallengeDialogues[selectedPublishedMiniChallengeId] || []).map((dialogue) => (
                              <button
                                key={dialogue.id}
                                type="button"
                                onClick={() => void openPublishedDialogue(dialogue.id)}
                                className={`w-full rounded-2xl border px-3 py-3 text-left transition ${selectedPublishedDialogueId === dialogue.id ? 'border-teal-300 bg-teal-50/70 dark:border-teal-700 dark:bg-teal-950/20' : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950/30 dark:hover:bg-slate-900/60'}`}
                              >
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">{dialogue.candidate_name || t('profile.mini_challenges.candidate_fallback', { defaultValue: 'Kandidát' })}</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{dialogue.candidateHeadline || dialogue.candidate_email || '—'}</div>
                                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">{dialogue.status}</div>
                              </button>
                            ))}
                          </div>

                          <div className="space-y-4">
                            {publishedMiniChallengeDialogueLoading ? (
                              <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                {t('profile.mini_challenges.loading_reply', { defaultValue: 'Načítám detail reakce…' })}
                              </div>
                            ) : publishedMiniChallengeDialogueDetail ? (
                              <>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-700 dark:bg-slate-950/30">
                                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                    {publishedMiniChallengeDialogueDetail.candidate_name || t('profile.mini_challenges.candidate_fallback', { defaultValue: 'Kandidát' })}
                                  </div>
                                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                    {publishedMiniChallengeDialogueDetail.candidate_email || publishedMiniChallengeDialogueDetail.candidate_profile_snapshot?.email || '—'}
                                  </div>
                                  {publishedMiniChallengeDialogueDetail.cover_letter ? (
                                    <div className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                                      {publishedMiniChallengeDialogueDetail.cover_letter}
                                    </div>
                                  ) : null}
                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {(['reviewed', 'shortlisted', 'rejected', 'hired'] as const).map((status) => (
                                      <button
                                        key={status}
                                        onClick={async () => {
                                          if (!selectedPublishedMiniChallengeId || !selectedPublishedDialogueId) return;
                                          setMiniChallengeUpdating(selectedPublishedDialogueId, true);
                                          try {
                                            await updateProfileMiniChallengeDialogueStatus(selectedPublishedDialogueId, status);
                                            const dialogues = await fetchProfileMiniChallengeDialogues(selectedPublishedMiniChallengeId);
                                            setPublishedMiniChallengeDialogues((current) => ({ ...current, [selectedPublishedMiniChallengeId]: dialogues }));
                                            const detail = await fetchProfileMiniChallengeDialogueDetail(selectedPublishedDialogueId);
                                            setPublishedMiniChallengeDialogueDetail(detail);
                                            await loadPublishedMiniChallenges({ focusJobId: selectedPublishedMiniChallengeId });
                                          } catch (error) {
                                            setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Status update failed.');
                                          } finally {
                                            setMiniChallengeUpdating(selectedPublishedDialogueId, false);
                                          }
                                        }}
                                        disabled={Boolean(publishedMiniChallengeUpdatingIds[selectedPublishedDialogueId || ''])}
                                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                                      >
                                        {status}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <ApplicationMessageCenter
                                  dialogueId={publishedMiniChallengeDialogueDetail.id}
                                  storageOwnerId={profile.id || null}
                                  viewerRole="recruiter"
                                  dialogueStatus={publishedMiniChallengeDialogueDetail.status}
                                  dialogueDeadlineAt={publishedMiniChallengeDialogueDetail.dialogue_deadline_at || null}
                                  dialogueTimeoutHours={publishedMiniChallengeDialogueDetail.dialogue_timeout_hours ?? null}
                                  dialogueCurrentTurn={publishedMiniChallengeDialogueDetail.dialogue_current_turn || null}
                                  dialogueClosedReason={publishedMiniChallengeDialogueDetail.dialogue_closed_reason || null}
                                  dialogueIsOverdue={Boolean(publishedMiniChallengeDialogueDetail.dialogue_is_overdue)}
                                  heading={t('profile.mini_challenges.reply_thread', { defaultValue: 'Vlákno reakce' })}
                                  subtitle={t('profile.mini_challenges.reply_thread_desc', { defaultValue: 'Navážete na handshake stejně jako v recruiter inboxu.' })}
                                  fetchMessages={fetchProfileMiniChallengeDialogueMessages}
                                  sendMessage={sendProfileMiniChallengeDialogueMessage}
                                />
                              </>
                            ) : (
                              <div className="rounded-2xl border border-slate-200 px-4 py-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                {t('profile.mini_challenges.select_reply', { defaultValue: 'Vyberte reakci vlevo a zobrazí se detail dialogu.' })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}

                  {closedPublishedMiniChallenges.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                        {t('profile.mini_challenges.closed_title', { defaultValue: 'Uzavřené mini výzvy' })}
                      </h3>
                      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                        {closedPublishedMiniChallenges.map((challenge) => (
                          <div key={challenge.id} className="rounded-[1.1rem] border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-950/30">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-slate-900 dark:text-white">{challenge.title}</div>
                                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{challenge.status}</div>
                              </div>
                              <button
                                onClick={async () => {
                                  setMiniChallengeUpdating(challenge.id, true);
                                  try {
                                    await updateProfileMiniChallengeLifecycle(challenge.id, 'active');
                                    await loadPublishedMiniChallenges({ focusJobId: challenge.id });
                                  } catch (error) {
                                    setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Lifecycle update failed.');
                                  } finally {
                                    setMiniChallengeUpdating(challenge.id, false);
                                  }
                                }}
                                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                              >
                                {t('profile.mini_challenges.reopen', { defaultValue: 'Znovu otevřít' })}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {postedMiniChallenges.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                        {t('profile.mini_challenges.legacy_title', { defaultValue: 'Starší lokální návrhy' })}
                      </h3>
                      <div className="rounded-[1.1rem] border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">
                        {t('profile.mini_challenges.legacy_desc', { defaultValue: 'Tyto starší mini výzvy byly uložené jen lokálně v profilu. Nově vytvořené výzvy už jdou do reálného handshake flow.' })}
                      </div>
                    </div>
                  ) : null}
                </div>

                <CreateMiniChallengeModal
                  isOpen={isProfileChallengeModalOpen}
                  onClose={() => setIsProfileChallengeModalOpen(false)}
                  isCsLike={localeBase === 'cs' || localeBase === 'sk'}
                  locale={i18n.language || localeBase}
                  onSubmit={async (data) => {
                    try {
                      const created = await createProfileMiniChallenge({
                        title: String(data?.title || '').trim(),
                        problem: String(data?.problem || '').trim(),
                        timeEstimate: String(data?.timeEstimate || '').trim() || undefined,
                        reward: String(data?.reward || '').trim() || undefined,
                        location: String(data?.location || '').trim() || undefined,
                      });
                      setIsProfileChallengeModalOpen(false);
                      await loadPublishedMiniChallenges({ focusJobId: created.id });
                      alert(localeBase === 'cs' ? 'Mini výzva byla publikována a je otevřená pro reálné reakce.' : 'Mini challenge published and ready for real replies.');
                    } catch (error) {
                      setPublishedMiniChallengesError(error instanceof Error ? error.message : 'Failed to publish mini challenge.');
                    }
                  }}
                />
              </div>
            )}

            {isAccountTab && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Mail className={profileAccentIconClass} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.account_title', {
                        defaultValue: getProfileLocaleLabel({
                          cs: 'Účet a e-mail',
                          sk: 'Účet a e-mail',
                          de: 'Konto und E-Mail',
                          at: 'Konto und E-Mail',
                          pl: 'Konto i e-mail',
                          en: 'Account and email'
                        }, profileLocale)
                      })}
                    </h2>
                  </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('profile.email')}</label>
                    <input
                      type="email"
                      value={formData.personal.email}
                      onChange={(e) => handlePersonalInfoChange('email', e.target.value)}
                      className={profileInputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      {profileCountryCopy.label}
                    </label>
                    <select
                      value={formData.personal.preferredCountryCode}
                      onChange={(e) => handlePersonalInfoChange('preferredCountryCode', e.target.value)}
                      className={profileInputClass}
                    >
                      <option value="CZ">{profileCountryCopy.countries.CZ}</option>
                      <option value="SK">{profileCountryCopy.countries.SK}</option>
                      <option value="PL">{profileCountryCopy.countries.PL}</option>
                      <option value="DE">{profileCountryCopy.countries.DE}</option>
                      <option value="AT">{profileCountryCopy.countries.AT}</option>
                    </select>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      {profileCountryCopy.help}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isAccountTab && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Bell className={profileAccentIconClass} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.notifications', {
                        defaultValue: getProfileLocaleLabel({
                          cs: 'Notifikace',
                          sk: 'Notifikácie',
                          de: 'Benachrichtigungen',
                          at: 'Benachrichtigungen',
                          pl: 'Powiadomienia',
                          en: 'Notifications'
                        }, profileLocale)
                      })}
                    </h2>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.notifications.dailyDigestEnabled)}
                        onChange={(e) => handleNotificationChange('dailyDigestEnabled', e.target.checked)}
                      />
                      {t('profile.digest_email', {
                        defaultValue: getProfileLocaleLabel({
                          cs: 'Denní digest e‑mailem',
                          sk: 'Denný digest e‑mailom',
                          de: 'Täglicher Digest per E-Mail',
                          at: 'Täglicher Digest per E-Mail',
                          pl: 'Dzienny digest e-mailem',
                          en: 'Daily digest by email'
                        }, profileLocale)
                      })}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.notifications.dailyDigestPushEnabled)}
                        onChange={(e) => handleNotificationChange('dailyDigestPushEnabled', e.target.checked)}
                      />
                      {t('profile.digest_push', {
                        defaultValue: getProfileLocaleLabel({
                          cs: 'Denní digest jako push',
                          sk: 'Denný digest ako push',
                          de: 'Täglicher Digest als Push',
                          at: 'Täglicher Digest als Push',
                          pl: 'Dzienny digest jako push',
                          en: 'Daily digest as push'
                        }, profileLocale)
                      })}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('profile.digest_time', {
                          defaultValue: getProfileLocaleLabel({
                            cs: 'Čas doručení',
                            sk: 'Čas doručenia',
                            de: 'Zeit der Zustellung',
                            at: 'Zeit der Zustellung',
                            pl: 'Godzina dostarczenia',
                            en: 'Delivery time'
                          }, profileLocale)
                        })}
                      </label>
                      <input
                        type="time"
                        value={formData.notifications.dailyDigestTime}
                        onChange={(e) => handleNotificationChange('dailyDigestTime', e.target.value)}
                        className={profileInputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('profile.digest_timezone', {
                          defaultValue: getProfileLocaleLabel({
                            cs: 'Časové pásmo',
                            sk: 'Časové pásmo',
                            de: 'Zeitzone',
                            at: 'Zeitzone',
                            pl: 'Strefa czasowa',
                            en: 'Timezone'
                          }, profileLocale)
                        })}
                      </label>
                      <input
                        type="text"
                        value={formData.notifications.dailyDigestTimezone}
                        onChange={(e) => handleNotificationChange('dailyDigestTimezone', e.target.value)}
                        className={profileInputClass}
                        placeholder="Europe/Prague"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-xs text-slate-500">
                      {pushSupported
                        ? `${t('profile.push_status', { defaultValue: 'Push status' })}: ${pushSubscribed ? profileUiCopy.pushActive : profileUiCopy.pushInactive} (${pushPermission})`
                        : t('profile.push_unsupported', {
                          defaultValue: getProfileLocaleLabel({
                            cs: 'Push notifikace nejsou v tomto prohlížeči dostupné.',
                            sk: 'Push notifikácie nie sú v tomto prehliadači dostupné.',
                            de: 'Push-Benachrichtigungen sind in diesem Browser nicht verfügbar.',
                            at: 'Push-Benachrichtigungen sind in diesem Browser nicht verfügbar.',
                            pl: 'Powiadomienia push nie są dostępne w tej przeglądarce.',
                            en: 'Push notifications are not available in this browser.'
                          }, profileLocale)
                        })}
                    </div>
                    {pushSupported && (
                      <>
                        <button
                          onClick={handleEnablePush}
                          disabled={pushBusy}
                          className="px-3 py-1.5 rounded-lg text-xs border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                        >
                          {t('profile.push_enable', {
                            defaultValue: getProfileLocaleLabel({
                              cs: 'Povolit push notifikace',
                              sk: 'Povoliť push notifikácie',
                              de: 'Push-Benachrichtigungen aktivieren',
                              at: 'Push-Benachrichtigungen aktivieren',
                              pl: 'Włącz powiadomienia push',
                              en: 'Enable push notifications'
                            }, profileLocale)
                          })}
                        </button>
                        <button
                          onClick={handleDisablePush}
                          disabled={pushBusy}
                          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                        >
                          {t('profile.push_disable', {
                            defaultValue: getProfileLocaleLabel({
                              cs: 'Vypnout push',
                              sk: 'Vypnúť push',
                              de: 'Push deaktivieren',
                              at: 'Push deaktivieren',
                              pl: 'Wyłącz push',
                              en: 'Disable push'
                            }, profileLocale)
                          })}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isAccountTab && profile.isLoggedIn && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Lock className={profileAccentIconClass} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.security_title', {
                        defaultValue: getProfileLocaleLabel({
                          cs: 'Změna hesla',
                          sk: 'Zmena hesla',
                          de: 'Passwort ändern',
                          at: 'Passwort ändern',
                          pl: 'Zmiana hasła',
                          en: 'Change password'
                        }, profileLocale)
                      })}
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {t('profile.security_desc', {
                      defaultValue: getProfileLocaleLabel({
                        cs: 'Nastavte si nové heslo pro přihlášení do účtu.',
                        sk: 'Nastavte si nové heslo pre prihlásenie do účtu.',
                        de: 'Legen Sie ein neues Passwort für die Anmeldung fest.',
                        at: 'Legen Sie ein neues Passwort für die Anmeldung fest.',
                        pl: 'Ustaw nowe hasło do logowania do konta.',
                        en: 'Set a new password for signing in to your account.'
                      }, profileLocale)
                    })}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('auth.new_password', { defaultValue: profileUiCopy.newPassword })}
                      </label>
                      <input
                        type="password"
                        minLength={6}
                        value={passwordForm.nextPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, nextPassword: e.target.value }))}
                        className={profileInputClass}
                        placeholder="••••••••"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('auth.confirm_new_password', { defaultValue: profileUiCopy.confirmNewPassword })}
                      </label>
                      <input
                        type="password"
                        minLength={6}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className={profileInputClass}
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handlePasswordChange}
                      disabled={isChangingPassword}
                      className={`${profilePrimaryButtonClass} px-5 py-2.5`}
                    >
                      {isChangingPassword
                        ? t('app.saving')
                        : t('auth.set_new_password', { defaultValue: profileUiCopy.setNewPassword })}
                    </button>
                    {passwordFeedback && (
                      <div className={`text-sm font-medium flex items-center gap-2 ${passwordFeedback.type === 'success'
                        ? 'text-amber-700 dark:text-amber-300'
                        : 'text-rose-700 dark:text-rose-300'
                        }`}>
                        {passwordFeedback.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                        <span>{passwordFeedback.text}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isEvidenceTab && showSolvedProblemsSection && (
              <div className={`${profileSurfaceClass} mt-8`}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Sparkles className={profileAccentIconClass} />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                        {t('profile.solved_problems.title', {
                          defaultValue: getProfileLocaleLabel({
                            cs: 'Vyřešené situace',
                            sk: 'Vyriešené situácie',
                            de: 'Gelöste Probleme',
                            at: 'Gelöste Probleme',
                            pl: 'Rozwiązane problemy',
                            en: 'Solved problems'
                          }, profileLocale)
                        })}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {t('profile.solved_problems.subtitle', {
                          defaultValue: getProfileLocaleLabel({
                            cs: 'Krátké outcome artefakty z dokončených micro jobů. Ne CV, ale konkrétní historie vyřešených situací.',
                            sk: 'Krátke outcome artefakty z dokončených micro jobov. Nie CV, ale konkrétna história vyriešených situácií.',
                            de: 'Kurze Outcome-Artefakte aus abgeschlossenen Micro Jobs. Kein CV, sondern eine konkrete Geschichte gelöster Situationen.',
                            at: 'Kurze Outcome-Artefakte aus abgeschlossenen Micro Jobs. Kein CV, sondern eine konkrete Geschichte gelöster Situationen.',
                            pl: 'Krótkie artefakty outcome z zakończonych micro jobów. Nie CV, ale konkretna historia rozwiązanych sytuacji.',
                            en: 'Short outcome artifacts from completed micro jobs. Not a CV, but a concrete history of solved situations.'
                          }, profileLocale)
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  {solutionSnapshotsLoading ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('common.loading', { defaultValue: getProfileLocaleLabel({ cs: 'Načítám...', sk: 'Načítavam...', de: 'Lädt...', at: 'Lädt...', pl: 'Ładowanie...', en: 'Loading...' }, profileLocale) })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {solutionSnapshots.map((snapshot, idx) => (
                        <div
                          key={snapshot.id}
                          className="rounded-[1.1rem] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-soft)] transition-all hover:border-[rgba(var(--accent-rgb),0.2)] hover:bg-[var(--surface)] hover:shadow-[var(--shadow-card)]"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-[var(--text-strong)]">
                                {snapshot.job_title || snapshot.company_name || t('company.dashboard.table.position', { defaultValue: 'Role' })}
                              </div>
                              <div className="mt-1 text-xs text-[var(--text-faint)]">
                                {[snapshot.company_name, snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString(profileDateLocale) : null]
                                  .filter(Boolean)
                                  .join(' • ')}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span className={profileAccentBadgeClass}>
                                {t('profile.solved_problems.badge', {
                                  defaultValue: getProfileLocaleLabel({
                                    cs: 'Outcome z micro jobu',
                                    sk: 'Outcome z micro jobu',
                                    de: 'Micro Job Outcome',
                                    at: 'Micro Job Outcome',
                                    pl: 'Outcome micro jobu',
                                    en: 'Micro job outcome'
                                  }, profileLocale)
                                })}
                              </span>
                              <GrowthSignal
                                level={idx + 1}
                                variant="emoji"
                                className="text-base"
                              />
                            </div>
                          </div>

                          <div className="mt-4 space-y-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                                {t('profile.solved_problems.problem', {
                                  defaultValue: getProfileLocaleLabel({
                                    cs: 'Problém',
                                    sk: 'Problém',
                                    de: 'Problem',
                                    at: 'Problem',
                                    pl: 'Problem',
                                    en: 'Problem'
                                  }, profileLocale)
                                })}
                              </div>
                              <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                                {snapshot.problem}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                                {t('profile.solved_problems.solution', {
                                  defaultValue: getProfileLocaleLabel({
                                    cs: 'Řešení',
                                    sk: 'Riešenie',
                                    de: 'Lösung',
                                    at: 'Lösung',
                                    pl: 'Rozwiązanie',
                                    en: 'Solution'
                                  }, profileLocale)
                                })}
                              </div>
                              <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                                {snapshot.solution}
                              </div>
                            </div>
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
                                {t('profile.solved_problems.result', { defaultValue: getProfileLocaleLabel({ cs: 'Výsledek', sk: 'Výsledok', de: 'Resultat', at: 'Resultat', pl: 'Rezultat', en: 'Result' }, profileLocale) })}
                              </div>
                              <div className="mt-1 text-sm leading-6 text-[var(--text-muted)]">
                                {snapshot.result}
                              </div>
                            </div>
                            {(snapshot.problem_tags.length > 0 || snapshot.solution_tags.length > 0) ? (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {snapshot.problem_tags.map((tag) => (
                                  <span key={`${snapshot.id}-problem-${tag}`} className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--text-muted)]">
                                    {tag}
                                  </span>
                                ))}
                                {snapshot.solution_tags.map((tag) => (
                                  <span key={`${snapshot.id}-solution-${tag}`} className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-2.5 py-1 text-xs text-[var(--accent)]">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isAccountTab && (
              <>
                {/* Danger Zone */}
                <div className="overflow-hidden rounded-[1.05rem] border-2 border-red-200 bg-white/95 shadow-[0_20px_38px_-32px_rgba(15,23,42,0.22)] dark:border-red-900/30 dark:bg-slate-800/95">
                  <div className="border-b border-red-100 dark:border-red-900/20 p-4 bg-red-50/50 dark:bg-red-900/10">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                        <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                      </div>
                      <h2 className="text-xl font-semibold text-red-900 dark:text-red-100">{t('profile.danger_zone')}</h2>
                    </div>
                  </div>

                  <div className="p-6">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
                      {t('profile.delete_account_warning_desc')}
                    </p>

                    <button
                      onClick={() => setShowDeleteConfirm(true)}
                      className="inline-flex items-center gap-2 rounded-[0.95rem] bg-red-600 px-4 py-2 text-white font-medium transition-colors hover:bg-red-700"
                    >
                      <Trash2 size={16} />
                      {t('profile.delete_account')}
                    </button>
                  </div>
                </div>

                {/* Premium Features Preview */}
                <div className="mt-8">
                  <PremiumFeaturesPreview userProfile={profileWithResolvedSubscription} />
                </div>
              </>
            )}
          </>
        ) : (
          <div className="w-full">
            <Suspense
              fallback={
                <div className="rounded-[1rem] border border-slate-200 bg-white/95 p-6 text-sm text-slate-600 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-800/95 dark:text-slate-300">
                  {t('app.loading')}
                </div>
              }
            >
              <ProfileJobManager
                userProfile={profile}
                savedJobs={displaySavedJobs}
                savedJobIds={savedJobIds}
                onToggleSave={onToggleSave || (() => { })}
                onJobSelect={onJobSelect || (() => { })}
                onApplyToJob={onApplyToJob || (() => { })}
                selectedJobId={selectedJobId || null}
                searchTerm={savedJobsSearchTerm}
                onSearchChange={setSavedJobsSearchTerm}
              />
            </Suspense>
          </div>
        )}
      </div>


      {/* Account Deletion Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md transition-all duration-300">
          <div className="animate-in zoom-in-95 duration-200 w-full max-w-md overflow-hidden rounded-[1.1rem] border border-slate-200 bg-white/95 shadow-[0_28px_60px_-38px_rgba(15,23,42,0.28)] fade-in dark:border-slate-700 dark:bg-slate-800/95">
            <div className="p-8">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 dark:text-white text-center mb-2">
                {t('profile.delete_account_warning_title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-center mb-8">
                {t('profile.delete_account_warning_desc')}
              </p>

              <div className="flex flex-col gap-3">
                <button
                  onClick={async () => {
                    if (onDeleteAccount) {
                      setIsDeleting(true);
                      try {
                        const success = await onDeleteAccount();
                        if (!success) {
                          setIsDeleting(false);
                          alert(t('profile.delete_account_error'));
                        }
                      } catch (err) {
                        setIsDeleting(false);
                        console.error("Deletion error:", err);
                        alert(t('profile.delete_account_error'));
                      }
                    }
                  }}
                  disabled={isDeleting}
                  className="flex w-full items-center justify-center gap-3 rounded-[1rem] bg-red-600 py-4 font-bold text-white shadow-[0_20px_34px_-24px_rgba(220,38,38,0.28)] transition-all hover:bg-red-700 disabled:opacity-50 active:scale-[0.98]"
                >
                  {isDeleting ? (
                    <div className="flex items-center gap-2">
                      <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>{t('app.loading')}</span>
                    </div>
                  ) : (
                    <>
                      <Trash2 size={20} />
                      {t('profile.delete_account_confirm')}
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="w-full rounded-[1rem] bg-slate-100 py-3 font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-[0.98] dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                >
                  {t('profile.delete_account_cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileEditor;
