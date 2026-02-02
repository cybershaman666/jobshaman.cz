import React from 'react';
import { Briefcase, BrainCircuit, Sparkles, Crown, CheckCircle } from 'lucide-react';
import { CompanyProfile } from '../types';
import { redirectToCheckout } from '../services/stripeService';
import AnalyticsService from '../services/analyticsService';
import ABTestService from '../services/abTestService';

interface PlanUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    feature?: string;
    companyProfile: CompanyProfile;
}

const PlanUpgradeModal: React.FC<PlanUpgradeModalProps> = ({ isOpen, onClose, feature, companyProfile }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                onClick={onClose}
            ></div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">
                {/* Left Side: Feature Context */}
                <div className="md:w-1/3 bg-slate-50 dark:bg-slate-950 p-8 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center md:overflow-y-auto">
                    <div className="w-16 h-16 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mb-6">
                        <Crown size={32} />
                    </div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Prémiové Funkce</h2>
                    <p className="text-slate-500 dark:text-slate-400 mb-6 leading-relaxed text-sm">
                        Funkce <span className="font-bold text-cyan-600 dark:text-cyan-400">"{feature}"</span> vyžaduje vyšší tarif nebo kredit.
                    </p>
                    <div className="space-y-3">
                        {[
                            { icon: Briefcase, text: 'Neomezený počet inzerátů' },
                            { icon: BrainCircuit, text: 'AI Assessmenty' },
                            { icon: Sparkles, text: 'AI Optimalizace inzerátů' },
                        ].map((f, i) => (
                            <div key={i} className="flex items-center gap-3">
                                <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-lg">
                                    <f.icon size={14} />
                                </div>
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{f.text}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Options */}
                <div className="flex-1 p-8 bg-white dark:bg-slate-900 overflow-y-auto max-h-[90vh] md:max-h-full">
                    <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Vyberte si řešení</h3>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Option 1: Basic Plan (Free) */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                                        <Briefcase size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Základní Plán</h4>
                                        <p className="text-xs text-slate-500">Ideální start</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-green-600 dark:text-green-400 text-xl">ZDARMA</div>
                                    <div className="text-[10px] text-slate-400">navždy</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-green-500" /> 3 inzeráty / měsíc</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-green-500" /> Základní dashboard</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 inline-block"></span> Bez AI funkcí</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-500"><span className="w-3 h-3 inline-block"></span> Bez assessmentů</li>
                            </ul>
                            <button
                                onClick={onClose}
                                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors shadow-sm"
                            >
                                Používat Zdarma
                            </button>
                        </div>

                        {/* Option 2: Business Plan */}
                        <div className="p-4 rounded-xl border-2 border-cyan-500 bg-cyan-50/10 relative">
                            <div className="absolute -top-3 right-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Doporučeno</div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                        <Crown size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Business Plán</h4>
                                        <p className="text-xs text-slate-500">Pro rostoucí firmy</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-cyan-600 dark:text-cyan-400 text-xl">4 990 Kč</div>
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">/ měsíc (akce)</div>
                                    <div className="text-[9px] text-slate-400 line-through">běžně 9 990 Kč</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> Neomezené inzeráty</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> AI Optimalizace</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> 10 Assessmentů / měsíc</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> Pokročilá analytics</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> Team management</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> Prioritní podpora</li>
                            </ul>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'BUSINESS_COMPANY_PLAN',
                                            currentTier: companyProfile.subscription?.tier || 'basic',
                                            reason: 'User clicked business company plan'
                                        });

                                        ABTestService.trackConversion('pricing_display_test', 'business_clicked', 4990);
                                        redirectToCheckout('business', companyProfile.id);
                                    } else {
                                        console.error('❌ Company ID missing in profile!');
                                        alert('Chyba: Nepodařilo se načíst ID společnosti. Zkuste obnovit stránku.');
                                    }
                                }}
                                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                            >
                                Aktivovat Business
                            </button>
                        </div>

                        {/* Option 3: Assessment Add-ons */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-cyan-500 dark:hover:border-cyan-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Assessment Center</h4>
                                        <p className="text-xs text-slate-500">Doplněk k jakémukoli plánu</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {/* Single Assessment */}
                                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
                                    <div>
                                        <div className="font-bold text-sm text-slate-900 dark:text-white">1 Assessment</div>
                                        <div className="text-xs text-slate-500">Jednorázový nákup</div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!companyProfile?.id) {
                                                console.error('❌ Company ID missing!', companyProfile);
                                                alert('Chyba: Nepodařilo se identifikovat společnost. Zkuste obnovit stránku.');
                                                return;
                                            }

                                            AnalyticsService.trackUpgradeTrigger({
                                                companyId: companyProfile.id,
                                                feature: 'SINGLE_ASSESSMENT',
                                                currentTier: companyProfile.subscription?.tier || 'basic',
                                                reason: 'User clicked single assessment'
                                            });

                                            ABTestService.trackConversion('pricing_display_test', 'single_assessment_clicked', 99);

                                            try {
                                                await redirectToCheckout('single_assessment', companyProfile.id);
                                            } catch (err) {
                                                console.error('❌ Error during checkout redirect:', err);
                                                alert('Nepodařilo se zahájit platbu: ' + (err instanceof Error ? err.message : String(err)));
                                            }
                                        }}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-sm transition-colors"
                                    >
                                        99 Kč
                                    </button>
                                </div>

                                {/* Assessment Bundle */}
                                <div className="flex justify-between items-center p-3 bg-cyan-50 dark:bg-cyan-950/20 rounded-lg border-2 border-cyan-200 dark:border-cyan-800">
                                    <div>
                                        <div className="font-bold text-sm text-slate-900 dark:text-white">10 Assessmentů</div>
                                        <div className="text-xs text-slate-500">Platnost 12 měsíců</div>
                                    </div>
                                    <button
                                        onClick={async () => {
                                            if (!companyProfile?.id) {
                                                console.error('❌ Company ID missing!', companyProfile);
                                                alert('Chyba: Nepodařilo se identifikovat společnost. Zkuste obnovit stránku.');
                                                return;
                                            }

                                            try {
                                                AnalyticsService.trackUpgradeTrigger({
                                                    companyId: companyProfile.id,
                                                    feature: 'ASSESSMENT_BUNDLE_10',
                                                    currentTier: companyProfile.subscription?.tier || 'basic',
                                                    reason: 'User clicked 10 assessment bundle'
                                                });

                                                ABTestService.trackConversion('pricing_display_test', 'assessment_bundle_10_clicked', 990);

                                                await redirectToCheckout('assessment_bundle', companyProfile.id);
                                            } catch (err) {
                                                console.error('❌ Error during checkout redirect:', err);
                                                alert('Nepodařilo se zahájit platbu: ' + (err instanceof Error ? err.message : String(err)));
                                            }
                                        }}
                                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-sm transition-colors shadow-sm"
                                    >
                                        990 Kč
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Option 4: Enterprise Plan */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-amber-500 dark:hover:border-amber-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-lg">
                                        <Crown size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Individuální Plán</h4>
                                        <p className="text-xs text-slate-500">Pro velké společnosti</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-amber-600 dark:text-amber-400 text-xl">Na míru</div>
                                    <div className="text-[10px] text-slate-400">individuální cenotvorba</div>
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> Všechny funkce Premium</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> Vlastní integrace</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> Dedicated support</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> API přístup</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> SLA garance</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-amber-500" /> Trénink na míru</li>
                            </ul>
                            <button
                                onClick={() => {
                                    AnalyticsService.trackUpgradeTrigger({
                                        companyId: companyProfile?.id || 'unknown',
                                        feature: 'ENTERPRISE_PLAN',
                                        currentTier: companyProfile?.subscription?.tier || 'basic',
                                        reason: 'User clicked enterprise plan'
                                    });
                                    window.open('mailto:obchod@jobshaman.cz?subject=Poptávka individuálního plánu&body=Dobrý den,%0D%0A%0D%0Amám zájem o individuální plán pro naši společnost.%0D%0A%0D%0AS pozdravem,', '_blank');
                                }}
                                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg transition-colors shadow-sm"
                            >
                                Kontaktovat Obchod
                            </button>
                        </div>
                    </div>

                    <button onClick={onClose} className="mt-6 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white underline w-full text-center">
                        Zavřít a pokračovat v základní verzi
                    </button>
                </div>
            </div>
        </div >
    );
};

export default PlanUpgradeModal;