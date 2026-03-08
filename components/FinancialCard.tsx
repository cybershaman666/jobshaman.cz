import React, { useMemo, useState } from 'react';
import { Job, UserProfile, CommuteAnalysis, SalaryBenchmarkResolved, ViewState } from '../types';
import {
    Wallet,
    Lock,
    Navigation,
    Home,
    Globe,
    Map,
    MapPin,
    Clock,
    Calculator,
    Sparkles,
    Info,
    ChevronUp,
    ChevronDown,
    Bus,
    Zap
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import OfferImpactSnapshot from './OfferImpactSnapshot';
import { FEATURE_SALARY_BENCHMARKS } from '../constants';
import { isRemoteJob } from '../services/commuteService';

interface FinancialCardProps {
    selectedJob: Job;
    userProfile: UserProfile;
    commuteAnalysis: CommuteAnalysis | null;
    salaryBenchmark: SalaryBenchmarkResolved | null;
    showCommuteDetails: boolean;
    showLoginPrompt: boolean;
    showAddressPrompt: boolean;
    handleAuthAction: (mode?: 'login' | 'register') => void;
    setViewState: (view: ViewState) => void;
    showFinancialMethodology: boolean;
    setShowFinancialMethodology: (show: boolean) => void;
    getTransportIcon: (mode: string) => React.ComponentType<any>;
}

const FinancialCard: React.FC<FinancialCardProps> = ({
    selectedJob,
    userProfile,
    commuteAnalysis,
    salaryBenchmark,
    showCommuteDetails,
    showLoginPrompt,
    showAddressPrompt,
    handleAuthAction,
    setViewState,
    showFinancialMethodology,
    setShowFinancialMethodology,
    getTransportIcon
}) => {
    const { t, i18n } = useTranslation();
    const [showMarketDetails, setShowMarketDetails] = useState(false);
    const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = locale === 'cs' || locale === 'sk';
    const remoteRole = isRemoteJob(selectedJob);
    const cur = commuteAnalysis?.financialReality.currency || 'Kč';
    const locationLabel = userProfile.address || t('financial.current_location_label');
    const takeHomeCopy = isCsLike
        ? {
            title: 'Reálně domů',
            subtitle: 'Po daních, odvodech a dojezdu',
            contractor: 'počítáno jako IČO',
            employee: 'počítáno jako zaměstnanec',
            family: 'děti v profilu'
        }
        : {
            title: 'Real take-home',
            subtitle: 'After taxes, deductions, and commute',
            contractor: 'calculated as contractor',
            employee: 'calculated as employee',
            family: 'children in profile'
        };
    const salaryBenchmarkReady = !!salaryBenchmark && !salaryBenchmark.insufficient_data;
    const salaryCurrency = salaryBenchmark?.currency || cur;
    const salaryTierLabel = salaryBenchmarkReady && salaryBenchmark?.delta_vs_p50 !== undefined
        ? (salaryBenchmark.delta_vs_p50 > 0
            ? t('financial.market.above', { defaultValue: 'Nad trhem' })
            : salaryBenchmark.delta_vs_p50 < 0
                ? t('financial.market.below', { defaultValue: 'Pod trhem' })
                : t('financial.market.at', { defaultValue: 'Na úrovni trhu' }))
        : null;
    const salaryTierColor = salaryBenchmarkReady && salaryBenchmark?.delta_vs_p50 !== undefined
        ? (salaryBenchmark.delta_vs_p50 > 0 ? 'text-emerald-400' : salaryBenchmark.delta_vs_p50 < 0 ? 'text-rose-400' : 'text-amber-300')
        : 'text-slate-300';
    const benchmarkFallbackMessage = useMemo(() => {
        const transparency = salaryBenchmark?.transparency;
        if (!transparency) return null;
        const mode = transparency.source_mode;
        const externalN = transparency.fallback_details?.external_sample ?? 0;
        const familyN = transparency.fallback_details?.family_sample ?? 0;
        const groupN = transparency.fallback_details?.group_sample ?? 0;
        const internalN = familyN || groupN || transparency.sample_size || 0;

        if (mode === 'public_fallback') {
            return t('financial.market.fallback_public', {
                source: transparency.source_name,
                n: externalN || transparency.sample_size || 0
            });
        }
        if (mode === 'blended_internal_public') {
            return t('financial.market.fallback_blended', {
                source: transparency.source_name,
                n: internalN,
                ext: externalN
            });
        }
        if (mode === 'internal_only' && transparency.fallback_reason) {
            return t('financial.market.fallback_national', { n: internalN });
        }
        return transparency.fallback_reason || null;
    }, [salaryBenchmark?.transparency, t]);

    return (
        <div className="bg-[#1e293b] text-slate-200 rounded-xl overflow-hidden shadow-xl mb-8 border border-slate-700 relative">
            {/* Card Header */}
            <div className="p-6 border-b border-slate-700 flex justify-between items-start">
                <div>
                    <h3 className="text-white text-lg font-bold flex items-center gap-2">
                        <Wallet className="text-emerald-400" size={20} /> {t('financial.reality_title')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        {showCommuteDetails
                            ? t('financial.based_on_location', { location: locationLabel })
                            : t('financial.reality_desc')}
                    </p>
                </div>
                {showCommuteDetails && commuteAnalysis && (
                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            {t('financial.jhi_impact_label')}
                        </div>
                        <div className={`text-xl font-bold ${commuteAnalysis.jhiImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {commuteAnalysis.jhiImpact > 0 ? '+' : ''}{commuteAnalysis.jhiImpact} {t('financial.points')}
                        </div>
                    </div>
                )}
            </div>

            {/* State: Guest */}
            {showLoginPrompt && (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                    <Lock size={40} className="text-slate-500 mb-4" />
                    <h4 className="text-white font-bold text-lg mb-2">{t('financial.unlock_title')}</h4>
                    <p className="text-slate-400 max-w-sm mb-6 text-sm">
                        {t('financial.unlock_desc')}
                    </p>
                    <p className="text-slate-500 max-w-sm mb-6 text-xs">
                        {t('financial.unlock_commute_address')}
                    </p>
                    <button onClick={() => handleAuthAction('login')} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">
                        {t('financial.login_button')}
                    </button>
                </div>
            )}

            {/* State: Logged In but No Address */}
            {showAddressPrompt && (
                <div className="p-12 text-center flex flex-col items-center justify-center">
                    <Navigation size={40} className="text-slate-500 mb-4" />
                    <h4 className="text-white font-bold text-lg mb-2">{t('financial.missing_address')}</h4>
                    <p className="text-slate-400 max-w-sm mb-6 text-sm">
                        {t('financial.set_address_desc')}
                    </p>
                    <p className="text-slate-500 max-w-sm mb-6 text-xs">
                        {t('financial.unlock_commute_address')}
                    </p>
                    <button onClick={() => setViewState(ViewState.PROFILE)} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-colors">
                        {t('financial.set_address_button')}
                    </button>
                </div>
            )}

            {/* State: Full Data */}
            {showCommuteDetails && commuteAnalysis && (
                <div className="grid grid-cols-1 md:grid-cols-2">
                    <div className="p-6 border-r border-slate-700 flex flex-col justify-center">
                        {remoteRole ? (
                            <div className="text-center py-2">
                                <Home size={40} className="text-emerald-400 mx-auto mb-3 opacity-80" />
                                <h4 className="text-white font-bold text-lg mb-1">{t('financial.home_office')}</h4>
                                <div className="text-emerald-400 text-sm font-medium mb-2">
                                    {t('financial.home_office_savings')}
                                </div>
                                <div className="text-xs text-emerald-400 mb-3 text-center">
                                    <div className="flex items-center gap-1 justify-center">
                                        <span className="text-green-400">🏠</span>
                                        <div>
                                            <div>{commuteAnalysis.financialReality.avoidedCommuteCost.toLocaleString()} {cur}/{t('financial.per_month')}</div>
                                            <div>{t('financial.saved_commute_time_money')}</div>
                                            <div>{t('financial.eco_friendly_choice')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : commuteAnalysis.isRelocation ? (
                            <div className="text-center py-2">
                                <Globe size={40} className="text-cyan-400 mx-auto mb-3 opacity-80" />
                                <h4 className="text-white font-bold text-lg mb-1">{t('logistics.relocation_required')}</h4>
                                <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">{t('logistics.relocation_desc')}</p>
                            </div>
                        ) : commuteAnalysis.distanceKm === -1 ? (
                            <div className="text-center py-2">
                                <Map size={40} className="text-slate-500 mx-auto mb-3 opacity-50" />
                                <h4 className="text-white font-bold text-lg mb-1">{t('logistics.unknown_location_title')}</h4>
                                <p className="text-slate-400 text-sm max-w-[200px] mx-auto leading-relaxed">{t('logistics.unknown_location_desc')}</p>
                            </div>
                        ) : (
                            <>
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><MapPin size={12} /> {t('logistics.logistics_title')}</h4>
                                <div className="relative h-12 mb-6">
                                    <div className="absolute top-2 left-0 right-0 flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>{t('logistics.home')}</span><span>{t('logistics.work')}</span></div>
                                    <div className="absolute top-6 left-0 right-0 h-1.5 bg-slate-900/50 rounded-full overflow-hidden"><div className={`h-full ${commuteAnalysis.timeMinutes > 45 ? 'bg-gradient-to-r from-emerald-500 to-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (commuteAnalysis.distanceKm / 60) * 100)}%` }}></div></div>
                                    <div className="absolute top-4 p-1.5 bg-slate-600 border border-slate-500 rounded-full text-white shadow-md transition-all" style={{ left: `clamp(0%, ${Math.min(100, (commuteAnalysis.distanceKm / 60) * 100)}%, 100%)`, transform: 'translateX(-50%)' }}>{React.createElement(getTransportIcon(userProfile.transportMode), { size: 14 })}</div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div><div className="text-2xl font-mono text-white font-light flex items-center gap-2"><Clock size={20} className="text-slate-400" /> {commuteAnalysis.timeMinutes * 2} <span className="text-sm text-slate-400 font-sans font-bold">min</span></div><div className="text-[10px] text-slate-400 mt-1">{t('logistics.daily_commute')}</div></div>
                                    <div><div className="text-2xl font-mono text-white font-light">{commuteAnalysis.distanceKm} <span className="text-sm text-slate-400 font-sans font-bold">km</span></div><div className="text-[10px] text-slate-400 mt-1">{t('logistics.one_way')}</div></div>
                                </div>
                            </>
                        )}
                    </div>
                    <div className="flex flex-col">
                        <div className="flex-1">
                            <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">
                                            {takeHomeCopy.title}
                                        </div>
                                        <div className="mt-1 text-xs text-emerald-100/80">
                                            {takeHomeCopy.subtitle}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-white">
                                            {commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} {cur}
                                        </div>
                                        <div className="mt-1 text-[11px] text-emerald-200/80">
                                            {commuteAnalysis.financialReality.isIco ? takeHomeCopy.contractor : takeHomeCopy.employee}
                                            {userProfile.taxProfile?.childrenCount
                                                ? ` • ${userProfile.taxProfile.childrenCount} ${takeHomeCopy.family}`
                                                : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <OfferImpactSnapshot
                                title={
                                    <span className="inline-flex items-center gap-2">
                                        <Calculator size={12} /> {t('financial.reality_vs_income')}
                                    </span>
                                }
                                leadingNote={
                                    selectedJob.aiEstimatedSalary ? (
                                        <span className="inline-flex items-center gap-1">
                                            <Sparkles size={10} />
                                            {t('financial.ai_estimation_hint')}
                                        </span>
                                    ) : null
                                }
                                rows={[
                                    {
                                        label: t('financial.gross_monthly'),
                                        value: commuteAnalysis.financialReality.grossMonthlySalary > 0
                                            ? `${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString()} ${cur}`
                                            : (selectedJob.aiEstimatedSalary
                                                ? `${selectedJob.aiEstimatedSalary.min.toLocaleString()} - ${selectedJob.aiEstimatedSalary.max.toLocaleString()} ${selectedJob.aiEstimatedSalary.currency}`
                                                : '???')
                                    },
                                    {
                                        label: `- ${t('financial.tax_insurance')}`,
                                        value: `${commuteAnalysis.financialReality.estimatedTaxAndInsurance.toLocaleString()} ${cur}`,
                                        tone: 'negative'
                                    },
                                    {
                                        label: t('financial.net_base'),
                                        value: `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString()} ${cur}`
                                    },
                                    {
                                        label: `+ ${t('financial.benefit_value_label')}`,
                                        value: `${commuteAnalysis.financialReality.benefitsValue.toLocaleString()} ${cur}`,
                                        tone: 'positive'
                                    },
                                    {
                                        label: `- ${t('financial.commute_costs')}`,
                                        value: commuteAnalysis.isRelocation ? '???' : `${commuteAnalysis.financialReality.commuteCost.toLocaleString()} ${cur}`,
                                        tone: 'negative'
                                    },
                                    {
                                        label: t('financial.reality_summary'),
                                        value: `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString()} ${cur}`,
                                        tone: 'emphasis'
                                    }
                                ]}
                            />
                            {commuteAnalysis.financialReality.benefitsValue > 0 && (
                                <div className="text-xs text-slate-400 mt-2 italic">
                                    <div className="flex items-start gap-1">
                                        <span className="text-blue-400">ℹ️</span>
                                        <div>
                                            <div>{t('financial.benefit_value_label')}: {commuteAnalysis.financialReality.benefitsValue.toLocaleString()} {cur}/{t('financial.per_month')}</div>
                                            <div>{t('financial.benefit_info_desc')}</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {FEATURE_SALARY_BENCHMARKS && (
                                <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/50 p-3">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                            {t('financial.market.title', { defaultValue: 'Mzda vs trh' })}
                                        </div>
                                        {salaryBenchmark?.transparency?.source_name && (
                                            <span
                                                className="text-[10px] text-slate-400 underline decoration-dotted cursor-help"
                                                title={[
                                                    `${t('financial.market.source_label', { defaultValue: 'Zdroj' })}: ${salaryBenchmark.transparency.source_name}`,
                                                    salaryBenchmark.transparency.period_label
                                                        ? `${t('financial.market.period_label', { defaultValue: 'Období' })}: ${salaryBenchmark.transparency.period_label}`
                                                        : null,
                                                    salaryBenchmark.transparency.measure_type
                                                        ? `${t('financial.market.measure_label', { defaultValue: 'Měření' })}: ${salaryBenchmark.transparency.measure_type === 'median' ? t('financial.market.measure_median', { defaultValue: 'median' }) : t('financial.market.measure_average', { defaultValue: 'průměr' })}`
                                                        : null,
                                                    salaryBenchmark.transparency.gross_net
                                                        ? `${t('financial.market.gross_net_label', { defaultValue: 'Typ' })}: ${salaryBenchmark.transparency.gross_net === 'gross' ? t('financial.market.gross', { defaultValue: 'gross' }) : t('financial.market.net', { defaultValue: 'net' })}`
                                                        : null,
                                                    salaryBenchmark.transparency.employment_scope
                                                        ? `${t('financial.market.scope_label', { defaultValue: 'Scope' })}: ${salaryBenchmark.transparency.employment_scope}`
                                                        : null,
                                                    salaryBenchmark.transparency.source_url
                                                        ? `${t('financial.market.source_url_label', { defaultValue: 'URL' })}: ${salaryBenchmark.transparency.source_url}`
                                                        : null
                                                ].filter(Boolean).join('\n')}
                                            >
                                                {t('financial.market.source_hint', { defaultValue: 'zdroj' })}
                                            </span>
                                        )}
                                    </div>
                                    {salaryBenchmarkReady ? (
                                        <div className="space-y-2 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <div>
                                                    <div className={`font-semibold ${salaryTierColor}`}>
                                                        {salaryTierLabel}
                                                        {typeof salaryBenchmark?.delta_vs_p50_pct === 'number' && (
                                                            <span className="ml-1">
                                                                ({salaryBenchmark.delta_vs_p50_pct > 0 ? '+' : ''}{salaryBenchmark.delta_vs_p50_pct.toFixed(1)}%)
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-slate-300">
                                                        {t('financial.market.p50', { defaultValue: 'Typická mzda (medián)' })}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-right font-mono text-white">
                                                        {(salaryBenchmark?.p50 || 0).toLocaleString()} {salaryCurrency}
                                                    </div>
                                                    <button
                                                        onClick={() => setShowMarketDetails((prev) => !prev)}
                                                        className="mt-1 text-[10px] text-slate-400 underline decoration-dotted"
                                                    >
                                                        {showMarketDetails
                                                            ? t('financial.market.hide_details', { defaultValue: 'Skrýt detail' })
                                                            : t('financial.market.show_details', { defaultValue: 'Zobrazit detail' })}
                                                    </button>
                                                </div>
                                            </div>
                                            {showMarketDetails && (
                                                <>
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-slate-300">
                                                        <div>{t('financial.market.iqr', { defaultValue: 'Rozpětí (p25–p75)' })}</div>
                                                        <div className="text-right font-mono">{(salaryBenchmark?.iqr || 0).toLocaleString()} {salaryCurrency}</div>
                                                        <div>{t('financial.market.sample_size', { defaultValue: 'Počet nabídek' })}</div>
                                                        <div className="text-right font-mono">{salaryBenchmark?.transparency.sample_size || 0}</div>
                                                        <div>{t('financial.market.window', { defaultValue: 'Období' })}</div>
                                                        <div className="text-right font-mono">{salaryBenchmark?.transparency.data_window_days || 0}d</div>
                                                        <div>{t('financial.market.confidence', { defaultValue: 'Spolehlivost' })}</div>
                                                        <div className="text-right font-semibold uppercase">{salaryBenchmark?.transparency.confidence_tier || 'low'}</div>
                                                    </div>
                                                    {benchmarkFallbackMessage && (
                                                        <div className="text-amber-300 text-[11px] leading-relaxed border-t border-slate-700 pt-2">
                                                            {benchmarkFallbackMessage}
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-400">
                                            {benchmarkFallbackMessage
                                                || t('financial.market.insufficient', { defaultValue: 'Insufficient data pro robustní benchmark.' })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Information Box - How JHI and Transport are Calculated */}
                        <div className="mt-6 pt-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowFinancialMethodology(!showFinancialMethodology)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded text-slate-300 hover:bg-slate-800/50 transition-colors text-xs font-semibold"
                            >
                                <Info size={14} className="text-blue-400 flex-shrink-0" />
                                <span>{t('financial.methodology.title')}</span>
                                {showFinancialMethodology ? (
                                    <ChevronUp size={12} className="ml-auto text-slate-500" />
                                ) : (
                                    <ChevronDown size={12} className="ml-auto text-slate-500" />
                                )}
                            </button>

                            {showFinancialMethodology && (
                                <div className="mt-3 p-3 rounded bg-slate-800/30 border border-slate-700 space-y-3 text-[11px] text-slate-300">
                                    {/* JHI Explanation */}
                                    <div>
                                        <div className="font-bold text-white mb-1 flex items-center gap-1">
                                            <Zap size={11} className="text-yellow-400" /> {t('financial.methodology.jhi_title')}
                                        </div>
                                        <p className="text-slate-400">
                                            {t('financial.methodology.jhi_formula')}
                                            <br />
                                            <span className="text-[10px]">{t('financial.methodology.jhi_example')}</span>
                                        </p>
                                    </div>

                                    {/* Transport Costs */}
                                    <div>
                                        <div className="font-bold text-white mb-1 flex items-center gap-1">
                                            <Bus size={11} className="text-blue-400" /> {t('financial.methodology.transport_title')}
                                        </div>
                                        <div className="space-y-1 text-slate-400 text-[10px]">
                                            <div>{t('financial.methodology.transport_car')}</div>
                                            <div>{t('financial.methodology.transport_public')}</div>
                                            <div>{t('financial.methodology.transport_bike')}</div>
                                            <div>{t('financial.methodology.transport_walk')}</div>
                                        </div>
                                    </div>

                                    {/* Final Calculation */}
                                    <div>
                                        <div className="font-bold text-white mb-1">{t('financial.methodology.final_title')}</div>
                                        <p className="text-slate-400 text-[10px]">
                                            {t('financial.methodology.final_formula')}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FinancialCard;
