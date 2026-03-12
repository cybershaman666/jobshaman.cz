import React, { useEffect, useMemo, useState } from 'react';
import Markdown from 'markdown-to-jsx';
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  Clock3,
  Compass,
  Route,
  Sparkles,
  Users,
  Wallet
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FEATURE_SALARY_BENCHMARKS } from '../../constants';
import { fetchSalaryBenchmark } from '../../services/benchmarkService';
import { calculateCommuteReality, isRemoteJob } from '../../services/commuteService';
import { fetchJobHumanContext } from '../../services/jobService';
import { formatJobDescription } from '../../utils/formatters';
import { CommuteAnalysis, Job, JobHumanContext, JobPublicPerson, MicroJobCollaborationMode, MicroJobLongTermPotential, SalaryBenchmarkResolved, UserProfile } from '../../types';
import ChallengeComposer from './ChallengeComposer';
import { MetricTile, PageHeader, SurfaceCard, cn } from '../ui/primitives';

interface ChallengeFocusViewProps {
  job: Job;
  userProfile: UserProfile;
  firstQualityActionAt?: string | null;
  onBack: () => void;
  onRequireAuth: () => void;
  onOpenProfile: () => void;
  onOpenSupportingContext: () => void;
  onOpenCompanyPage: (companyId: string) => void;
  onOpenImportedListing: () => void;
}

