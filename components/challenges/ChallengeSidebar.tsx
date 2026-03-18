import React, { useMemo, useState } from 'react';
import { Coins, Compass, Home, Import, RotateCcw, SlidersHorizontal, Sparkles, TrainFront } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../../types';
import { SurfaceCard, cn } from '../ui/primitives';

export type DiscoveryMode = 'all' | 'micro_jobs';

type SidebarSection = {
  title: string;
  items: Array<{
    key: string;
    label: string;
    icon: React.ReactNode;
    active: boolean;
    onClick: (e?: React.MouseEvent) => void;
  }>;
};

interface ChallengeSidebarProps {
  userProfile: UserProfile;
  lane: 'challenges' | 'imports';
  setLane: (lane: 'challenges' | 'imports') => void;
  discoveryMode: DiscoveryMode;
  setDiscoveryMode: (mode: DiscoveryMode) => void;
  filterMinSalary: number;
  setFilterMinSalary: (salary: number) => void;
  remoteOnly: boolean;
  setRemoteOnly: (enabled: boolean) => void;
  enableCommuteFilter: boolean;
  setEnableCommuteFilter: (enabled: boolean) => void;
  filterMaxDistance: number;
  setFilterMaxDistance: (distance: number) => void;
  filterDomains: string[];
  setFilterDomains: (domains: string[]) => void;
  filterSeniorities: string[];
  setFilterSeniorities: (seniorities: string[]) => void;
  filterContractTypes: string[];
  setFilterContractTypes: (types: string[]) => void;
  onOpenProfile: () => void;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const ChallengeSidebar: React.FC<ChallengeSidebarProps> = ({
  userProfile,
  lane,
  setLane,
  discoveryMode,
  setDiscoveryMode,
  filterMinSalary,
  setFilterMinSalary,
  remoteOnly,
  setRemoteOnly,
  enableCommuteFilter,
  setEnableCommuteFilter,
  filterMaxDistance,
  setFilterMaxDistance,
  filterDomains,
  setFilterDomains,
  filterSeniorities,
  setFilterSeniorities,
  filterContractTypes,
  setFilterContractTypes,
  onOpenProfile,
}) => {
  const { i18n } = useTranslation();
  const locale = String(i18n.resolvedLanguage || i18n.language || userProfile?.preferredLocale || 'en')
    .split('-')[0]
    .toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';

  const copy = useMemo(() => {
    if (locale === 'cs') {
      return {
        explore: 'Kam se vrtat',
        reality: 'Filtry bez keců',
        activity: 'Moje aktivita',
        recommended: 'Nejlepší shoda',
        challenges: 'Výzvy',
        miniChallenges: 'Fušky (Mini)',
        imported: 'Importované role',
        salary: 'Spodní hranice peněz',
        commute: 'Počítat dojezd',
        distance: 'Jak daleko to ještě zkousnu',
        remote: 'Jen remote, bez dojíždění',
        handshakes: 'Handshaky',
        conversations: 'Konverzace',
        saved: 'Uložené',
        presets: 'Rychlé režimy',
        traditional: 'Doladit ručně',
        domains: 'Obory',
        seniority: 'Seniorita',
        contract: 'Úvazek',
        presetsTitle: 'Rychlé režimy',
        presetReality: 'Co mi reálně sedí do života',
        presetZen: 'Méně cesty, méně stresu',
        presetRemote: 'Remote na prvním místě',
        presetMoney: 'Když to finančně dává smysl',
        helper: 'Nastav si feed podle života, ne podle HR slibů.',
        allChallenges: 'Všechny výzvy',
        resetAll: 'Reset',
        advancedFilters: 'Detailní filtry',
        activeCount: '{{count}} aktivní',
        activeCountPlural: '{{count}} aktivní',
        oneChoice: 'vyber jednu',
        showMore: 'Ukázat víc',
        showLess: 'Sbalit',
        salaryPresets: 'Rychlé hranice',
        distancePresets: 'Rychlé dojezdy',
        quickReality: 'Rychlá realita',
        deepFilters: 'Jít víc do hloubky',
        profile: 'Profil',
        noMinimum: 'Bez minima',
        off: 'Vypnuto',
      };
    }
    if (locale === 'sk') {
      return {
        explore: 'Kam sa vŕtať',
        reality: 'Filtre bez kecov',
        activity: 'Moja aktivita',
        recommended: 'Najlepšia zhoda',
        challenges: 'Výzvy',
        miniChallenges: 'Fušky (Mini)',
        imported: 'Importované roly',
        salary: 'Spodná hranica peňazí',
        commute: 'Počítať dochádzku',
        distance: 'Ako ďaleko to ešte znesiem',
        remote: 'Len remote, bez dochádzania',
        handshakes: 'Handshaky',
        conversations: 'Konverzácie',
        saved: 'Uložené',
        presets: 'Rýchle režimy',
        traditional: 'Doladiť ručne',
        domains: 'Obory',
        seniority: 'Seniorita',
        contract: 'Úväzok',
        presetsTitle: 'Rýchle režimy',
        presetReality: 'Čo mi reálne sadne do života',
        presetZen: 'Menej cesty, menej stresu',
        presetRemote: 'Remote na prvom mieste',
        presetMoney: 'Keď to finančne dáva zmysel',
        helper: 'Nastav si feed podľa života, nie podľa HR omáčky.',
        allChallenges: 'Všetky výzvy',
        resetAll: 'Reset',
        advancedFilters: 'Detailné filtre',
        activeCount: '{{count}} aktívny',
        activeCountPlural: '{{count}} aktívne',
        oneChoice: 'vyber jednu',
        showMore: 'Ukázať viac',
        showLess: 'Zbaliť',
        salaryPresets: 'Rýchle hranice',
        distancePresets: 'Rýchle dochádzky',
        quickReality: 'Rýchla realita',
        deepFilters: 'Ísť viac do hĺbky',
        profile: 'Profil',
        noMinimum: 'Bez minima',
        off: 'Vypnuté',
      };
    }
    if (locale === 'de') {
      return {
        explore: 'Wo wir graben',
        reality: 'Filter ohne Bullshit',
        activity: 'Meine Aktivität',
        recommended: 'Beste Übereinstimmung',
        challenges: 'Challenges',
        miniChallenges: 'Mini-Jobs',
        imported: 'Importierte Rollen',
        salary: 'Untergrenze beim Geld',
        commute: 'Pendeln mitrechnen',
        distance: 'Wie weit ich noch schlucke',
        remote: 'Nur remote, ohne Pendeln',
        handshakes: 'Handshakes',
        conversations: 'Gespräche',
        saved: 'Gespeichert',
        presets: 'Schnelle Modi',
        traditional: 'Manuell nachziehen',
        domains: 'Bereiche',
        seniority: 'Seniorität',
        contract: 'Vertragsart',
        presetsTitle: 'Schnelle Modi',
        presetReality: 'Was wirklich in mein Leben passt',
        presetZen: 'Weniger Weg, weniger Nerven',
        presetRemote: 'Remote zuerst',
        presetMoney: 'Wenn es finanziell Sinn ergibt',
        helper: 'Stell den Feed nach echtem Leben ein, nicht nach HR-Floskeln.',
        allChallenges: 'Alle Challenges',
        resetAll: 'Reset',
        advancedFilters: 'Feine Filter',
        activeCount: '{{count}} aktiv',
        activeCountPlural: '{{count}} aktiv',
        oneChoice: 'eine Wahl',
        showMore: 'Mehr zeigen',
        showLess: 'Weniger',
        salaryPresets: 'Schnelle Grenzen',
        distancePresets: 'Schnelle Pendelwege',
        quickReality: 'Schnelle Realität',
        deepFilters: 'Tiefer rein',
        profile: 'Profil',
        noMinimum: 'Kein Minimum',
        off: 'Aus',
      };
    }
    if (locale === 'pl') {
      return {
        explore: 'Gdzie pogrzebać',
        reality: 'Filtry bez ściemy',
        activity: 'Moja aktywność',
        recommended: 'Najlepsze dopasowanie',
        challenges: 'Wyzwania',
        miniChallenges: 'Fuszki (Mini)',
        imported: 'Importowane role',
        salary: 'Dolna granica kasy',
        commute: 'Wlicz dojazd',
        distance: 'Jak daleko jeszcze dam radę',
        remote: 'Tylko remote, bez dojazdu',
        handshakes: 'Handshaki',
        conversations: 'Rozmowy',
        saved: 'Zapisane',
        presets: 'Szybkie tryby',
        traditional: 'Dostrój ręcznie',
        domains: 'Obszary',
        seniority: 'Seniority',
        contract: 'Typ umowy',
        presetsTitle: 'Szybkie tryby',
        presetReality: 'Co naprawdę pasuje do mojego życia',
        presetZen: 'Mniej drogi, mniej stresu',
        presetRemote: 'Remote na pierwszym miejscu',
        presetMoney: 'Jeśli finansowo ma sens',
        helper: 'Ustaw feed pod życie, nie pod HR-ową watę.',
        allChallenges: 'Wszystkie wyzwania',
        resetAll: 'Reset',
        advancedFilters: 'Dokładne filtry',
        activeCount: '{{count}} aktywny',
        activeCountPlural: '{{count}} aktywne',
        oneChoice: 'jeden wybór',
        showMore: 'Pokaż więcej',
        showLess: 'Zwiń',
        salaryPresets: 'Szybkie progi',
        distancePresets: 'Szybkie dojazdy',
        quickReality: 'Szybka rzeczywistość',
        deepFilters: 'Wejdź głębiej',
        profile: 'Profil',
        noMinimum: 'Bez minimum',
        off: 'Wyłączone',
      };
    }
    return {
      explore: 'Explore',
      reality: 'Reality filters',
      activity: 'My activity',
      recommended: 'Recommended',
      challenges: 'Challenges',
      miniChallenges: 'Mini challenges',
      imported: 'Imported roles',
      salary: 'Salary min',
      commute: 'Commute',
      distance: 'Distance',
      remote: 'Remote only',
      handshakes: 'Handshakes',
      conversations: 'Conversations',
      saved: 'Saved',
      presets: 'Life presets',
      traditional: 'Traditional filters',
      domains: 'Domains',
      seniority: 'Seniority',
      contract: 'Contract type',
      presetsTitle: 'Reality presets',
      presetReality: 'What actually fits my life',
      presetZen: 'Less commute, less stress',
      presetRemote: 'Remote first',
      presetMoney: 'If the money makes sense',
      helper: 'Tune the feed to real life, not HR perfume.',
      allChallenges: 'All challenges',
      resetAll: 'Reset',
      advancedFilters: 'Detailed filters',
      activeCount: '{{count}} active',
      activeCountPlural: '{{count}} active',
      oneChoice: 'single choice',
      showMore: 'Show more',
      showLess: 'Show less',
      salaryPresets: 'Quick thresholds',
      distancePresets: 'Quick commute caps',
      quickReality: 'Quick reality',
      deepFilters: 'Go deeper',
      profile: 'Profile',
      noMinimum: 'Any',
      off: 'Off',
    };
  }, [isCsLike, locale]);

  const sections: SidebarSection[] = [
    {
      title: copy.presetsTitle,
      items: [
        {
          key: 'life_recommended',
          label: copy.presetReality,
          icon: <Sparkles size={16} />,
          active: (() => {
            const searchProfile = userProfile?.preferences?.searchProfile;
            const defaultCommute = Boolean(searchProfile?.defaultEnableCommuteFilter ?? false);
            const defaultDistance = Number(searchProfile?.defaultMaxDistanceKm ?? 50) || 50;
            const desiredMin = Number(userProfile?.preferences?.desired_salary_min ?? 0) || 0;
            const shouldUseRemote = !defaultCommute && Boolean(searchProfile?.wantsRemoteRoles ?? false);
            return lane === 'challenges' &&
              discoveryMode === 'all' &&
              remoteOnly === shouldUseRemote &&
              enableCommuteFilter === defaultCommute &&
              filterMaxDistance === defaultDistance &&
              filterMinSalary === desiredMin;
          })(),
          onClick: (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            setLane('challenges');
            setDiscoveryMode('all');
            const searchProfile = userProfile?.preferences?.searchProfile;
            const desiredMin = Number(userProfile?.preferences?.desired_salary_min ?? 0) || 0;
            const defaultCommute = Boolean(searchProfile?.defaultEnableCommuteFilter ?? false);
            const defaultDistance = Number(searchProfile?.defaultMaxDistanceKm ?? 50) || 50;
            const shouldUseRemote = !defaultCommute && Boolean(searchProfile?.wantsRemoteRoles ?? false);

            setRemoteOnly(shouldUseRemote);
            setFilterMinSalary(desiredMin);
            setEnableCommuteFilter(defaultCommute);
            setFilterMaxDistance(defaultDistance);
          },
        },
        {
          key: 'life_zen',
          label: copy.presetZen,
          icon: <TrainFront size={16} />,
          active: enableCommuteFilter && filterMaxDistance <= 20,
          onClick: (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            setLane('challenges');
            setDiscoveryMode('all');
            setRemoteOnly(false);
            setEnableCommuteFilter(true);
            setFilterMaxDistance(20);
          },
        },
        {
          key: 'life_remote',
          label: copy.presetRemote,
          icon: <Home size={16} />,
          active: remoteOnly && !enableCommuteFilter,
          onClick: (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            setLane('challenges');
            setDiscoveryMode('all');
            setRemoteOnly(true);
            setEnableCommuteFilter(false);
          },
        },
        {
          key: 'life_money',
          label: copy.presetMoney,
          icon: <Coins size={16} />,
          active: lane === 'challenges' && discoveryMode === 'all' && filterMinSalary >= 60000,
          onClick: (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            setLane('challenges');
            setDiscoveryMode('all');
            setFilterMinSalary(60000);
          },
        },
      ],
    },
    {
      title: copy.explore,
      items: [
        {
          key: 'challenges',
          label: copy.allChallenges,
          icon: <Compass size={16} />,
          active: lane === 'challenges' && discoveryMode === 'all',
          onClick: () => {
            setLane('challenges');
            setDiscoveryMode('all');
          },
        },
        {
          key: 'mini',
          label: copy.miniChallenges,
          icon: <SlidersHorizontal size={16} />,
          active: discoveryMode === 'micro_jobs',
          onClick: () => {
            setDiscoveryMode('micro_jobs');
          },
        },
        {
          key: 'imports',
          label: copy.imported,
          icon: <Import size={16} />,
          active: lane === 'imports',
          onClick: () => {
            setLane('imports');
            setDiscoveryMode('all');
          },
        },
      ],
    },
    {
      title: copy.reality,
      items: [
        {
          key: 'remote',
          label: copy.remote,
          icon: <Sparkles size={16} />,
          active: remoteOnly,
          onClick: () => {
            const nextRemoteOnly = !remoteOnly;
            setRemoteOnly(nextRemoteOnly);
            if (nextRemoteOnly) {
              setEnableCommuteFilter(false);
            }
          },
        },
        {
          key: 'commute',
          label: copy.commute,
          icon: <TrainFront size={16} />,
          active: enableCommuteFilter,
          onClick: () => {
            const nextCommute = !enableCommuteFilter;
            if (nextCommute) {
              setRemoteOnly(false);
            }
            setEnableCommuteFilter(nextCommute);
          },
        },
      ],
    },
  ];

  const traditionalOptions = {
    domains: [
      { key: 'it', label: isCsLike ? 'IT' : 'IT' },
      { key: 'engineering', label: locale === 'cs' ? 'Inženýring' : locale === 'sk' ? 'Inžiniering' : locale === 'de' ? 'Engineering' : locale === 'pl' ? 'Inżynieria' : 'Engineering' },
      { key: 'marketing', label: locale === 'pl' ? 'Marketing' : 'Marketing' },
      { key: 'sales', label: locale === 'cs' ? 'Obchod' : locale === 'sk' ? 'Obchod' : locale === 'de' ? 'Vertrieb' : locale === 'pl' ? 'Sprzedaż' : 'Sales' },
      { key: 'product', label: locale === 'cs' ? 'Produkt' : locale === 'sk' ? 'Produkt' : locale === 'de' ? 'Produkt' : locale === 'pl' ? 'Produkt' : 'Product' },
      { key: 'finance', label: locale === 'de' ? 'Finanzen' : locale === 'pl' ? 'Finanse' : 'Finance' },
    ],
    seniority: [
      { key: 'junior', label: isCsLike ? 'Junior' : 'Junior' },
      { key: 'medior', label: locale === 'de' ? 'Mittelstufe' : locale === 'pl' ? 'Mid' : 'Medior' },
      { key: 'senior', label: isCsLike ? 'Senior' : 'Senior' },
    ],
    contract: [
      { key: 'employee', label: locale === 'cs' ? 'HPP' : locale === 'sk' ? 'TPP' : locale === 'de' ? 'Angestellt' : locale === 'pl' ? 'Etat' : 'Employee' },
      { key: 'contractor', label: locale === 'cs' ? 'IČO' : locale === 'sk' ? 'SZČO' : locale === 'de' ? 'Freelance' : locale === 'pl' ? 'B2B' : 'Contractor' },
    ],
  };

  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showAllDomains, setShowAllDomains] = useState(false);
  const resetAllFilters = () => {
    setLane('challenges');
    setDiscoveryMode('all');
    setRemoteOnly(false);
    setEnableCommuteFilter(false);
    setFilterMaxDistance(50);
    setFilterMinSalary(0);
    setFilterDomains([]);
    setFilterSeniorities([]);
    setFilterContractTypes([]);
  };
  const activeSignals = useMemo(() => {
    const signals: string[] = [];
    if (remoteOnly) signals.push(copy.remote);
    if (discoveryMode === 'micro_jobs') signals.push(copy.miniChallenges);
    return signals.slice(0, 4);
  }, [copy.miniChallenges, copy.remote, discoveryMode, remoteOnly]);
  const advancedFilterCount = filterDomains.length + filterSeniorities.length + filterContractTypes.length;
  const advancedFilterLabel = (advancedFilterCount === 1 ? copy.activeCount : copy.activeCountPlural).replace('{{count}}', String(advancedFilterCount));
  const visibleDomains = showAllDomains ? traditionalOptions.domains : traditionalOptions.domains.slice(0, 4);
  const hiddenDomainCount = Math.max(0, traditionalOptions.domains.length - visibleDomains.length);
  const salaryPresets = [0, 40000, 60000, 80000];
  const distancePresets = [20, 50, 80];
  const hasAnyFilters =
    remoteOnly ||
    enableCommuteFilter ||
    filterMinSalary > 0 ||
    discoveryMode === 'micro_jobs' ||
    lane === 'imports' ||
    advancedFilterCount > 0;

