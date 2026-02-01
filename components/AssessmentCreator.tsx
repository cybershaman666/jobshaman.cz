
import React, { useState } from 'react';
import { Assessment, CompanyProfile } from '../types';
import { generateAssessment } from '../services/geminiService';

import { incrementAssessmentUsage } from '../services/supabaseService';
import { getRemainingAssessments } from '../services/billingService';
import AnalyticsService from '../services/analyticsService';
import AssessmentPreviewModal from './AssessmentPreviewModal';
import PlanUpgradeModal from './PlanUpgradeModal';
import { BrainCircuit, Loader2, Code, FileText, CheckCircle, Copy, Zap, BarChart3, Eye } from 'lucide-react';

interface AssessmentCreatorProps {
    companyProfile?: CompanyProfile | null;
}

const AssessmentCreator: React.FC<AssessmentCreatorProps> = ({ companyProfile }) => {
    const [role, setRole] = useState('');
    const [skills, setSkills] = useState('');
    const [difficulty, setDifficulty] = useState('Senior');
    const [questionCount, setQuestionCount] = useState<number>(5);
    const [isGenerating, setIsGenerating] = useState(false);
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    const handleGenerate = async () => {
        if (!role || !skills) return;

        // Check assessment limits for companies
        if (companyProfile) {
            const tier = companyProfile.subscription?.tier || 'basic';
            const used = companyProfile.subscription?.usage?.aiAssessmentsUsed || 0;
            const limit = (tier === 'enterprise' || tier === 'business' || tier === 'trial' || tier === 'assessment_bundle') ? (tier === 'enterprise' ? 999999 : 10) : 0;

            if (used >= limit) {
                alert(`Dosáhli jste limitu ${limit} assessmentů pro aktuální tarif. Upgradujte pro další assessmenty.`);
                return;
            }

            // Premium check for extended assessments
            if (questionCount > 5 && tier === 'basic') {
                setShowUpgradeModal(true);
                return;
            }
        } else {
            // Individual user logic
            if (questionCount > 5) {
                setShowUpgradeModal(true);
                return;
            }
        }

        setIsGenerating(true);
        try {
            const result = await generateAssessment(role, skills.split(','), difficulty, questionCount);
            setAssessment(result);

            // Track usage for companies
            if (companyProfile?.id) {
                await incrementAssessmentUsage(companyProfile.id);

                // Track feature usage analytics
                AnalyticsService.trackFeatureUsage({
                    companyId: companyProfile.id,
                    feature: 'ASSESSMENT_GENERATION',
                    tier: companyProfile.subscription?.tier || 'basic'
                });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsGenerating(false);
        }
    };

    // Calculate remaining assessments
    const remainingAssessments = companyProfile ? getRemainingAssessments(companyProfile) : 0;
    const tier = companyProfile?.subscription?.tier || 'basic';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in">
            {/* Usage Display */}
            {companyProfile && (
                <div className="lg:col-span-2 mb-4">
                    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-950/20 dark:to-blue-950/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg">
                                <BarChart3 size={20} />
                            </div>
                            <div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                    Zbývající Assessmenty: <span className="text-cyan-600 dark:text-cyan-400">{remainingAssessments}</span>
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                    Tarif: <span className="font-medium">
                                        {tier === 'enterprise' ? 'Enterprise' :
                                            tier === 'business' ? 'Business' :
                                                tier === 'trial' ? 'Business (Trial)' :
                                                    tier === 'assessment_bundle' ? 'Assessment Bundle' :
                                                        'Základní'}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap"
                        >
                            Další Kredit
                        </button>
                    </div>
                </div>
            )}

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
                            <button
                                onClick={() => setShowPreview(true)}
                                className="flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 bg-white dark:bg-slate-900 p-3 rounded-lg border border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                            >
                                <Eye size={16} />
                                <span>Vyzkoušet (Preview)</span>
                            </button>
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

            {showPreview && assessment && (
                <AssessmentPreviewModal
                    assessment={assessment}
                    onClose={() => setShowPreview(false)}
                />
            )}

            <PlanUpgradeModal
                isOpen={showUpgradeModal}
                onClose={() => setShowUpgradeModal(false)}
                feature="AI Assessment"
                companyProfile={companyProfile || { id: 'guest', name: 'Guest' } as any}
            />
        </div>
    );
};

export default AssessmentCreator;
