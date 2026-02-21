import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseService';
import { AssessmentResult } from '../types';
import { evaluateAssessmentResult } from '../services/geminiService';
import { Sparkles, ChevronDown, ChevronUp, CheckCircle, AlertCircle, FileText, Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AssessmentPreviewModal from './AssessmentPreviewModal';

interface Props {
    companyId: string;
}

const AssessmentResultsList: React.FC<Props> = ({ companyId }) => {
    const { t } = useTranslation();
    const [results, setResults] = useState<AssessmentResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        loadResults();
    }, [companyId]);

    const loadResults = async () => {
        try {
            if (!supabase) return;
            const { data, error } = await supabase
                .from('assessment_results')
                .select('*')
                .eq('company_id', companyId)
                .order('completed_at', { ascending: false });

            if (error) throw error;
            setResults(data as AssessmentResult[]);
        } catch (e) {
            console.error("Failed to load assessment results:", e);
        } finally {
            setLoading(false);
        }
    };

    const handleAiEvaluate = async (result: AssessmentResult) => {
        setEvaluatingId(result.id);
        try {
            // 1. Prepare questions - Fetch assessment definition
            const { data: assessmentData } = await supabase!
                .from('assessments')
                .select('*')
                .eq('id', result.assessment_id)
                .single();

            const questions = assessmentData?.questions || result.answers.map(a => ({ id: a.questionId, text: `${t('assessment.results.question_fallback')} ` + a.questionId })); // Fallback

            const evaluation = await evaluateAssessmentResult(
                result.role,
                result.difficulty,
                questions,
                result.answers
            );

            // 3. Save to Supabase using RPC
            const { error: saveError } = await supabase.rpc('save_assessment_evaluation', {
                p_result_id: result.id,
                p_evaluation: evaluation
            });

            if (saveError) throw saveError;

            // 4. Update local state
            setResults(prev => prev.map(r =>
                r.id === result.id
                    ? { ...r, ai_evaluation: evaluation }
                    : r
            ));

            // Auto-expand the result to show analysis
            setExpandedId(result.id);

        } catch (e) {
            console.error("Evaluation failed:", e);
            alert(t('assessment.results.eval_failed'));
        } finally {
            setEvaluatingId(null);
        }
    };

    const [previewAssessment, setPreviewAssessment] = useState<any | null>(null);

    const handlePreview = async (result: AssessmentResult) => {
        try {
            if (!supabase) return;
            const { data: assessmentData, error } = await supabase
                .from('assessments')
                .select('*')
                .eq('id', result.assessment_id)
                .single();

            if (error) throw error;
            if (assessmentData) {
                setPreviewAssessment(assessmentData);
            }
        } catch (e) {
            console.error("Failed to load assessment for preview:", e);
            alert(t('assessment.results.preview_failed'));
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-500">{t('assessment.results.loading')}</div>;

    if (results.length === 0) return (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 mt-8">
            <FileText className="mx-auto h-12 w-12 text-slate-400 mb-2" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">{t('assessment.results.no_results_title')}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('assessment.results.no_results_desc')}</p>
        </div>
    );

    return (
        <div className="space-y-4 mt-8">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                {t('assessment.results.title')} ({results.length})
            </h3>

            <div className="grid gap-4">
                {results.map(result => (
                    <div key={result.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-all">
                        <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-bold text-slate-900 dark:text-white">{result.role}</span>
                                    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">{result.difficulty}</span>
                                </div>
                                <div className="text-sm text-slate-500 dark:text-slate-400">
                                    {t('assessment.results.score')} <span className="font-mono font-bold text-slate-900 dark:text-white">{result.score}%</span> •
                                    {new Date(result.completed_at).toLocaleDateString()}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handlePreview(result); }}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                                    title={t('assessment.results.preview_title')}
                                >
                                    <Eye size={20} />
                                </button>

                                {!result.ai_evaluation ? (
                                    <button
                                        onClick={() => handleAiEvaluate(result)}
                                        disabled={!!evaluatingId}
                                        className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors flex items-center gap-2"
                                    >
                                        {evaluatingId === result.id ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                        {evaluatingId === result.id ? t('assessment.results.evaluating') : t('assessment.results.ai_evaluate_btn')}
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wide border border-emerald-100 dark:border-emerald-800">
                                        <CheckCircle size={14} /> {t('assessment.results.evaluated')}
                                    </div>
                                )}

                                <button
                                    onClick={() => setExpandedId(expandedId === result.id ? null : result.id)}
                                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 transition-colors"
                                >
                                    {expandedId === result.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                </button>
                            </div>
                        </div>

                        {/* Expandable Content with AI Evaluation */}
                        {expandedId === result.id && (
                            <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 p-6 animate-in slide-in-from-top-2">
                                {result.ai_evaluation ? (
                                    <div className="grid md:grid-cols-2 gap-6">
                                        {/* Recommendation Box */}
                                        {result.ai_evaluation.recommendation && (
                                            <div className="md:col-span-2 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-center gap-4">
                                                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center text-white shadow-lg flex-shrink-0">
                                                    <Sparkles size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">{t('assessment.results.partner_recommendation')}</h4>
                                                    <p className="text-slate-900 dark:text-white font-bold text-lg leading-tight">
                                                        {result.ai_evaluation.recommendation}
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t('assessment.results.summary_title')}</h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed italic border-l-4 border-indigo-500 pl-4 py-1">
                                                    "{result.ai_evaluation.summary}"
                                                </p>
                                            </div>

                                            <div>
                                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">{t('assessment.results.match_score_title')}</h4>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${result.ai_evaluation.skillMatchScore >= 70 ? 'bg-emerald-500' : result.ai_evaluation.skillMatchScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                                            style={{ width: `${result.ai_evaluation.skillMatchScore}%` }}
                                                        ></div>
                                                    </div>
                                                    <span className="font-mono font-bold text-slate-900 dark:text-white">{result.ai_evaluation.skillMatchScore}/100</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                                <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                    <CheckCircle size={12} /> {t('assessment.results.pros_title')}
                                                </h4>
                                                <ul className="space-y-1">
                                                    {result.ai_evaluation.pros.map((pro, i) => (
                                                        <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                                                            <span className="mt-1 block w-1 h-1 rounded-full bg-emerald-400 flex-shrink-0"></span>
                                                            {pro}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            <div className="bg-amber-50/50 dark:bg-amber-900/10 p-3 rounded-lg border border-amber-100 dark:border-amber-900/20">
                                                <h4 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                    <AlertCircle size={12} /> {t('assessment.results.cons_title')}
                                                </h4>
                                                <ul className="space-y-1">
                                                    {result.ai_evaluation.cons.map((con, i) => (
                                                        <li key={i} className="text-xs text-slate-700 dark:text-slate-300 flex items-start gap-1.5">
                                                            <span className="mt-1 block w-1 h-1 rounded-full bg-amber-400 flex-shrink-0"></span>
                                                            {con}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-6">
                                        <p className="text-slate-500 dark:text-slate-400 mb-4 text-sm">{t('assessment.results.not_evaluated_desc')}</p>
                                        <button
                                            onClick={() => handleAiEvaluate(result)}
                                            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-500 transition-colors inline-flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                                        >
                                            <Sparkles size={18} />
                                            {t('assessment.results.run_analysis_btn')}
                                        </button>
                                    </div>
                                )}

                                {/* Show Answer Details (optional) */}
                                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">{t('assessment.results.detailed_answers')}</h4>
                                    <div className="space-y-3">
                                        {result.answers.map((ans, idx) => (
                                            <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                                                <div className="text-xs font-bold text-slate-400 mb-1">{t('assessment.results.question_label')} {idx + 1}</div>
                                                <div className="text-sm font-mono text-slate-700 dark:text-slate-300 mb-2">{ans.answer}</div>

                                                {/* Question Feedback */}
                                                {result.ai_evaluation?.questionFeedback?.find(f => f.questionId === ans.questionId)?.feedback && (
                                                    <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 p-2 rounded border border-indigo-100 dark:border-indigo-900/40 italic">
                                                        🤖 {result.ai_evaluation.questionFeedback.find(f => f.questionId === ans.questionId)?.feedback}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {previewAssessment && (
                <AssessmentPreviewModal
                    assessment={previewAssessment}
                    onClose={() => setPreviewAssessment(null)}
                />
            )}
        </div>
    );
};

export default AssessmentResultsList;
