import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CompanyDialogueSolutionSnapshotState, DialogueDossier, SolutionSnapshotUpsertPayload } from '../../types';
import {
    fetchCompanyDialogueSolutionSnapshotState,
    fetchCompanyDialogueMessages,
    saveCompanyDialogueSolutionSnapshot,
    sendCompanyDialogueMessage
} from '../../services/jobApplicationService';
import ApplicationMessageCenter from '../ApplicationMessageCenter';
import AssessmentResultsList from '../AssessmentResultsList';
import SectionHeader from './SectionHeader';
import SolutionSnapshotModal from './SolutionSnapshotModal';

const getAvatarInitials = (value: string): string => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!parts.length) return 'JS';
    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const getUiLocale = (locale: string): 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en' => {
    const normalized = String(locale || 'en').split('-')[0].toLowerCase();
    return ['cs', 'sk', 'de', 'at', 'pl'].includes(normalized) ? (normalized as 'cs' | 'sk' | 'de' | 'at' | 'pl') : 'en';
};

const getLocaleDateTime = (locale: string): string => {
    const uiLocale = getUiLocale(locale);
    if (uiLocale === 'cs') return 'cs-CZ';
    if (uiLocale === 'sk') return 'sk-SK';
    if (uiLocale === 'de' || uiLocale === 'at') return 'de-AT';
    if (uiLocale === 'pl') return 'pl-PL';
    return 'en-US';
};

interface ApplicationDossierDetailProps {
    dossier: DialogueDossier;
    dialogue?: DialogueDossier;
    companyId: string;
    locale: string;
    onCreateAssessmentFromApplication: () => void;
    onInviteCandidateFromApplication: () => void;
    onCreateAssessmentFromDialogue?: () => void;
    onInviteCandidateFromDialogue?: () => void;
}

