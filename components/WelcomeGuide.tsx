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

interface WelcomeGuideProps {
    theme: 'light' | 'dark';
}

const WelcomeGuide: React.FC<WelcomeGuideProps> = ({ theme }) => {
    const demoJHI: JHI = { score: 70, financial: 75, timeCost: 65, mentalLoad: 70, growth: 75, values: 60 };

    return (
        <div className="h-full flex flex-col overflow-y-auto custom-scrollbar relative w-full bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="relative z-10 flex-1 flex flex-col items-center justify-start p-8 lg:p-16 w-full">
                <div className="my-auto w-full max-w-5xl">
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-200/50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold mb-6 border border-slate-300/50 dark:border-slate-700">
                            <Sparkles size={12} />
                            Next-Gen Hiring Intelligence
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6 tracking-tight">
                            Profesionální <span className="text-cyan-600 dark:text-cyan-400">Analýza Nabídek</span>
                        </h1>
                        <p className="text-slate-600 dark:text-slate-300 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
                            JobShaman dekóduje realitu za korporátními inzeráty. Počítáme skutečný čistý příjem, filtrujeme "balast" a kvantifikujeme štěstí v práci pomocí ověřených metrik.
                        </p>
                    </div>
                    {/* Demo components here */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left mb-12">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Zap size={24} className="text-emerald-500" />
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">JHI Skóre</h3>
                                </div>
                                <button className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                                    Jak to počítáme? <Info size={14} />
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-8">
                                <div className="h-56 w-full sm:w-1/2">
                                    <JHIChart jhi={demoJHI} theme={theme} />
                                </div>
                                <div className="flex-1 flex flex-col justify-center gap-4 text-sm text-slate-600 dark:text-slate-300">
                                    <p className="leading-relaxed">Kompozitní metrika (0-100) hodnotící nabídku holisticky: peníze, čas, stres a růst.</p>
                                    <div className="flex gap-2">
                                        <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded">Finance 90%</span>
                                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-bold rounded">Růst 70%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        {/* More visual components */}
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800 relative">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-2">
                                    <Activity size={24} className="text-rose-500" />
                                    <h3 className="text-slate-900 dark:text-white font-bold text-lg">Signál vs. Šum</h3>
                                    <span className="text-xs text-slate-400">AI Detektor Klišé</span>
                                </div>
                            </div>
                            <div className="space-y-6">
                                <div>
                                    <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-slate-500 mb-2">
                                        <span>Detektor Klišé</span>
                                        <span className="text-emerald-500"><ThumbsUp size={12} className="inline mr-1" /> Čistý signál</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full w-[15%]"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
                                    <span className="text-slate-500">Detekovaný tón</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">Professional</span>
                                </div>
                                <p className="text-xs text-slate-400 italic">
                                    Automatická detekce klišé ("Jsme jako rodina") a varovných signálů ("Odolnost vůči stresu").
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                <Wallet size={20} className="text-indigo-500" /> Finanční Realita
                            </h3>
                            <div className="space-y-3 text-sm font-mono">
                                <div className="flex justify-between text-slate-500 dark:text-slate-400"><span>Hrubá mzda</span><span>100 000 Kč</span></div>
                                <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- Daně & Pojištění</span><span>23 000 Kč</span></div>
                                <div className="flex justify-between text-rose-600 dark:text-rose-400 border-l-2 border-rose-600 dark:border-rose-400 pl-3"><span>- Náklady na cestu</span><span>2 500 Kč</span></div>
                                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-100 dark:border-slate-800 pt-3 mt-3 text-lg"><span>Skutečný čistý příjem</span><span>74 500 Kč</span></div>
                            </div>
                            <p className="text-xs text-slate-400 mt-4">*Kalkulace zahrnuje hodnotu benefitů a náklady na dojíždění z vaší adresy.</p>
                        </div>

                        <div className="bg-white dark:bg-slate-900 rounded-xl p-8 shadow-sm border border-slate-200 dark:border-slate-800">
                            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4 text-lg">
                                <ShieldCheck size={20} className="text-amber-500" /> Transparentnost
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase mb-1">Fluktuace</div>
                                    <div className="text-emerald-500 font-bold text-xl">8% / rok</div>
                                </div>
                                <div className="text-center p-4 border border-slate-100 dark:border-slate-800 rounded-lg">
                                    <div className="text-xs text-slate-500 uppercase mb-1">Ghosting</div>
                                    <div className="text-amber-500 font-bold text-xl">15%</div>
                                </div>
                            </div>
                            <p className="text-xs text-slate-500 mt-4 leading-relaxed">
                                Zobrazujeme průměrnou délku úvazku a pravděpodobnost, že se vám ozvou zpět. Data, která HR tají.
                            </p>

                            {/* EU Transparent Badge Explanation */}
                            <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <div className="w-4 h-4 bg-emerald-600 dark:bg-emerald-500 rounded flex items-center justify-center">
                                            <span className="text-white text-[10px] font-bold">€</span>
                                        </div>
                                        <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400">Proč vidíte EU Transparent odznak?</h4>
                                    </div>
                                </div>
                                <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300 mt-2">
                                    Od června 2026 bude uvádění platového rozmezí v EU povinné.
                                    My v JobShamanu věříme, že váš čas má svou cenu už dnes.
                                    Firmy s tímto označením hrají fér a otevřeně ukazují odměnu jako první.
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
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Kontextová Validace Benefitů</h3>
                            <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">AI Rozbor</span>
                        </div>

                        <div className="space-y-6">
                            <div className="border-l-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20 p-4 rounded-r-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <Dog size={16} className="text-amber-600 dark:text-amber-400" />
                                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200">Příklad z praxe</span>
                                </div>
                                <div className="text-slate-700 dark:text-slate-300 text-sm">
                                    <p className="font-medium mb-2">Vzdálená práce • 100% remote • Možnost home office</p>
                                    <div className="bg-white dark:bg-slate-800 p-3 rounded border border-amber-200 dark:border-amber-700">
                                        <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2">Neaplikovatelné (1)</div>
                                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                            <span>•</span>
                                            <span className="font-medium">dog-friendly office</span>
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-3 italic leading-relaxed">
                                            Firma sice nabízí dog-friendly office, ale jelikož budete pracovat z obýváku, doporučujeme probrat s vaším psem, jestli s vaší celodenní přítomností u něj doma souhlasí.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="bg-emerald-50 dark:bg-emerald-950/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ThumbsUp size={16} className="text-emerald-600 dark:text-emerald-400" />
                                        <span className="font-bold text-emerald-800 dark:text-emerald-200">Relevantní benefity</span>
                                    </div>
                                    <ul className="text-emerald-700 dark:text-emerald-300 space-y-1 text-xs">
                                        <li>• Flexibilní pracovní doba</li>
                                        <li>• Příspěvek na home office vybavení</li>
                                        <li>• Virtualní teambuildingy</li>
                                    </ul>
                                </div>
                                <div className="bg-rose-50 dark:bg-rose-950/20 p-4 rounded-lg border border-rose-200 dark:border-rose-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400" />
                                        <span className="font-bold text-rose-800 dark:text-rose-200">Varovné signály</span>
                                    </div>
                                    <ul className="text-rose-700 dark:text-rose-300 space-y-1 text-xs">
                                        <li>• "Kancelářský pes" při remote práci</li>
                                        <li>• "Skvělá atmoséra v kanceláři"</li>
                                        <li>• "Obědy v firemní kantýně"</li>
                                    </ul>
                                </div>
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                Naše AI analyzuje relevantnost benefitů v kontextu pracovních podmínek. 
                                Odhalíme nesrovnalosti a ušetříme čas čtením mezi řádky.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeGuide;
