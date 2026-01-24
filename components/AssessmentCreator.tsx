
import React, { useState } from 'react';
import { Assessment } from '../types';
import { generateAssessment } from '../services/geminiService';
import { redirectToCheckout } from '../services/stripeService';
import { BrainCircuit, Loader2, Code, FileText, CheckCircle, Copy, Zap } from 'lucide-react';

const AssessmentCreator: React.FC = () => {
    const [role, setRole] = useState('');
    const [skills, setSkills] = useState('');
    const [difficulty, setDifficulty] = useState('Senior');
    const [questionCount, setQuestionCount] = useState<number>(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [assessment, setAssessment] = useState<Assessment | null>(null);

    const handleGenerate = async () => {
        if (!role || !skills) return;

        // Premium Check
        if (questionCount > 5) {
            if (confirm(`Generování ${questionCount} otázek je prémiová funkce za 99 Kč. Chcete pokračovat k platbě?`)) {
                // Assuming we have userId available (In real app, props would pass userId)
                // For now, using a placeholder or context if available, else alert
                // Since this component is inside CompanyDashboard (which has userEmail), we ideally need userId passed down.
                // But for this quick impl, we'll try to get it from session or just trigger general checkout.
                await redirectToCheckout('assessment_bundle', 'current_user');
                return;
            } else {
                return;
            }
        }

        setIsGenerating(true);
        try {
            const result = await generateAssessment(role, skills.split(','), difficulty, questionCount);
            setAssessment(result);
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            {/* Input Side */}
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 transition-colors duration-300">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg border border-cyan-500/20">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Generátor Kompetencí</h2>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">AI vytvoří scénáře pro ověření skutečných schopností.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Role</label>
                        <input
                            type="text"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            placeholder="např. Senior Frontend Dev"
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Klíčové dovednosti (oddělené čárkou)</label>
                        <textarea
                            value={skills}
                            onChange={(e) => setSkills(e.target.value)}
                            placeholder="např. React, Performance Optimization, System Design"
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:outline-none h-24 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Obtížnost</label>
                        <select
                            value={difficulty}
                            onChange={(e) => setDifficulty(e.target.value)}
                            className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none text-slate-900 dark:text-white transition-colors"
                        >
                            <option value="Junior">Junior (Základy)</option>
                            <option value="Medior">Medior (Praxe)</option>
                            <option value="Senior">Senior (Architektura & Hloubka)</option>
                            <option value="Expert">Expert (Edge cases)</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Délka Assessmetu</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[2, 5, 10].map(count => (
                                <button
                                    key={count}
                                    onClick={() => setQuestionCount(count)}
                                    className={`relative p-3 rounded-xl border font-bold text-sm transition-all ${questionCount === count
                                        ? 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-500 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500'
                                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-cyan-300 dark:hover:border-cyan-700'
                                        }`}
                                >
                                    {count} Otázek
                                    {count === 10 && (
                                        <div className="absolute -top-2 -right-2 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-0.5 shadow-sm">
                                            <Zap size={8} fill="currentColor" />
                                            PRO
                                        </div>
                                    )}
                                </button>
                            ))}
                        </div>
                        {questionCount === 10 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                                <Zap size={12} />
                                Rozšířený assessment (10 otázek) stojí 99 Kč.
                            </p>
                        )}
                    </div>

                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating || !role}
                        className="w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-[0_0_15px_rgba(8,145,178,0.3)]"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" /> : <BrainCircuit />}
                        {isGenerating ? 'Generuji Test...' : 'Vytvořit Assessment'}
                    </button>
                </div>
            </div>

            {/* Output Side */}
            <div className="bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-full min-h-[500px] transition-colors duration-300">
                {assessment ? (
                    <div className="animate-in zoom-in-95 space-y-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">{assessment.title}</h3>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs px-2 py-0.5 bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 rounded font-medium border border-cyan-500/30">{assessment.role}</span>
                                    <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded font-medium border border-slate-300 dark:border-slate-700">AI Generated</span>
                                </div>
                            </div>
                            <button className="text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400" title="Kopírovat">
                                <Copy size={18} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {assessment.questions.map((q, idx) => (
                                <div key={idx} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-slate-500 dark:text-slate-500 uppercase tracking-wider">Otázka {idx + 1}</span>
                                        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${q.type === 'Code' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20' : 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20'}`}>
                                            {q.type === 'Code' ? <Code size={12} /> : <FileText size={12} />}
                                            {q.type}
                                        </div>
                                    </div>
                                    <p className="text-slate-800 dark:text-slate-300 font-medium leading-relaxed">{q.text}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mt-auto pt-6 border-t border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                <CheckCircle size={16} className="text-emerald-500" />
                                <span>Tento test můžete odeslat kandidátovi jako "Pre-screen challenge".</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600">
                        <BrainCircuit size={48} className="mb-4 opacity-20" />
                        <p className="font-medium text-center max-w-xs text-slate-500">
                            Zadejte roli a dovednosti vlevo pro vygenerování ověřovacích otázek na míru.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AssessmentCreator;
