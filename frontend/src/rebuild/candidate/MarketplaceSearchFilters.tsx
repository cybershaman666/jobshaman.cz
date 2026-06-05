import React from 'react';
import { SlidersHorizontal, X, Search, MapPin, Banknote, ArrowRight, Car, Bus, Bike, Footprints, Dog, Baby, Home, CheckCircle2 } from 'lucide-react';
import { MarketplaceFilters } from '../models';

export const getBenefitOptions = (t: (key: string, opts?: { defaultValue: string }) => string) => [
  t('rebuild.marketplace.benefit_dog_friendly', { defaultValue: 'Dog-friendly office' }),
  t('rebuild.marketplace.benefit_child_friendly', { defaultValue: 'Child friendly office' }),
  t('rebuild.marketplace.benefit_car', { defaultValue: 'Služební auto' }),
  t('rebuild.marketplace.benefit_accommodation', { defaultValue: 'Ubytování' }),
  t('rebuild.marketplace.benefit_home_office', { defaultValue: 'Home office' }),
  t('rebuild.marketplace.benefit_flex_hours', { defaultValue: 'Flexibilní směny' }),
  t('rebuild.marketplace.benefit_transport', { defaultValue: 'Příspěvek na dopravu' }),
  t('rebuild.marketplace.benefit_meal_vouchers', { defaultValue: 'Stravenky' }),
  t('rebuild.marketplace.benefit_multisport', { defaultValue: 'Multisport' }),
  t('rebuild.marketplace.benefit_education', { defaultValue: 'Vzdělávání' }),
  t('rebuild.marketplace.benefit_13th_salary', { defaultValue: '13. plat' }),
  t('rebuild.marketplace.benefit_part_time', { defaultValue: 'Zkrácený úvazek' }),
];

export const getRoleFamilyOptions = (t: (key: string, opts?: { defaultValue: string }) => string) => [
  { value: 'all' as const, label: t('rebuild.marketplace.role_family_all', { defaultValue: 'Všechny obory' }) },
  { value: 'engineering' as const, label: 'Engineering' },
  { value: 'design' as const, label: 'Design' },
  { value: 'product' as const, label: 'Product' },
  { value: 'operations' as const, label: 'Operations' },
  { value: 'sales' as const, label: 'Sales' },
  { value: 'care' as const, label: t('rebuild.marketplace.role_family_care', { defaultValue: 'Péče a služby' }) },
  { value: 'frontline' as const, label: 'Frontline' },
  { value: 'marketing' as const, label: 'Marketing' },
  { value: 'finance' as const, label: 'Finance' },
  { value: 'people' as const, label: 'People/HR' },
  { value: 'education' as const, label: t('rebuild.marketplace.role_family_education', { defaultValue: 'Vzdělávání' }) },
  { value: 'health' as const, label: t('rebuild.marketplace.role_family_health', { defaultValue: 'Zdravotnictví' }) },
  { value: 'construction' as const, label: t('rebuild.marketplace.role_family_construction', { defaultValue: 'Stavba a řemesla' }) },
  { value: 'logistics' as const, label: t('rebuild.marketplace.role_family_logistics', { defaultValue: 'Logistika' }) },
  { value: 'legal' as const, label: t('rebuild.marketplace.role_family_legal', { defaultValue: 'Právo' }) },
];

export const getTransportOptions = (t: (key: string, opts?: { defaultValue: string }) => string) => [
  { value: 'car' as const, label: t('rebuild.transport.car', { defaultValue: 'Auto' }), icon: Car },
  { value: 'public' as const, label: t('rebuild.transport.public', { defaultValue: 'MHD/Vlak' }), icon: Bus },
  { value: 'bike' as const, label: t('rebuild.transport.bike', { defaultValue: 'Kolo' }), icon: Bike },
  { value: 'walk' as const, label: t('rebuild.transport.walk', { defaultValue: 'Pěšky' }), icon: Footprints },
];

