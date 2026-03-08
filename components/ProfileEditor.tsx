import React, { Suspense, lazy, useEffect, useState, useRef } from 'react';
import { CandidateDomainKey, CandidateSearchProfile, CandidateSeniority, SearchLanguageCode, UserProfile, WorkExperience, Education, TransportMode, Job, TaxProfile, JHIPreferences, HappinessAuditInput, HappinessAuditOutput, JcfpmSnapshotV1 } from '../types';
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
  SlidersHorizontal
} from 'lucide-react';
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
import { enrichSearchProfileWithInference, getCandidateIntentDomainLabel, getCandidateIntentDomainOptions, resolveCandidateIntentProfile } from '../services/candidateIntentService';
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

import { useTranslation } from 'react-i18next';

interface ProfileEditorProps {
  profile: UserProfile;
  onChange: (profile: UserProfile, persist?: boolean) => void | Promise<void>;
  onSave: () => void | Promise<boolean>;
  onRefreshProfile?: () => void | Promise<void>;
  savedJobs?: Job[];
  savedJobIds?: string[];
  onToggleSave?: (jobId: string) => void;
  onJobSelect?: (jobId: string) => void;
  onApplyToJob?: (job: Job) => void;
  selectedJobId?: string | null;
  onDeleteAccount?: () => Promise<boolean>;
}

const ProfileJobManager = lazy(() => import('./ProfileJobManager'));
type ProfileTabKey = 'personal' | 'cv' | 'jcfpm' | 'settings' | 'saved';

