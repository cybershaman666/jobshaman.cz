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
  Wallet
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FEATURE_SALARY_BENCHMARKS } from '../../constants';
import { fetchSalaryBenchmark } from '../../services/benchmarkService';
import { calculateCommuteReality, isRemoteJob } from '../../services/commuteService';
import { formatJobDescription } from '../../utils/formatters';
import { CommuteAnalysis, Job, SalaryBenchmarkResolved, UserProfile } from '../../types';
import ChallengeComposer from './ChallengeComposer';
import { MetricTile, PageHeader, SurfaceCard, cn } from '../ui/primitives';

interface ChallengeFocusViewProps {
  job: Job;
  userProfile: UserProfile;
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
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = ['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en';
  const isCsLike = language === 'cs' || language === 'sk';
  const isImported = job.listingKind === 'imported';
  const remoteRole = isRemoteJob(job);

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
      moreOriginal: 'Původní text nabídky'
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
      moreOriginal: 'Pôvodný text ponuky'
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
      moreOriginal: 'Originaltext der Anzeige'
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
      moreOriginal: 'Oryginalna treść oferty'
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
      moreOriginal: 'Original listing'
    }
  } as const)[language === 'at' ? 'de' : language];

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
      if (!FEATURE_SALARY_BENCHMARKS) {
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
  }, [job.id]);

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
  const quickInsights = [
    { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
    { label: copy.location, value: locationValue },
    { label: copy.realIncome, value: realIncomeValue },
    { label: copy.commuteDistance, value: commuteValue },
    { label: copy.workModel, value: job.work_model || job.type || '—' },
    { label: copy.source, value: job.source || '—' }
  ];
  const mobilePrimaryInsights = [
    { label: copy.compatibility, value: `${Math.round(job.jhi?.score || 0)}/100`, tone: 'accent' as const },
    { label: copy.salary, value: displayedSalary },
    { label: copy.workModel, value: job.work_model || job.type || '—' },
    { label: copy.location, value: locationValue }
  ];
  const mobileSecondaryInsights = [
    { label: copy.realIncome, value: realIncomeValue },
    { label: copy.commuteDistance, value: commuteValue },
    { label: copy.source, value: job.source || '—' }
  ];

  const renderFinancialSection = () => {
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
        eyebrow={copy.eyebrow}
        title={job.title}
        body={copy.body}
        actions={
          <div className="hidden md:contents">
            <MetricTile label={copy.fit} value={`${Math.round(job.jhi?.score || 0)}/100`} tone="accent" className="min-w-[150px]" />
            <MetricTile label={copy.location} value={locationValue} className="min-w-[170px]" />
            <MetricTile label={copy.salary} value={displayedSalary} className="min-w-[150px]" />
            <MetricTile label={copy.workModel} value={job.work_model || job.type || '—'} className="min-w-[150px]" />
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
            </div>
          </SurfaceCard>

          <details className="group rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] md:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-[var(--text-strong)]">
              <span>{copy.moreCompany}</span>
              <span className="text-[var(--text-faint)] transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="mt-4 space-y-4">
              <NarrativeCard title={copy.companySignal} body={companySignal} />
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

export default ChallengeFocusView;