  return (
    <aside className="lg:sticky lg:top-[calc(var(--app-sticky-stack-offset)+10px)] lg:max-h-[calc(100dvh-var(--app-sticky-stack-offset)-28px)] lg:overflow-y-auto lg:pr-1">
      <SurfaceCard className="space-y-4 rounded-[28px] border-[rgba(15,23,42,0.05)] p-4 shadow-[0_18px_50px_-42px_rgba(15,23,42,0.24)] lg:p-5 dark:border-white/6" variant="frost">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {copy.reality}
            </div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">
              {copy.helper}
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenProfile}
            className="rounded-full bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-strong)] dark:bg-white/5"
          >
            {copy.profile}
          </button>
        </div>

        {hasAnyFilters ? (
          <button
            type="button"
            onClick={resetAllFilters}
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(15,23,42,0.08)] bg-white/74 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:text-[var(--text-strong)] dark:border-white/8 dark:bg-white/6"
          >
            <RotateCcw size={12} />
            {copy.resetAll}
          </button>
        ) : null}

        {activeSignals.length ? (
          <div className="flex flex-wrap gap-2">
            {activeSignals.map((signal) => (
              <span key={signal} className="inline-flex items-center rounded-full bg-[rgba(var(--accent-rgb),0.10)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)] ring-1 ring-inset ring-[rgba(var(--accent-rgb),0.14)]">
                {signal}
              </span>
            ))}
          </div>
        ) : null}

        {sections.map((section) => (
          <div key={section.title} className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">
              {section.title}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={item.onClick}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-[16px] border px-3 py-2.5 text-left text-sm font-semibold transition group cursor-pointer relative z-10 shadow-[0_8px_22px_-20px_rgba(15,23,42,0.2)]",
                    item.active
                      ? "border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.10)] text-[var(--text-strong)]"
                      : "border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.78)] text-[var(--text)] hover:bg-white dark:bg-white/5 dark:border-white/6 dark:hover:bg-white/10"
                  )}
                >
                  <span className={cn("text-[var(--text-faint)] group-active:scale-95 transition-transform", item.active && "text-[var(--accent)]")}>
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-3 rounded-[22px] border border-[rgba(var(--accent-rgb),0.10)] bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.05),rgba(255,255,255,0.82))] p-3.5 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.22)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.quickReality}</div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.salary}</div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">
              {filterMinSalary > 0 ? filterMinSalary.toLocaleString(locale === 'cs' ? 'cs-CZ' : locale === 'sk' ? 'sk-SK' : locale === 'de' ? 'de-DE' : locale === 'pl' ? 'pl-PL' : 'en-US') : copy.noMinimum}
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={250000}
            step={5000}
            value={clamp(Number(filterMinSalary || 0), 0, 250000)}
            onChange={(e) => setFilterMinSalary(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex flex-wrap gap-1.5">
            {salaryPresets.map((value) => (
              <button
                key={`salary-preset-${value}`}
                type="button"
                onClick={() => setFilterMinSalary(value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  filterMinSalary === value
                    ? "border-teal-500/30 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : "border-[rgba(15,23,42,0.08)] bg-white/74 text-[var(--text-muted)] hover:border-teal-500/20 dark:border-white/8 dark:bg-white/6"
                )}
                title={copy.salaryPresets}
              >
                {value === 0 ? copy.noMinimum : `${Math.round(value / 1000)}k+`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-[22px] border border-[rgba(var(--accent-rgb),0.10)] bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.05),rgba(255,255,255,0.82))] p-3.5 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.22)] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)]">{copy.distance}</div>
            <div className="text-sm font-semibold text-[var(--text-strong)]">{enableCommuteFilter ? `${filterMaxDistance} km` : copy.off}</div>
          </div>
          <input
            type="range"
            min={5}
            max={120}
            step={5}
            value={clamp(Number(filterMaxDistance || 0), 5, 120)}
            onChange={(e) => setFilterMaxDistance(Number(e.target.value))}
            className={cn("w-full accent-[var(--accent)]", !enableCommuteFilter && "opacity-60")}
            disabled={!enableCommuteFilter}
          />
          <div className="flex flex-wrap gap-1.5">
            {distancePresets.map((value) => (
              <button
                key={`distance-preset-${value}`}
                type="button"
                onClick={() => {
                  if (remoteOnly) setRemoteOnly(false);
                  if (!enableCommuteFilter) setEnableCommuteFilter(true);
                  setFilterMaxDistance(value);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                  enableCommuteFilter && filterMaxDistance === value
                    ? "border-teal-500/30 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                    : "border-[rgba(15,23,42,0.08)] bg-white/74 text-[var(--text-muted)] hover:border-teal-500/20 dark:border-white/8 dark:bg-white/6"
                )}
                title={copy.distancePresets}
              >
                {value} km
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--border-subtle)] pt-3">
          <button
            type="button"
            onClick={() => setExpandedSection(expandedSection === 'traditional' ? null : 'traditional')}
            className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-faint)] hover:text-[var(--text-strong)] transition"
          >
            <span>{copy.deepFilters}</span>
            <span className="flex items-center gap-2">
              {advancedFilterCount > 0 ? (
                <span className="rounded-full bg-[rgba(var(--accent-rgb),0.10)] px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-[var(--accent)]">
                  {advancedFilterLabel}
                </span>
              ) : null}
              <SlidersHorizontal size={12} className={cn("transition-transform", expandedSection === 'traditional' && "rotate-90")} />
            </span>
          </button>

          {expandedSection === 'traditional' && (
            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{copy.domains}</div>
                  {hiddenDomainCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setShowAllDomains(!showAllDomains)}
                      className="text-[10px] font-medium text-[var(--text-faint)] transition hover:text-[var(--text-strong)]"
                    >
                      {showAllDomains ? copy.showLess : `${copy.showMore} +${hiddenDomainCount}`}
                    </button>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibleDomains.map(dom => (
                    <button
                      key={dom.key}
                      onClick={() => {
                        const next = filterDomains.includes(dom.key)
                          ? filterDomains.filter(k => k !== dom.key)
                          : [...filterDomains, dom.key];
                        setFilterDomains(next);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                        filterDomains.includes(dom.key)
                          ? "border-teal-500/30 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                          : "border-[rgba(15,23,42,0.08)] bg-white/74 text-[var(--text-muted)] hover:border-teal-500/20 dark:border-white/8 dark:bg-white/6"
                      )}
                    >
                      {dom.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{copy.seniority}</div>
                  <div className="text-[10px] font-medium text-[var(--text-faint)]">{copy.oneChoice}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {traditionalOptions.seniority.map(s => (
                    <button
                      key={s.key}
                      onClick={() => {
                        const next = filterSeniorities.includes(s.key) ? [] : [s.key];
                        setFilterSeniorities(next);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                        filterSeniorities.includes(s.key)
                          ? "border-teal-500/30 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                          : "border-[rgba(15,23,42,0.08)] bg-white/74 text-[var(--text-muted)] hover:border-teal-500/20 dark:border-white/8 dark:bg-white/6"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase text-[var(--text-muted)]">{copy.contract}</div>
                  <div className="text-[10px] font-medium text-[var(--text-faint)]">{copy.oneChoice}</div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {traditionalOptions.contract.map(c => (
                    <button
                      key={c.key}
                      onClick={() => {
                        const next = filterContractTypes.includes(c.key) ? [] : [c.key];
                        setFilterContractTypes(next);
                      }}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
                        filterContractTypes.includes(c.key)
                          ? "border-teal-500/30 bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                          : "border-[var(--border-subtle)] bg-white/50 text-[var(--text-muted)] hover:border-teal-500/20"
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </SurfaceCard>
    </aside>
  );
};

export default ChallengeSidebar;
