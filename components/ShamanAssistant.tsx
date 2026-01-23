import React from 'react';
import { Sparkles } from 'lucide-react';

interface ShamanAssistantProps {
    isShamanThinking: boolean;
    shamanAdvice: {
        reasoning: string;
        matchScore: number;
        seniorityLabel: string;
        salaryImpact?: string;
        missingSkills: string[];
    } | null;
}

const ShamanAssistant: React.FC<ShamanAssistantProps> = ({ isShamanThinking, shamanAdvice }) => {
    return (
        <>
            {/* Shaman Advice - Thinking State */}
            {isShamanThinking && (
                <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-4 z-50">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-cyan-500 animate-pulse" />
                        <span className="text-sm text-slate-600 dark:text-slate-400">Shaman přemýšlí...</span>
                    </div>
                </div>
            )}

            {/* Shaman Advice - Result State */}
            {shamanAdvice && !isShamanThinking && (
                <div className="fixed bottom-4 right-4 max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-4 z-50 animate-in slide-in-from-bottom-4">
                    <h4 className="font-semibold text-slate-900 dark:text-white mb-2">Shaman Rada</h4>
                    <p className="text-sm text-slate-600 dark:text-slate-400">{shamanAdvice.reasoning}</p>
                    <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">Shoda:</span>
                                <span className="ml-1 font-bold text-cyan-600 dark:text-cyan-400">{shamanAdvice.matchScore}%</span>
                            </div>
                            <div>
                                <span className="font-medium text-slate-700 dark:text-slate-300">Seniorita:</span>
                                <span className="ml-1 font-bold text-cyan-600 dark:text-cyan-400">{shamanAdvice.seniorityLabel}</span>
                            </div>
                            {shamanAdvice.salaryImpact && (
                                <div className="col-span-2">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Potenciál růstu:</span>
                                    <span className="ml-1 font-bold text-emerald-600 dark:text-emerald-400">{shamanAdvice.salaryImpact}</span>
                                </div>
                            )}
                            {shamanAdvice.missingSkills.length > 0 && (
                                <div className="col-span-2">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Chybějící dovednosti:</span>
                                    <span className="ml-1 text-rose-600 dark:text-rose-400">{shamanAdvice.missingSkills.join(', ')}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default ShamanAssistant;
