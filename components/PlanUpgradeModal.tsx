
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
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col md:flex-row">
                {/* Left Side: Feature Context */}
                <div className="md:w-1/3 bg-slate-50 dark:bg-slate-950 p-8 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-center">
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
                <div className="flex-1 p-8 bg-white dark:bg-slate-900 overflow-y-auto">
                    <h3 className="font-bold text-lg mb-6 text-slate-900 dark:text-white">Vyberte si řešení</h3>

                    <div className="grid grid-cols-1 gap-4">
                        {/* Option 1: Assessment Bundle */}
                        <div className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 transition-all cursor-pointer group relative overflow-hidden">
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                        <BrainCircuit size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Assessment Bundle</h4>
                                        <p className="text-xs text-slate-500">Jednorázový balíček</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-indigo-600 dark:text-indigo-400 text-xl">990 Kč</div>
                                    <div className="text-[10px] text-slate-400">jednorázový balíček</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300 mb-4 bg-slate-50 dark:bg-slate-950 p-3 rounded-lg">
                                <CheckCircle size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                <span><strong>10 AI Assessmentů</strong> pro vaše kandidáty. Ideální pro nárazové nábory. Neomezená platnost.</span>
                            </div>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        // Track upgrade attempt
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'ASSESSMENT_BUNDLE',
                                            currentTier: companyProfile.subscription?.tier || 'basic',
                                            reason: 'User clicked assessment bundle purchase'
                                        });
                                        
                                        // Track A/B test conversion
                                        ABTestService.trackConversion('pricing_display_test', 'assessment_bundle_clicked', 990);
                                        
                                        redirectToCheckout('assessment_bundle', companyProfile.id);
                                    }
                                }}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-colors shadow-sm"
                            >
                                Koupit Balíček
                            </button>
                        </div>

                        {/* Option 2: Business Subscription */}
                        <div className="p-4 rounded-xl border-2 border-cyan-500 bg-cyan-50/10 relative">
                            <div className="absolute -top-3 right-4 bg-cyan-600 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-widest">Doporučeno</div>
                            <div className="flex justify-between items-center mb-2">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                        <RocketIcon size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-900 dark:text-white">Business Tarif</h4>
                                        <p className="text-xs text-slate-500">Měsíční předplatné</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-black text-cyan-600 dark:text-cyan-400 text-xl">4 990 Kč</div>
                                    <div className="text-[10px] text-slate-400">/ měsíc</div>
                                    {false && (
                                        <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">Ušetřete 10% ročně</div>
                                    )}
                                </div>
                            </div>
                            <ul className="grid grid-cols-2 gap-2 mb-4">
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> Neomezené inzeráty</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> 10 Assessmentů / měs</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> AI Optimalizace</li>
                                <li className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300"><CheckCircle size={12} className="text-cyan-500" /> Prioritní podpora</li>
                            </ul>
                            <button
                                onClick={() => {
                                    if (companyProfile?.id) {
                                        // Track upgrade attempt
                                        AnalyticsService.trackUpgradeTrigger({
                                            companyId: companyProfile.id,
                                            feature: 'BUSINESS_SUBSCRIPTION',
                                            currentTier: companyProfile.subscription?.tier || 'basic',
                                            reason: 'User clicked business subscription'
                                        });
                                        
                                        // Track A/B test conversion
                                        ABTestService.trackConversion('pricing_display_test', 'business_clicked', 4990);
                                        
                                        redirectToCheckout('business', companyProfile.id);
                                    }
                                }}
                                className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors shadow-lg shadow-cyan-900/20"
                            >
                                Aktivovat Business
                            </button>
                        </div>
                    </div>

                    <button onClick={onClose} className="mt-6 text-xs text-slate-400 hover:text-slate-900 dark:hover:text-white underline w-full text-center">
                        Zavřít a pokračovat v základní verzi
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper icon
const RocketIcon = ({ size }: { size: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.1 2.75-2 2.75-2" /><path d="M12 15v5s3.03-.55 4-2c1.1-1.62 2-2.75 2-2.75" /></svg>
);

export default PlanUpgradeModal;
