import React from 'react';
import {
    Sparkles,
    Zap,
    Info,
    Activity,
    ThumbsUp,
    Wallet,
    ShieldCheck,
    Dog,
    AlertTriangle,
} from 'lucide-react';
import { JHI } from '../types';
import JHIChart from './JHIChart';
import { useTranslation } from 'react-i18next';

interface WelcomeGuideProps {
    theme: 'light' | 'dark';
}

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ theme }) => {
    const { t } = useTranslation();
    const demoJHI: JHI = {
        score: 70,
        baseScore: 70,
        personalizedScore: 70,
        financial: 75,
        timeCost: 65,
        mentalLoad: 70,
        growth: 75,
        values: 60,
        explanations: ['Demo score']
    };

    return (
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
                <div className="my-auto w-full max-w-5xl">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-6 border border-slate-300/50 dark:border-slate-700">
                            <Sparkles size={12} />
                            {t('welcome.next_gen_tag')}
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-black dark:text-white mb-6 tracking-tight">
                            {t('welcome.title_main')} <span className="text-cyan-600 dark:text-cyan-400">{t('welcome.title_accent')}</span>
                        </h1>
                        <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
                            {t('welcome.subtitle')}
                        </p>
                    </div>
                    {/* Demo components here */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Zap size={24} className="text-emerald-500" />
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('welcome.jhi_score')}</h3>
                                </div>
                                <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                    {t('welcome.how_it_works')} <Info size={14} />
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-8">
                                <div className="h-56 w-full sm:w-1/2">
                                    <JHIChart jhi={demoJHI} theme={theme} />
                                </div>
                                <div className="flex-1 flex flex-col justify-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                                    <p className="leading-relaxed">{t('welcome.jhi_desc')}</p>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded">{t('welcome.finance_stat')}</span>
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded">{t('welcome.growth_stat')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* More visual components */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Activity size={24} className="text-rose-500" />
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">{t('welcome.signal_noise')}</h3>
                                    <span className="text-xs text-slate-400">{t('welcome.cliche_detector')}</span>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                        <span>{t('welcome.cliche_detector')}</span>
                                        <span className="text-emerald-500"><ThumbsUp size={12} className="inline mr-1" /> {t('welcome.clean_signal')}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full w-[15%]"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <span className="text-slate-500">{t('welcome.cliche_tone')}</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{t('welcome.tone_professional')}</span>
                                </div>
                                <p className="text-xs text-slate-400 italic">
                                    {t('welcome.cliche_desc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                <Wallet size={20} className="text-indigo-500" /> {t('financial.reality_title')}
                            </h3>
                            <div className="space-y-3 text-sm font-mono">
                                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>{t('financial.gross_wage')}</span><span>100 000 Kč</span></div>
                                <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- {t('financial.tax_insurance')}</span><span>23 000 Kč</span></div>
                                <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- {t('financial.commute_costs')}</span><span>2 500 Kč</span></div>
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 text-lg"><span>{t('financial.net_income')}</span><span>74 500 Kč</span></div>
                            </div>
                            <p className="text-xs text-slate-400 mt-4">{t('financial.calculation_hint')}</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                <ShieldCheck size={20} className="text-amber-500" /> {t('welcome.transparency_title')}
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase mb-1">{t('welcome.fluctuation')}</div>
                                    <div className="text-emerald-500 font-bold text-xl">{t('welcome.fluctuation_val')}</div>
                                </div>
                                <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase mb-1">{t('welcome.ghosting')}</div>
                                    <div className="text-amber-500 font-bold text-xl">{t('welcome.ghosting_val')}</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                                {t('welcome.transparency_desc')}
                            </p>

                            {/* EU Transparent Badge Explanation */}
                            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-4 h-4 bg-emerald-600 dark:bg-emerald-500 rounded flex items-center justify-center">
                                            <span className="text-white text-[10px] font-bold">€</span>
                                        </div>
                                        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">{t('welcome.eu_transparent_title')}</h4>
                                    </div>
                                </div>
                                <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300 mt-2">
                                    {t('welcome.eu_transparent_desc')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Benefit Validation Example */}
                    <div className="mt-16 bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
                                <AlertTriangle size={20} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{t('welcome.benefit_validation_title')}</h3>
                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{t('welcome.ai_analysis_label')}</span>
                        </div>

                        <div className="space-y-6">
                            <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-r-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Dog size={16} className="text-amber-600 dark:text-amber-400" />
                                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200">{t('welcome.case_study')}</span>
                                </div>
                                <div className="text-slate-700 dark:text-slate-300 text-sm">
                                    <p className="font-medium mb-2">{t('welcome.remote_job_example')}</p>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-200 dark:border-amber-700">
                                        <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">{t('welcome.not_applicable')} (1)</div>
                                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                            <span>•</span>
                                            <span className="font-medium">{t('welcome.dog_friendly_office')}</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 italic leading-relaxed">
                                            {t('welcome.dog_joke')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ThumbsUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                                        <span className="font-bold text-emerald-800 dark:text-emerald-200">{t('welcome.relevant_benefits')}</span>
                                    </div>
                                    <ul className="text-emerald-700 dark:text-emerald-300 space-y-1 text-xs">
                                        <li>• {t('welcome.flexible_hours')}</li>
                                        <li>• {t('welcome.ho_equipment')}</li>
                                        <li>• {t('welcome.virtual_teambuilding')}</li>
                                    </ul>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg border border-rose-200 dark:border-rose-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                                        <span className="font-bold text-rose-800 dark:text-rose-200">{t('welcome.warning_signals')}</span>
                                    </div>
                                    <ul className="text-rose-700 dark:text-rose-300 space-y-1 text-xs">
                                        <li>• {t('welcome.office_dog_remote')}</li>
                                        <li>• {t('welcome.great_atmosphere')}</li>
                                        <li>• {t('welcome.canteen')}</li>
                                    </ul>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {t('welcome.ai_analysis_desc')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


export default WelcomeGuide;