const ProfileEditor: React.FC<ProfileEditorProps> = ({
  profile,
  onChange,
  onSave,
  onRefreshProfile,
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
  const isCsLikeProfile = localeBase === 'cs' || localeBase === 'sk';
  const supportingContextCopy = isCsLikeProfile
    ? {
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
      }
    : {
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
      };
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
  const searchProfileCopy = localeBase === 'cs'
    ? {
        title: 'Výchozí nastavení hledání',
        intro: 'Nastavte hledání tak, aby odpovídalo vaší skutečné situaci: typu práce, dojíždění, rodině, psům i benefitům, na kterých vám opravdu záleží.',
        nearBorder: 'Chci snadno hledat i přes hranice',
        contractor: 'Primárně hledám práci na IČO / živnost',
        dogFriendly: 'Chci upřednostňovat kanceláře, kam mohou psi',
        childFriendly: 'Potřebuji role vhodné pro rodiče',
        avoidShift: 'Chci se vyhýbat směnnému a nočnímu provozu',
        remote: 'Chci mít připravené hledání práce na dálku',
        languages: 'Jazyky pro práci na dálku',
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
      }
    : localeBase === 'sk'
      ? {
          title: 'Predvolené nastavenie hľadania',
          intro: 'Nastavte hľadanie tak, aby zodpovedalo vašej skutočnej situácii: typu práce, dochádzaniu, rodine, psom aj benefitom, na ktorých vám naozaj záleží.',
          nearBorder: 'Chcem jednoducho hľadať aj cez hranice',
          contractor: 'Primárne hľadám prácu na živnosť / kontrakt',
          dogFriendly: 'Chcem uprednostňovať kancelárie, kam môžu psy',
          childFriendly: 'Potrebujem roly vhodné pre rodičov',
          avoidShift: 'Chcem sa vyhýbať zmenovej a nočnej prevádzke',
          remote: 'Chcem mať pripravené hľadanie práce na diaľku',
          languages: 'Jazyky pre prácu na diaľku',
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
        }
      : {
        title: 'Search setup',
        intro: 'Set search defaults around the actual reality of your life: work mode, commute, family context, dogs, and benefits that matter.',
        nearBorder: 'I live near a border and want cross-border search to stay easy',
        contractor: 'I primarily want contractor / self-employed roles',
        dogFriendly: 'Prefer dog-friendly offices',
        childFriendly: 'I need parent-friendly / child-friendly roles',
        avoidShift: 'Avoid shift-based and night roles',
        remote: 'Keep a remote-focused preset ready',
        languages: 'Languages I can use in remote roles',
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
      };
  const intentProfileCopy = isCsLikeProfile
    ? {
        title: 'Můj obor a role',
        intro: 'Tahle část určuje, co má být v přehledu opravdu vaše. Nejdřív obor a cílová role, až potom životní filtry.',
        primaryDomain: 'Hlavní obor',
        secondaryDomains: 'Příbuzné obory',
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
      }
    : {
        title: 'My domain and role',
        intro: 'This section decides what should actually feel like your feed: first domain and target role, then life-context filters.',
        primaryDomain: 'Primary domain',
        secondaryDomains: 'Adjacent domains',
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
      };
  const remoteLanguageOptions: Array<{ code: SearchLanguageCode; label: string }> = [
    { code: 'cs', label: isCsLikeProfile ? 'Čeština' : 'Czech' },
    { code: 'en', label: isCsLikeProfile ? 'Angličtina' : 'English' },
    { code: 'de', label: isCsLikeProfile ? 'Němčina' : 'German' },
    { code: 'sk', label: isCsLikeProfile ? 'Slovenština' : 'Slovak' },
    { code: 'pl', label: isCsLikeProfile ? 'Polština' : 'Polish' },
  ];
  const searchBenefitOptions: Array<{ key: string; label: string }> = [
    { key: 'childcare_support', label: isCsLikeProfile ? 'Podpora péče o děti' : 'Childcare support' },
    { key: 'child_friendly', label: isCsLikeProfile ? 'Child-friendly prostředí' : 'Child-friendly environment' },
    { key: 'home_office', label: isCsLikeProfile ? 'Home office' : 'Home office' },
    { key: 'flex_time', label: isCsLikeProfile ? 'Flexibilní režim' : 'Flexible schedule' },
    { key: 'meal_allowance', label: isCsLikeProfile ? 'Stravování' : 'Meals' },
    { key: 'transport_support', label: isCsLikeProfile ? 'Doprava / parkování' : 'Transport / parking' },
    { key: 'health_care', label: isCsLikeProfile ? 'Zdravotní péče' : 'Healthcare' },
    { key: 'pension', label: isCsLikeProfile ? 'Penzijko / spoření' : 'Pension / retirement' },
    { key: 'vacation_5w', label: isCsLikeProfile ? 'Extra dovolená' : 'Extra vacation' },
    { key: 'education', label: isCsLikeProfile ? 'Vzdělávání' : 'Education' },
    { key: 'multisport', label: isCsLikeProfile ? 'Sport / wellness' : 'Sport / wellness' },
    { key: 'car_personal', label: isCsLikeProfile ? 'Služební auto' : 'Company car' },
  ];
  const intentDomainOptions = getCandidateIntentDomainOptions(i18n.language || 'cs');
  const seniorityOptions: Array<{ key: CandidateSeniority; label: string }> = [
    { key: 'entry', label: isCsLikeProfile ? 'Entry / trainee' : 'Entry / trainee' },
    { key: 'junior', label: isCsLikeProfile ? 'Junior' : 'Junior' },
    { key: 'medior', label: isCsLikeProfile ? 'Medior' : 'Mid-level' },
    { key: 'senior', label: isCsLikeProfile ? 'Senior' : 'Senior' },
    { key: 'lead', label: isCsLikeProfile ? 'Lead / manažer' : 'Lead / manager' },
  ];
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [profilePhotoFailed, setProfilePhotoFailed] = useState(false);
  const [isUploadingCV, setIsUploadingCV] = useState(false);
  const [isRepairingPhoto, setIsRepairingPhoto] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTabKey>('personal');
  const [savedJobsSearchTerm, setSavedJobsSearchTerm] = useState('');
  const [savedJobsFallback, setSavedJobsFallback] = useState<Job[]>([]);
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
  const [saveFeedback, setSaveFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passwordForm, setPasswordForm] = useState({ nextPassword: '', confirmPassword: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
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

  const displaySavedJobs = savedJobs.length > 0 ? savedJobs : savedJobsFallback;
  const profileTabs: Array<{
    key: ProfileTabKey;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    caption?: string;
  }> = [
    { key: 'personal', icon: User, label: t('profile.personal_info', { defaultValue: 'Osobní údaje' }) },
    {
      key: 'cv',
      icon: FileText,
      label: t('profile.supporting_context_tab', { defaultValue: supportingContextCopy.tabLabel }),
      caption: t('profile.supporting_context_tab_caption', { defaultValue: supportingContextCopy.tabCaption })
    },
    { key: 'jcfpm', icon: Sparkles, label: 'JCFPM' },
    { key: 'settings', icon: Bell, label: t('profile.settings_title', { defaultValue: 'Nastavení' }) },
    {
      key: 'saved',
      icon: Bookmark,
      label: t('profile.job_hub.badge', { defaultValue: 'Dialogové centrum' }),
      caption: t('profile.job_hub.tab_caption', { defaultValue: 'Dialogy a sloty' })
    },
  ];
  const isPersonalTab = activeTab === 'personal';
  const isCvTab = activeTab === 'cv';
  const isJcfpmTab = activeTab === 'jcfpm';
  const isSettingsTab = activeTab === 'settings';
  const profileInputClass = 'w-full rounded-[0.95rem] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2.5 text-[var(--text-strong)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]';
  const profileCompactInputClass = 'w-full rounded-[0.9rem] border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[var(--text-strong)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] dark:[color-scheme:dark]';
  const profileIconButtonClass = 'rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-2 text-[var(--text-muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]';
  const profilePrimaryButtonClass = 'app-button-primary disabled:cursor-not-allowed disabled:opacity-60';
  const profileSurfaceClass = 'app-surface overflow-hidden rounded-[var(--radius-xl)] border shadow-[var(--shadow-card)]';
  const profileAccentIconShellClass = 'rounded-lg bg-[var(--accent-soft)] p-2';
  const profileAccentIconClass = 'h-5 w-5 text-[var(--accent)]';
  const profileAccentPanelClass = 'rounded-xl border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] p-4';
  const profileAccentBadgeClass = 'inline-flex items-center rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]';

  const profileHeroCopy = isCsLikeProfile
    ? {
      eyebrow: 'Profil kandidáta',
      subtitle: 'Udržujte profil připravený pro první kontakt. Jasný kontext, stručné podklady a aktualizované preference.',
      readiness: 'Připravenost profilu',
      sections: 'Aktivní sekce',
      docs: 'Podklady'
    }
    : {
      eyebrow: 'Candidate profile',
      subtitle: 'Keep your profile ready for first contact: clear context, concise supporting docs, and up-to-date preferences.',
      readiness: 'Profile readiness',
      sections: 'Active sections',
      docs: 'Documents'
    };

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
    formData.searchProfile.nearBorder,
    formData.searchProfile.wantsContractorRoles,
    formData.searchProfile.wantsDogFriendlyOffice,
    formData.searchProfile.preferredBenefitKeys.includes('child_friendly') || formData.searchProfile.preferredBenefitKeys.includes('childcare_support'),
    formData.searchProfile.wantsRemoteRoles,
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
  const inferredIntentAvailable = Boolean(resolvedIntentProfile.inferredPrimaryDomain || resolvedIntentProfile.inferredTargetRole);
  const hasManualIntent = Boolean(formData.searchProfile.primaryDomain || formData.searchProfile.targetRole || formData.searchProfile.seniority);
  const focusIntentSetup = () => {
    setActiveTab('settings');
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

  const renderAiGuidePanel = isCvTab ? (
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
                  {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurMonthlyLabel}`}
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
                {t('app.clear', { defaultValue: 'Clear' })}
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
              {t('profile.ai_cv_editor.count', { defaultValue: '{{count}} characters', count: editableCvAiText.length })}
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
                ? t('profile.ai_cv_editor.saving', { defaultValue: 'Saving...' })
                : t('profile.ai_cv_editor.save', { defaultValue: supportingContextCopy.aiDraftSave })}
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const renderIntentSetupPanel = isSettingsTab ? (
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
                {showIntentNudge ? (isCsLikeProfile ? 'Doporučené doplnění po nahrání CV' : 'Suggested update after CV upload') : intentProfileCopy.inferredTitle}
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
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
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
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        active
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

  const renderPremiumSearchSetupPanel = isSettingsTab ? (
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
                : (isCsLikeProfile
                  ? 'Premium odemyká životní situaci, dopravu, benefity a jemnější výchozí nastavení feedu.'
                  : 'Premium unlocks life-context setup, transport preferences, benefits and finer feed defaults.')}
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
                className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${
                  item.active
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
              className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${
                formData.searchProfile.wantsDogFriendlyOffice
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
              className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${
                formData.searchProfile.preferredBenefitKeys.includes('child_friendly') || formData.searchProfile.preferredBenefitKeys.includes('childcare_support')
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
              className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${
                formData.jhiPreferences.hardConstraints.excludeShift
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
                    {isCsLikeProfile ? 'Výchozí dojezd' : 'Default commute'}
                  </div>
                  <div className="mt-1 text-base font-semibold text-[var(--text-strong)]">
                    {formData.searchProfile.defaultEnableCommuteFilter ? `${formData.searchProfile.defaultMaxDistanceKm} km` : (isCsLikeProfile ? 'Vypnuto' : 'Off')}
                  </div>
                </div>
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                    {isCsLikeProfile ? 'Forma dopravy' : 'Transport mode'}
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
                    {commuteOriginAddress || (isCsLikeProfile ? 'Neuvedeno' : 'Not set')}
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
              <label className={`flex items-start gap-3 rounded-[0.95rem] border px-4 py-3 text-sm transition ${
                formData.searchProfile.defaultEnableCommuteFilter
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
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
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
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      active
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
                {isCsLikeProfile
                  ? 'Ve free verzi zůstává zdarma váš obor a cílová role. Premium přidává životní situaci, preferovanou dopravu, benefity a detailnější rozhodovací vrstvu.'
                  : 'The free plan keeps your domain and target role. Premium adds life-context setup, transport preferences, benefits and a deeper decision layer.'}
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
              {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurMonthlyLabel}`}
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

    if (field === 'preferredBenefitKeys') {
      nextSearchProfile.preferredBenefitKeys = Array.from(new Set(((value as string[]) || []).map((item) => String(item || '').trim()).filter(Boolean)));
    }

    if (field === 'secondaryDomains') {
      nextSearchProfile.secondaryDomains = Array.from(new Set(((value as CandidateDomainKey[]) || []).filter(Boolean))).slice(0, 2);
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
    <div className="app-shell-bg relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-18rem] top-[-10rem] h-[28rem] w-[28rem] rounded-full bg-[rgba(var(--accent-rgb),0.14)] blur-3xl" />
        <div className="absolute right-[-14rem] top-[8rem] h-[24rem] w-[24rem] rounded-full bg-[rgba(var(--accent-rgb),0.08)] blur-3xl" />
        <div className="absolute bottom-[-12rem] left-[30%] h-[24rem] w-[24rem] rounded-full bg-emerald-200/20 blur-3xl dark:bg-emerald-500/10" />
      </div>

      <div className="relative mx-auto w-full max-w-[1720px] space-y-6 px-3 pb-10 pt-6 sm:px-5 lg:px-8">
        {/* Header */}
        <div className="app-page-header overflow-hidden rounded-[var(--radius-2xl)] border p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full items-start gap-4 sm:w-auto sm:items-center">
              <div className="relative">
                {profile.photo && !profilePhotoFailed ? (
                  <img
                    src={profile.photo}
                    alt="Profile"
                    className="h-20 w-20 rounded-full border border-[var(--border)] object-cover ring-2 ring-[rgba(var(--accent-rgb),0.14)] sm:h-24 sm:w-24"
                    onError={() => setProfilePhotoFailed(true)}
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] ring-2 ring-[rgba(var(--accent-rgb),0.14)] sm:h-24 sm:w-24">
                    <Camera size={32} className="text-[var(--accent)]" />
                  </div>
                )}

                <label className="absolute bottom-0 right-0 cursor-pointer rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-[var(--accent)] p-2 text-white transition-colors hover:bg-[var(--accent-hover)]">
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
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--text)] transition-colors hover:bg-[var(--surface-elevated)]"
                  >
                    {isRepairingPhoto ? t('profile.photo_uploading') : t('profile.photo_repair')}
                  </button>
                )}
              </div>
            </div>

            <div className="w-full max-w-[34rem] space-y-3 lg:w-auto">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="min-w-0 break-words text-[10px] leading-tight text-[var(--text-faint)]">{profileHeroCopy.readiness}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-strong)]">{profileReadinessScore}%</div>
                </div>
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="min-w-0 break-words text-[10px] leading-tight text-[var(--text-faint)]">{profileHeroCopy.sections}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-strong)]">{profileTotalSections}</div>
                </div>
                <div className="rounded-[0.9rem] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                  <div className="min-w-0 break-words text-[10px] leading-tight text-[var(--text-faint)]">{profileHeroCopy.docs}</div>
                  <div className="mt-1 text-xl font-semibold text-[var(--text-strong)]">{profileDocumentsReady}/2</div>
                </div>
              </div>

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
          {saveFeedback && (
            <div className={`mt-4 flex items-center gap-2 text-sm font-medium ${saveFeedback.type === 'success'
              ? 'text-emerald-600 dark:text-emerald-300'
              : 'text-rose-600 dark:text-rose-300'
              }`}>
              <CheckCircle size={16} />
              <span>{saveFeedback.text}</span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className={`${profileSurfaceClass} p-2.5`}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
            {profileTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-[1rem] border px-3 py-3 text-left transition-all ${isActive
                    ? 'border-[rgba(var(--accent-rgb),0.26)] bg-[var(--accent-soft)] text-[var(--accent)] shadow-[var(--shadow-soft)]'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text)] hover:-translate-y-[1px] hover:border-[rgba(var(--accent-rgb),0.18)] hover:bg-[var(--surface-elevated)]'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${isActive ? 'bg-white/70 text-[var(--accent)]' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
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

            {isPersonalTab && (
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
                    className={`w-full rounded-[0.95rem] border bg-[var(--surface-muted)] px-4 py-2.5 text-[var(--text-strong)] outline-none transition focus:border-[rgba(var(--accent-rgb),0.34)] focus:ring-4 focus:ring-[rgba(var(--accent-rgb),0.08)] ${addressVerificationStatus === 'success' ? 'border-emerald-500 pr-12' :
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
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
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

            {isCvTab && (
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
                          <CheckCircle className="w-4 h-4 text-emerald-500" />
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

            {isCvTab && (
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

            {isSettingsTab && (
              <>
            {renderPremiumSearchSetupPanel}
            {renderIntentSetupPanel}

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
                        {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurMonthlyLabel}`}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={profileSurfaceClass}>
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
                      {`${t('premium.upgrade_btn_short')} • ${premiumPrice.eurMonthlyLabel}`}
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
                      className="px-3 py-1.5 text-xs font-semibold rounded-full border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:cursor-not-allowed"
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
                        {t('happiness_audit_3d.title', { defaultValue: 'Personal Happiness Audit (Premium)' })}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {t('happiness_audit_3d.subtitle', { defaultValue: 'Life-Sustainability Orbit + Career Anchor vs Drift' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full border border-amber-300/80 bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Premium
                      </span>
                      <button
                        onClick={() => setEnableLive3D((prev) => !prev)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${enableLive3D
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {enableLive3D
                          ? t('happiness_audit_3d.live_on', { defaultValue: 'Enable live 3D: ON' })
                          : t('happiness_audit_3d.live_off', { defaultValue: 'Enable live 3D: OFF' })}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  {!isPremium && (
                    <div className="text-sm text-amber-700 dark:text-amber-300">
                      {t('happiness_audit_3d.premium_required', { defaultValue: 'Happiness audit is available in Premium.' })}
                    </div>
                  )}
                  <fieldset disabled={!isPremium} className={!isPremium ? 'opacity-60' : ''}>
                    <div className="space-y-4">
                      <div className="rounded-xl border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] p-4">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                          {isCsLikeProfile ? 'Úkol 1 · Únik zdrojů' : 'Quest 1 · The Resource Leak'}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          Když se podíváš na svůj měsíční výpis z účtu a odečteš čas strávený v kolonách (v tvém případě {monthlyCommuteHours} hodiny), kolik energie ti reálně zbývá na věci, které tě definují?
                        </p>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                          {([
                            ['commute', 'Dojíždění'],
                            ['taxes', 'Daně'],
                            ['fixed', 'Fixní náklady'],
                          ] as const).map(([key, label]) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setResourceLeakToggles((prev) => ({ ...prev, [key]: !prev[key] }))}
                              className={`px-3 py-2 rounded-lg text-sm border ${resourceLeakToggles[key]
                                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300'
                                }`}
                            >
                              {resourceLeakToggles[key]
                                ? `${isCsLikeProfile ? 'Zapnuto' : 'Pipe ON'}: ${label}`
                                : `${isCsLikeProfile ? 'Vypnuto' : 'Pipe OFF'}: ${label}`}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Odpojeno rour: {disconnectedPipes} / 3
                        </div>
                      </div>

                      <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/40 bg-indigo-50/60 dark:bg-indigo-950/20 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 mb-2">
                          {isCsLikeProfile ? 'Úkol 2 · Zrcadlo příběhu' : 'Quest 2 · The Narrative Mirror'}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          Kdybys měl vymazat všechna formální "buzzwordy" ze svého životopisu, co je ten jeden moment v tvé kariéře, kdy jsi měl pocit, že jsi nezastavitelný a dělal jsi přesně to, co umíš nejlíp?
                        </p>
                        <textarea
                          value={narrativeStory}
                          onChange={(e) => setNarrativeStory(e.target.value)}
                          placeholder={isCsLikeProfile ? 'Nadiktuj svůj příběh...' : 'Dictate your story...'}
                          className="mt-3 w-full h-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-white"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {narrativeSkills.length > 0 ? narrativeSkills.map((skill, index) => (
                            <span key={`${skill}-${index}`} className="px-2 py-1 text-xs rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {skill}
                            </span>
                          )) : (
                            <span className="text-xs text-slate-500 dark:text-slate-400">Zatím bez rozsvíceného souhvězdí.</span>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/20 p-4">
                        <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 mb-2">
                          {isCsLikeProfile ? 'Úkol 3 · Kulturní severka' : 'Quest 3 · The Cultural Northstar'}
                        </div>
                        <p className="text-sm text-slate-700 dark:text-slate-200">
                          Představ si, že tvůj šéf udělá zásadní chybu. Co je v tvém ideálním světě ta správná reakce firmy – upřímná omluva v tónu „přátelský profesionál“, nebo tiché opravení procesu?
                        </p>
                        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="text-xs text-slate-600 dark:text-slate-300">
                            Individualismus ↔ Tým ({culturalCompass.individualVsTeam})
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
                            Chaos ↔ Struktura ({culturalCompass.chaosVsStructure})
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
                          Aktuální firma je mimo sever o {culturalMismatch}%.
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="text-sm text-slate-700 dark:text-slate-300">
                          {t('happiness_audit_3d.salary', { defaultValue: 'Monthly gross salary' })}
                          <input
                            type="number"
                            min={0}
                            value={happinessAuditInput.salary}
                            onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, salary: Number(e.target.value) || 0 }))}
                            className={`mt-1 ${profileCompactInputClass}`}
                          />
                        </label>
                        <label className="text-sm text-slate-700 dark:text-slate-300">
                          {t('happiness_audit_3d.commute_cost', { defaultValue: 'Monthly commute cost' })}
                          <input
                            type="number"
                            min={0}
                            value={happinessAuditInput.commute_cost}
                            onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, commute_cost: Number(e.target.value) || 0 }))}
                            className={`mt-1 ${profileCompactInputClass}`}
                          />
                        </label>
                        <label className="text-sm text-slate-700 dark:text-slate-300">
                          {t('happiness_audit_3d.home_office_days', { defaultValue: 'Home office days / week' })}
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
                          {t('happiness_audit_3d.commute_minutes', { defaultValue: 'Commute minutes per day' })}
                          <input
                            type="range"
                            min={0}
                            max={180}
                            step={5}
                            value={happinessAuditInput.commute_minutes_daily}
                            onChange={(e) => setHappinessAuditInput((prev) => ({ ...prev, commute_minutes_daily: Number(e.target.value) || 0 }))}
                            className="mt-2 w-full"
                          />
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{happinessAuditInput.commute_minutes_daily} min/day</div>
                        </label>
                        <label className="text-sm text-slate-700 dark:text-slate-300">
                          {t('happiness_audit_3d.energy', { defaultValue: 'Subjective energy' })}
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
                          {t('happiness_audit_3d.role_shift', { defaultValue: 'Role drift indicator' })}
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
                        {isCsLikeProfile ? 'Orbit životní udržitelnosti' : 'Life-Sustainability Orbit'}
                      </div>
                      {enableLive3D ? (
                        <SceneShell
                          capability={sceneCapability}
                          enableControls
                          fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{isCsLikeProfile ? '3D náhradní režim.' : '3D fallback mode.'}</div>}
                        >
                          <LifeSustainabilityOrbit output={happinessAuditOutput} />
                        </SceneShell>
                      ) : (
                        <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                          {isCsLikeProfile ? 'Živé 3D je vypnuté.' : 'Live 3D disabled.'}
                        </div>
                      )}
                    </div>
                    <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-2">
                        {isCsLikeProfile ? 'Kariérní kotva vs. drift' : 'Career Anchor vs Drift'}
                      </div>
                      {enableLive3D ? (
                        <SceneShell
                          capability={sceneCapability}
                          fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{isCsLikeProfile ? '3D náhradní režim.' : '3D fallback mode.'}</div>}
                        >
                          <CareerAnchorDrift output={happinessAuditOutput} />
                        </SceneShell>
                      ) : (
                        <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                          {isCsLikeProfile ? 'Živé 3D je vypnuté.' : 'Live 3D disabled.'}
                        </div>
                      )}
                    </div>
                    <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="text-xs uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-2">
                        {isCsLikeProfile ? 'Zrcadlo příběhu' : 'The Narrative Mirror'}
                      </div>
                      {enableLive3D ? (
                        <SceneShell
                          capability={sceneCapability}
                          fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{isCsLikeProfile ? '3D náhradní režim.' : '3D fallback mode.'}</div>}
                        >
                          <NebulaOfPotential frame={narrativeFrame} />
                        </SceneShell>
                      ) : (
                        <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                          {isCsLikeProfile ? 'Živé 3D je vypnuté.' : 'Live 3D disabled.'}
                        </div>
                      )}
                    </div>
                    <div className="rounded-[1rem] border border-slate-200 bg-slate-50 p-3 shadow-[0_16px_30px_-30px_rgba(15,23,42,0.18)] dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-2">
                        {isCsLikeProfile ? 'Kulturní severka' : 'The Cultural Northstar'}
                      </div>
                      {enableLive3D ? (
                        <SceneShell
                          capability={sceneCapability}
                          fallback={<div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">{isCsLikeProfile ? '3D náhradní režim.' : '3D fallback mode.'}</div>}
                        >
                          <CulturalNorthstarCompass
                            alignmentScore={culturalAlignment}
                            individualVsTeam={culturalCompass.individualVsTeam}
                            chaosVsStructure={culturalCompass.chaosVsStructure}
                          />
                        </SceneShell>
                      ) : (
                        <div className="h-44 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-500">
                          {isCsLikeProfile ? 'Živé 3D je vypnuté.' : 'Live 3D disabled.'}
                        </div>
                      )}
                      <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {isCsLikeProfile
                          ? `Kulturní sladění: ${culturalAlignment}% · nesoulad: ${culturalMismatch}%`
                          : `Cultural alignment: ${culturalAlignment}% · mismatch: ${culturalMismatch}%`}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                      {isSimulatingAudit
                        ? t('happiness_audit_3d.simulating', { defaultValue: 'Simulating...' })
                        : t('happiness_audit_3d.results', { defaultValue: 'Audit output' })}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div><span className="text-slate-500">{isCsLikeProfile ? 'Časový okruh' : 'Time ring'}</span><div className="font-bold">{happinessAuditOutput?.time_ring ?? 0}/100</div></div>
                      <div><span className="text-slate-500">{isCsLikeProfile ? 'Energetický okruh' : 'Energy ring'}</span><div className="font-bold">{happinessAuditOutput?.energy_ring ?? 0}/100</div></div>
                      <div><span className="text-slate-500">{isCsLikeProfile ? 'Udržitelnost' : 'Sustainability'}</span><div className="font-bold">{happinessAuditOutput?.sustainability_score ?? 0}/100</div></div>
                      <div><span className="text-slate-500">{isCsLikeProfile ? 'Drift' : 'Drift'}</span><div className="font-bold">{happinessAuditOutput?.drift_score ?? 0}/100</div></div>
                    </div>
                    <ul className="mt-3 space-y-1 text-sm text-slate-700 dark:text-slate-300">
                      {(happinessAuditOutput?.recommendations || []).map((item, index) => (
                        <li key={`${item}-${index}`}>• {item}</li>
                      ))}
                    </ul>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                      {happinessAuditOutput?.advisory_disclaimer || t('ai_advisory.default', { defaultValue: 'This is guidance only. Final decision remains yours.' })}
                    </div>
                  </div>
                </div>
              </div>
            )}

              </>
            )}

            {isJcfpmTab && (
            <div id="jcfpm-card" className={profileSurfaceClass}>
              <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Career Fit & Potential Test
                  <span className="ml-2 inline-block bg-emerald-100 text-emerald-800 dark:bg-emerald-600 dark:text-emerald-50 text-xs font-medium px-2 py-0.5 rounded-full">
                    &bull; test
                  </span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {profilePremiumCopy.jcfpmSummary}
                </p>
              </div>
              <div className="space-y-4 bg-[linear-gradient(180deg,rgba(255,250,240,0.88),rgba(255,255,255,0.98))] p-6 dark:bg-[linear-gradient(180deg,rgba(29,21,7,0.28),rgba(10,18,32,0.96))]">
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
                {jcfpmSnapshot && (
                  <div id="profile-jcfpm-report" className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-3 shadow-[var(--shadow-soft)]">
                    <JcfpmReportPanel snapshot={jcfpmSnapshot} showAdvancedReport={isPremium} />
                  </div>
                )}
                {profile.preferences?.jcfpm_jhi_adjustment_v1 && isPremium && (
                  <div className="rounded-xl border border-[rgba(var(--accent-rgb),0.16)] bg-white/80 p-4 dark:bg-slate-900/70">
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
                  <div className="rounded-xl border border-amber-200/70 dark:border-amber-900/40 bg-white/80 dark:bg-slate-900/70 p-4">
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
                  {t('profile.save_hint_bottom', { defaultValue: 'Po úpravách profilu změny uložte.' })}
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
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-rose-700 dark:text-rose-300'
                  }`}>
                  <CheckCircle size={16} />
                  <span>{saveFeedback.text}</span>
                </div>
              )}
            </div>

            {isSettingsTab && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Mail className={profileAccentIconClass} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.account_title', { defaultValue: 'Účet a e-mail' })}
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

            {isSettingsTab && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Bell className={profileAccentIconClass} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.notifications', { defaultValue: 'Notifikace' })}
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
                      {t('profile.digest_email', { defaultValue: 'Denní digest e‑mailem' })}
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input
                        type="checkbox"
                        checked={Boolean(formData.notifications.dailyDigestPushEnabled)}
                        onChange={(e) => handleNotificationChange('dailyDigestPushEnabled', e.target.checked)}
                      />
                      {t('profile.digest_push', { defaultValue: 'Denní digest jako push' })}
                    </label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('profile.digest_time', { defaultValue: 'Čas doručení' })}
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
                        {t('profile.digest_timezone', { defaultValue: 'Časové pásmo' })}
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
                        ? `${t('profile.push_status', { defaultValue: 'Push status' })}: ${pushSubscribed ? 'aktivní' : 'neaktivní'} (${pushPermission})`
                        : t('profile.push_unsupported', { defaultValue: 'Push notifikace nejsou v tomto prohlížeči dostupné.' })}
                    </div>
                    {pushSupported && (
                      <>
                        <button
                          onClick={handleEnablePush}
                          disabled={pushBusy}
                          className="px-3 py-1.5 rounded-lg text-xs border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50"
                        >
                          {t('profile.push_enable', { defaultValue: 'Povolit push notifikace' })}
                        </button>
                        <button
                          onClick={handleDisablePush}
                          disabled={pushBusy}
                          className="px-3 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-800 hover:border-rose-400 hover:text-rose-600 transition-colors disabled:opacity-50"
                        >
                          {t('profile.push_disable', { defaultValue: 'Vypnout push' })}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {isSettingsTab && profile.isLoggedIn && (
              <div className={profileSurfaceClass}>
                <div className="border-b border-slate-200 dark:border-slate-700 p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center gap-3">
                    <div className={profileAccentIconShellClass}>
                      <Lock className={profileAccentIconClass} />
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {t('profile.security_title', { defaultValue: 'Změna hesla' })}
                    </h2>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {t('profile.security_desc', { defaultValue: 'Nastavte si nové heslo pro přihlášení do účtu.' })}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                        {t('auth.new_password', { defaultValue: 'Nové heslo' })}
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
                        {t('auth.confirm_new_password', { defaultValue: 'Potvrzení hesla' })}
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
                        : t('auth.set_new_password', { defaultValue: 'Nastavit nové heslo' })}
                    </button>
                    {passwordFeedback && (
                      <div className={`text-sm font-medium flex items-center gap-2 ${passwordFeedback.type === 'success'
                        ? 'text-emerald-700 dark:text-emerald-300'
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

            {isSettingsTab && (
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
