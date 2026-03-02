import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseService';
import { AssessmentResult } from '../types';
import { evaluateAssessmentResult } from '../services/geminiService';
import { FileText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { openAssessmentPreviewPage } from '../services/assessmentPreviewNavigation';
import AssessmentResultCard from './AssessmentResultCard';

interface Props {
    companyId: string;
    jobTitleFilter?: string;
    candidateEmailFilter?: string;
    applicationIdFilter?: string;
}

const AssessmentResultsList: React.FC<Props> = ({ companyId, jobTitleFilter, candidateEmailFilter, applicationIdFilter }) => {
    const { t } = useTranslation();
    const [results, setResults] = useState<AssessmentResult[]>([]);
    const [invitationContextById, setInvitationContextById] = useState<Record<string, { candidate_email?: string; metadata?: Record<string, any> | null }>>({});
    const [loading, setLoading] = useState(true);
    const [evaluatingId, setEvaluatingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const normalizeAnswers = (raw: any, feedbackRaw?: string): Array<{ questionId: string; answer: string }> => {
        const feedbackPayload = (() => {
            if (!feedbackRaw) return null;
            try {
                return JSON.parse(feedbackRaw);
            } catch {
                return null;
            }
        })();
        const mergedRaw = raw ?? feedbackPayload?.assessment_payload ?? feedbackPayload?.answers ?? null;

        if (Array.isArray(mergedRaw)) {
            return mergedRaw.map((item, idx) => ({
                questionId: String(item?.questionId || `q_${idx + 1}`),
                answer: String(item?.answer || ''),
            }));
        }
        if (mergedRaw && typeof mergedRaw === 'object' && mergedRaw.technical && typeof mergedRaw.technical === 'object') {
            return Object.entries(mergedRaw.technical).map(([questionId, answer]) => ({
                questionId,
                answer: String(answer || ''),
            }));
        }
        return [];
    };

    const extractJourneyPayload = (raw: any, feedbackRaw?: string): any => {
        const feedbackPayload = (() => {
            if (!feedbackRaw) return null;
            try {
                return JSON.parse(feedbackRaw);
            } catch {
                return null;
            }
        })();
        if (raw && typeof raw === 'object' && raw.decision_pattern) return raw;
        const embedded = feedbackPayload?.assessment_payload;
        if (embedded && typeof embedded === 'object' && embedded.decision_pattern) return embedded;
        return null;
    };

    const mapQualityFlag = (flag: string): string => {
        if (flag === 'short_answer') return t('assessment.results.quality_flag_short_answer', { defaultValue: 'Krátké odpovědi' });
        if (flag === 'low_specificity') return t('assessment.results.quality_flag_low_specificity', { defaultValue: 'Nízká konkrétnost' });
        if (flag === 'high_uncertainty') return t('assessment.results.quality_flag_high_uncertainty', { defaultValue: 'Vyšší nejistota v odpovědích' });
        if (flag === 'style_shift') return t('assessment.results.quality_flag_style_shift', { defaultValue: 'Posun stylu mezi checkpointy' });
        return flag;
    };

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
            const nextResults = data as AssessmentResult[];
            setResults(nextResults);

            const invitationIds = nextResults
                .map((row) => row.invitation_id)
                .filter((value): value is string => Boolean(value));

            if (invitationIds.length > 0) {
                const { data: invitationRows, error: invitationError } = await supabase
                    .from('assessment_invitations')
                    .select('id,candidate_email,metadata')
                    .in('id', invitationIds);

                if (invitationError) throw invitationError;

                const nextContext = (invitationRows || []).reduce((acc: Record<string, { candidate_email?: string; metadata?: Record<string, any> | null }>, row: any) => {
                    acc[String(row.id)] = {
                        candidate_email: row?.candidate_email || undefined,
                        metadata: (row?.metadata && typeof row.metadata === 'object') ? row.metadata : null
                    };
                    return acc;
                }, {});
                setInvitationContextById(nextContext);
            } else {
                setInvitationContextById({});
            }
        } catch (e) {
            console.error("Failed to load assessment results:", e);
        } finally {
            setLoading(false);
        }
    };

    const visibleResults = results.filter((result) => {
        const invitationMeta = result.invitation_id ? invitationContextById[result.invitation_id]?.metadata || null : null;
        const invitationEmail = result.invitation_id ? invitationContextById[result.invitation_id]?.candidate_email || '' : '';
        const matchesJobTitle = jobTitleFilter
            ? String(invitationMeta?.job_title || '').toLowerCase() === jobTitleFilter.toLowerCase()
            : true;
        const matchesCandidateEmail = candidateEmailFilter
            ? invitationEmail.toLowerCase() === candidateEmailFilter.toLowerCase()
            : true;
        const matchesApplication = applicationIdFilter
            ? String(result.application_id || invitationMeta?.application_id || '') === applicationIdFilter
            : true;
        return matchesJobTitle && matchesCandidateEmail && matchesApplication;
    });

    const handleAiEvaluate = async (result: AssessmentResult) => {
        setEvaluatingId(result.id);
        try {
            // 1. Prepare questions - Fetch assessment definition
            const { data: assessmentData } = await supabase!
                .from('assessments')
                .select('*')
                .eq('id', result.assessment_id)
                .single();

            const normalizedAnswers = normalizeAnswers(result.answers, result.feedback);
            const journeyPayload = extractJourneyPayload(result.answers, result.feedback);
            const questions = assessmentData?.questions || normalizedAnswers.map(a => ({ id: a.questionId, text: `${t('assessment.results.question_fallback')} ` + a.questionId })); // Fallback

            const evaluation = await evaluateAssessmentResult(
                result.role,
                result.difficulty,
                questions,
                normalizedAnswers,
                journeyPayload
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
                openAssessmentPreviewPage(assessmentData);
            }
        } catch (e) {
            console.error("Failed to load assessment for preview:", e);
            alert(t('assessment.results.preview_failed'));
        }
    };

    if (loading) return <div className="p-4 text-center text-slate-500 dark:text-slate-400">{t('assessment.results.loading')}</div>;

    if (visibleResults.length === 0) return (
        <div className="p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 mt-8">
            <FileText className="mx-auto h-12 w-12 text-slate-400 mb-2" />
            <h3 className="text-lg font-medium text-slate-900 dark:text-white">{t('assessment.results.no_results_title')}</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{t('assessment.results.no_results_desc')}</p>
        </div>
    );

    return (
        <div className="space-y-3 mt-5">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                {t('assessment.results.title')} ({visibleResults.length})
            </h3>

            <div className="grid gap-3">
                {visibleResults.map(result => {
                    const invitationContext = result.invitation_id ? invitationContextById[result.invitation_id] : undefined;
                    return (
                        <AssessmentResultCard
                            key={result.id}
                            result={result}
                            invitationContext={invitationContext}
                            expanded={expandedId === result.id}
                            evaluating={evaluatingId === result.id}
                            onToggleExpanded={() => setExpandedId(expandedId === result.id ? null : result.id)}
                            onEvaluate={() => handleAiEvaluate(result)}
                            onPreview={() => handlePreview(result)}
                            normalizeAnswers={normalizeAnswers}
                            extractJourneyPayload={extractJourneyPayload}
                            mapQualityFlag={mapQualityFlag}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default AssessmentResultsList;