export const benefitIconFor = (benefit: string) => {
  const normalized = benefit.toLowerCase();
  if (normalized.includes('dog')) return Dog;
  if (normalized.includes('child')) return Baby;
  if (normalized.includes('auto')) return Car;
  if (normalized.includes('ubyt') || normalized.includes('home')) return Home;
  return CheckCircle2;
};

export const SearchFiltersModal: React.FC<{
  open: boolean;
  filters: MarketplaceFilters;
  searchValue: string;
  onClose: () => void;
  onApply: () => void;
  onReset: () => void;
  onSearchChange: (value: string) => void;
  onFiltersChange: (updater: React.SetStateAction<MarketplaceFilters>) => void;
  t: (key: string, options?: { defaultValue?: string } & Record<string, any>) => string;
}> = ({ open, filters, searchValue, onClose, onApply, onReset, onSearchChange, onFiltersChange, t }) => {
  if (!open) return null;

  const fieldShell = 'mt-2 flex h-12 items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 text-slate-500 dark:text-slate-400 shadow-sm focus-within:border-[#12afcb] dark:focus-within:border-cyan-500 focus-within:ring-4 focus-within:ring-[#eefaff] dark:focus-within:ring-cyan-500/20';
  const inputClass = 'h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400';
  const labelClass = 'block text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-hidden bg-white/80 p-0 backdrop-blur-sm dark:bg-slate-950/80 sm:items-center sm:p-4 md:p-6">
      <div className="grid w-full max-w-[64rem] max-h-[92dvh] overflow-hidden rounded-t-[1.4rem] rounded-b-none border border-white/60 bg-[#ffffff] shadow-[0_-20px_90px_-36px_rgba(8,16,22,0.72)] dark:border-white/10 dark:bg-slate-900 sm:max-h-[90dvh] sm:rounded-[1.15rem] sm:shadow-[0_30px_90px_-36px_rgba(8,16,22,0.72)] md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="relative hidden overflow-hidden bg-[linear-gradient(160deg,#fbfdff_0%,#f5f8f9_48%,#eef5f5_100%)] px-9 py-10 dark:bg-[linear-gradient(160deg,#0f172a_0%,#1e293b_48%,#0f172a_100%)] md:flex md:min-h-0 md:flex-col">
          <img src="/logo-transparent.png" alt="Jobshaman" className="dark:hidden h-12 w-12 rounded-full object-contain" loading="eager" />
          <img src="/logodark.png" alt="Jobshaman" className="hidden dark:block h-12 w-12 rounded-full object-contain" loading="eager" />
          <div className="mt-16">
            <h2 className="max-w-[14rem] text-[1.55rem] font-semibold leading-tight text-slate-950 dark:text-slate-100">
              {t('rebuild.marketplace.filter_title', { defaultValue: 'Najdi práci podle reality, ne podle náhodného keywordu.' })}
            </h2>
            <p className="mt-4 text-sm leading-6 text-slate-500 dark:text-slate-400">
              {t('rebuild.marketplace.filter_desc', { defaultValue: 'Role, obor, místo, dojíždění, peníze a benefity se posílají do V2 katalogu jako jeden záměr.' })}
            </p>
          </div>
          <div className="relative mt-10 flex flex-1 items-center justify-center overflow-hidden rounded-lg border border-slate-100 dark:border-slate-800 bg-[radial-gradient(circle_at_center,#12afcb_0%,#f0fcfd_34%,#fdfdfd_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(18,175,203,0.1)_0%,rgba(18,175,203,0.05)_34%,rgba(18,175,203,0.02)_70%)]">
            <SlidersHorizontal size={92} className="relative z-10 text-[#0f95ac] drop-shadow-[0_24px_40px_rgba(15,149,172,0.16)]" />
          </div>
          <div className="mt-auto text-[0.72rem] font-semibold leading-4 text-slate-500 dark:text-slate-400">
            {t('rebuild.marketplace.filter_hint', { defaultValue: 'Dojezd a benefity jsou preference uchazeče, ne tvrdý HR filtr.' })}
          </div>
        </aside>

        <section key="filters-main" className="relative flex min-h-0 flex-col overflow-y-auto overscroll-contain bg-[#ffffff] px-5 py-6 dark:bg-slate-900 md:px-8 md:py-8">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 dark:text-slate-400 transition hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            aria-label={t('rebuild.marketplace.close_search', { defaultValue: 'Zavřít' })}
          >
            <X size={18} />
          </button>

          <div className="pr-10">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t('rebuild.marketplace.step_search', { defaultValue: '01 Vyhledávání' })}</div>
            <div className="mt-4 rounded-xl border border-[#12afcb]/40 bg-[#f0fcfd] dark:bg-cyan-950/20 px-4 py-4 shadow-[0_18px_38px_-32px_rgba(18,175,203,0.3)] dark:shadow-none">
              <label className={labelClass}>
                {t('rebuild.marketplace.position_label', { defaultValue: 'Název pozice nebo klíčový záměr' })}
                <span className={fieldShell + ' dark:bg-slate-800 dark:border-slate-700 dark:focus-within:ring-amber-500/20'}>
                  <Search size={16} />
                  <input
                    value={searchValue}
                    onChange={(event) => onSearchChange(event.target.value)}
                    className={inputClass + ' dark:text-slate-200'}
                    placeholder={t('rebuild.marketplace.search_placeholder_long', { defaultValue: 'např. skladník, product designer, práce se psy' })}
                    autoFocus
                  />
                </span>
              </label>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              {t('rebuild.marketplace.role_family', { defaultValue: 'Obor' })}
              <select
                value={filters.roleFamily}
                onChange={(event) => onFiltersChange((current) => ({ ...current, roleFamily: event.target.value as MarketplaceFilters['roleFamily'] }))}
                className={`${fieldShell} w-full appearance-none text-sm font-semibold text-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700`}
              >
                {getRoleFamilyOptions(t).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className={labelClass}>
              {t('rebuild.marketplace.location_label', { defaultValue: 'Místo práce' })}
              <span className={fieldShell + ' dark:bg-slate-800 dark:border-slate-700'}>
                <MapPin size={16} />
                <input
                  value={filters.city}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, city: event.target.value }))}
                  className={inputClass + ' dark:text-slate-200'}
                  placeholder={t('rebuild.marketplace.city_placeholder', { defaultValue: 'Praha, Brno, Ostrava...' })}
                />
              </span>
            </label>
            <label className={labelClass}>
              {t('rebuild.marketplace.min_salary', { defaultValue: 'Minimální mzda' })}
              <span className={fieldShell + ' dark:bg-slate-800 dark:border-slate-700'}>
                <Banknote size={16} />
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={filters.minSalary || ''}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, minSalary: Number(event.target.value || 0) }))}
                  className={inputClass + ' dark:text-slate-200'}
                  placeholder={t('rebuild.marketplace.min_salary_placeholder', { defaultValue: 'např. 45000' })}
                />
              </span>
            </label>
            <label className={labelClass}>
              {t('rebuild.marketplace.work_arrangement', { defaultValue: 'Forma práce' })}
              <select
                value={filters.remoteOnly ? 'remote' : filters.workArrangement}
                onChange={(event) => {
                  const next = event.target.value as MarketplaceFilters['workArrangement'];
                  onFiltersChange((current) => ({ ...current, remoteOnly: next === 'remote', workArrangement: next === 'remote' ? 'all' : next }));
                }}
                className={`${fieldShell} w-full appearance-none text-sm font-semibold text-slate-800 dark:text-slate-200 dark:bg-slate-800 dark:border-slate-700`}
              >
                <option value="all">{t('rebuild.marketplace.work_arrangement_all', { defaultValue: 'Všechny formy' })}</option>
                <option value="remote">{t('rebuild.marketplace.work_arrangement_remote', { defaultValue: 'Pouze remote' })}</option>
                <option value="hybrid">{t('rebuild.marketplace.work_arrangement_hybrid', { defaultValue: 'Hybrid' })}</option>
                <option value="onsite">{t('rebuild.marketplace.work_arrangement_onsite', { defaultValue: 'Na místě' })}</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('rebuild.marketplace.commute_label', { defaultValue: '02 Dojíždění' })}</div>
                <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {filters.enableCommuteFilter !== false
                    ? t('rebuild.marketplace.up_to_radius', { defaultValue: 'Do {{radius}} km', radius: filters.radiusKm })
                    : t('rebuild.marketplace.commute_disabled', { defaultValue: 'Dojezd neomezuje výsledky' })}
                </div>
              </div>
              <label className="flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700 shadow-sm dark:bg-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={filters.enableCommuteFilter !== false}
                  onChange={(event) => onFiltersChange((current) => ({ ...current, enableCommuteFilter: event.target.checked }))}
                />
                {t('rebuild.marketplace.commute_toggle', { defaultValue: 'Filtrovat dojezd' })}
              </label>
            </div>
            <input
              type="range"
              min={5}
              max={180}
              step={5}
              value={filters.radiusKm}
              disabled={filters.enableCommuteFilter === false}
              onChange={(event) => onFiltersChange((current) => ({ ...current, radiusKm: Number(event.target.value) }))}
              className="mt-4 w-full accent-[#12afcb] disabled:opacity-40"
            />
          </div>

          <div className="mt-6">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">{t('rebuild.marketplace.step_transport', { defaultValue: '04 Preferovaný způsob dojíždění' })}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {getTransportOptions(t).map((option) => {
                const active = filters.transportMode === option.value;
                const Icon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onFiltersChange((current) => ({ ...current, transportMode: option.value }))}
                    className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition ${active ? 'border-[#12afcb] bg-[#eefaff] text-[#0d8ca3] dark:bg-cyan-950 dark:text-cyan-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:border-[#12afcb]'}`}
                  >
                    <Icon size={20} />
                    <span className="text-[10px] font-bold uppercase tracking-wider">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <div className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-slate-500">{t('rebuild.marketplace.step_benefits', { defaultValue: '03 Benefity a životní preference' })}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {getBenefitOptions(t).map((benefit) => {
                const active = filters.benefits.includes(benefit);
                const Icon = benefitIconFor(benefit);
                return (
                  <button
                    key={benefit}
                    type="button"
                    onClick={() => onFiltersChange((current) => ({
                      ...current,
                      benefits: current.benefits.includes(benefit)
                        ? current.benefits.filter((item) => item !== benefit)
                        : [...current.benefits, benefit],
                    }))}
                    className={`inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition ${active ? 'border-[#12afcb] bg-[#f0fcfd] text-[#0f95ac] dark:bg-cyan-950/40 dark:text-cyan-400' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-[#12afcb]'}`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{benefit}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sticky bottom-0 -mx-5 mt-auto flex flex-col gap-3 border-t border-slate-200 bg-white/96 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-18px_34px_-30px_rgba(15,23,42,0.42)] dark:border-slate-800 dark:bg-slate-900/96 sm:flex-row md:-mx-8 md:px-8">
            <button type="button" onClick={onReset} className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-5 text-sm font-bold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700">
              {t('rebuild.marketplace.reset_filters', { defaultValue: 'Resetovat' })}
            </button>
            <button type="button" onClick={onApply} className="inline-flex h-12 flex-1 items-center justify-center gap-3 rounded-xl bg-[#12afcb] px-5 text-sm font-bold text-white shadow-[0_18px_34px_-24px_rgba(18,175,203,0.5)] transition hover:bg-[#0f95ac]">
              {t('rebuild.marketplace.apply_filters', { defaultValue: 'Použít filtry' })}
              <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
