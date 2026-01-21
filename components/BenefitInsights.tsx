
import React, { useState } from 'react';
import { BenefitInsight } from '../types';
import { MOCK_BENEFIT_STATS } from '../constants';
import { TrendingUp, DollarSign, Heart, Coffee, BookOpen, AlertCircle } from 'lucide-react';

const BenefitInsights: React.FC = () => {
    
    const getIcon = (category: string) => {
        switch(category) {
            case 'Financial': return <DollarSign size={14} />;
            case 'Health': return <Heart size={14} />;
            case 'Growth': return <BookOpen size={14} />;
            default: return <Coffee size={14} />;
        }
    };

    const getImpactColor = (impact: string) => {
        if (impact === 'High') return 'text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20';
        if (impact === 'Medium') return 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20';
        return 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-500/10 border-slate-200 dark:border-slate-500/20';
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors duration-300">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <TrendingUp size={16} className="text-cyan-600 dark:text-cyan-400" />
                    Market Insights: Benefity
                </h3>
            </div>
            
            <div className="p-4 bg-cyan-50 dark:bg-cyan-500/5 border-b border-cyan-100 dark:border-cyan-500/10">
                <div className="flex items-start gap-2 text-xs text-cyan-700 dark:text-cyan-300">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <p>
                        Data ukazují, že <span className="font-bold text-cyan-900 dark:text-cyan-200">Remote work</span> a <span className="font-bold text-cyan-900 dark:text-cyan-200">Flexibilita</span> mají 3x vyšší dopad na retenci než "kancelářské perky" jako ovoce nebo fotbálek.
                    </p>
                </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {MOCK_BENEFIT_STATS.sort((a,b) => b.popularityScore - a.popularityScore).map((stat, idx) => (
                    <div key={idx} className="p-4 border-b border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <h4 className="font-bold text-slate-900 dark:text-slate-200 text-sm">{stat.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                        {getIcon(stat.category)} {stat.category}
                                    </span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getImpactColor(stat.impactOnRetention)}`}>
                                        {stat.impactOnRetention === 'High' ? '🔥 High Retention' : stat.impactOnRetention === 'Medium' ? '✨ Medium Retention' : '💤 Low Retention'}
                                    </span>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400 font-mono">{stat.popularityScore}%</div>
                                <div className="text-[10px] text-slate-500">Popularita</div>
                            </div>
                        </div>

                        {/* Market Adoption Bar */}
                        <div className="mt-3">
                            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                                <span>Nabízí {stat.marketAdoption}% firem</span>
                                {stat.popularityScore > 80 && stat.marketAdoption < 20 && (
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">💎 Konkurenční výhoda</span>
                                )}
                            </div>
                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-slate-500 dark:bg-slate-600 rounded-full" 
                                    style={{ width: `${stat.marketAdoption}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default BenefitInsights;
