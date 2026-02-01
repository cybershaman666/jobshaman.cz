
import React, { useState, useEffect } from 'react';
import { Assessment, CompanyProfile, Job } from '../types';
import { generateAssessment, extractSkillsFromJob } from '../services/geminiService';

import { incrementAssessmentUsage } from '../services/supabaseService';
import { getRemainingAssessments } from '../services/billingService';
import AnalyticsService from '../services/analyticsService';
import AssessmentPreviewModal from './AssessmentPreviewModal';
import PlanUpgradeModal from './PlanUpgradeModal';
import { BrainCircuit, Loader2, Code, FileText, CheckCircle, Copy, BarChart3, Eye, Sparkles } from 'lucide-react';

interface AssessmentCreatorProps {
    companyProfile?: CompanyProfile | null;
    jobs?: Job[];
    initialJobId?: string;
}

const AssessmentCreator: React.FC<AssessmentCreatorProps> = ({ companyProfile, jobs = [], initialJobId }) => {
    const [role, setRole] = useState('');
    const [skills, setSkills] = useState('');
    const [difficulty, setDifficulty] = useState('Senior');
    const [isGenerating, setIsGenerating] = useState(false);
    const [assessment, setAssessment] = useState<Assessment | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);
    const [selectedJobId, setSelectedJobId] = useState(initialJobId || '');
    const [isExtracting, setIsExtracting] = useState(false);

    // React to initialJobId prop changes
    useEffect(() => {
        if (initialJobId) {
            handleJobSelect(initialJobId);
        }
    }, [initialJobId]);

    // Auto-fill when job is selected
    const handleJobSelect = async (jobId: string) => {
        setSelectedJobId(jobId);
        const job = jobs.find(j => j.id === jobId);
        if (job) {
            setRole(job.title);
            if (job.required_skills && job.required_skills.length > 0) {
                setSkills(job.required_skills.join(', '));
            } else {
                // Try to extract skills from description
                setIsExtracting(true);
                try {
                    const extracted = await extractSkillsFromJob(job.title, job.description);
                    if (extracted.length > 0) {
                        setSkills(extracted.join(', '));
                    } else {
                        setSkills('');
                    }
                } catch (e) {
                    setSkills('');
                } finally {
                    setIsExtracting(false);
                }
            }
        }
    };

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
        }

        setIsGenerating(true);
        try {
            const result = await generateAssessment(role, skills.split(','), difficulty);
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
                    {jobs.length > 0 && (
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-200 dark:border-indigo-800 rounded-xl mb-2">
                            <label className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Sparkles size={12} /> Automaticky z inzerátu
                            </label>
                            <select
                                value={selectedJobId}
                                onChange={(e) => handleJobSelect(e.target.value)}
                                className="w-full bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg p-2 text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">-- Vyberte aktivní inzerát --</option>
                                {jobs.map(job => (
                                    <option key={job.id} value={job.id}>{job.title}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-500 mt-2">
                                Výběrem inzerátu AI automaticky doplní roli a klíčové dovednosti.
                            </p>
                        </div>
                    )}

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
                        {isExtracting && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-indigo-500 italic">
                                <Loader2 size={12} className="animate-spin" />
                                Analyzuji inzerát a vytahuji dovednosti...
                            </div>
                        )}
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
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">Struktura Assessmentu</label>
                        <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50 rounded-xl space-y-3">
                            <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                                <Sparkles size={16} className="text-amber-500" />
                                🏗️ Komplexní Digitální AC
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-indigo-500 border border-indigo-100 dark:border-indigo-800">1</div>
                                    <span><b>Odborný "Quick-fire"</b> (5-8 úloh) - znalost postupů, nástrojů a norem.</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-indigo-500 border border-indigo-100 dark:border-indigo-800">2</div>
                                    <span><b>Situační úkoly (SJT)</b> (2-3 scénáře) - chování v reálných situacích.</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-indigo-500 border border-indigo-100 dark:border-indigo-800">3</div>
                                    <span><b>Praktická Case Study</b> (1 úkol) - reálná ukázka práce na míru pozici.</span>
                                </div>
                                <div className="flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                                    <div className="min-w-[18px] h-[18px] bg-white dark:bg-slate-800 rounded flex items-center justify-center font-bold text-indigo-500 border border-indigo-100 dark:border-indigo-800">4</div>
                                    <span><b>Logika & Analýza</b> (1-2 úlohy) - prioritizace a interpretace dat.</span>
                                </div>
                            </div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 italic px-1">
                            Složení se automaticky přizpůsobí charakteru pozice (od chirurga po plánovače výroby).
                        </p>
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