const ApplicationDossierDetail: React.FC<ApplicationDossierDetailProps> = ({
    dossier,
    dialogue: dialogueProp,
    companyId,
    locale,
    onCreateAssessmentFromApplication,
    onInviteCandidateFromApplication,
    onCreateAssessmentFromDialogue,
    onInviteCandidateFromDialogue
}) => {
    const { t } = useTranslation();
    const uiLocale = getUiLocale(locale);
    const dateTimeLocale = getLocaleDateTime(locale);
    const dialogue = dialogueProp || dossier;
    const handleCreateAssessment = onCreateAssessmentFromDialogue || onCreateAssessmentFromApplication;
    const handleInviteCandidate = onInviteCandidateFromDialogue || onInviteCandidateFromApplication;
    const [solutionSnapshotState, setSolutionSnapshotState] = useState<CompanyDialogueSolutionSnapshotState | null>(null);
    const [solutionSnapshotLoading, setSolutionSnapshotLoading] = useState(false);
    const [solutionSnapshotSaving, setSolutionSnapshotSaving] = useState(false);
    const [solutionSnapshotModalOpen, setSolutionSnapshotModalOpen] = useState(false);
    const [solutionSnapshotError, setSolutionSnapshotError] = useState<string | null>(null);
    const lastDialogueIdRef = useRef<string>('');
    const lastStatusRef = useRef<string>('');
    const autoPromptPendingRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        const loadSolutionSnapshot = async () => {
            if (!dialogue?.id) return;
            setSolutionSnapshotLoading(true);
            setSolutionSnapshotError(null);
            try {
                const state = await fetchCompanyDialogueSolutionSnapshotState(dialogue.id);
                if (!cancelled) {
                    setSolutionSnapshotState(state);
                }
            } catch (error) {
                if (!cancelled) {
                    setSolutionSnapshotError(error instanceof Error ? error.message : null);
                    setSolutionSnapshotState(null);
                }
            } finally {
                if (!cancelled) {
                    setSolutionSnapshotLoading(false);
                }
            }
        };
        void loadSolutionSnapshot();
        return () => {
            cancelled = true;
        };
    }, [dialogue?.id, dialogue?.status]);

    useEffect(() => {
        const currentId = String(dialogue?.id || '');
        const currentStatus = String(dialogue?.status || 'pending');
        if (lastDialogueIdRef.current !== currentId) {
            lastDialogueIdRef.current = currentId;
            lastStatusRef.current = currentStatus;
            autoPromptPendingRef.current = false;
            return;
        }
        if (lastStatusRef.current !== currentStatus && lastStatusRef.current !== 'hired' && currentStatus === 'hired') {
            autoPromptPendingRef.current = true;
        }
        lastStatusRef.current = currentStatus;
    }, [dialogue?.id, dialogue?.status]);

    useEffect(() => {
        if (
            autoPromptPendingRef.current
            && solutionSnapshotState?.eligible
            && !solutionSnapshotState.snapshot
        ) {
            setSolutionSnapshotModalOpen(true);
            autoPromptPendingRef.current = false;
        }
        if (solutionSnapshotState?.snapshot) {
            autoPromptPendingRef.current = false;
        }
    }, [solutionSnapshotState?.eligible, solutionSnapshotState?.snapshot, dialogue?.id]);

    const handleSaveSolutionSnapshot = async (payload: SolutionSnapshotUpsertPayload) => {
        if (!dialogue?.id) return;
        setSolutionSnapshotSaving(true);
        setSolutionSnapshotError(null);
        try {
            const snapshot = await saveCompanyDialogueSolutionSnapshot(dialogue.id, payload);
            setSolutionSnapshotState({
                eligible: true,
                reason: null,
                snapshot,
            });
            setSolutionSnapshotModalOpen(false);
        } catch (error) {
            setSolutionSnapshotError(
                error instanceof Error
                    ? error.message
                    : t('company.solution_snapshot.save_failed', {
                        defaultValue: copy.saveFailed
                    })
            );
        } finally {
            setSolutionSnapshotSaving(false);
        }
    };
    if (!dialogue) return null;

    const copy = ({
        cs: {
            saveFailed: 'Nepodařilo se uložit solution snapshot.',
            reviewed: 'Zkontrolováno',
            shortlisted: 'Ve výběru',
            rejected: 'Zamítnuto',
            hired: 'Přijato',
            withdrawn: 'Staženo',
            closedTimeout: 'Uzavřeno timeoutem',
            roleFilled: 'Pozice obsazena',
            closed: 'Uzavřeno',
            pending: 'Čeká',
            timeoutClosed: 'Tento dialog byl uzavřen, protože ani jedna strana neodpověděla včas.',
            waitingForCandidate: 'Čeká se na kandidáta',
            yourReplyDue: 'Čeká se na vaši odpověď',
            deadlinePassed: 'termín vypršel',
            closeReasonTimeout: 'Okno pro odpověď vypršelo dřív, než odpověděla některá strana.',
            closeReasonRejected: 'Tento dialog byl uzavřen bez posunu kandidáta dál.',
            closeReasonWithdrawn: 'Kandidát se z tohoto dialogu stáhl.',
            closeReasonRoleFilled: 'Pozice byla obsazena dříve, než dialog pokračoval.',
            closeReasonHired: 'Tento dialog skončil rozhodnutím o přijetí.',
            closeReasonGeneric: 'Tento dialog byl uzavřen bez aktivního dalšího kroku.',
            status: 'Stav',
            handshakeOpened: 'Handshake otevřen',
            source: 'Zdroj',
            candidate: 'Kandidát',
            noEmail: 'Bez e-mailu',
            documents: 'Dokumenty',
            noCv: 'CV nepřiloženo',
            openCv: 'Otevřít CV',
            skills: 'Dovednosti',
            coverLetter: 'Průvodní zpráva',
            nextAssessment: 'Další kroky hodnocení',
            assessmentHint: 'Nechte tento dialog propojený, zatímco spustíte assessment nebo pošlete pozvánku.',
            createAssessment: 'Vytvořit assessment',
            inviteFromDialogue: 'Pozvat z tohoto dialogu',
            loading: 'Načítám...'
        },
        sk: {
            saveFailed: 'Nepodarilo sa uložiť solution snapshot.',
            reviewed: 'Skontrolované',
            shortlisted: 'Vo výbere',
            rejected: 'Zamietnuté',
            hired: 'Prijaté',
            withdrawn: 'Stiahnuté',
            closedTimeout: 'Uzatvorené timeoutom',
            roleFilled: 'Pozícia obsadená',
            closed: 'Uzatvorené',
            pending: 'Čaká',
            timeoutClosed: 'Tento dialóg bol uzavretý, pretože ani jedna strana neodpovedala včas.',
            waitingForCandidate: 'Čaká sa na kandidáta',
            yourReplyDue: 'Čaká sa na vašu odpoveď',
            deadlinePassed: 'termín uplynul',
            closeReasonTimeout: 'Okno na odpoveď vypršalo skôr, než odpovedala niektorá strana.',
            closeReasonRejected: 'Tento dialóg bol uzavretý bez posunu kandidáta ďalej.',
            closeReasonWithdrawn: 'Kandidát sa z tohto dialógu stiahol.',
            closeReasonRoleFilled: 'Pozícia bola obsadená skôr, než dialóg pokračoval.',
            closeReasonHired: 'Tento dialóg skončil rozhodnutím o prijatí.',
            closeReasonGeneric: 'Tento dialóg bol uzavretý bez aktívneho ďalšieho kroku.',
            status: 'Stav',
            handshakeOpened: 'Handshake otvorený',
            source: 'Zdroj',
            candidate: 'Kandidát',
            noEmail: 'Bez e-mailu',
            documents: 'Dokumenty',
            noCv: 'CV nepriložené',
            openCv: 'Otvoriť CV',
            skills: 'Zručnosti',
            coverLetter: 'Sprievodná správa',
            nextAssessment: 'Ďalšie kroky hodnotenia',
            assessmentHint: 'Nechajte tento dialóg prepojený, kým spustíte assessment alebo pošlete pozvánku.',
            createAssessment: 'Vytvoriť assessment',
            inviteFromDialogue: 'Pozvať z tohto dialógu',
            loading: 'Načítavam...'
        },
        de: {
            saveFailed: 'Solution Snapshot konnte nicht gespeichert werden.',
            reviewed: 'Geprüft',
            shortlisted: 'In Auswahl',
            rejected: 'Abgelehnt',
            hired: 'Eingestellt',
            withdrawn: 'Zurückgezogen',
            closedTimeout: 'Wegen Timeout geschlossen',
            roleFilled: 'Rolle besetzt',
            closed: 'Geschlossen',
            pending: 'Offen',
            timeoutClosed: 'Dieser Dialog wurde geschlossen, weil keine Seite rechtzeitig geantwortet hat.',
            waitingForCandidate: 'Warten auf Kandidat:in',
            yourReplyDue: 'Ihre Antwort ist fällig',
            deadlinePassed: 'Frist abgelaufen',
            closeReasonTimeout: 'Das Antwortfenster ist abgelaufen, bevor eine Seite geantwortet hat.',
            closeReasonRejected: 'Dieser Dialog wurde geschlossen, ohne die Person weiterzubewegen.',
            closeReasonWithdrawn: 'Die Kandidatin bzw. der Kandidat hat den Dialog zurückgezogen.',
            closeReasonRoleFilled: 'Die Rolle wurde besetzt, bevor dieser Dialog weiterging.',
            closeReasonHired: 'Dieser Dialog endete mit einer Einstellungsentscheidung.',
            closeReasonGeneric: 'Dieser Dialog wurde ohne aktiven nächsten Schritt geschlossen.',
            status: 'Status',
            handshakeOpened: 'Handshake geöffnet',
            source: 'Quelle',
            candidate: 'Kandidat:in',
            noEmail: 'Keine E-Mail',
            documents: 'Dokumente',
            noCv: 'Kein CV angehängt',
            openCv: 'CV öffnen',
            skills: 'Skills',
            coverLetter: 'Anschreiben',
            nextAssessment: 'Nächste Assessment-Schritte',
            assessmentHint: 'Lassen Sie diesen Dialog verknüpft, während Sie ein Assessment starten oder eine Einladung senden.',
            createAssessment: 'Assessment erstellen',
            inviteFromDialogue: 'Aus diesem Dialog einladen',
            loading: 'Lädt...'
        },
        at: {} as any,
        pl: {
            saveFailed: 'Nie udało się zapisać solution snapshot.',
            reviewed: 'Sprawdzone',
            shortlisted: 'Na shortliście',
            rejected: 'Odrzucone',
            hired: 'Zatrudniono',
            withdrawn: 'Wycofano',
            closedTimeout: 'Zamknięto z powodu timeoutu',
            roleFilled: 'Rola obsadzona',
            closed: 'Zamknięte',
            pending: 'Oczekuje',
            timeoutClosed: 'Ten dialog został zamknięty, ponieważ żadna ze stron nie odpowiedziała na czas.',
            waitingForCandidate: 'Czeka na kandydata',
            yourReplyDue: 'Czeka na Twoją odpowiedź',
            deadlinePassed: 'termin minął',
            closeReasonTimeout: 'Okno odpowiedzi wygasło, zanim odpowiedziała którakolwiek ze stron.',
            closeReasonRejected: 'Ten dialog został zamknięty bez przesunięcia kandydata dalej.',
            closeReasonWithdrawn: 'Kandydat wycofał się z tego dialogu.',
            closeReasonRoleFilled: 'Rola została obsadzona, zanim ten dialog był kontynuowany.',
            closeReasonHired: 'Ten dialog zakończył się decyzją o zatrudnieniu.',
            closeReasonGeneric: 'Ten dialog został zamknięty bez aktywnego kolejnego kroku.',
            status: 'Status',
            handshakeOpened: 'Handshake otwarty',
            source: 'Źródło',
            candidate: 'Kandydat',
            noEmail: 'Brak e-maila',
            documents: 'Dokumenty',
            noCv: 'Brak CV',
            openCv: 'Otwórz CV',
            skills: 'Umiejętności',
            coverLetter: 'Wiadomość wstępna',
            nextAssessment: 'Kolejne kroki oceny',
            assessmentHint: 'Zostaw ten dialog powiązany, gdy uruchamiasz assessment albo wysyłasz zaproszenie.',
            createAssessment: 'Utwórz assessment',
            inviteFromDialogue: 'Zaproś z tego dialogu',
            loading: 'Ładowanie...'
        },
        en: {
            saveFailed: 'Failed to save the solution snapshot.',
            reviewed: 'Reviewed',
            shortlisted: 'Shortlisted',
            rejected: 'Rejected',
            hired: 'Hired',
            withdrawn: 'Withdrawn',
            closedTimeout: 'Closed by timeout',
            roleFilled: 'Role filled',
            closed: 'Closed',
            pending: 'Pending',
            timeoutClosed: 'This dialogue was closed because neither side replied in time.',
            waitingForCandidate: 'Waiting for candidate',
            yourReplyDue: 'Your reply is due',
            deadlinePassed: 'deadline passed',
            closeReasonTimeout: 'The reply window expired before either side responded.',
            closeReasonRejected: 'This dialogue was closed without moving the candidate forward.',
            closeReasonWithdrawn: 'The candidate withdrew from this dialogue.',
            closeReasonRoleFilled: 'The role was filled before this dialogue continued.',
            closeReasonHired: 'This dialogue ended in a hire decision.',
            closeReasonGeneric: 'This dialogue was closed without an active next step.',
            status: 'Status',
            handshakeOpened: 'Handshake opened',
            source: 'Source',
            candidate: 'Candidate',
            noEmail: 'No email',
            documents: 'Documents',
            noCv: 'No CV attached',
            openCv: 'Open CV',
            skills: 'Skills',
            coverLetter: 'Cover letter',
            nextAssessment: 'Next assessment steps',
            assessmentHint: 'Keep this dialogue linked while you launch screening or send an invite.',
            createAssessment: 'Create assessment',
            inviteFromDialogue: 'Invite from this dialogue',
            loading: 'Loading...'
        }
    } as const)[uiLocale === 'at' ? 'de' : uiLocale];

    const getReadableStatus = (status: DialogueDossier['status']) => {
        switch (status) {
            case 'reviewed':
                return t('company.dashboard.status.approved', { defaultValue: copy.reviewed });
            case 'shortlisted':
                return t('company.dashboard.status.shortlisted', { defaultValue: copy.shortlisted });
            case 'rejected':
            case 'closed_rejected':
                return t('company.dashboard.status.refused', { defaultValue: copy.rejected });
            case 'hired':
                return t('company.dashboard.status.hired', { defaultValue: copy.hired });
            case 'withdrawn':
            case 'closed_withdrawn':
                return t('company.applications.status.withdrawn', { defaultValue: copy.withdrawn });
            case 'closed_timeout':
                return t('company.applications.status.timeout', { defaultValue: copy.closedTimeout });
            case 'closed_role_filled':
                return t('company.applications.status.role_filled', { defaultValue: copy.roleFilled });
            case 'closed':
                return t('company.applications.status.closed', { defaultValue: copy.closed });
            default:
                return t('company.dashboard.status.pending', { defaultValue: copy.pending });
        }
    };

    const getTimingMeta = () => {
        const closedReason = String(dossier.dialogue_closed_reason || '').trim().toLowerCase();
        if (dossier.status === 'closed_timeout' || closedReason === 'timeout') {
            return {
                label: t('company.applications.timeout_closed', { defaultValue: copy.timeoutClosed }),
                className: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
            };
        }
        const deadlineValue = String(dossier.dialogue_deadline_at || '').trim();
        if (!deadlineValue || !['pending', 'reviewed', 'shortlisted'].includes(String(dossier.status || 'pending'))) {
            return null;
        }
        const deadline = new Date(deadlineValue);
        if (Number.isNaN(deadline.getTime())) return null;
        const msRemaining = deadline.getTime() - Date.now();
        const actorLabel =
            dossier.dialogue_current_turn === 'candidate'
                ? t('company.applications.turn_candidate', { defaultValue: copy.waitingForCandidate })
                : t('company.applications.turn_company', { defaultValue: copy.yourReplyDue });
        if (dossier.dialogue_is_overdue || msRemaining <= 0) {
            return {
                label: `${actorLabel} • ${t('company.applications.deadline_passed', { defaultValue: copy.deadlinePassed })}`,
                className: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
            };
        }
        return {
            label: `${actorLabel} • ${deadline.toLocaleString(dateTimeLocale)}`,
            className: 'border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] text-[var(--accent)]'
        };
    };

    const getClosedReasonMeta = () => {
        if (['pending', 'reviewed', 'shortlisted'].includes(String(dossier.status || 'pending'))) {
            return null;
        }
        const normalizedReason = String(dossier.dialogue_closed_reason || dossier.status || '').trim().toLowerCase();
        switch (normalizedReason) {
            case 'timeout':
            case 'closed_timeout':
                return {
                    label: t('company.applications.close_reason_timeout', { defaultValue: copy.closeReasonTimeout }),
                    className: 'border-amber-200 bg-amber-50/80 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300'
                };
            case 'rejected':
            case 'closed_rejected':
                return {
                    label: t('company.applications.close_reason_rejected', { defaultValue: copy.closeReasonRejected }),
                    className: 'border-rose-200 bg-rose-50/80 text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300'
                };
            case 'withdrawn':
            case 'closed_withdrawn':
                return {
                    label: t('company.applications.close_reason_withdrawn', { defaultValue: copy.closeReasonWithdrawn }),
                    className: 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300'
                };
            case 'closed_role_filled':
                return {
                    label: t('company.applications.close_reason_role_filled', { defaultValue: copy.closeReasonRoleFilled }),
                    className: 'border-indigo-200 bg-indigo-50/80 text-indigo-800 dark:border-indigo-900/40 dark:bg-indigo-950/20 dark:text-indigo-300'
                };
            case 'hired':
                return {
                    label: t('company.applications.close_reason_hired', { defaultValue: copy.closeReasonHired }),
                    className: 'border-emerald-200 bg-emerald-50/80 text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300'
                };
            case 'closed':
            default:
                return {
                    label: t('company.applications.close_reason_generic', { defaultValue: copy.closeReasonGeneric }),
                    className: 'border-slate-200 bg-slate-50/80 text-slate-700 dark:border-slate-700 dark:bg-slate-950/30 dark:text-slate-300'
                };
        }
    };

    const timingMeta = getTimingMeta();
    const closeReasonMeta = getClosedReasonMeta();
    const solutionSnapshot = solutionSnapshotState?.snapshot || null;
    const shouldRenderSolutionSnapshotCard =
        solutionSnapshotLoading
        || Boolean(solutionSnapshot)
        || Boolean(solutionSnapshotState?.eligible)
        || solutionSnapshotState?.reason === 'awaiting_completion'
        || Boolean(solutionSnapshotError);

    return (
        <>
        <div className="space-y-4">
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.dashboard.table.position')}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.job_title || t('company.dashboard.table.position')}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.dashboard.table.status', { defaultValue: copy.status })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {getReadableStatus(dossier.status)}
                        {closeReasonMeta ? (
                            <div className="mt-2 text-xs font-normal leading-5 text-slate-600 dark:text-slate-300">
                                {closeReasonMeta.label}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.workspace.timeline.application_received', { defaultValue: copy.handshakeOpened })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.submitted_at
                            ? new Date(dossier.submitted_at).toLocaleString(dateTimeLocale)
                            : '—'}
                    </div>
                </div>
                <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-3 bg-slate-50/80 dark:bg-slate-950/30">
                    <div className="text-[11px] uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">
                        {t('company.applications.detail.source', { defaultValue: copy.source })}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {dossier.source || 'application_modal'}
                    </div>
                </div>
            </div>

            {(timingMeta || closeReasonMeta) ? (
                <div className={`rounded-2xl border px-4 py-3 text-sm font-medium ${(timingMeta || closeReasonMeta)?.className}`}>
                    {(timingMeta || closeReasonMeta)?.label}
                </div>
            ) : null}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.candidate', { defaultValue: copy.candidate })}</div>
                    <div className="flex items-start gap-3">
                        {dossier.candidate_profile_snapshot?.avatar_url || dossier.candidateAvatarUrl || dossier.candidate_avatar_url ? (
                            <img
                                src={dossier.candidate_profile_snapshot?.avatar_url || dossier.candidateAvatarUrl || dossier.candidate_avatar_url}
                                alt={dossier.candidate_profile_snapshot?.name || dossier.candidate_name || 'Candidate'}
                                className="h-14 w-14 shrink-0 rounded-[1.1rem] object-cover"
                            />
                        ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.1rem] bg-slate-100 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                {getAvatarInitials(dossier.candidate_profile_snapshot?.name || dossier.candidate_name || t('company.applications.labels.candidate', { defaultValue: copy.candidate }))}
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">
                                {dossier.candidate_profile_snapshot?.name || dossier.candidate_name || t('company.applications.labels.candidate', { defaultValue: copy.candidate })}
                            </div>
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                                {dossier.candidate_profile_snapshot?.email || dossier.candidate_email || t('company.applications.detail.no_email', { defaultValue: copy.noEmail })}
                            </div>
                        </div>
                    </div>
                    {dossier.candidate_profile_snapshot?.phone && (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {dossier.candidate_profile_snapshot.phone}
                        </div>
                    )}
                    {dossier.candidate_profile_snapshot?.jobTitle && (
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            {dossier.candidate_profile_snapshot.jobTitle}
                        </div>
                    )}
                </div>
                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.documents', { defaultValue: copy.documents })}</div>
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                        {dossier.cv_snapshot?.originalName || dossier.cv_snapshot?.label || t('company.applications.detail.no_cv', { defaultValue: copy.noCv })}
                    </div>
                    {dossier.cv_snapshot?.fileUrl && (
                        <a
                            href={dossier.cv_snapshot.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="company-action-link mt-2 inline-block text-xs hover:underline"
                        >
                            {t('company.candidates.open_cv', { defaultValue: copy.openCv })}
                        </a>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                        {t('company.applications.detail.source', { defaultValue: copy.source })}: {dossier.source || 'application_modal'}
                    </div>
                </div>
            </div>

            {dossier.candidate_profile_snapshot?.skills?.length ? (
                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <div className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.skills', { defaultValue: copy.skills })}</div>
                    <div className="flex flex-wrap gap-2">
                        {dossier.candidate_profile_snapshot.skills.map((skill) => (
                            <span key={skill} className="px-2.5 py-1 text-xs rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {skill}
                            </span>
                        ))}
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
                {dossier.cover_letter ? (
                    <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                        <SectionHeader
                            title={t('company.workspace.labels.cover_letter', { defaultValue: copy.coverLetter })}
                            className="mb-2"
                        />
                        <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {dossier.cover_letter}
                        </div>
                    </div>
                ) : null}

                <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                    <SectionHeader
                        title={t('company.applications.detail.assessment_actions', { defaultValue: copy.nextAssessment })}
                        subtitle={t('company.applications.detail.assessment_hint', { defaultValue: copy.assessmentHint })}
                        className="mb-3"
                    />
                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={handleCreateAssessment}
                            className="app-button-secondary rounded-full px-3 py-2 text-xs !text-[var(--accent)]"
                        >
                            {t('company.dashboard.actions.create_assessment', { defaultValue: copy.createAssessment })}
                        </button>
                        <button
                            onClick={handleInviteCandidate}
                            className="px-3 py-2 rounded-full border border-emerald-200 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/30 dark:text-emerald-300 dark:hover:bg-emerald-950/20"
                        >
                            {t('company.assessment_library.invite_from_context', { defaultValue: copy.inviteFromDialogue })}
                        </button>
                    </div>
                </div>
            </div>

            {shouldRenderSolutionSnapshotCard ? (
                <div className="rounded-[22px] border border-emerald-200/80 bg-emerald-50/70 p-4 shadow-[0_16px_32px_-28px_rgba(5,150,105,0.35)] dark:border-emerald-900/30 dark:bg-emerald-950/20">
                    <SectionHeader
                        title={t('company.solution_snapshot.title', { defaultValue: 'Solution snapshot' })}
                        subtitle={
                            solutionSnapshot
                                ? t('company.solution_snapshot.subtitle_existing', {
                                    defaultValue: 'A compact collaboration artifact the candidate can later surface on their profile.'
                                })
                                : solutionSnapshotState?.reason === 'awaiting_completion'
                                    ? t('company.solution_snapshot.subtitle_locked', {
                                        defaultValue: 'This unlocks after the micro job is marked as hired.'
                                    })
                                    : t('company.solution_snapshot.subtitle_empty', {
                                        defaultValue: 'Once the micro job is complete, capture the concrete story of the solution here.'
                                    })
                        }
                        aside={
                            solutionSnapshotState?.eligible ? (
                                <button
                                    type="button"
                                    onClick={() => setSolutionSnapshotModalOpen(true)}
                                    className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                                >
                                    {solutionSnapshot
                                        ? t('company.solution_snapshot.edit', { defaultValue: 'Edit' })
                                        : t('company.solution_snapshot.create', { defaultValue: 'Create snapshot' })}
                                </button>
                            ) : null
                        }
                        className="mb-3"
                    />

                    {solutionSnapshotError ? (
                        <div className="mb-3 rounded-[0.95rem] border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/30 dark:bg-rose-950/20 dark:text-rose-300">
                            {solutionSnapshotError}
                        </div>
                    ) : null}

                    {solutionSnapshotLoading ? (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                            {t('common.loading', { defaultValue: copy.loading })}
                        </div>
                    ) : solutionSnapshot ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
                                <div className="rounded-[1rem] border border-white/70 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        {t('company.solution_snapshot.problem', { defaultValue: 'Problem' })}
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                                        {solutionSnapshot.problem}
                                    </div>
                                </div>
                                <div className="rounded-[1rem] border border-white/70 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        {t('company.solution_snapshot.solution', { defaultValue: 'Solution' })}
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                                        {solutionSnapshot.solution}
                                    </div>
                                </div>
                                <div className="rounded-[1rem] border border-white/70 bg-white/90 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                        {t('company.solution_snapshot.result', { defaultValue: 'Result' })}
                                    </div>
                                    <div className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                                        {solutionSnapshot.result}
                                    </div>
                                </div>
                            </div>
                            {(solutionSnapshot.problem_tags.length || solutionSnapshot.solution_tags.length) ? (
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    {solutionSnapshot.problem_tags.length ? (
                                        <div>
                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                {t('company.solution_snapshot.problem_tags', { defaultValue: 'Problem tags' })}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {solutionSnapshot.problem_tags.map((tag) => (
                                                    <span key={`problem-${tag}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                    {solutionSnapshot.solution_tags.length ? (
                                        <div>
                                            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                                {t('company.solution_snapshot.solution_tags', { defaultValue: 'Solution tags' })}
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {solutionSnapshot.solution_tags.map((tag) => (
                                                    <span key={`solution-${tag}`} className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-700 dark:bg-slate-900 dark:text-slate-200">
                                                        {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    ) : solutionSnapshotState?.reason === 'awaiting_completion' ? (
                        <div className="rounded-[1rem] border border-dashed border-emerald-200 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-emerald-900/30 dark:bg-slate-950/30 dark:text-slate-300">
                            {t('company.solution_snapshot.locked_hint', {
                                defaultValue: 'Once you mark the collaboration as hired, you can create a short solution snapshot for the candidate profile.'
                            })}
                        </div>
                    ) : (
                        <div className="rounded-[1rem] border border-dashed border-emerald-200 bg-white/70 px-4 py-3 text-sm text-slate-600 dark:border-emerald-900/30 dark:bg-slate-950/30 dark:text-slate-300">
                            {t('company.solution_snapshot.empty_hint', {
                                defaultValue: 'Capture the concrete solution story here so the micro job becomes a shareable proof of work.'
                            })}
                        </div>
                    )}
                </div>
            ) : null}

            {dossier.shared_jcfpm_payload ? (
                <div className="rounded-[22px] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] p-4 space-y-3 shadow-[var(--shadow-soft)]">
                    <div className="flex items-center justify-between gap-2">
                        <div className="text-xs uppercase tracking-widest text-[var(--accent)]">
                            {t('company.applications.detail.profile_fit_signal', { defaultValue: 'Profile fit signal' })}
                        </div>
                        <div className="text-[11px] text-[var(--accent)]">
                            {t('company.applications.labels.summary', { defaultValue: 'Shared' })}
                        </div>
                    </div>
                    {dossier.shared_jcfpm_payload.archetype?.title && (
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {dossier.shared_jcfpm_payload.archetype.title}
                        </div>
                    )}
                    {dossier.shared_jcfpm_payload.strengths?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.skills', { defaultValue: 'Strengths' })}</div>
                            <div className="flex flex-wrap gap-2">
                                {dossier.shared_jcfpm_payload.strengths.map((item) => (
                                    <span key={item} className="px-2.5 py-1 text-xs rounded-full border border-[rgba(var(--accent-rgb),0.12)] bg-white/80 text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
                                        {item}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.environment_fit_summary?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.environment_fit', { defaultValue: 'Environment fit' })}</div>
                            <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                {dossier.shared_jcfpm_payload.environment_fit_summary.map((item) => (
                                    <li key={item}>• {item}</li>
                                ))}
                            </ul>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.comparison_signals?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                                {t('company.applications.detail.comparison_signals', { defaultValue: 'Comparable signals' })}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {dossier.shared_jcfpm_payload.comparison_signals.map((item) => (
                                    <div key={`${item.key}-${item.score}`} className="rounded-xl border border-[rgba(var(--accent-rgb),0.12)] bg-white/75 px-3 py-2 dark:bg-slate-900/40">
                                        <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                            {item.label}
                                        </div>
                                        <div className="mt-1 flex items-center justify-between gap-2">
                                            <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-[var(--accent)]"
                                                    style={{ width: `${Math.max(6, Math.min(100, item.score || 0))}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">{item.score}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    {dossier.shared_jcfpm_payload.top_dimensions?.length ? (
                        <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">{t('company.applications.detail.top_dimensions', { defaultValue: 'Top dimensions' })}</div>
                            <div className="space-y-1 text-sm text-slate-700 dark:text-slate-200">
                                {dossier.shared_jcfpm_payload.top_dimensions.map((item) => (
                                    <div key={`${item.dimension}-${item.percentile}`} className="flex items-center justify-between">
                                        <span>{item.label || item.dimension}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{Math.round(item.percentile)}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </div>
            ) : (
                <div className="rounded-[22px] border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-slate-950/20">
                    {t('company.candidates.no_jcfpm_shared', { defaultValue: 'This candidate did not share a deeper profile signal with the handshake.' })}
                </div>
            )}

            <div className="rounded-[22px] border border-slate-200/80 dark:border-slate-800 p-4 bg-white/90 dark:bg-slate-950/20 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.38)]">
                <SectionHeader
                    title={t('company.applications.detail.related_assessments', { defaultValue: 'Related assessments' })}
                    subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: 'Assessment results linked to this applicant will appear here automatically.' })}
                    className="mb-2"
                />
                <AssessmentResultsList
                    companyId={companyId}
                    dialogueIdFilter={dialogue.id}
                    applicationIdFilter={dialogue.id}
                    candidateEmailFilter={dialogue.candidate_profile_snapshot?.email || dialogue.candidate_email || undefined}
                />
            </div>

            <ApplicationMessageCenter
                dialogueId={dialogue.id}
                applicationId={dialogue.id}
                storageOwnerId={companyId}
                viewerRole="recruiter"
                dialogueStatus={dialogue.status}
                dialogueDeadlineAt={dialogue.dialogue_deadline_at || null}
                dialogueTimeoutHours={dialogue.dialogue_timeout_hours ?? null}
                dialogueCurrentTurn={dialogue.dialogue_current_turn || null}
                dialogueClosedReason={dialogue.dialogue_closed_reason || null}
                dialogueIsOverdue={Boolean(dialogue.dialogue_is_overdue)}
                heading={t('company.applications.detail.messages_title', { defaultValue: 'Dialogue thread' })}
                subtitle={t('company.applications.detail.messages_desc', {
                    defaultValue: 'Use asynchronous dialogue messages for clarifications, document requests, and follow-up without live chat pressure.'
                })}
                emptyText={t('company.applications.detail.messages_empty', {
                    defaultValue: 'No messages yet. Start the dialogue when you need additional information or want to share a document.'
                })}
                fetchMessages={fetchCompanyDialogueMessages}
                sendMessage={sendCompanyDialogueMessage}
            />
        </div>
        <SolutionSnapshotModal
            open={solutionSnapshotModalOpen}
            locale={locale}
            jobTitle={dialogue.job_title || null}
            candidateName={dialogue.candidate_profile_snapshot?.name || dialogue.candidate_name || null}
            initialValue={solutionSnapshot}
            saving={solutionSnapshotSaving}
            onClose={() => setSolutionSnapshotModalOpen(false)}
            onSave={handleSaveSolutionSnapshot}
        />
        </>
    );
};

export default ApplicationDossierDetail;
