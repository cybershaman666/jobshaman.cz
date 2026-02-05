import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigation, Globe } from 'lucide-react';

const CrossBorderPromo: React.FC = () => {
    const { t } = useTranslation();
    const [activePath, setActivePath] = useState(0);
    const [activeNode, setActiveNode] = useState(0);

    // Simple animation for the "path" connecting cities
    useEffect(() => {
        const interval = setInterval(() => {
            setActivePath(prev => (prev + 1) % 2);
        }, 3000);
        return () => clearInterval(interval);
    }, []);
    useEffect(() => {
        const interval = setInterval(() => {
            setActiveNode(prev => (prev + 1) % 3); // 0: PL, 1: CZ, 2: Distance
        }, 2200);
        return () => clearInterval(interval);
    }, []);

    return (
        <section className="max-w-7xl mx-auto px-4 lg:px-8 py-16 overflow-hidden">
            <div className="relative bg-slate-900 rounded-3xl p-8 lg:p-12 overflow-hidden shadow-2xl border border-slate-800">
                {/* Background decorative map-like elements */}
                <div className="absolute inset-0 opacity-10 pointer-events-none">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5" />
                            </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#grid)" />
                    </svg>
                </div>

                {/* Content Container */}
                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

                    {/* Text Column */}
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-900/30 border border-cyan-800 mb-6 text-cyan-400">
                            <Globe size={14} />
                            <span className="text-xs font-bold uppercase tracking-wider">{t('filters.cross_border')}</span>
                        </div>

                        <h2 className="text-3xl lg:text-5xl font-bold text-white mb-6 leading-tight">
                            {t('promo.cross_border.headline')}
                        </h2>

                        <p className="text-lg text-slate-300 mb-6 leading-relaxed">
                            {t('promo.cross_border.body_1')}
                        </p>

                        <p className="text-lg text-slate-300 mb-8 leading-relaxed">
                            {t('promo.cross_border.body_2')}
                        </p>

                        <div className="flex items-center gap-4 text-cyan-400 font-bold">
                            <div className="p-2 bg-cyan-900/30 rounded-lg border border-cyan-800">
                                <Navigation className="w-6 h-6" />
                            </div>
                            <span>{t('promo.cross_border.cta')}</span>
                        </div>
                    </div>

                    {/* Graphic/Visual Column */}
                    <div className="relative h-[300px] lg:h-[400px] bg-slate-800/50 rounded-2xl border border-slate-700 p-6 flex items-center justify-center">
                        {/* Abstract Border Line */}
                        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-slate-600 border-dashed border-r border-slate-600"></div>
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-600 px-3 py-1 rounded text-xs text-slate-500 font-mono">
                            BORDER
                        </div>

                        {/* City Nodes */}
                        <div className="absolute top-1/3 left-1/4 flex flex-col items-center group">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 mb-2 z-10 transition-all duration-500 ${
                                activeNode === 0
                                    ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.6)]'
                                    : 'bg-slate-700/80 border-slate-600'
                            }`}>
                                <span className="text-xl">PL</span>
                            </div>
                            <span className={`font-bold transition-colors duration-500 ${activeNode === 0 ? 'text-white' : 'text-slate-400'}`}>Rybnik</span>
                        </div>

                        <div className="absolute bottom-1/3 right-1/4 flex flex-col items-center group">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 mb-2 z-10 transition-all duration-500 ${
                                activeNode === 1
                                    ? 'bg-cyan-900/80 border-cyan-400 shadow-[0_0_18px_rgba(6,182,212,0.6)]'
                                    : 'bg-slate-700/80 border-slate-600'
                            }`}>
                                <span className="text-xl">CZ</span>
                            </div>
                            <span className={`font-bold transition-colors duration-500 ${activeNode === 1 ? 'text-white' : 'text-slate-400'}`}>Ostrava</span>
                        </div>

                        {/* Connection Line & Animation */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                            <path
                                d="M 25% 33% Q 50% 50% 75% 66%"
                                fill="none"
                                stroke={activePath === 0 ? "#06b6d4" : "#475569"}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray="10 5"
                                className="transition-colors duration-1000"
                            />
                            {/* Moving particle */}
                            <circle r="4" fill="#fff">
                                <animateMotion
                                    dur="3s"
                                    repeatCount="indefinite"
                                    path="M 25% 33% Q 50% 50% 75% 66%"
                                />
                            </circle>
                        </svg>

                        {/* False Connection (Katowice) */}
                        <div className="absolute top-1/4 left-1/3 flex flex-col items-center opacity-40">
                            <div className="w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700 mb-2">
                            </div>
                            <span className="text-xs text-slate-500">Katowice</span>
                        </div>

                        {/* Distance Badge */}
                        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 backdrop-blur border px-4 py-2 rounded-lg text-sm font-bold shadow-xl transition-all duration-500 ${
                            activeNode === 2
                                ? 'border-cyan-400 text-cyan-300 shadow-[0_0_22px_rgba(6,182,212,0.45)]'
                                : 'border-cyan-500/30 text-cyan-400'
                        }`}>
                            35 min <span className="text-slate-500 mx-1">|</span> 28 km
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CrossBorderPromo;
