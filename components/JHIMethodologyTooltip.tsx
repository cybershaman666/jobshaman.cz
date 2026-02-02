import React from 'react';
import { Info, X, Shield, Clock, Brain, BarChart3, Target, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';

interface JHIMethodologyTooltipProps {
}

const JHIMethodologyTooltip: React.FC<JHIMethodologyTooltipProps> = () => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = React.useState(false);

    const pillars = [
        {
            id: 'financial',
            icon: <BarChart3 className="text-cyan-600 dark:text-cyan-400" size={18} />,
            weight: '30%',
            title: t('jhi.methodology.financial_title', 'Finanční Realita'),
            desc: t('jhi.methodology.financial_desc', 'Mzda, bonusy, transparentnost a rozptyl nabídek.')
        },
        {
            id: 'time',
            icon: <Clock className="text-emerald-600 dark:text-emerald-400" size={18} />,
            weight: '25%',
            title: t('jhi.methodology.time_title', 'Časová Dotace'),
            desc: t('jhi.methodology.time_desc', 'Typ úvazku, remote, hybrid a čas ztracený dojížděním.')
        },
        {
            id: 'mental',
            icon: <Shield className="text-purple-600 dark:text-purple-400" size={18} />,
            weight: '20%',
            title: t('jhi.methodology.mental_title', 'Duševní Pohoda'),
            desc: t('jhi.methodology.mental_desc', 'Toxicita inzerátu, stresové faktory a péče o zdraví.')
        },
        {
            id: 'growth',
            icon: <Zap className="text-amber-600 dark:text-amber-400" size={18} />,
            weight: '15%',
            title: t('jhi.methodology.growth_title', 'Možnost Růstu'),
            desc: t('jhi.methodology.growth_desc', 'Vzdělávací budgety, mentoring a kariérní vize.')
        },
        {
            id: 'values',
            icon: <Target className="text-rose-600 dark:text-rose-400" size={18} />,
            weight: '10%',
            title: t('jhi.methodology.values_title', 'Soulad s Hodnotami'),
            desc: t('jhi.methodology.values_desc', 'Osobní shoda s kulturou a smyslem práce.')
        }
    ];

    return (
        <div className="relative inline-block ml-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-1 rounded-full text-slate-400 hover:text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-all outline-none"
                title={t('jhi.methodology.info_button', 'Jak se to počítá?')}
            >
                <Info size={16} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {/* Backdrop for mobile */}
                        <div
                            className="fixed inset-0 z-[110] lg:hidden bg-slate-950/20 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className={`absolute right-0 top-full mt-3 w-80 z-[120] bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 overflow-hidden`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 bg-cyan-100 dark:bg-cyan-950 rounded-lg">
                                        <Brain className="text-cyan-600 dark:text-cyan-400" size={18} />
                                    </div>
                                    <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-wider text-xs">
                                        {t('jhi.methodology.title', "Shamanova Formule V1.0")}
                                    </h3>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {pillars.map((pillar) => (
                                    <div key={pillar.id} className="group">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                {pillar.icon}
                                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{pillar.title}</span>
                                            </div>
                                            <span className="text-[10px] font-black py-0.5 px-1.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-950 group-hover:text-cyan-600 transition-colors">
                                                {pillar.weight}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed pl-6">
                                            {pillar.desc}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                                <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20">
                                    <Zap className="text-red-500 flex-shrink-0" size={14} />
                                    <p className="text-[10px] text-red-600 dark:text-red-400 font-medium leading-normal">
                                        <span className="font-black uppercase">{t('jhi.methodology.penalty_label', 'Kritická penalizace:')}</span>
                                        <br />
                                        {t('jhi.methodology.penalty_desc', 'Pokud jakýkoliv pilíř klesne pod 20 bodů, celkové JHI se propadá o 30% (Anti-BS ochrana).')}
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
};

export default JHIMethodologyTooltip;
