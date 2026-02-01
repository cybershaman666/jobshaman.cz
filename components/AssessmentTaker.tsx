import React, { useState, useEffect, useRef } from 'react';
import { Assessment, AssessmentResult } from '../types';
import { supabase } from '../services/supabaseService';
import { Timer, AlertTriangle, Eye, EyeOff, CheckCircle, Zap, Code, FileText, ChevronRight, Maximize2, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Props {
    assessment: Assessment;
    invitationId: string;
    candidateId?: string;
    onComplete: (resultId: string) => void;
}

const AssessmentTaker: React.FC<Props> = ({ assessment, invitationId, candidateId, onComplete }) => {
    const { t } = useTranslation();
    const [started, setStarted] = useState(false);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [answers, setAnswers] = useState<{ questionId: string; answer: string }[]>([]);
    const [timeLeft, setTimeLeft] = useState(assessment.timeLimitSeconds || 900);
    const [cheatingAttempts, setCheatingAttempts] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showCheatWarning, setShowCheatWarning] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // --- Cheat Detection ---
    useEffect(() => {
        if (!started || submitting) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                setCheatingAttempts(prev => prev + 1);
                setShowCheatWarning(true);
            }
        };

        const handleBlur = () => {
            setCheatingAttempts(prev => prev + 1);
            setShowCheatWarning(true);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleBlur);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleBlur);
        };
    }, [started, submitting]);

    // --- Timer ---
    useEffect(() => {
        if (!started || submitting) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit(); // Auto-submit
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [started, submitting]);

    // --- Fullscreen Toggle ---
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen().catch(err => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const handleStart = () => {
        toggleFullscreen();
        setStarted(true);
    };

    const handleAnswer = (answer: string) => {
        const currentQ = assessment.questions[currentQuestionIndex];
        setAnswers(prev => {
            const existing = prev.filter(a => a.questionId !== currentQ.id);
            return [...existing, { questionId: currentQ.id, answer }];
        });
    };

    const handleNext = () => {
        if (currentQuestionIndex < assessment.questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setShowCheatWarning(false);
        } else {
            handleSubmit();
        }
    };

    const calculateScore = () => {
        let correct = 0;
        let total = 0;

        assessment.questions.forEach(q => {
            if (q.correctAnswer) {
                total++;
                const userAnswer = answers.find(a => a.questionId === q.id)?.answer;
                if (userAnswer === q.correctAnswer) correct++;
            }
        });

        return total === 0 ? 0 : Math.round((correct / total) * 100);
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        if (document.fullscreenElement) document.exitFullscreen();

        try {
            const score = calculateScore();
            const questionsTotal = assessment.questions.length;
            const questionsCorrect = 0;

            const resultData = {
                assessment_id: assessment.id,
                company_id: 'unknown',
                role: assessment.role,
                difficulty: 'Unknown',
                questions_total: questionsTotal,
                questions_correct: questionsCorrect,
                score: score,
                time_spent_seconds: (assessment.timeLimitSeconds || 900) - timeLeft,
                answers: answers,
                completed_at: new Date().toISOString(),
                metadata: {
                    cheating_attempts: cheatingAttempts,
                    forced_submission: timeLeft === 0
                }
            };

            const { data, error } = await supabase!
                .from('assessment_results')
                .insert([resultData])
                .select()
                .single();

            if (error) throw error;

            await supabase!
                .from('assessment_invitations')
                .update({ status: 'completed', completed_at: new Date().toISOString() })
                .eq('id', invitationId);

            onComplete(data.id);
        } catch (error) {
            console.error('Submission error:', error);
            alert(t('assessment.taker.submission_failed'));
            setSubmitting(false);
        }
    };

    // --- Renders ---

    if (!started) {
        return (
            <div ref={containerRef} className="min-h-screen bg-slate-950 text-cyan-500 font-mono flex items-center justify-center p-4">
                <div className="max-w-2xl w-full bg-slate-900 border border-cyan-500/30 rounded-lg p-8 shadow-[0_0_30px_rgba(8,145,178,0.2)] relative overflow-hidden">
                    {/* ... (gradient and icon) ... */}

                    <h1 className="text-3xl font-bold text-center text-white mb-2">{assessment.title}</h1>
                    <p className="text-center text-slate-400 mb-8">{assessment.description || "Ověřte své schopnosti v tomto interaktivním testu."}</p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-slate-950 p-4 rounded border border-slate-800 flex items-center gap-3">
                            <Timer className="text-amber-500" />
                            <div>
                                <div className="text-xs text-slate-500 uppercase">{t('assessment.taker.limit')}</div>
                                <div className="font-bold text-white">{Math.floor((assessment.timeLimitSeconds || 900) / 60)} min</div>
                            </div>
                        </div>
                        <div className="bg-slate-950 p-4 rounded border border-slate-800 flex items-center gap-3">
                            <ShieldAlert className="text-rose-500" />
                            <div>
                                <div className="text-xs text-slate-500 uppercase">{t('assessment.taker.anti_cheat')}</div>
                                <div className="font-bold text-white">{t('assessment.taker.active')}</div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 text-sm text-slate-400 bg-slate-950/50 p-4 rounded border border-slate-800 mb-8">
                        <p className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> {t('assessment.taker.fullscreen_mode')}</p>
                        <p className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> {t('assessment.taker.blur_detection')}</p>
                        <p className="flex items-center gap-2"><CheckCircle size={14} className="text-emerald-500" /> {t('assessment.taker.auto_submit')}</p>
                    </div>

                    <button
                        onClick={handleStart}
                        className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-lg rounded shadow-[0_0_20px_rgba(8,145,178,0.4)] transition-all hover:scale-[1.02]"
                    >
                        {t('assessment.taker.initialize_mission')}
                    </button>
                </div>
            </div>
        );
    }

    if (submitting) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-2xl text-white font-mono animate-pulse">{t('assessment.taker.uploading_data')}</h2>
                </div>
            </div>
        );
    }

    const question = assessment.questions[currentQuestionIndex];
    const currentAnswer = answers.find(a => a.questionId === question.id)?.answer || "";

    return (
        <div ref={containerRef} className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500/30">
            {/* HUD Header */}
            <header className="h-16 border-b border-slate-800 bg-slate-900/50 backdrop-blur flex items-center justify-between px-6 sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="text-cyan-500 font-bold font-mono text-xl tracking-wider">JOB.SHAMAN_OS</div>
                    <div className="h-6 w-px bg-slate-700"></div>
                    <div className="text-xs text-slate-400 uppercase tracking-widest hidden sm:block">{assessment.role} {t('assessment.taker.assessment_label')}</div>
                </div>

                <div className="flex items-center gap-6">
                    {cheatingAttempts > 0 && (
                        <div className="flex items-center gap-2 text-rose-500 animate-pulse font-mono text-xs">
                            <ShieldAlert size={14} />
                            {t('assessment.taker.warnings')} {cheatingAttempts}
                        </div>
                    )}

                    <div className={`flex items-center gap-2 font-mono text-xl font-bold ${timeLeft < 60 ? 'text-rose-500 animate-pulse' : 'text-cyan-400'}`}>
                        <Timer size={20} />
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                </div>
            </header>

            {/* Warning Overlay */}
            {showCheatWarning && (
                <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-rose-500/90 text-white px-6 py-3 rounded shadow-lg backdrop-blur z-50 animate-bounce">
                    <div className="flex items-center gap-3 font-bold">
                        <EyeOff />
                        {t('assessment.taker.focus_lost')}
                    </div>
                    <div className="text-xs text-rose-100 text-center mt-1">{t('assessment.taker.return_to_test', { count: cheatingAttempts })}</div>
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-4xl mx-auto p-6 md:p-12">
                {/* Progress Bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-xs text-slate-500 mb-2 uppercase tracking-widest">
                        <span>{t('assessment.taker.progress')}</span>
                        <span>{currentQuestionIndex + 1} / {assessment.questions.length}</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-cyan-500 shadow-[0_0_10px_rgba(6,182,212,0.5)] transition-all duration-500 ease-out"
                            style={{ width: `${((currentQuestionIndex + 1) / assessment.questions.length) * 100}%` }}
                        ></div>
                    </div>
                </div>

                {/* Question Card */}
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 md:p-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-600"></div>

                    <div className="mb-6">
                        <span className="inline-block px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700 mb-3">
                            {question.type === 'MultipleChoice' ? t('assessment.taker.type_multiple_choice') : question.type === 'Code' ? t('assessment.taker.type_code') : t('assessment.taker.type_open')}
                        </span>
                        <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{question.text}</h2>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                        {question.type === 'MultipleChoice' && question.options ? (
                            <div className="grid gap-3">
                                {question.options.map((opt, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleAnswer(opt)}
                                        className={`text-left p-4 rounded-xl border transition-all ${currentAnswer === opt
                                            ? 'bg-cyan-900/30 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-900'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${currentAnswer === opt ? 'border-cyan-500 bg-cyan-500 text-slate-900' : 'border-slate-600 text-slate-500'
                                                }`}>
                                                {String.fromCharCode(65 + i)}
                                            </div>
                                            {opt}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        ) : question.type === 'Code' ? (
                            <div className="relative">
                                <div className="absolute top-0 right-0 bg-slate-800 text-slate-400 text-xs px-2 py-1 rounded-bl">JavaScript/TypeScript</div>
                                <textarea
                                    value={currentAnswer}
                                    onChange={(e) => handleAnswer(e.target.value)}
                                    placeholder={t('assessment.taker.placeholder_code')}
                                    className="w-full h-64 bg-slate-950 border border-slate-700 rounded-xl p-4 font-mono text-sm text-cyan-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none leading-relaxed custom-scrollbar"
                                    spellCheck={false}
                                />
                            </div>
                        ) : (
                            <textarea
                                value={currentAnswer}
                                onChange={(e) => handleAnswer(e.target.value)}
                                placeholder={t('assessment.taker.placeholder_text')}
                                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-xl p-4 text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none resize-none"
                            />
                        )}
                    </div>
                </div>

                {/* Footer Controls */}
                <div className="mt-8 flex justify-end">
                    <button
                        onClick={handleNext}
                        disabled={!currentAnswer && question.type === 'MultipleChoice'} // Only require answer for MC
                        className="px-8 py-3 bg-white text-slate-900 font-bold rounded-lg hover:bg-cyan-50 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                        {currentQuestionIndex === assessment.questions.length - 1 ? t('assessment.taker.submit_mission') : t('assessment.taker.next_phase')}
                        <ChevronRight size={20} />
                    </button>
                </div>
            </main>
        </div>
    );
};

export default AssessmentTaker;