const stripMarkdown = (value: string | null | undefined): string => {
  return String(value || '')
    .replace(/[#>*_`~[\]()!-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const shorten = (value: string | null | undefined, maxLength = 220): string => {
  const plain = stripMarkdown(value);
  if (!plain) return '';
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength - 3).trim()}...`;
};

const normalizeBenefitChips = (benefits: string[] | null | undefined): string[] => {
  if (!Array.isArray(benefits) || benefits.length === 0) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  benefits.forEach((rawBenefit) => {
    const raw = stripMarkdown(rawBenefit);
    if (!raw) return;

    const chunks = raw.length > 120
      ? raw.split(/[\n;|•]+/g)
      : [raw];

    chunks.forEach((chunk) => {
      const cleaned = chunk
        .replace(/^(náplň práce|požadujeme|požadovaný profil|odpovědnosti|responsibilities|requirements|deine aufgaben)\s*:?\s*/i, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!cleaned) return;
      if (cleaned.length > 64) return;
      if (cleaned.split(' ').length > 8) return;

      const key = cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push(cleaned);
    });
  });

  return normalized.slice(0, 8);
};

const getInitials = (value: string): string => {
  const parts = value.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'JS';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const isMicroJob = (job: Job): boolean => job.challenge_format === 'micro_job';

const getMicroJobKindLabel = (kind: Job['micro_job_kind'], language: string): string | null => {
  if (!kind) return null;
  const locale = language === 'at' ? 'de' : language;
  const labels: Record<NonNullable<Job['micro_job_kind']>, Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string>> = {
    one_off_task: { cs: 'Jednorázový task', sk: 'Jednorazový task', de: 'Einmalige Aufgabe', pl: 'Jednorazowe zadanie', en: 'One-off task' },
    short_project: { cs: 'Krátký projekt', sk: 'Krátky projekt', de: 'Kurzprojekt', pl: 'Krótki projekt', en: 'Short project' },
    audit_review: { cs: 'Audit / review', sk: 'Audit / review', de: 'Audit / Review', pl: 'Audyt / review', en: 'Audit / review' },
    prototype: { cs: 'Prototyp', sk: 'Prototyp', de: 'Prototyp', pl: 'Prototyp', en: 'Prototype' },
    experiment: { cs: 'Experiment', sk: 'Experiment', de: 'Experiment', pl: 'Eksperyment', en: 'Experiment' }
  };
  return labels[kind]?.[locale as 'cs' | 'sk' | 'de' | 'pl' | 'en'] || labels[kind]?.en || null;
};

const getMicroJobCollaborationLabel = (
  modes: Job['micro_job_collaboration_modes'],
  language: string
): string | null => {
  if (!Array.isArray(modes) || modes.length === 0) return null;
  const locale = language === 'at' ? 'de' : language;
  const labels: Record<MicroJobCollaborationMode, Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string>> = {
    remote: { cs: 'Remote', sk: 'Remote', de: 'Remote', pl: 'Remote', en: 'Remote' },
    async: { cs: 'Asynchronně', sk: 'Asynchrónne', de: 'Asynchron', pl: 'Asynchronicznie', en: 'Async' },
    call: { cs: 'Call', sk: 'Call', de: 'Call', pl: 'Call', en: 'Call' }
  };
  return modes.map((mode) => labels[mode]?.[locale as 'cs' | 'sk' | 'de' | 'pl' | 'en'] || labels[mode]?.en || mode).join(' • ');
};

const getMicroJobLongTermPotentialLabel = (
  value: Job['micro_job_long_term_potential'],
  language: string
): string | null => {
  if (!value) return null;
  const locale = language === 'at' ? 'de' : language;
  const labels: Record<MicroJobLongTermPotential, Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string>> = {
    yes: { cs: 'Ano', sk: 'Áno', de: 'Ja', pl: 'Tak', en: 'Yes' },
    maybe: { cs: 'Možná', sk: 'Možno', de: 'Vielleicht', pl: 'Możliwe', en: 'Maybe' },
    no: { cs: 'Ne', sk: 'Nie', de: 'Nein', pl: 'Nie', en: 'No' }
  };
  return labels[value]?.[locale as 'cs' | 'sk' | 'de' | 'pl' | 'en'] || labels[value]?.en || null;
};

const formatSalary = (job: Job, locale: string, isCsLike: boolean): string => {
  if (job.salaryRange) return job.salaryRange;
  const from = Number(job.salary_from || 0);
  const to = Number(job.salary_to || 0);
  const currency = (job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR');
  if (from && to) return `${from.toLocaleString(locale)} - ${to.toLocaleString(locale)} ${currency}`;
  if (from || to) return `${(from || to).toLocaleString(locale)} ${currency}`;
  return isCsLike ? 'Mzda neuvedena' : 'Salary not specified';
};

const ChallengeFocusView: React.FC<ChallengeFocusViewProps> = ({
  job,
  userProfile,
  firstQualityActionAt,
  onBack,
  onRequireAuth,
  onOpenProfile,
  onOpenSupportingContext,
  onOpenCompanyPage,
  onOpenImportedListing
}) => {
  const { i18n } = useTranslation();
  const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
  const [salaryBenchmark, setSalaryBenchmark] = useState<SalaryBenchmarkResolved | null>(null);
  const [humanContext, setHumanContext] = useState<JobHumanContext | null>(null);
  const [showFirstContactGuide, setShowFirstContactGuide] = useState(false);
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en';
  const localizedLanguage = (language === 'at' ? 'de' : language) as 'cs' | 'sk' | 'de' | 'pl' | 'en';
  const isCsLike = language === 'cs' || language === 'sk';
  const isImported = job.listingKind === 'imported';
  const isMicroJobRole = isMicroJob(job);
  const isNativeChallenge = !isImported && Boolean(job.company_id) && String(job.source || '').trim().toLowerCase() === 'jobshaman.cz';
  const remoteRole = isRemoteJob(job);
  const firstContactGuideStorageKey = 'jobshaman_first_contact_guide_dismissed';

  const copy = ({
    cs: {
      back: 'Zpět na seznam',
      eyebrow: isImported ? 'Importovaná nabídka' : 'Nabídka s vlastní výzvou',
      body: 'Co bude potřeba zvládnout, na co si dát pozor, jak odpovědět a co to znamená pro tvoji realitu.',
      reality: 'Rychlá orientace',
      decision: 'Na co odpovědět',
      company: 'Firma a kontext',
      quickInsights: 'Rychlý přehled',
      challenge: 'Co bude potřeba zvládnout',
      risk: 'Na co si dát pozor',
      question: 'První otázka',
      fit: 'Shoda podle JHI',
      salary: 'Mzda',
      workModel: 'Způsob práce',
      location: 'Místo',
      source: 'Zdroj',
      openListing: 'Otevřít původní inzerát',
      openCompany: 'Otevřít profil firmy',
      openContext: 'Doplnit vlastní kontext',
      financialTitle: 'Finanční a dojezdová realita',
      financialBody: 'Tady vidíš skutečný dopad nabídky po započtení čisté mzdy, benefitů a dojíždění.',
      financialFormula: 'Výpočet: čistá mzda {{net}} + benefity {{benefits}} - dojíždění {{commute}} = {{total}}',
      loginPrompt: 'Přihlas se a uvidíš dopad mzdy a dojíždění na svou vlastní situaci.',
      addressPrompt: 'Doplň v profilu adresu nebo polohu a dopočítáme reálné dojíždění.',
      openProfile: 'Otevřít profil',
      gross: 'Hrubá mzda',
      net: 'Čistá mzda',
      benefits: 'Hodnota benefitů',
      commute: 'Náklady na dojíždění',
      commuteDistance: 'Vzdálenost do práce',
      realValue: 'Skutečná měsíční hodnota',
      jhiImpact: 'Dopad do JHI',
      oneWay: 'Jedna cesta',
      dailyTime: 'Čas za den',
      marketMedian: 'Medián trhu',
      marketDelta: 'Rozdíl oproti mediánu',
      benefitsList: 'Benefity',
      realIncome: 'Skutečný příjem',
      compatibility: 'Míra shody',
      originalListing: 'Původní text nabídky',
      originalBody: 'Plný text zůstává dostupný i tady, aby bylo vždy jasné, z čeho nabídka vychází.',
      noDescription: 'Plný text nabídky není k dispozici.',
      companySignal: 'Co o firmě a roli víme',
      importedNote: 'Tato výzva je odvozená z importované nabídky, ale stále vychází z původního inzerátu.',
      importedActionTitle: 'Na tuto nabídku odpovíš na původním webu',
      importedActionBody: 'Otázka výše slouží jen jako pomůcka pro tvoje rozhodnutí. Pokud ti nabídka dává smysl, pokračuješ přes původní inzerát, kde má firma vlastní tlačítko pro odpověď.',
      importedActionCta: 'Otevřít původní inzerát',
      remoteReality: 'Práce na dálku se počítá jako nulové dojíždění, ne jako chybějící údaj.',
      moreCompany: 'Firma a kontext',
      moreOriginal: 'Původní text nabídky',
      firstContactGuideTitle: 'Jak funguje první kontakt s firmou',
      firstContactGuideBody: isImported
        ? 'Tady se nejdřív zorientuješ v tom, co firma skutečně řeší. U importované nabídky ti tato otázka pomůže udělat lepší rozhodnutí před odchodem na původní web.'
        : 'Na JobShamanu nezačínáš slepým CV. Firma nejdřív uvidí krátkou odpověď na konkrétní situaci a až potom volitelný kontext z profilu nebo životopisu.',
      firstContactGuidePointOne: isImported
        ? 'Otázka výše se firmě sama neposílá. Slouží jako tvoje příprava před otevřením původního inzerátu.'
        : 'První signál je tvoje stručná odpověď: co bys udělal(a) jako první krok a co bys potřeboval(a) ověřit.',
      firstContactGuidePointTwo: isImported
        ? 'Pokud ti role dává smysl, odpověď dokončíš na původním webu firmy nebo job boardu.'
        : 'Profil, CV a delší kontext jsou až druhá vrstva. Pomáhají, ale nepřebíjejí první odpověď.',
      firstContactGuidePointThree: isImported
        ? 'Doplňující kontext si můžeš připravit tady, ať nejdeš na původní web bez rozmyšlení.'
        : 'Čím konkrétnější odpověď na skutečný problém, tím vyšší šance na smysluplný dialog místo generické reakce.',
      firstContactGuideDismiss: 'Rozumím',
      firstContactGuideContext: 'Doplnit kontext',
      publisherLabel: 'Tuto výzvu publikoval',
      respondersLabel: 'Kdo bude pravděpodobně reagovat',
      teamTrustLabel: 'Jak tento tým vede dialog',
      trustDialogues: 'Tým vedl za posledních 90 dní {{count}} dialogů.',
      trustResponse: 'Obvykle reaguje do {{hours}} hodin.',
      trustResponseUnderHour: 'Obvykle reaguje do 1 hodiny.',
      humanContextFallbackRole: 'Tým'
    },
    sk: {
      back: 'Späť na zoznam',
      eyebrow: isImported ? 'Importovaná ponuka' : 'Ponuka s vlastnou výzvou',
      body: 'Čo bude treba zvládnuť, na čo si dať pozor, ako odpovedať a čo to znamená pre tvoju realitu.',
      reality: 'Rýchla orientácia',
      decision: 'Na čo odpovedať',
      company: 'Firma a kontext',
      quickInsights: 'Rýchly prehľad',
      challenge: 'Čo bude treba zvládnuť',
      risk: 'Na čo si dať pozor',
      question: 'Prvá otázka',
      fit: 'Zhoda podľa JHI',
      salary: 'Mzda',
      workModel: 'Spôsob práce',
      location: 'Miesto',
      source: 'Zdroj',
      openListing: 'Otvoriť pôvodný inzerát',
      openCompany: 'Otvoriť profil firmy',
      openContext: 'Doplniť vlastný kontext',
      financialTitle: 'Finančná a dochádzková realita',
      financialBody: 'Tu vidíš skutočný dopad ponuky po započítaní čistej mzdy, benefitov a dochádzania.',
      financialFormula: 'Výpočet: čistá mzda {{net}} + benefity {{benefits}} - dochádzanie {{commute}} = {{total}}',
      loginPrompt: 'Prihlás sa a uvidíš dopad mzdy a dochádzania na svoju vlastnú situáciu.',
      addressPrompt: 'Doplň v profile adresu alebo polohu a dopočítame reálne dochádzanie.',
      openProfile: 'Otvoriť profil',
      gross: 'Hrubá mzda',
      net: 'Čistá mzda',
      benefits: 'Hodnota benefitov',
      commute: 'Náklady na dochádzanie',
      commuteDistance: 'Vzdialenosť do práce',
      realValue: 'Skutočná mesačná hodnota',
      jhiImpact: 'Dopad do JHI',
      oneWay: 'Jedna cesta',
      dailyTime: 'Čas za deň',
      marketMedian: 'Medián trhu',
      marketDelta: 'Rozdiel oproti mediánu',
      benefitsList: 'Benefity',
      realIncome: 'Skutočný príjem',
      compatibility: 'Miera zhody',
      originalListing: 'Pôvodný text ponuky',
      originalBody: 'Plný text zostáva dostupný aj tu, aby bolo vždy jasné, z čoho ponuka vychádza.',
      noDescription: 'Plný text ponuky nie je k dispozícii.',
      companySignal: 'Čo o firme a roli vieme',
      importedNote: 'Táto výzva je odvodená z importovanej ponuky, ale stále vychádza z pôvodného inzerátu.',
      importedActionTitle: 'Na túto ponuku odpovieš na pôvodnom webe',
      importedActionBody: 'Otázka vyššie slúži len ako pomôcka pre tvoje rozhodnutie. Ak ti ponuka dáva zmysel, pokračuješ cez pôvodný inzerát, kde má firma vlastné tlačidlo na odpoveď.',
      importedActionCta: 'Otvoriť pôvodný inzerát',
      remoteReality: 'Práca na diaľku sa počíta ako nulové dochádzanie, nie ako chýbajúci údaj.',
      moreCompany: 'Firma a kontext',
      moreOriginal: 'Pôvodný text ponuky',
      firstContactGuideTitle: 'Ako funguje prvý kontakt s firmou',
      firstContactGuideBody: isImported
        ? 'Tu sa najprv zorientuješ v tom, čo firma skutočne rieši. Pri importovanej ponuke ti táto otázka pomôže urobiť lepšie rozhodnutie ešte pred odchodom na pôvodný web.'
        : 'Na JobShamane nezačínaš slepým CV. Firma najprv uvidí krátku odpoveď na konkrétnu situáciu a až potom voliteľný kontext z profilu alebo životopisu.',
      firstContactGuidePointOne: isImported
        ? 'Otázka vyššie sa firme sama neposiela. Slúži ako tvoja príprava pred otvorením pôvodného inzerátu.'
        : 'Prvý signál je tvoja stručná odpoveď: čo by si urobil(a) ako prvý krok a čo by si potreboval(a) overiť.',
      firstContactGuidePointTwo: isImported
        ? 'Ak ti rola dáva zmysel, odpoveď dokončíš na pôvodnom webe firmy alebo job boarde.'
        : 'Profil, CV a dlhší kontext sú až druhá vrstva. Pomáhajú, ale neprebíjajú prvú odpoveď.',
      firstContactGuidePointThree: isImported
        ? 'Doplňujúci kontext si môžeš pripraviť tu, aby si na pôvodný web nešiel bez rozmyslenia.'
        : 'Čím konkrétnejšia odpoveď na skutočný problém, tým vyššia šanca na zmysluplný dialóg namiesto generickej reakcie.',
      firstContactGuideDismiss: 'Rozumiem',
      firstContactGuideContext: 'Doplniť kontext',
      publisherLabel: 'Túto výzvu publikoval',
      respondersLabel: 'Kto bude pravdepodobne reagovať',
      teamTrustLabel: 'Ako tento tím vedie dialóg',
      trustDialogues: 'Tím viedol za posledných 90 dní {{count}} dialógov.',
      trustResponse: 'Zvyčajne reaguje do {{hours}} hodín.',
      trustResponseUnderHour: 'Zvyčajne reaguje do 1 hodiny.',
      humanContextFallbackRole: 'Tím'
    },
    de: {
      back: 'Zurück zur Liste',
      eyebrow: isImported ? 'Importierte Rolle' : 'Rolle mit eigener Aufgabe',
      body: 'Was gelöst werden soll, worauf man achten sollte, wie du antworten kannst und was das für deinen Alltag bedeutet.',
      reality: 'Schnelle Orientierung',
      decision: 'Worauf du antwortest',
      company: 'Firma und Kontext',
      quickInsights: 'Kurzübersicht',
      challenge: 'Was gelöst werden soll',
      risk: 'Worauf man achten sollte',
      question: 'Erste Frage',
      fit: 'JHI-Passung',
      salary: 'Gehalt',
      workModel: 'Arbeitsweise',
      location: 'Ort',
      source: 'Quelle',
      openListing: 'Originalanzeige öffnen',
      openCompany: 'Firmenprofil öffnen',
      openContext: 'Eigenen Kontext ergänzen',
      financialTitle: 'Finanz- und Pendelrealität',
      financialBody: 'Hier siehst du die tatsächliche Auswirkung des Angebots nach Netto, Benefits und Pendeln.',
      financialFormula: 'Berechnung: netto {{net}} + Benefits {{benefits}} - Pendeln {{commute}} = {{total}}',
      loginPrompt: 'Melde dich an, um Gehalt und Pendeln für deine eigene Situation zu sehen.',
      addressPrompt: 'Ergänze im Profil deine Adresse oder Position, dann berechnen wir das reale Pendeln.',
      openProfile: 'Profil öffnen',
      gross: 'Bruttogehalt',
      net: 'Nettogehalt',
      benefits: 'Wert der Benefits',
      commute: 'Pendelkosten',
      commuteDistance: 'Entfernung zur Arbeit',
      realValue: 'Tatsächlicher Monatswert',
      jhiImpact: 'Einfluss auf JHI',
      oneWay: 'Eine Strecke',
      dailyTime: 'Zeit pro Tag',
      marketMedian: 'Marktmedian',
      marketDelta: 'Abweichung vom Median',
      benefitsList: 'Benefits',
      realIncome: 'Realer Ertrag',
      compatibility: 'Passungswert',
      originalListing: 'Originaltext der Anzeige',
      originalBody: 'Der vollständige Anzeigentext bleibt sichtbar, damit immer klar ist, worauf die Rolle basiert.',
      noDescription: 'Der vollständige Anzeigentext ist nicht verfügbar.',
      companySignal: 'Was wir über Firma und Rolle wissen',
      importedNote: 'Diese Aufgabe wurde aus einer importierten Rolle abgeleitet, basiert aber weiterhin auf der Originalanzeige.',
      importedActionTitle: 'Auf diese Rolle antwortest du auf der Originalseite',
      importedActionBody: 'Die Frage oben dient nur als Denkstütze für deine Entscheidung. Wenn die Rolle für dich passt, gehst du über die Originalanzeige weiter, wo das Unternehmen seinen eigenen Bewerbungsweg hat.',
      importedActionCta: 'Originalanzeige öffnen',
      remoteReality: 'Remote-Arbeit wird als null Pendelaufwand behandelt, nicht als fehlende Angabe.',
      moreCompany: 'Firma und Kontext',
      moreOriginal: 'Originaltext der Anzeige',
      firstContactGuideTitle: 'So funktioniert der erste Kontakt mit dem Unternehmen',
      firstContactGuideBody: isImported
        ? 'Hier orientierst du dich zuerst daran, was das Unternehmen tatsächlich lösen will. Bei importierten Rollen hilft dir diese Frage, besser zu entscheiden, bevor du zur Originalseite wechselst.'
        : 'Bei JobShaman startest du nicht mit einem blinden CV. Das Unternehmen sieht zuerst eine kurze Antwort auf eine konkrete Situation und erst danach optionalen Kontext aus Profil oder Lebenslauf.',
      firstContactGuidePointOne: isImported
        ? 'Die Frage oben wird nicht automatisch an das Unternehmen gesendet. Sie ist deine Vorbereitung vor dem Wechsel zur Originalanzeige.'
        : 'Das erste Signal ist deine kurze Antwort: Was wäre dein erster Schritt und was müsstest du zuerst prüfen?',
      firstContactGuidePointTwo: isImported
        ? 'Wenn die Rolle für dich passt, machst du auf der Originalseite des Unternehmens oder Jobboards weiter.'
        : 'Profil, CV und zusätzlicher Kontext sind die zweite Ebene. Sie helfen, ersetzen aber nicht deine erste Antwort.',
      firstContactGuidePointThree: isImported
        ? 'Zusätzlichen Kontext kannst du hier vorbereiten, damit du nicht unvorbereitet auf die Originalseite gehst.'
        : 'Je konkreter deine Antwort auf das echte Problem ist, desto höher die Chance auf einen sinnvollen Dialog statt einer generischen Reaktion.',
      firstContactGuideDismiss: 'Verstanden',
      firstContactGuideContext: 'Kontext ergänzen',
      publisherLabel: 'Diese Aufgabe wurde veröffentlicht von',
      respondersLabel: 'Wer voraussichtlich antwortet',
      teamTrustLabel: 'Wie dieses Team Dialoge führt',
      trustDialogues: 'Das Team hat in den letzten 90 Tagen {{count}} Dialoge geführt.',
      trustResponse: 'Antwortet normalerweise innerhalb von {{hours}} Stunden.',
      trustResponseUnderHour: 'Antwortet normalerweise innerhalb von 1 Stunde.',
      humanContextFallbackRole: 'Team'
    },
    at: {} as any,
    pl: {
      back: 'Powrót do listy',
      eyebrow: isImported ? 'Importowana oferta' : 'Oferta z własnym wyzwaniem',
      body: 'Co trzeba ogarnąć, na co uważać, jak możesz odpowiedzieć i co to oznacza w twojej codzienności.',
      reality: 'Szybki przegląd',
      decision: 'Na co odpowiadasz',
      company: 'Firma i kontekst',
      quickInsights: 'Szybki podgląd',
      challenge: 'Co trzeba ogarnąć',
      risk: 'Na co uważać',
      question: 'Pierwsze pytanie',
      fit: 'Dopasowanie JHI',
      salary: 'Wynagrodzenie',
      workModel: 'Sposób pracy',
      location: 'Miejsce',
      source: 'Źródło',
      openListing: 'Otwórz oryginalne ogłoszenie',
      openCompany: 'Otwórz profil firmy',
      openContext: 'Dodaj własny kontekst',
      financialTitle: 'Finanse i realny dojazd',
      financialBody: 'Tutaj widzisz rzeczywisty wpływ oferty po uwzględnieniu wynagrodzenia netto, benefitów i dojazdu.',
      financialFormula: 'Wyliczenie: netto {{net}} + benefity {{benefits}} - dojazd {{commute}} = {{total}}',
      loginPrompt: 'Zaloguj się, aby zobaczyć wpływ pensji i dojazdu na swoją sytuację.',
      addressPrompt: 'Uzupełnij adres lub lokalizację w profilu, a policzymy realny dojazd.',
      openProfile: 'Otwórz profil',
      gross: 'Wynagrodzenie brutto',
      net: 'Wynagrodzenie netto',
      benefits: 'Wartość benefitów',
      commute: 'Koszt dojazdu',
      commuteDistance: 'Odległość do pracy',
      realValue: 'Rzeczywista wartość miesięczna',
      jhiImpact: 'Wpływ na JHI',
      oneWay: 'W jedną stronę',
      dailyTime: 'Czas dziennie',
      marketMedian: 'Mediana rynku',
      marketDelta: 'Różnica względem mediany',
      benefitsList: 'Benefity',
      realIncome: 'Rzeczywisty dochód',
      compatibility: 'Poziom dopasowania',
      originalListing: 'Oryginalna treść oferty',
      originalBody: 'Pełna treść ogłoszenia pozostaje widoczna także tutaj, żeby zawsze było jasne, na czym opiera się oferta.',
      noDescription: 'Pełna treść oferty nie jest dostępna.',
      companySignal: 'Co wiemy o firmie i roli',
      importedNote: 'To wyzwanie zostało wyprowadzone z importowanej oferty, ale nadal opiera się na oryginalnym ogłoszeniu.',
      importedActionTitle: 'Na tę ofertę odpowiadasz na oryginalnej stronie',
      importedActionBody: 'Pytanie wyżej to tylko pomoc w podjęciu decyzji. Jeśli oferta ma sens, przechodzisz do oryginalnego ogłoszenia, gdzie firma ma własny sposób zgłoszenia.',
      importedActionCta: 'Otwórz oryginalne ogłoszenie',
      remoteReality: 'Praca zdalna liczy się jako zerowy dojazd, a nie brak danych.',
      moreCompany: 'Firma i kontekst',
      moreOriginal: 'Oryginalna treść oferty',
      firstContactGuideTitle: 'Jak działa pierwszy kontakt z firmą',
      firstContactGuideBody: isImported
        ? 'Tutaj najpierw orientujesz się, co firma naprawdę chce rozwiązać. Przy importowanej ofercie to pytanie pomaga podjąć lepszą decyzję, zanim przejdziesz na oryginalną stronę.'
        : 'W JobShaman nie zaczynasz od ślepego CV. Firma najpierw widzi krótką odpowiedź na konkretną sytuację, a dopiero potem opcjonalny kontekst z profilu lub CV.',
      firstContactGuidePointOne: isImported
        ? 'Pytanie wyżej nie wysyła się automatycznie do firmy. To twoje przygotowanie przed otwarciem oryginalnego ogłoszenia.'
        : 'Pierwszym sygnałem jest twoja krótka odpowiedź: jaki byłby pierwszy krok i co chcesz najpierw sprawdzić.',
      firstContactGuidePointTwo: isImported
        ? 'Jeśli rola ma sens, kończysz odpowiedź na oryginalnej stronie firmy albo job boardu.'
        : 'Profil, CV i szerszy kontekst to druga warstwa. Pomagają, ale nie zastępują pierwszej odpowiedzi.',
      firstContactGuidePointThree: isImported
        ? 'Dodatkowy kontekst możesz przygotować tutaj, żeby nie iść na oryginalną stronę bez przemyślenia.'
        : 'Im bardziej konkretna odpowiedź na realny problem, tym większa szansa na sensowny dialog zamiast generycznej reakcji.',
      firstContactGuideDismiss: 'Rozumiem',
      firstContactGuideContext: 'Dodaj kontekst',
      publisherLabel: 'To wyzwanie opublikował(a)',
      respondersLabel: 'Kto prawdopodobnie odpowie',
      teamTrustLabel: 'Jak ten zespół prowadzi dialog',
      trustDialogues: 'Zespół prowadził w ostatnich 90 dniach {{count}} dialogów.',
      trustResponse: 'Zwykle odpowiada w ciągu {{hours}} godzin.',
      trustResponseUnderHour: 'Zwykle odpowiada w ciągu 1 godziny.',
      humanContextFallbackRole: 'Zespół'
    },
    en: {
      back: 'Back to list',
      eyebrow: isImported ? 'Imported role' : 'Role with native challenge',
      body: 'What needs to be solved, what to watch out for, how you can respond, and what it means for your reality.',
      reality: 'Quick actions',
      decision: 'What to respond to',
      company: 'Company and context',
      quickInsights: 'Quick insights',
      challenge: 'What needs to be solved',
      risk: 'What to watch out for',
      question: 'First question',
      fit: 'JHI fit',
      salary: 'Salary',
      workModel: 'Work model',
      location: 'Location',
      source: 'Source',
      openListing: 'Open original listing',
      openCompany: 'Open company profile',
      openContext: 'Add your context',
      financialTitle: 'Financial and commute reality',
      financialBody: 'This shows the real impact of the role after net salary, benefits, and commute are taken into account.',
      financialFormula: 'Calculation: net pay {{net}} + benefits {{benefits}} - commute {{commute}} = {{total}}',
      loginPrompt: 'Sign in to see salary and commute impact for your own situation.',
      addressPrompt: 'Add your address or location in profile and we will calculate real commute impact.',
      openProfile: 'Open profile',
      gross: 'Gross salary',
      net: 'Net salary',
      benefits: 'Benefit value',
      commute: 'Commute cost',
      commuteDistance: 'Distance to work',
      realValue: 'Real monthly value',
      jhiImpact: 'JHI impact',
      oneWay: 'One way',
      dailyTime: 'Daily time',
      marketMedian: 'Market median',
      marketDelta: 'Difference vs median',
      benefitsList: 'Benefits',
      realIncome: 'Real income',
      compatibility: 'Compatibility',
      originalListing: 'Original listing',
      originalBody: 'The full source listing stays visible here so it is always clear what the role is based on.',
      noDescription: 'The full source listing is not available.',
      companySignal: 'What we know about the company and role',
      importedNote: 'This challenge is derived from an imported role, but still anchored in the original listing.',
      importedActionTitle: 'You respond to this role on the original website',
      importedActionBody: 'The question above is only a thinking aid for your decision. If the role makes sense, you continue through the original listing, where the company keeps its own application flow.',
      importedActionCta: 'Open original listing',
      remoteReality: 'Remote work counts as zero commute, not as missing data.',
      moreCompany: 'Company and context',
      moreOriginal: 'Original listing',
      firstContactGuideTitle: 'How first contact with the company works',
      firstContactGuideBody: isImported
        ? 'This is where you first understand what the company is actually trying to solve. For imported roles, the question helps you decide better before you leave for the original site.'
        : 'On JobShaman, you do not start with a blind CV. The company first sees a short response to a concrete situation, then optional context from your profile or resume.',
      firstContactGuidePointOne: isImported
        ? 'The question above is not sent to the company automatically. It prepares you before you open the original listing.'
        : 'Your first signal is a short response: what your first step would be and what you would need to verify first.',
      firstContactGuidePointTwo: isImported
        ? 'If the role makes sense, you finish the response on the company or job board website.'
        : 'Profile, CV, and richer context are the second layer. They help, but they should not override the first response.',
      firstContactGuidePointThree: isImported
        ? 'You can prepare additional context here so you do not go to the original site cold.'
        : 'The more concrete your answer to the real problem, the higher the chance of a meaningful dialogue instead of a generic reaction.',
      firstContactGuideDismiss: 'Understood',
      firstContactGuideContext: 'Add context',
      publisherLabel: 'This challenge was published by',
      respondersLabel: 'Who will likely reply',
      teamTrustLabel: 'How this team runs dialogue',
      trustDialogues: 'The team ran {{count}} dialogues in the last 90 days.',
      trustResponse: 'Usually replies within {{hours}} hours.',
      trustResponseUnderHour: 'Usually replies within 1 hour.',
      humanContextFallbackRole: 'Team'
    }
  } as const)[localizedLanguage];
  const microJobCopy = ({
    cs: {
      badge: 'MINI VYZVA',
      budget: 'Rozpočet',
      type: 'Typ mini výzvy',
      timeEstimate: 'Odhad času',
      collaboration: 'Typ spolupráce',
      longTermPotential: 'Další spolupráce',
      financialNoteTitle: 'Rychlá spolupráce místo měsíční mzdy',
      financialNoteBody: 'U mini výzvy ukazujeme rozpočet, časový odhad a způsob spolupráce. Měsíční salary benchmark a čistý příjem zde nedávají smysl.'
    },
    sk: {
      badge: 'MINI VYZVA',
      budget: 'Rozpočet',
      type: 'Typ mini výzvy',
      timeEstimate: 'Odhad času',
      collaboration: 'Typ spolupráce',
      longTermPotential: 'Ďalšia spolupráca',
      financialNoteTitle: 'Rýchla spolupráca namiesto mesačnej mzdy',
      financialNoteBody: 'Pri mini výzve ukazujeme rozpočet, odhad času a spôsob spolupráce. Mesačný salary benchmark a čistý príjem tu nedávajú zmysel.'
    },
    de: {
      badge: 'MINI-AUFGABE',
      budget: 'Budget',
      type: 'Typ',
      timeEstimate: 'Zeitaufwand',
      collaboration: 'Zusammenarbeit',
      longTermPotential: 'Weitere Zusammenarbeit',
      financialNoteTitle: 'Schnelle Zusammenarbeit statt Monatsgehalt',
      financialNoteBody: 'Bei einer Mini-Aufgabe zeigen wir Budget, Zeitaufwand und die Form der Zusammenarbeit. Monatliche Gehaltsbenchmarks und Nettoeinkommen sind hier nicht sinnvoll.'
    },
    pl: {
      badge: 'MINI WYZWANIE',
      budget: 'Budżet',
      type: 'Typ',
      timeEstimate: 'Szacowany czas',
      collaboration: 'Typ współpracy',
      longTermPotential: 'Dalsza współpraca',
      financialNoteTitle: 'Szybka współpraca zamiast miesięcznej pensji',
      financialNoteBody: 'Przy mini wyzwaniu pokazujemy budżet, czas i sposób współpracy. Miesięczny benchmark wynagrodzenia i dochód netto nie mają tu sensu.'
    },
    en: {
      badge: 'MINI CHALLENGE',
      budget: 'Budget',
      type: 'Type',
      timeEstimate: 'Time estimate',
      collaboration: 'Collaboration',
      longTermPotential: 'Long-term potential',
      financialNoteTitle: 'Quick collaboration instead of monthly salary',
      financialNoteBody: 'For a mini challenge, we show budget, time estimate, and collaboration mode. Monthly salary benchmarks and net income do not make sense here.'
    }
  } as const)[localizedLanguage];

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (firstQualityActionAt) {
      setShowFirstContactGuide(false);
      return;
    }
    const dismissed = window.localStorage.getItem(firstContactGuideStorageKey) === 'true';
    setShowFirstContactGuide(!dismissed);
  }, [firstQualityActionAt]);

  const dismissFirstContactGuide = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(firstContactGuideStorageKey, 'true');
    }
    setShowFirstContactGuide(false);
  };

  useEffect(() => {
    if (!userProfile.isLoggedIn || ((!userProfile.address && !userProfile.coordinates) && !remoteRole)) {
      setCommuteAnalysis(null);
      return;
    }
    try {
      const commuteProfile = userProfile.address
        ? userProfile
        : {
            ...userProfile,
            address: isCsLike ? 'Aktuální poloha' : 'Current location'
          };
      setCommuteAnalysis(calculateCommuteReality(job, commuteProfile));
    } catch (error) {
      console.warn('Failed to calculate commute reality:', error);
      setCommuteAnalysis(null);
    }
  }, [isCsLike, job, remoteRole, userProfile]);

  useEffect(() => {
    let cancelled = false;

    const loadBenchmark = async () => {
      if (!FEATURE_SALARY_BENCHMARKS || isMicroJobRole) {
        setSalaryBenchmark(null);
        return;
      }
      try {
        const benchmark = await fetchSalaryBenchmark(job.id);
        if (!cancelled) setSalaryBenchmark(benchmark);
      } catch (error) {
        console.warn('Salary benchmark fetch failed:', error);
        if (!cancelled) setSalaryBenchmark(null);
      }
    };

    void loadBenchmark();
    return () => {
      cancelled = true;
    };
  }, [isMicroJobRole, job.id]);

  useEffect(() => {
    let cancelled = false;

    const loadHumanContext = async () => {
      if (!isNativeChallenge) {
        setHumanContext(null);
        return;
      }
      try {
        const payload = await fetchJobHumanContext(job.id);
        if (!cancelled) {
          setHumanContext(payload);
        }
      } catch (error) {
        console.warn('Human context fetch failed:', error);
        if (!cancelled) setHumanContext(null);
      }
    };

    void loadHumanContext();
    return () => {
      cancelled = true;
    };
  }, [isNativeChallenge, job.id]);

  const formattedDescription = useMemo(() => formatJobDescription(job.description || ''), [job.description]);

  const whyNowBody = useMemo(
    () => shorten(job.challenge || job.aiAnalysis?.summary || job.description, 260),
    [job.aiAnalysis?.summary, job.challenge, job.description]
  );
  const riskBody = useMemo(
    () => shorten(job.risk || job.aiAnalysis?.culturalFit || job.noiseMetrics?.keywords?.join(', '), 220),
    [job.aiAnalysis?.culturalFit, job.noiseMetrics?.keywords, job.risk]
  );
  const responsePrompt = job.firstStepPrompt || shorten(job.description, 180);
  const companySignal = shorten(job.companyPageSummary || job.aiAnalysis?.summary || job.description, 220);
  const displayedSalary = formatSalary(job, i18n.language, isCsLike);
  const locationValue = shorten(job.location, 72) || (isCsLike ? 'Místo neuvedeno' : 'Location not specified');
  const companyValue = shorten(job.company, 72) || (isCsLike ? 'Firma neuvedena' : 'Company not specified');
  const microJobKindValue = getMicroJobKindLabel(job.micro_job_kind, language);
  const microJobCollaborationValue = getMicroJobCollaborationLabel(job.micro_job_collaboration_modes, language);
  const microJobLongTermPotentialValue = getMicroJobLongTermPotentialLabel(job.micro_job_long_term_potential, language);
  const benefitChips = useMemo(() => normalizeBenefitChips(job.benefits), [job.benefits]);
  const realIncomeValue = commuteAnalysis
    ? `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`
    : displayedSalary;
  const commuteValue = remoteRole
    ? '0 km'
    : commuteAnalysis
      ? `${commuteAnalysis.distanceKm} km`
      : userProfile.isLoggedIn
        ? (isCsLike ? 'Doplň adresu' : 'Add address')
        : (isCsLike ? 'Po přihlášení' : 'After sign in');
  const quickInsights = isMicroJobRole
    ? [
        { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
        { label: microJobCopy.budget, value: displayedSalary },
        ...(job.micro_job_time_estimate ? [{ label: microJobCopy.timeEstimate, value: job.micro_job_time_estimate }] : []),
        ...(microJobCollaborationValue ? [{ label: microJobCopy.collaboration, value: microJobCollaborationValue }] : []),
        ...(microJobLongTermPotentialValue ? [{ label: microJobCopy.longTermPotential, value: microJobLongTermPotentialValue }] : []),
        ...(microJobKindValue ? [{ label: microJobCopy.type, value: microJobKindValue }] : []),
        { label: copy.location, value: locationValue },
        { label: copy.workModel, value: job.work_model || job.type || '—' },
        { label: copy.source, value: job.source || '—' }
      ]
    : [
        { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
        { label: copy.location, value: locationValue },
        { label: copy.realIncome, value: realIncomeValue },
        { label: copy.commuteDistance, value: commuteValue },
        { label: copy.workModel, value: job.work_model || job.type || '—' },
        { label: copy.source, value: job.source || '—' }
      ];
  const mobilePrimaryInsights = isMicroJobRole
    ? [
        { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
        { label: microJobCopy.budget, value: displayedSalary },
        { label: copy.workModel, value: job.work_model || job.type || '—' },
        { label: copy.location, value: locationValue }
      ]
    : [
        { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
        { label: copy.salary, value: displayedSalary },
        { label: copy.workModel, value: job.work_model || job.type || '—' },
        { label: copy.location, value: locationValue }
      ];
  const mobileSecondaryInsights = isMicroJobRole
    ? [
        ...(job.micro_job_time_estimate ? [{ label: microJobCopy.timeEstimate, value: job.micro_job_time_estimate }] : []),
        ...(microJobCollaborationValue ? [{ label: microJobCopy.collaboration, value: microJobCollaborationValue }] : []),
        ...(microJobLongTermPotentialValue ? [{ label: microJobCopy.longTermPotential, value: microJobLongTermPotentialValue }] : []),
        ...(microJobKindValue ? [{ label: microJobCopy.type, value: microJobKindValue }] : []),
        { label: copy.company, value: companyValue },
        { label: copy.source, value: job.source || '—' }
      ]
    : [
        { label: copy.realIncome, value: realIncomeValue },
        { label: copy.commuteDistance, value: commuteValue },
        { label: copy.company, value: companyValue },
        { label: copy.source, value: job.source || '—' }
      ];
  const trustDialoguesCount = humanContext?.trust?.dialogues_last_90d ?? null;
  const trustResponseHours = humanContext?.trust?.median_first_response_hours_last_90d ?? null;
  const hasHumanContextContent = Boolean(
    humanContext?.publisher ||
    (humanContext?.responders?.length || 0) > 0 ||
    (typeof trustDialoguesCount === 'number' && trustDialoguesCount > 0) ||
    trustResponseHours != null
  );

  const formatTrustResponseLabel = () => {
    if (trustResponseHours == null) return null;
    if (trustResponseHours < 1) return copy.trustResponseUnderHour;
    const normalizedHours = Number.isInteger(trustResponseHours)
      ? String(Math.round(trustResponseHours))
      : trustResponseHours.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
    return copy.trustResponse.replace('{{hours}}', normalizedHours);
  };

  const renderHumanContextSection = () => {
    if (!hasHumanContextContent) return null;
    const trustLabels = [
      typeof trustDialoguesCount === 'number' && trustDialoguesCount > 0
        ? copy.trustDialogues.replace('{{count}}', trustDialoguesCount.toLocaleString(i18n.language))
        : null,
      formatTrustResponseLabel()
    ].filter(Boolean) as string[];

    return (
      <div className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
        {humanContext?.publisher ? (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.publisherLabel}</div>
            <HumanContextPersonCard person={humanContext.publisher} fallbackRole={copy.humanContextFallbackRole} />
          </div>
        ) : null}

        {humanContext?.responders?.length ? (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.respondersLabel}</div>
            <div className="grid gap-3 md:grid-cols-2">
              {humanContext.responders.map((person, index) => (
                <HumanContextPersonCard
                  key={`${person.user_id || person.id || 'responder'}-${index}`}
                  person={person}
                  fallbackRole={copy.humanContextFallbackRole}
                />
              ))}
            </div>
          </div>
        ) : null}

        {trustLabels.length > 0 ? (
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.teamTrustLabel}</div>
            <div className="flex flex-wrap gap-2">
              {trustLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.12)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)]"
                >
                  <Users size={13} className="text-[var(--accent)]" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderFinancialSection = () => {
    if (isMicroJobRole) {
      return (
        <SurfaceCard className="space-y-4">
          <div className="app-eyebrow w-fit">
            <Wallet size={12} />
            {microJobCopy.financialNoteTitle}
          </div>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{microJobCopy.financialNoteBody}</p>
        </SurfaceCard>
      );
    }

    if (!userProfile.isLoggedIn) {
      return (
        <SurfaceCard className="space-y-4">
          <div className="app-eyebrow w-fit">
            <Wallet size={12} />
            {copy.financialTitle}
          </div>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.loginPrompt}</p>
          <button type="button" onClick={onRequireAuth} className="app-button-primary">
            {isCsLike ? 'Přihlásit / vytvořit účet' : 'Sign in / create account'}
          </button>
        </SurfaceCard>
      );
    }

    if (!userProfile.address && !userProfile.coordinates && !remoteRole) {
      return (
        <SurfaceCard className="space-y-4">
          <div className="app-eyebrow w-fit">
            <Route size={12} />
            {copy.financialTitle}
          </div>
          <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.addressPrompt}</p>
          <button type="button" onClick={onOpenProfile} className="app-button-secondary">
            {copy.openProfile}
          </button>
        </SurfaceCard>
      );
    }

    if (!commuteAnalysis) return null;

    return (
      <SurfaceCard className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="app-eyebrow w-fit">
              <Wallet size={12} />
              {copy.financialTitle}
            </div>
            <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{copy.financialBody}</p>
            {remoteRole ? (
              <p className="text-sm leading-6 text-[var(--accent)]">{copy.remoteReality}</p>
            ) : null}
          </div>
          <MetricTile
            label={copy.jhiImpact}
            value={`${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}`}
            tone={commuteAnalysis.jhiImpact >= 0 ? 'success' : 'warning'}
            className="min-w-[150px]"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <MetricTile
            label={copy.gross}
            value={`${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
          />
          <MetricTile
            label={copy.net}
            value={`${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
          />
          <MetricTile
            label={copy.benefits}
            value={`${commuteAnalysis.financialReality.benefitsValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
          />
          <MetricTile
            label={copy.commute}
            value={`${commuteAnalysis.financialReality.commuteCost.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
          />
          <MetricTile label={copy.oneWay} value={remoteRole ? '0 km' : `${commuteAnalysis.distanceKm} km`} />
          <MetricTile
            label={copy.realValue}
            value={`${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
            tone="accent"
          />
        </div>

        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
          {copy.financialFormula
            .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
            .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
            .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
            .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)}
        </div>

        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Clock3 size={15} className="text-[var(--text-faint)]" />
          {copy.dailyTime}: {commuteAnalysis.timeMinutes * 2} min
        </div>

        {salaryBenchmark && !salaryBenchmark.insufficient_data ? (
          <div className="grid gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 sm:grid-cols-2">
            <MetricTile
              label={copy.marketMedian}
              value={`${(salaryBenchmark.p50 || 0).toLocaleString(i18n.language)} ${salaryBenchmark.currency || commuteAnalysis.financialReality.currency}`}
            />
            <MetricTile
              label={copy.marketDelta}
              value={`${(salaryBenchmark.delta_vs_p50 || 0) > 0 ? '+' : ''}${(salaryBenchmark.delta_vs_p50 || 0).toLocaleString(i18n.language)} ${salaryBenchmark.currency || commuteAnalysis.financialReality.currency}`}
              tone={(salaryBenchmark.delta_vs_p50 || 0) >= 0 ? 'success' : 'warning'}
            />
          </div>
        ) : null}
      </SurfaceCard>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-5 pb-8">
      <button type="button" onClick={onBack} className="app-button-secondary !px-3.5 !py-2.5">
        <ArrowLeft size={16} />
        {copy.back}
      </button>

      <PageHeader
        eyebrow={isMicroJobRole ? `${microJobCopy.badge} • ${copy.eyebrow}` : copy.eyebrow}
        title={job.title}
        body={copy.body}
        actions={
          <div className="hidden md:contents">
            <MetricTile label={copy.fit} value={`${Math.round(job.jhi?.score || 0)}/100`} tone="accent" className="min-w-[150px]" />
            <MetricTile label={copy.company} value={companyValue} className="min-w-[200px]" />
            <MetricTile label={copy.location} value={locationValue} className="min-w-[170px]" />
            <MetricTile label={isMicroJobRole ? microJobCopy.budget : copy.salary} value={displayedSalary} className="min-w-[150px]" />
            <MetricTile
              label={isMicroJobRole ? microJobCopy.timeEstimate : copy.workModel}
              value={isMicroJobRole ? (job.micro_job_time_estimate || '—') : (job.work_model || job.type || '—')}
              className="min-w-[150px]"
            />
          </div>
        }
      />

      <div className="grid gap-4 xl:hidden">
        <SurfaceCard className="space-y-4">
          <SectionTitle title={copy.quickInsights} />
          <div className="grid gap-3 sm:grid-cols-2">
            {mobilePrimaryInsights.map((item, index) => (
              <MetricTile key={`${item.label}-${index}`} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </div>
          <div className="grid gap-3">
            {mobileSecondaryInsights.map((item, index) => (
              <MetricTile key={`${item.label}-secondary-${index}`} label={item.label} value={item.value} />
            ))}
          </div>
        </SurfaceCard>

        <SurfaceCard className="space-y-3">
          <SectionTitle title={copy.reality} />
          <div className="grid gap-3">
            {job.company_id ? (
              <button type="button" onClick={() => onOpenCompanyPage(job.company_id!)} className="app-button-secondary justify-between">
                <span className="inline-flex items-center gap-2">
                  <Building2 size={16} />
                  {copy.openCompany}
                </span>
                <ArrowUpRight size={15} />
              </button>
            ) : null}
            <button type="button" onClick={onOpenSupportingContext} className="app-button-secondary justify-between">
              <span className="inline-flex items-center gap-2">
                <Compass size={16} />
                {copy.openContext}
              </span>
              <ArrowUpRight size={15} />
            </button>
            {job.url ? (
              <button type="button" onClick={onOpenImportedListing} className="app-button-primary justify-between">
                <span className="inline-flex items-center gap-2">
                  <Sparkles size={16} />
                  {copy.openListing}
                </span>
                <ArrowUpRight size={15} />
              </button>
            ) : null}
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_360px]">
        <div className="space-y-5">
          <SurfaceCard className="space-y-5">
            <SectionTitle title={copy.decision} />
            <div className="space-y-5">
              <div className="space-y-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.challenge}</div>
                <h2 className="max-w-4xl text-3xl font-semibold leading-tight tracking-[-0.05em] text-[var(--text-strong)] md:text-[2.6rem]">
                  {whyNowBody || '—'}
                </h2>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <NarrativeCard title={copy.risk} body={riskBody} />
                <NarrativeCard title={copy.question} body={responsePrompt} tone="accent" />
              </div>

              {showFirstContactGuide ? (
                <SurfaceCard className="space-y-4 border-[var(--accent-soft)] bg-[linear-gradient(135deg,rgba(245,158,11,0.08),rgba(255,255,255,0.92))] dark:bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(17,24,39,0.92))]">
                  <div className="space-y-2">
                    <div className="app-eyebrow w-fit">
                      <Sparkles size={12} />
                      {copy.firstContactGuideTitle}
                    </div>
                    <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">{copy.firstContactGuideBody}</p>
                  </div>
                  <div className="grid gap-2.5 text-sm leading-6 text-[var(--text)]">
                    {[copy.firstContactGuidePointOne, copy.firstContactGuidePointTwo, copy.firstContactGuidePointThree].map((point) => (
                      <div key={point} className="flex items-start gap-2.5">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {!isImported ? (
                      <button type="button" onClick={onOpenSupportingContext} className="app-button-secondary">
                        {copy.firstContactGuideContext}
                      </button>
                    ) : null}
                    <button type="button" onClick={dismissFirstContactGuide} className="app-button-secondary">
                      {copy.firstContactGuideDismiss}
                    </button>
                  </div>
                </SurfaceCard>
              ) : null}

              {isImported ? (
                <div className="rounded-[var(--radius-lg)] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  {copy.importedNote}
                </div>
              ) : null}

              {isImported ? (
                <SurfaceCard className="space-y-4 border-amber-200 bg-amber-50/70 dark:border-amber-500/20 dark:bg-amber-500/10">
                  <div className="text-lg font-semibold text-[var(--text-strong)]">{copy.importedActionTitle}</div>
                  <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.importedActionBody}</p>
                  {job.url ? (
                    <button type="button" onClick={onOpenImportedListing} className="app-button-primary">
                      <ArrowUpRight size={16} />
                      {copy.importedActionCta}
                    </button>
                  ) : null}
                </SurfaceCard>
              ) : (
                <ChallengeComposer
                  job={job}
                  userProfile={userProfile}
                  onRequireAuth={onRequireAuth}
                  onOpenSupportingContext={onOpenSupportingContext}
                />
              )}
            </div>
          </SurfaceCard>

          {renderFinancialSection()}

          <SurfaceCard className="hidden space-y-5 md:block">
            <SectionTitle title={copy.company} />
            <div className="space-y-4">
              <NarrativeCard title={copy.companySignal} body={companySignal} />
              {renderHumanContextSection()}
              {!isMicroJobRole ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.benefitsList}</div>
                  <div className="flex flex-wrap items-start gap-2">
                  {benefitChips.length > 0 ? (
                    benefitChips.map((benefit) => (
                      <span
                        key={benefit}
                        title={benefit}
                        className="max-w-full rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
                      >
                        <span className="block max-w-[280px] truncate">{benefit}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-[var(--text-faint)]">—</span>
                  )}
                  </div>
                </div>
              ) : null}
            </div>
          </SurfaceCard>

          <details className="group rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text-strong)]">
              <span>{copy.moreCompany}</span>
              <span className="text-[var(--text-faint)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4 space-y-4">
              <NarrativeCard title={copy.companySignal} body={companySignal} />
              {renderHumanContextSection()}
              {!isMicroJobRole ? (
                <div className="space-y-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.benefitsList}</div>
                  <div className="flex flex-wrap items-start gap-2">
                    {benefitChips.length > 0 ? (
                      benefitChips.map((benefit) => (
                        <span
                          key={`mobile-${benefit}`}
                          title={benefit}
                          className="max-w-full rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
                        >
                          <span className="block max-w-[280px] truncate">{benefit}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[var(--text-faint)]">—</span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </details>

          <SurfaceCard className="hidden space-y-5 md:block">
            <SectionTitle title={copy.originalListing} />
            <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.originalBody}</p>
            <div className="prose prose-slate max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] dark:prose-headings:text-[var(--text-strong)] dark:prose-strong:text-[var(--text-strong)]">
              {formattedDescription ? (
                <Markdown>{formattedDescription}</Markdown>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">{copy.noDescription}</p>
              )}
            </div>
          </SurfaceCard>

          <details className="group rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text-strong)]">
              <span>{copy.moreOriginal}</span>
              <span className="text-[var(--text-faint)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4 space-y-4">
              <p className="text-sm leading-7 text-[var(--text-muted)]">{copy.originalBody}</p>
              <div className="prose prose-slate max-w-none prose-headings:tracking-[-0.03em] prose-headings:text-[var(--text-strong)] prose-p:text-[var(--text)] prose-li:text-[var(--text)] prose-strong:text-[var(--text-strong)] dark:prose-headings:text-[var(--text-strong)] dark:prose-strong:text-[var(--text-strong)]">
                {formattedDescription ? (
                  <Markdown>{formattedDescription}</Markdown>
                ) : (
                  <p className="text-sm text-[var(--text-muted)]">{copy.noDescription}</p>
                )}
              </div>
            </div>
          </details>
        </div>

        <div className="hidden min-w-0 space-y-5 xl:block xl:sticky xl:top-[var(--app-sticky-stack-offset)] xl:self-start">
          <SurfaceCard className="space-y-4">
            <SectionTitle title={copy.quickInsights} />
            <div className="grid gap-3">
              {quickInsights.map((item, index) => (
                <MetricTile key={`${item.label}-${index}`} label={item.label} value={item.value} tone={item.tone} />
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="space-y-4">
            <SectionTitle title={copy.reality} />
            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => {
                  if (job.company_id) onOpenCompanyPage(job.company_id);
                }}
                disabled={!job.company_id}
                className={cn('app-button-secondary justify-between', !job.company_id && 'cursor-not-allowed opacity-50')}
              >
                <span className="inline-flex items-center gap-2">
                  <Building2 size={16} />
                  {copy.openCompany}
                </span>
                <ArrowUpRight size={15} />
              </button>
              <button type="button" onClick={onOpenSupportingContext} className="app-button-secondary justify-between">
                <span className="inline-flex items-center gap-2">
                  <Compass size={16} />
                  {copy.openContext}
                </span>
                <ArrowUpRight size={15} />
              </button>
              {job.url ? (
                <button type="button" onClick={onOpenImportedListing} className="app-button-primary justify-between">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles size={16} />
                    {copy.openListing}
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ) : null}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
};

const SectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-3">
    <div className="h-px flex-1 bg-[var(--border-subtle)]" />
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{title}</div>
    <div className="h-px flex-1 bg-[var(--border-subtle)]" />
  </div>
);

const NarrativeCard: React.FC<{ title: string; body: string; tone?: 'default' | 'accent' }> = ({
  title,
  body,
  tone = 'default'
}) => (
  <div
    className={cn(
      'rounded-[var(--radius-lg)] border px-5 py-4',
      tone === 'accent'
        ? 'border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)]'
        : 'border-[var(--border-subtle)] bg-[var(--surface-muted)]'
    )}
  >
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{title}</div>
    <p className="mt-3 text-sm leading-7 text-[var(--text)]">{body || '—'}</p>
  </div>
);

const HumanContextPersonCard: React.FC<{
  person: JobPublicPerson;
  fallbackRole: string;
}> = ({
  person,
  fallbackRole
}) => (
  <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4">
    <div className="flex items-start gap-3">
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt={person.display_name}
          className="h-12 w-12 rounded-2xl object-cover"
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-sm font-semibold text-[var(--accent)]">
          {getInitials(person.display_name)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold text-[var(--text-strong)]">{person.display_name}</div>
        <div className="mt-1 text-xs leading-5 text-[var(--text-faint)]">{person.display_role || fallbackRole}</div>
      </div>
    </div>
    {person.short_context ? (
      <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{person.short_context}</p>
    ) : null}
  </div>
);

export default ChallengeFocusView;
