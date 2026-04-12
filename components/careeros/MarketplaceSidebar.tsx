import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Briefcase,
  CarFront,
  Dog,
  Filter,
  Globe2,
  GraduationCap,
  Heart,
  MapPin,
  Sparkles,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';

import { cn } from '../ui/primitives';
import { galaxyShellPanelClass } from '../galaxy/GalaxyShellPrimitives';

interface MarketplaceSidebarProps {
  jobCount: number;
  savedCount: number;
  remoteOnly: boolean;
  filterMinSalary: number;
  filterBenefits: string[];
  enableCommuteFilter: boolean;
  filterMaxDistance: number;
  currentPage: number;
  pageSize: number;
  hasMore: boolean;
  discoveryMode: string;
  lane: string;
  onOpenProfile: () => void;
  collapsed?: boolean;
}

const BENEFIT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  dog_friendly: Dog,
  education: GraduationCap,
  meal_allowance: UtensilsCrossed,
  car_personal: CarFront,
};

const BENEFIT_LABELS: Record<string, string> = {
  dog_friendly: 'Dog Friendly',
  education: 'Vzdelavani',
  meal_allowance: 'Stravenky',
  car_personal: 'Sluzebni auto',
  multisport: 'Multisport',
  health_care: 'Zdravotni pece',
  child_friendly: 'Deti vitany',
};

const DISCOVERY_MODE_LABELS: Record<string, { cs: string; en: string }> = {
  all: { cs: 'Vsechny nabidky', en: 'All offers' },
  micro_jobs: { cs: 'Mini vyzvy', en: 'Mini challenges' },
  discovery_default: { cs: 'Doporucene', en: 'Recommended' },
};

