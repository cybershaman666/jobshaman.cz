import React from 'react';
import { Job, UserProfile, CommuteAnalysis, ViewState } from '../types';
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

interface FinancialCardProps {
    selectedJob: Job;
    userProfile: UserProfile;
    commuteAnalysis: CommuteAnalysis | null;
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
    showCommuteDetails,
    showLoginPrompt,
    showAddressPrompt,
    handleAuthAction,
    setViewState,
    showFinancialMethodology,
    setShowFinancialMethodology,
    getTransportIcon
}) => {
    const { t } = useTranslation();
    const cur = commuteAnalysis?.financialReality.currency || 'Kč';

    return (
        <div className="bg-[#1e293b] text-slate-200 rounded-xl overflow-hidden shadow-xl mb-8 border border-slate-700 relative">
            {/* Card Header */}
            <div className="p-6 border-b border-slate-700 flex justify-between items-start">
                <div>
                    <h3 className="text-white text-lg font-bold flex items-center gap-2">
                        <Wallet className="text-emerald-400" size={20} /> {t('financial.reality_title')}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">
                        {showCommuteDetails ? `Na základě ${userProfile.address}` : t('financial.reality_desc', 'Kalkulace čistého příjmu a nákladů na dojíždění.')}
                    </p>
                </div>
                {showCommuteDetails && commuteAnalysis && (
                    <div className="text-right">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">JHI DOPAD</div>
                        <div className={`text-xl font-bold ${commuteAnalysis.jhiImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {commuteAnalysis.jhiImpact > 0 ? '+' : ''}{commuteAnalysis.jhiImpact} bodů
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
                        {t(
                            'financial.unlock_commute_address',
                            'Pro odemčení dojezdové reality je nutné vyplnit adresu ve svém profilu.'
                        )}
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
                        {t(
                            'financial.unlock_commute_address',
                            'Pro odemčení dojezdové reality je nutné vyplnit adresu ve svém profilu.'
                        )}
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
                        {selectedJob.type === 'Remote' ? (
                            <div className="text-center py-2">
                                <Home size={40} className="text-emerald-400 mx-auto mb-3 opacity-80" />
                                <h4 className="text-white font-bold text-lg mb-1">Home Office</h4>
                                <div className="text-emerald-400 text-sm font-medium mb-2">
                                    Úspora za home office
                                </div>
                                <div className="text-xs text-emerald-400 mb-3 text-center">
                                    <div className="flex items-center gap-1 justify-center">
                                        <span className="text-green-400">🏠</span>
                                        <div>
                                            <div>{commuteAnalysis.financialReality.avoidedCommuteCost.toLocaleString()} {cur}/měsíc</div>
                                            <div>Ušetřený čas a peníze za dojíždění.</div>
                                            <div>Ekologicky šetrnější volba.</div>
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
                    <div className="p-6 bg-slate-900/30 flex flex-col">
                        <div className="flex-1">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2"><Calculator size={12} /> {t('financial.reality_vs_income')}</h4>
                            <div className="space-y-1 text-sm font-mono">
                                {/* AI Estimation Hint */}
                                {selectedJob.aiEstimatedSalary && (
                                    <div className="text-xs text-purple-400 mb-2 flex items-center gap-1">
                                        <Sparkles size={10} />
                                        {t('financial.ai_estimation_hint')}
                                    </div>
                                )}

                                <div className="flex justify-between text-slate-300">
                                    <span>{t('financial.gross_monthly')}</span>
                                    <span>{commuteAnalysis.financialReality.grossMonthlySalary > 0 ? `${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString()} ${cur}` : (selectedJob.aiEstimatedSalary ? `${selectedJob.aiEstimatedSalary.min.toLocaleString()} - ${selectedJob.aiEstimatedSalary.max.toLocaleString()} ${selectedJob.aiEstimatedSalary.currency}` : "???")}</span>
                                </div>
                                <div className="flex justify-between text-rose-300 text-xs">
                                    <span>- {t('financial.tax_insurance')}</span>
                                    <span>{commuteAnalysis.financialReality.estimatedTaxAndInsurance.toLocaleString()} {cur}</span>
                                </div>
                                <div className="flex justify-between text-white font-bold pt-2 mt-1 border-t border-slate-700">
                                    <span>{t('financial.net_base')}</span>
                                    <span>{commuteAnalysis.financialReality.netBaseSalary.toLocaleString()} {cur}</span>
                                </div>
                                <div className="flex justify-between text-emerald-400">
                                    <span>+ {t('financial.benefit_value_label')}</span>
                                    <span>{commuteAnalysis.financialReality.benefitsValue.toLocaleString()} {cur}</span>
                                </div>
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
                                <div className="flex justify-between text-rose-400">
                                    <span>- {t('financial.commute_costs')}</span>
                                    <span>{commuteAnalysis.isRelocation ? '???' : `${commuteAnalysis.financialReality.commuteCost.toLocaleString()} ${cur}`}</span>
                                </div>
                                <div className="flex justify-between text-xl font-bold text-white pt-3 mt-3 border-t border-slate-700">
                                    <span>{t('financial.reality_summary')}</span>
                                    <span>{commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString()} {cur}</span>
                                </div>
                            </div>
                        </div>

                        {/* Information Box - How JHI and Transport are Calculated */}
                        <div className="mt-6 pt-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowFinancialMethodology(!showFinancialMethodology)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded text-slate-300 hover:bg-slate-800/50 transition-colors text-xs font-semibold"
                            >
                                <Info size={14} className="text-blue-400 flex-shrink-0" />
                                <span>{t('financial.methodology.title') || 'Jak se počítá JHI a doprava?'}</span>
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
                                            <Zap size={11} className="text-yellow-400" /> {t('financial.methodology.jhi_title') || 'JHI Impact Formula'}
                                        </div>
                                        <p className="text-slate-400">
                                            {t('financial.methodology.jhi_formula') || 'Procent změny příjmu z dopravy × 1.5 = JHI body'}
                                            <br />
                                            <span className="text-[10px]">{t('financial.methodology.jhi_example') || 'Příklad: Pokud doprava sníží příjem o 1%, JHI klesne o ~1.5 bodů'}</span>
                                        </p>
                                    </div>

                                    {/* Transport Costs */}
                                    <div>
                                        <div className="font-bold text-white mb-1 flex items-center gap-1">
                                            <Bus size={11} className="text-blue-400" /> {t('financial.methodology.transport_title') || 'Výpočet Dopravy'}
                                        </div>
                                        <div className="space-y-1 text-slate-400 text-[10px]">
                                            <div>{t('financial.methodology.transport_car') || '🚗 Auto: 5 CZK/km × 2 × 22 dnů'}</div>
                                            <div>{t('financial.methodology.transport_public') || '🚌 MHD: Město letenka (Praha 1500 Kč) - nejlevnější'}</div>
                                            <div>{t('financial.methodology.transport_bike') || '🚴 Kolo: 0.05 CZK/km × 2 × 22 dnů'}</div>
                                            <div>{t('financial.methodology.transport_walk') || '🚶 Pěšky: 0 Kč (zdarma)'}</div>
                                        </div>
                                    </div>

                                    {/* Final Calculation */}
                                    <div>
                                        <div className="font-bold text-white mb-1">{t('financial.methodology.final_title') || 'Vzorec Čisté Reality'}</div>
                                        <p className="text-slate-400 text-[10px]">
                                            {t('financial.methodology.final_formula') || 'Čistý základ + Benefity - Doprava = Reálný Příjem'}
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