export const MarketplaceSidebar: React.FC<MarketplaceSidebarProps> = ({
  jobCount,
  savedCount,
  remoteOnly,
  filterMinSalary,
  filterBenefits,
  enableCommuteFilter,
  filterMaxDistance,
  currentPage,
  pageSize,
  hasMore,
  discoveryMode,
  lane,
  onOpenProfile,
  collapsed = false,
}) => {
  const { i18n } = useTranslation();
  const lang = i18n.language?.split('-')[0] || 'en';
  const isCsLike = lang === 'cs' || lang === 'sk';

  const activeFiltersCount = [
    remoteOnly,
    filterMinSalary > 0,
    filterBenefits.length > 0,
    enableCommuteFilter,
  ].filter(Boolean).length;

  const startJob = jobCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endJob = Math.min(currentPage * pageSize, jobCount);
  const modeLabel = DISCOVERY_MODE_LABELS[discoveryMode]?.[isCsLike ? 'cs' : 'en'] || discoveryMode;
  const laneLabel = lane === 'imports'
    ? (isCsLike ? 'Externi zdroje' : 'External sources')
    : (isCsLike ? 'Hlavni feed' : 'Primary feed');
  const activeFocusCopy = activeFiltersCount > 0
    ? (isCsLike ? 'Feed uz je zúzeny na to podstatne.' : 'The feed is already narrowed to what matters.')
    : (isCsLike ? 'Ted vidis plnou sirku trhu bez omezeni.' : 'You are seeing the full market without constraints.');
  const visibleFilterItems = [
    remoteOnly
      ? {
          icon: Globe2,
          label: isCsLike ? 'Pouze remote' : 'Remote only',
          tone: 'text-cyan-600 dark:text-cyan-300',
        }
      : null,
    filterMinSalary > 0
      ? {
          icon: Wallet,
          label: isCsLike ? `Min. ${filterMinSalary.toLocaleString()} Kc` : `Min. ${filterMinSalary.toLocaleString()} CZK`,
          tone: 'text-emerald-600 dark:text-emerald-300',
        }
      : null,
    enableCommuteFilter
      ? {
          icon: MapPin,
          label: isCsLike ? `Dojezd do ${filterMaxDistance} km` : `Commute to ${filterMaxDistance} km`,
          tone: 'text-orange-600 dark:text-orange-300',
        }
      : null,
    ...filterBenefits.slice(0, 3).map((benefit) => {
      const Icon = BENEFIT_ICONS[benefit] || Sparkles;
      return {
        icon: Icon,
        label: BENEFIT_LABELS[benefit] || benefit,
        tone: 'text-amber-600 dark:text-amber-300',
      };
    }),
  ].filter(Boolean) as Array<{ icon: React.ComponentType<{ className?: string }>; label: string; tone: string }>;
  const hiddenBenefitsCount = Math.max(0, filterBenefits.length - 3);

  if (collapsed) {
    const compactStats = [
      { label: isCsLike ? 'Role' : 'Roles', value: jobCount.toLocaleString() },
      { label: isCsLike ? 'Save' : 'Saved', value: savedCount.toLocaleString() },
      { label: isCsLike ? 'Filt' : 'Filt', value: String(activeFiltersCount) },
    ];

    return (
      <div className="flex w-16 flex-col gap-3">
        <div className={cn(galaxyShellPanelClass, 'rounded-[24px] px-2 py-3')}>
          <div className="flex flex-col items-center gap-2">
            {compactStats.map((item) => (
              <div
                key={item.label}
                className="flex w-full flex-col items-center rounded-2xl bg-slate-50 px-1 py-2 text-center dark:bg-slate-900/70"
                title={`${item.label}: ${item.value}`}
              >
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-400">{item.label}</span>
                <span className="mt-1 text-xs font-bold text-slate-900 dark:text-slate-100">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className={cn(
            galaxyShellPanelClass,
            'inline-flex h-14 items-center justify-center rounded-[24px] text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-900'
          )}
          aria-label={isCsLike ? 'Otevrit preference' : 'Open preferences'}
          title={isCsLike ? 'Otevrit preference' : 'Open preferences'}
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex w-72 flex-col gap-4">
      <div className={cn(galaxyShellPanelClass, 'rounded-[24px] p-4')}>
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          <Briefcase className="h-3.5 w-3.5" />
          <span>{isCsLike ? 'Marketplace pulse' : 'Marketplace pulse'}</span>
        </div>

        <div className="mt-3 space-y-4">
          <div className="rounded-[20px] bg-slate-50 px-4 py-3 dark:bg-slate-900/80">
            <div className="text-3xl font-bold tracking-[-0.04em] text-slate-900 dark:text-white">
              {jobCount.toLocaleString()}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              {isCsLike ? 'nabidek v aktualnim vyberu' : 'offers in the current scope'}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {isCsLike ? 'Zobrazeno' : 'Visible now'}
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                {jobCount > 0 ? `${startJob}-${endJob}` : '0'}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {hasMore
                  ? (isCsLike ? 'dalsi pokracuji nize' : 'more continue below')
                  : (isCsLike ? 'aktualni sada hotova' : 'current batch complete')}
              </div>
            </div>

            <div className="rounded-[18px] border border-slate-200/80 bg-white px-3 py-3 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {isCsLike ? 'Ulozeno' : 'Saved'}
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <Heart className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                {savedCount}
              </div>
              <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {savedCount > 0
                  ? (isCsLike ? 'mas se kam vracet' : 'your shortlist is building')
                  : (isCsLike ? 'zatim bez shortlistu' : 'no shortlist yet')}
              </div>
            </div>
          </div>

          <div className="rounded-[18px] border border-cyan-200/70 bg-cyan-50/80 px-3 py-3 dark:border-cyan-500/20 dark:bg-cyan-950/20">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isCsLike ? 'Fokus feedu' : 'Feed focus'}</span>
            </div>
            <div className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {modeLabel}
            </div>
            <div className="mt-1 text-[12px] leading-5 text-slate-600 dark:text-slate-300">
              {laneLabel}. {activeFocusCopy}
            </div>
          </div>
        </div>
      </div>

      <div className={cn(galaxyShellPanelClass, 'rounded-[24px] p-4')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            <Filter className="h-3.5 w-3.5" />
            <span>{isCsLike ? 'Aktivni filtry' : 'Active filters'}</span>
          </div>
          {activeFiltersCount > 0 ? (
            <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300">
              {activeFiltersCount}
            </span>
          ) : null}
        </div>

        <div className="mt-3 space-y-2.5">
          {visibleFilterItems.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-center gap-2 rounded-[18px] bg-slate-50 px-3 py-2.5 text-xs text-slate-700 dark:bg-slate-800/80 dark:text-slate-200">
                <Icon className={cn('h-3.5 w-3.5', item.tone)} />
                <span>{item.label}</span>
              </div>
            );
          })}

          {hiddenBenefitsCount > 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {isCsLike ? `+${hiddenBenefitsCount} dalsi benefitni preference` : `+${hiddenBenefitsCount} more benefit preferences`}
            </div>
          ) : null}

          {activeFiltersCount === 0 ? (
            <div className="rounded-[18px] border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
              {isCsLike ? 'Zadne aktivni filtry, feed je otevreny naplno.' : 'No active filters, the feed is fully open.'}
            </div>
          ) : null}
        </div>
      </div>

      <div className={cn(galaxyShellPanelClass, 'rounded-[24px] p-4')}>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          {isCsLike ? 'Co s tim' : 'Next move'}
        </div>

        <div className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {savedCount > 0
            ? (isCsLike
              ? 'Mas shortlist. Dolad preference a rychleji oddelis silne nabidky od sumu.'
              : 'You already have a shortlist. Refine preferences to separate signal from noise faster.')
            : (isCsLike
              ? 'Jeste nemas shortlist. Nastav preference a zacni si ukladat role, ktere opravdu sedi.'
              : 'No shortlist yet. Tune your preferences and start saving the roles that actually fit.')}
        </div>

        <button
          type="button"
          onClick={onOpenProfile}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <span>{isCsLike ? 'Otevrit preference' : 'Open preferences'}</span>
          <ArrowRight className="h-4 w-4" />
        </button>

        {lane === 'imports' ? (
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
            {isCsLike
              ? 'Prave jedes externi feed. Pro vlastni vyzvy prepni zpet na hlavni lane.'
              : 'You are currently in the external feed. Switch back to the primary lane for native challenges.'}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default MarketplaceSidebar;
