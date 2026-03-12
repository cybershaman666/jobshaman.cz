import React from 'react';
import { useTranslation } from 'react-i18next';
import { Briefcase, X } from 'lucide-react';
import { CompanyApplicationRow, DialogueDossier, Job } from '../../types';
import ApplicationDossierDetail from './ApplicationDossierDetail';
import MetricCard from './MetricCard';
import SectionHeader from './SectionHeader';
import WorkspaceHeader from './WorkspaceHeader';
import WorkspacePanel from './WorkspacePanel';
import WorkspaceSyncBadge from './WorkspaceSyncBadge';

const getAvatarInitials = (value: string): string => {
    const parts = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    if (!parts.length) return 'JS';
    return parts.map((part) => part[0]?.toUpperCase() || '').join('');
};

const getUiLocale = (language: string): 'cs' | 'sk' | 'de' | 'pl' | 'en' => {
    const normalized = String(language || 'en').split('-')[0].toLowerCase();
    if (normalized === 'at') return 'de';
    return ['cs', 'sk', 'de', 'pl'].includes(normalized) ? (normalized as 'cs' | 'sk' | 'de' | 'pl') : 'en';
};

const getDateTimeLocale = (language: string): string => {
    const locale = getUiLocale(language);
    if (locale === 'cs') return 'cs-CZ';
    if (locale === 'sk') return 'sk-SK';
    if (locale === 'de') return 'de-AT';
    if (locale === 'pl') return 'pl-PL';
    return 'en-US';
};

interface CompanyApplicationsWorkspaceProps {
    jobs: Job[];
    selectedJobId: string;
    selectedJob: Job | null;
    dialogues?: CompanyApplicationRow[];
    applications: CompanyApplicationRow[];
    dialoguesLoading?: boolean;
    applicationsLoading: boolean;
    dialoguesUpdating?: Record<string, boolean>;
    applicationsUpdating: Record<string, boolean>;
    selectedDialogueId?: string | null;
    selectedApplicationId: string | null;
    selectedDialogueDetail?: DialogueDossier | null;
    selectedApplicationDetail: DialogueDossier | null;
    dialogueDetailLoading?: boolean;
    applicationDetailLoading: boolean;
    lastSyncedAt?: string | null;
    companyId: string;
    onSelectedJobChange: (jobId: string) => void;
    onOpenJobs: () => void;
    onRefresh: () => void;
    onOpenDialogue?: (dialogueId: string) => void;
    onOpenApplication: (applicationId: string) => void;
    onCloseDetail: () => void;
    onStatusChange: (applicationId: string, status: CompanyApplicationRow['status']) => void;
    onCreateAssessmentFromDialogue?: () => void;
    onCreateAssessmentFromApplication: () => void;
    onInviteCandidateFromDialogue?: () => void;
    onInviteCandidateFromApplication: () => void;
}

const CompanyApplicationsWorkspace: React.FC<CompanyApplicationsWorkspaceProps> = ({
    jobs,
    selectedJobId,
    selectedJob,
    dialogues,
    applications,
    dialoguesLoading,
    applicationsLoading,
    dialoguesUpdating,
    applicationsUpdating,
    selectedDialogueId,
    selectedApplicationId,
    selectedDialogueDetail,
    selectedApplicationDetail,
    dialogueDetailLoading,
    applicationDetailLoading,
    lastSyncedAt,
    companyId,
    onSelectedJobChange,
    onOpenJobs,
    onRefresh,
    onOpenDialogue,
    onOpenApplication,
    onCloseDetail,
    onStatusChange,
    onCreateAssessmentFromDialogue,
    onCreateAssessmentFromApplication,
    onInviteCandidateFromDialogue,
    onInviteCandidateFromApplication
}) => {
    const { t, i18n } = useTranslation();
    const language = getUiLocale(i18n.language || 'en');
    const dateTimeLocale = getDateTimeLocale(i18n.language || 'en');
    const resolvedDialogues = dialogues ?? applications;
    const resolvedDialoguesLoading = dialoguesLoading ?? applicationsLoading;
    const resolvedDialoguesUpdating = dialoguesUpdating ?? applicationsUpdating;
    const resolvedSelectedDialogueId = selectedDialogueId ?? selectedApplicationId;
    const resolvedSelectedDialogueDetail = selectedDialogueDetail ?? selectedApplicationDetail;
    const resolvedDialogueDetailLoading = dialogueDetailLoading ?? applicationDetailLoading;
    const handleOpenDialogue = onOpenDialogue || onOpenApplication;
    const handleCreateAssessment = onCreateAssessmentFromDialogue || onCreateAssessmentFromApplication;
    const handleInviteCandidate = onInviteCandidateFromDialogue || onInviteCandidateFromApplication;
    const sharedJcfpmCount = resolvedDialogues.filter((dialogue) => dialogue.hasJcfpm).length;
    const openDialogues = resolvedDialogues.filter((dialogue) => ['pending', 'reviewed', 'shortlisted'].includes(String(dialogue.status || 'pending')));
    const resolvedResponseSlaHours = (() => {
        const detailHours = Number(resolvedSelectedDialogueDetail?.dialogue_timeout_hours);
        if (Number.isFinite(detailHours) && detailHours > 0) return Math.max(1, Math.round(detailHours));
        const firstOpen = openDialogues.find((item) => Number(item.dialogue_timeout_hours) > 0);
        const openHours = Number(firstOpen?.dialogue_timeout_hours);
        if (Number.isFinite(openHours) && openHours > 0) return Math.max(1, Math.round(openHours));
        return 48;
    })();
    const copy = ({
        cs: {
            days: '{{count}} dní',
            hours: '{{count}} hodin',
            reviewed: 'Přečteno',
            shortlisted: 'Chceme pokračovat',
            rejected: 'Děkujeme, ale hledáme jiný přístup',
            hired: 'Přijato',
            withdrawn: 'Staženo',
            closedTimeout: 'Uzavřeno timeoutem',
            roleFilled: 'Pozice obsazena',
            closed: 'Uzavřeno',
            pending: 'Čeká na první reakci',
            closeReasonTimeout: 'Okno pro odpověď vypršelo dřív, než odpověděla některá strana.',
            closeReasonRejected: 'Tento dialog jste uzavřeli bez posunu kandidáta dál.',
            closeReasonWithdrawn: 'Kandidát se z tohoto dialogu stáhl.',
            closeReasonRoleFilled: 'Pozice byla obsazena dříve, než dialog pokračoval.',
            closeReasonHired: 'Tento dialog skončil rozhodnutím o přijetí.',
            closeReasonGeneric: 'Tento dialog byl uzavřen bez aktivního dalšího kroku.',
            timeoutClosed: 'Uzavřeno po vypršení okna pro odpověď.',
            waitingForCandidate: 'Čeká se na kandidáta',
            yourReplyDue: 'Čeká se na vaši odpověď',
            deadlinePassed: 'termín vypršel',
            underHour: '< 1 hodina zbývá',
            hourLeft: '{{count}} h zbývá',
            dayLeft: '{{count}} d zbývá',
            responseSlaInline: 'SLA reakce: {{window}}',
            dialogueInbox: 'Dialogové centrum',
            dialogueSubtitle: 'Projděte aktivní handshaky, posuňte je dál a udržte každého člověka v kontextu.',
            openRoleDialogues: 'Otevřené dialogy role',
            openRoles: 'Otevřít role',
            dialogues: 'Dialogy',
            dialoguesHint: 'Uvidíte, kdo právě otevřel handshake, zkontrolujete kontext a posunete dialog dál jedním kliknutím.',
            needsReview: 'K revizi',
            needsReviewHint: 'Otevřené dialogy stále čekají na recruiter akci nebo jasný další krok.',
            sharedProfileSignal: 'Sdílený profilový signál',
            sharedProfileSignalHint: 'Kandidáti, kteří sdíleli hlubší profilový signál pro lepší hiring kontext.',
            roleInFocus: 'Role v pozornosti',
            activeDialogues: 'Aktivní dialogy',
            activeDialoguesHint: 'Otevřete dialog, změňte stav nebo skočte rovnou do navázaného review flow.',
            candidatesSeeExpectation: 'Kandidát vidí očekávání první reakce do {{window}}.',
            noDialogues: 'Pro vybranou roli zatím nejsou žádné dialogy.',
            candidate: 'Kandidát',
            coverLetter: 'Průvodní zpráva',
            shared: 'Sdíleno',
            saving: 'Ukládám…',
            openDialogue: 'Otevřít dialog',
            dialogueReview: 'Revize dialogu',
            dialogueReviewDesc: 'Strukturovaný dossier pro recruiter review.',
            loading: 'Načítám...',
            selectPrompt: 'Vyberte dialog z fronty a zobrazí se plný kontext.'
        },
        sk: {
            days: '{{count}} dní',
            hours: '{{count}} hodín',
            reviewed: 'Prečítané',
            shortlisted: 'Chceme pokračovať',
            rejected: 'Ďakujeme, ale hľadáme iný prístup',
            hired: 'Prijaté',
            withdrawn: 'Stiahnuté',
            closedTimeout: 'Uzatvorené timeoutom',
            roleFilled: 'Pozícia obsadená',
            closed: 'Uzatvorené',
            pending: 'Čaká na prvú reakciu',
            closeReasonTimeout: 'Okno na odpoveď vypršalo skôr, než odpovedala niektorá strana.',
            closeReasonRejected: 'Tento dialóg ste uzavreli bez posunu kandidáta ďalej.',
            closeReasonWithdrawn: 'Kandidát sa z tohto dialógu stiahol.',
            closeReasonRoleFilled: 'Pozícia bola obsadená skôr, než dialóg pokračoval.',
            closeReasonHired: 'Tento dialóg skončil rozhodnutím o prijatí.',
            closeReasonGeneric: 'Tento dialóg bol uzavretý bez aktívneho ďalšieho kroku.',
            timeoutClosed: 'Uzatvorené po vypršaní okna na odpoveď.',
            waitingForCandidate: 'Čaká sa na kandidáta',
            yourReplyDue: 'Čaká sa na vašu odpoveď',
            deadlinePassed: 'termín uplynul',
            underHour: '< 1 hodina zostáva',
            hourLeft: '{{count}} h zostáva',
            dayLeft: '{{count}} d zostávajú',
            responseSlaInline: 'SLA reakcie: {{window}}',
            dialogueInbox: 'Centrum dialógov',
            dialogueSubtitle: 'Prejdite aktívne handshaky, posuňte ich ďalej a udržte každého človeka v kontexte.',
            openRoleDialogues: 'Otvorené dialógy roly',
            openRoles: 'Otvoriť roly',
            dialogues: 'Dialógy',
            dialoguesHint: 'Uvidíte, kto práve otvoril handshake, skontrolujete kontext a posuniete dialóg ďalej jedným kliknutím.',
            needsReview: 'Na revíziu',
            needsReviewHint: 'Otvorené dialógy stále čakajú na recruiter akciu alebo jasný ďalší krok.',
            sharedProfileSignal: 'Zdieľaný profilový signál',
            sharedProfileSignalHint: 'Kandidáti, ktorí zdieľali hlbší profilový signál pre lepší hiring kontext.',
            roleInFocus: 'Rola v pozornosti',
            activeDialogues: 'Aktívne dialógy',
            activeDialoguesHint: 'Otvorte dialóg, zmeňte stav alebo skočte rovno do naviazaného review flow.',
            candidatesSeeExpectation: 'Kandidát vidí očakávanie prvej reakcie do {{window}}.',
            noDialogues: 'Pre vybranú rolu zatiaľ nie sú žiadne dialógy.',
            candidate: 'Kandidát',
            coverLetter: 'Sprievodná správa',
            shared: 'Zdieľané',
            saving: 'Ukladám…',
            openDialogue: 'Otvoriť dialóg',
            dialogueReview: 'Revízia dialógu',
            dialogueReviewDesc: 'Štruktúrovaný dossier pre recruiter review.',
            loading: 'Načítavam...',
            selectPrompt: 'Vyberte dialóg z fronty a zobrazí sa plný kontext.'
        },
        de: {
            days: '{{count}} Tage',
            hours: '{{count}} Stunden',
            reviewed: 'Gelesen',
            shortlisted: 'Wir wollen fortfahren',
            rejected: 'Danke, wir wählen eine andere Richtung',
            hired: 'Eingestellt',
            withdrawn: 'Zurückgezogen',
            closedTimeout: 'Wegen Timeout geschlossen',
            roleFilled: 'Rolle besetzt',
            closed: 'Geschlossen',
            pending: 'Wartet auf erste Reaktion',
            closeReasonTimeout: 'Das Antwortfenster ist abgelaufen, bevor eine Seite geantwortet hat.',
            closeReasonRejected: 'Sie haben diesen Dialog geschlossen, ohne die Person weiterzubewegen.',
            closeReasonWithdrawn: 'Die Kandidatin bzw. der Kandidat hat den Dialog zurückgezogen.',
            closeReasonRoleFilled: 'Die Rolle wurde besetzt, bevor dieser Dialog weiterging.',
            closeReasonHired: 'Dieser Dialog endete mit einer Einstellungsentscheidung.',
            closeReasonGeneric: 'Dieser Dialog wurde ohne aktiven nächsten Schritt geschlossen.',
            timeoutClosed: 'Nach Ablauf des Antwortfensters geschlossen.',
            waitingForCandidate: 'Warten auf Kandidat:in',
            yourReplyDue: 'Ihre Antwort ist fällig',
            deadlinePassed: 'Frist abgelaufen',
            underHour: '< 1 Stunde übrig',
            hourLeft: '{{count}} h übrig',
            dayLeft: '{{count}} T übrig',
            responseSlaInline: 'Antwort-SLA: {{window}}',
            dialogueInbox: 'Dialog-Inbox',
            dialogueSubtitle: 'Prüfen Sie aktive Handshakes, bewegen Sie sie weiter und behalten Sie jede Person im Kontext.',
            openRoleDialogues: 'Offene Dialoge der Rolle',
            openRoles: 'Rollen öffnen',
            dialogues: 'Dialoge',
            dialoguesHint: 'Sehen Sie, wer gerade einen Handshake geöffnet hat, prüfen Sie den Kontext und bewegen Sie den Dialog mit einem Klick weiter.',
            needsReview: 'Braucht Review',
            needsReviewHint: 'Offene Dialoge warten noch auf Recruiter-Aktion oder einen klaren nächsten Schritt.',
            sharedProfileSignal: 'Geteiltes Profilsignal',
            sharedProfileSignalHint: 'Kandidat:innen, die ein tieferes Profilsignal für besseren Hiring-Kontext geteilt haben.',
            roleInFocus: 'Rolle im Fokus',
            activeDialogues: 'Aktive Dialoge',
            activeDialoguesHint: 'Öffnen Sie einen Dialog, ändern Sie den Status oder springen Sie direkt in den verknüpften Review-Flow.',
            candidatesSeeExpectation: 'Kandidat:innen sehen die Erwartung einer ersten Antwort innerhalb von {{window}}.',
            noDialogues: 'Für die gewählte Rolle gibt es noch keine Dialoge.',
            candidate: 'Kandidat:in',
            coverLetter: 'Anschreiben',
            shared: 'Geteilt',
            saving: 'Speichert…',
            openDialogue: 'Dialog öffnen',
            dialogueReview: 'Dialog-Review',
            dialogueReviewDesc: 'Strukturiertes Dossier für Recruiter-Review.',
            loading: 'Lädt...',
            selectPrompt: 'Wählen Sie einen Dialog aus der Queue, um den vollständigen Kontext zu sehen.'
        },
        pl: {
            days: '{{count}} dni',
            hours: '{{count}} godzin',
            reviewed: 'Przeczytane',
            shortlisted: 'Chcemy kontynuować',
            rejected: 'Dziękujemy, wybieramy inny kierunek',
            hired: 'Zatrudniono',
            withdrawn: 'Wycofano',
            closedTimeout: 'Zamknięto z powodu timeoutu',
            roleFilled: 'Rola obsadzona',
            closed: 'Zamknięte',
            pending: 'Czeka na pierwszą reakcję',
            closeReasonTimeout: 'Okno odpowiedzi wygasło, zanim odpowiedziała którakolwiek ze stron.',
            closeReasonRejected: 'Zamknęliście ten dialog bez przesunięcia kandydata dalej.',
            closeReasonWithdrawn: 'Kandydat wycofał się z tego dialogu.',
            closeReasonRoleFilled: 'Rola została obsadzona, zanim ten dialog był kontynuowany.',
            closeReasonHired: 'Ten dialog zakończył się decyzją o zatrudnieniu.',
            closeReasonGeneric: 'Ten dialog został zamknięty bez aktywnego kolejnego kroku.',
            timeoutClosed: 'Zamknięto po wygaśnięciu okna odpowiedzi.',
            waitingForCandidate: 'Czeka na kandydata',
            yourReplyDue: 'Czeka na Twoją odpowiedź',
            deadlinePassed: 'termin minął',
            underHour: '< 1 godzina została',
            hourLeft: '{{count}} h zostało',
            dayLeft: '{{count}} d zostało',
            responseSlaInline: 'SLA odpowiedzi: {{window}}',
            dialogueInbox: 'Skrzynka dialogów',
            dialogueSubtitle: 'Przeglądaj aktywne handshake’i, przesuwaj je dalej i trzymaj każdą osobę w kontekście.',
            openRoleDialogues: 'Otwarte dialogi roli',
            openRoles: 'Otwórz role',
            dialogues: 'Dialogi',
            dialoguesHint: 'Zobaczysz, kto właśnie otworzył handshake, sprawdzisz kontekst i przesuniesz dialog dalej jednym kliknięciem.',
            needsReview: 'Do review',
            needsReviewHint: 'Otwarte dialogi nadal czekają na działanie rekrutera albo jasny kolejny krok.',
            sharedProfileSignal: 'Udostępniony sygnał profilu',
            sharedProfileSignalHint: 'Kandydaci, którzy udostępnili głębszy sygnał profilu dla lepszego kontekstu hiringowego.',
            roleInFocus: 'Rola w fokusie',
            activeDialogues: 'Aktywne dialogi',
            activeDialoguesHint: 'Otwórz dialog, zmień status albo przejdź prosto do powiązanego review flow.',
            candidatesSeeExpectation: 'Kandydat widzi oczekiwanie pierwszej odpowiedzi w ciągu {{window}}.',
            noDialogues: 'Dla wybranej roli nie ma jeszcze żadnych dialogów.',
            candidate: 'Kandydat',
            coverLetter: 'Wiadomość wstępna',
            shared: 'Udostępnione',
            saving: 'Zapisywanie…',
            openDialogue: 'Otwórz dialog',
            dialogueReview: 'Przegląd dialogu',
            dialogueReviewDesc: 'Ustrukturyzowany dossier do recruiter review.',
            loading: 'Ładowanie...',
            selectPrompt: 'Wybierz dialog z kolejki, aby zobaczyć pełny kontekst.'
        },
        en: {
            days: '{{count}} days',
            hours: '{{count}} hours',
            reviewed: 'Read',
            shortlisted: 'We want to continue',
            rejected: 'Thanks, different direction',
            hired: 'Hired',
            withdrawn: 'Withdrawn',
            closedTimeout: 'Closed by timeout',
            roleFilled: 'Role filled',
            closed: 'Closed',
            pending: 'Waiting for first response',
            closeReasonTimeout: 'The reply window expired before either side responded.',
            closeReasonRejected: 'You closed this dialogue without moving the candidate forward.',
            closeReasonWithdrawn: 'The candidate withdrew from this dialogue.',
            closeReasonRoleFilled: 'The role was filled before this dialogue continued.',
            closeReasonHired: 'This dialogue ended in a hire decision.',
            closeReasonGeneric: 'This dialogue was closed without an active next step.',
            timeoutClosed: 'Closed after the reply window expired.',
            waitingForCandidate: 'Waiting for candidate',
            yourReplyDue: 'Your reply is due',
            deadlinePassed: 'deadline passed',
            underHour: '< 1 hour left',
            hourLeft: '{{count}} h left',
            dayLeft: '{{count}} d left',
            responseSlaInline: 'Response SLA: {{window}}',
            dialogueInbox: 'Dialogue inbox',
            dialogueSubtitle: 'Review active handshakes, move them forward, and keep each person in context.',
            openRoleDialogues: 'Open role dialogues',
            openRoles: 'Open roles',
            dialogues: 'Dialogues',
            dialoguesHint: 'See who just opened a handshake, review the context, and move the dialogue forward in one click.',
            needsReview: 'Needs review',
            needsReviewHint: 'Open dialogues still need recruiter action or a clear next step.',
            sharedProfileSignal: 'Shared profile signal',
            sharedProfileSignalHint: 'Candidates who shared a deeper profile signal for better hiring context.',
            roleInFocus: 'Role in focus',
            activeDialogues: 'Active dialogues',
            activeDialoguesHint: 'Open a dialogue, move status, or jump directly into the linked review flow.',
            candidatesSeeExpectation: 'Candidates see first-response expectation within {{window}}.',
            noDialogues: 'No dialogues for the selected role yet.',
            candidate: 'Candidate',
            coverLetter: 'Cover letter',
            shared: 'Shared',
            saving: 'Saving…',
            openDialogue: 'Open dialogue',
            dialogueReview: 'Dialogue review',
            dialogueReviewDesc: 'Structured dossier for recruiter review.',
            loading: 'Loading...',
            selectPrompt: 'Select a dialogue from the queue to review the full context.'
        }
    } as const)[language];
    const responseSlaLabel =
        resolvedResponseSlaHours % 24 === 0
            ? t('company.applications.reaction_sla_days', {
                defaultValue: copy.days,
                count: Math.max(1, Math.round(resolvedResponseSlaHours / 24))
            })
            : t('company.applications.reaction_sla_hours', {
                defaultValue: copy.hours,
                count: resolvedResponseSlaHours
            });

    const getStatusLabel = (status: CompanyApplicationRow['status']) => {
        switch (status) {
            case 'reviewed':
                return t('company.applications.response_state_read', {
                    defaultValue: copy.reviewed
                });
            case 'shortlisted':
                return t('company.applications.response_state_continue', {
                    defaultValue: copy.shortlisted
                });
            case 'rejected':
            case 'closed_rejected':
                return t('company.applications.response_state_declined', {
                    defaultValue: copy.rejected
                });
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
                return t('company.applications.response_state_pending', { defaultValue: copy.pending });
        }
    };

    const getStatusBadgeClass = (status: CompanyApplicationRow['status']) => {
        switch (status) {
            case 'shortlisted':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            case 'rejected':
            case 'closed_rejected':
                return 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
            case 'hired':
                return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
            case 'closed_timeout':
                return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
            case 'withdrawn':
            case 'closed':
            case 'closed_withdrawn':
                return 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
            case 'closed_role_filled':
                return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
            case 'reviewed':
                return 'border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] text-[var(--accent)]';
            default:
                return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        }
    };

    const isSelectableStatus = (status: CompanyApplicationRow['status']) =>
        ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'].includes(String(status || 'pending'));

    const getDialogueClosedReasonMeta = (
        item: Pick<CompanyApplicationRow, 'status' | 'dialogue_closed_reason'>
    ): { label: string; className: string } | null => {
        if (!item || ['pending', 'reviewed', 'shortlisted'].includes(String(item.status || 'pending'))) {
            return null;
        }

        const normalizedReason = String(item.dialogue_closed_reason || item.status || '').trim().toLowerCase();
        switch (normalizedReason) {
            case 'timeout':
            case 'closed_timeout':
                return {
                    label: t('company.applications.close_reason_timeout', { defaultValue: copy.closeReasonTimeout }),
                    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                };
            case 'rejected':
            case 'closed_rejected':
                return {
                    label: t('company.applications.close_reason_rejected', { defaultValue: copy.closeReasonRejected }),
                    className: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
                };
            case 'withdrawn':
            case 'closed_withdrawn':
                return {
                    label: t('company.applications.close_reason_withdrawn', { defaultValue: copy.closeReasonWithdrawn }),
                    className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                };
            case 'closed_role_filled':
                return {
                    label: t('company.applications.close_reason_role_filled', { defaultValue: copy.closeReasonRoleFilled }),
                    className: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                };
            case 'hired':
                return {
                    label: t('company.applications.close_reason_hired', { defaultValue: copy.closeReasonHired }),
                    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                };
            case 'closed':
            default:
                return {
                    label: t('company.applications.close_reason_generic', { defaultValue: copy.closeReasonGeneric }),
                    className: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                };
        }
    };

    const getDialogueTimingMeta = (
        item: Pick<
            CompanyApplicationRow,
            'status' | 'dialogue_deadline_at' | 'dialogue_current_turn' | 'dialogue_closed_reason' | 'dialogue_is_overdue'
        >
    ): { label: string; className: string } | null => {
        const closedReason = String(item.dialogue_closed_reason || '').trim().toLowerCase();
        if (item.status === 'closed_timeout' || closedReason === 'timeout') {
            return {
                label: t('company.applications.timeout_closed', { defaultValue: copy.timeoutClosed }),
                className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            };
        }
        if (!['pending', 'reviewed', 'shortlisted'].includes(String(item.status || 'pending'))) {
            return null;
        }
        const deadlineValue = String(item.dialogue_deadline_at || '').trim();
        if (!deadlineValue) return null;
        const deadline = new Date(deadlineValue);
        if (Number.isNaN(deadline.getTime())) return null;
        const msRemaining = deadline.getTime() - Date.now();
        const actorLabel =
            item.dialogue_current_turn === 'candidate'
                ? t('company.applications.turn_candidate', { defaultValue: copy.waitingForCandidate })
                : t('company.applications.turn_company', { defaultValue: copy.yourReplyDue });
        if (item.dialogue_is_overdue || msRemaining <= 0) {
            return {
                label: `${actorLabel} • ${t('company.applications.deadline_passed', { defaultValue: copy.deadlinePassed })}`,
                className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
            };
        }
        const totalHours = msRemaining / (60 * 60 * 1000);
        const windowLabel =
            totalHours < 1
                ? t('company.applications.deadline_under_hour', { defaultValue: copy.underHour })
                : totalHours < 24
                    ? t('company.applications.deadline_hours', {
                        defaultValue: copy.hourLeft,
                        count: Math.max(1, Math.ceil(totalHours))
                    })
                    : t('company.applications.deadline_days', {
                        defaultValue: copy.dayLeft,
                        count: Math.max(1, Math.ceil(totalHours / 24))
                    });
        return {
            label: `${actorLabel} • ${windowLabel}`,
            className:
                totalHours <= 12
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                    : 'border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] text-[var(--accent)]'
        };
    };

    const getResponseSlaHint = (
        item: Pick<CompanyApplicationRow, 'dialogue_timeout_hours'>
    ): string => {
        const rawHours = Number(item.dialogue_timeout_hours);
        const resolvedHours = Number.isFinite(rawHours) && rawHours > 0 ? Math.max(1, Math.round(rawHours)) : 48;
        const windowLabel =
            resolvedHours % 24 === 0
                ? t('company.applications.response_sla_days', {
                    defaultValue: copy.days,
                    count: Math.max(1, Math.round(resolvedHours / 24))
                })
                : t('company.applications.response_sla_hours', {
                    defaultValue: copy.hours,
                    count: resolvedHours
                });
        return t('company.applications.response_sla_hint_inline', {
            defaultValue: copy.responseSlaInline,
            window: windowLabel
        });
    };

    return (
        <div className="space-y-4 animate-in fade-in">
            <WorkspaceHeader
                badgeIcon={<Briefcase size={12} />}
                badgeLabel={t('company.applications.title', { defaultValue: copy.dialogueInbox })}
                title={t('company.applications.title', { defaultValue: copy.dialogueInbox })}
                subtitle={t('company.applications.subtitle', { defaultValue: copy.dialogueSubtitle })}
                actions={
                    <>
                        <WorkspaceSyncBadge
                            loading={resolvedDialoguesLoading}
                            syncedAt={lastSyncedAt}
                            onRefresh={onRefresh}
                        />
                        <div className="company-control min-w-[240px] px-3.5 py-2.5">
                            <div className="mb-1 text-[11px] uppercase tracking-widest text-[var(--text-faint)]">
                                {t('company.jobs.open_applications', { defaultValue: copy.openRoleDialogues })}
                            </div>
                            <select
                                value={selectedJobId}
                                onChange={(e) => onSelectedJobChange(e.target.value)}
                                className="w-full cursor-pointer border-none bg-transparent p-0 font-semibold text-[var(--text-strong)] ring-0 focus:outline-none dark:[color-scheme:dark]"
                            >
                                {jobs.map((job) => (
                                    <option key={job.id} value={job.id} className="bg-white dark:bg-slate-900">{job.title}</option>
                                ))}
                            </select>
                        </div>
                        <button onClick={onOpenJobs} className="app-button-secondary rounded-full px-4 py-2.5 text-sm">
                            {t('company.workspace.actions.open_jobs', { defaultValue: copy.openRoles })}
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <MetricCard
                    label={t('company.workspace.labels.applications', { defaultValue: copy.dialogues })}
                    value={resolvedDialogues.length}
                    hint={t('company.workspace.cards.recent_applications_desc', { defaultValue: copy.dialoguesHint })}
                />
                <MetricCard
                    label={t('company.workspace.metrics.review_queue', { defaultValue: copy.needsReview })}
                    value={openDialogues.length}
                    hint={t('company.workspace.metrics.review_queue_hint', { defaultValue: copy.needsReviewHint })}
                />
                <MetricCard
                    label={t('company.applications.metrics.shared_jcfpm', { defaultValue: copy.sharedProfileSignal })}
                    value={sharedJcfpmCount}
                    hint={t('company.applications.metrics.shared_jcfpm_hint', { defaultValue: copy.sharedProfileSignalHint })}
                />
                <MetricCard
                    label={t('company.assessment_library.selected_role', { defaultValue: copy.roleInFocus })}
                    value={<span className="text-base font-semibold">{selectedJob?.title || t('company.dashboard.table.position')}</span>}
                    hint={selectedJob?.location || t('company.dashboard.empty_state_desc')}
                />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-3">
                <WorkspacePanel className="p-3">
                    <SectionHeader
                        title={t('company.candidates.applications_title', { defaultValue: copy.activeDialogues })}
                        subtitle={t('company.workspace.cards.recent_applications_desc', { defaultValue: copy.activeDialoguesHint })}
                            aside={resolvedDialoguesLoading ? (
                            <span className="text-xs text-slate-500 dark:text-slate-400">{t('common.loading', { defaultValue: copy.loading })}</span>
                        ) : undefined}
                        className="mb-3"
                    />
                    <div className="mb-3 rounded-[0.9rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-3 py-2 text-xs text-[var(--accent)]">
                        {t('company.applications.reaction_sla_hint', {
                            defaultValue: copy.candidatesSeeExpectation,
                            window: responseSlaLabel
                        })}
                    </div>
                    {resolvedDialogues.length === 0 && !resolvedDialoguesLoading ? (
                        <div className="rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('company.candidates.applications_empty', { defaultValue: copy.noDialogues })}
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {resolvedDialogues.map((dialogue) => {
                                const timingMeta = getDialogueTimingMeta(dialogue);
                                const closeReasonMeta = getDialogueClosedReasonMeta(dialogue);
                                return (
                                <div key={dialogue.id} className="rounded-[1rem] border border-slate-200/80 bg-white/85 px-3 py-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-slate-950/30">
                                    <div className="flex flex-col gap-2.5">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex items-start gap-3">
                                                {dialogue.candidateAvatarUrl || dialogue.candidate_avatar_url ? (
                                                    <img
                                                        src={dialogue.candidateAvatarUrl || dialogue.candidate_avatar_url}
                                                        alt={dialogue.candidate_name || copy.candidate}
                                                        className="h-11 w-11 shrink-0 rounded-2xl object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
                                                        {getAvatarInitials(dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: copy.candidate }))}
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                                                        {dialogue.candidate_name || t('company.applications.labels.candidate', { defaultValue: copy.candidate })}
                                                    </div>
                                                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 space-y-1">
                                                        <div>{dialogue.job_title || t('company.dashboard.table.position')}</div>
                                                        {dialogue.candidateHeadline && (
                                                            <div className="text-[11px] text-slate-400">{dialogue.candidateHeadline}</div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {isSelectableStatus(dialogue.status) ? (
                                                <select
                                                    value={dialogue.status}
                                                    onChange={(e) => onStatusChange(dialogue.id, e.target.value as CompanyApplicationRow['status'])}
                                                    className="company-control rounded-full px-2.5 py-1 text-xs dark:[color-scheme:dark]"
                                                    disabled={resolvedDialoguesUpdating[dialogue.id]}
                                                >
                                                    <option value="pending">{t('company.applications.response_state_pending', { defaultValue: copy.pending })}</option>
                                                    <option value="reviewed">{t('company.applications.response_state_read', { defaultValue: copy.reviewed })}</option>
                                                    <option value="shortlisted">{t('company.applications.response_state_continue', { defaultValue: copy.shortlisted })}</option>
                                                    <option value="rejected">{t('company.applications.response_state_declined', { defaultValue: copy.rejected })}</option>
                                                    <option value="hired">{t('company.dashboard.status.hired', { defaultValue: copy.hired })}</option>
                                                </select>
                                            ) : (
                                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClass(dialogue.status)}`}>
                                                    {getStatusLabel(dialogue.status)}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[11px]">
                                            {timingMeta && (
                                                <span className={`rounded-full px-2 py-1 ${timingMeta.className}`}>
                                                    {timingMeta.label}
                                                </span>
                                            )}
                                            {closeReasonMeta && (
                                                <span className={`rounded-full px-2 py-1 ${closeReasonMeta.className}`}>
                                                    {closeReasonMeta.label}
                                                </span>
                                            )}
                                            <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
                                                {getResponseSlaHint(dialogue)}
                                            </span>
                                            {dialogue.hasCv && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">CV</span>}
                                            {dialogue.hasCoverLetter && <span className="rounded-full bg-slate-100 px-2 py-1 dark:bg-slate-800">{t('company.workspace.labels.cover_letter', { defaultValue: copy.coverLetter })}</span>}
                                            {dialogue.hasJcfpm && (
                                                <span className="rounded-full border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] px-2 py-1 text-[var(--accent)]">
                                                    JCFPM: {t('company.applications.labels.summary', { defaultValue: copy.shared })}
                                                </span>
                                            )}
                                            {resolvedDialoguesUpdating[dialogue.id] && (
                                                <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                                    {t('common.saving', { defaultValue: copy.saving })}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex justify-end">
                                            <button
                                                onClick={() => handleOpenDialogue?.(dialogue.id)}
                                                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                                                    resolvedSelectedDialogueId === dialogue.id
                                                        ? 'border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] text-[var(--accent)]'
                                                        : 'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)] hover:bg-[var(--surface-elevated)]'
                                                }`}
                                            >
                                                {t('company.candidates.open_application', { defaultValue: copy.openDialogue })}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    )}
                </WorkspacePanel>

                <WorkspacePanel className="p-3" bodyClassName="space-y-3">
                    <SectionHeader
                        title={t('company.candidates.application_review_title', { defaultValue: copy.dialogueReview })}
                        subtitle={resolvedSelectedDialogueDetail
                            ? (getDialogueTimingMeta(resolvedSelectedDialogueDetail) || getDialogueClosedReasonMeta(resolvedSelectedDialogueDetail) || null)?.label ||
                              (resolvedSelectedDialogueDetail.submitted_at
                                  ? new Date(resolvedSelectedDialogueDetail.submitted_at).toLocaleString(dateTimeLocale)
                                  : t('company.candidates.application_review_desc', { defaultValue: copy.dialogueReviewDesc }))
                            : t('company.candidates.application_review_desc', { defaultValue: copy.dialogueReviewDesc })}
                        aside={resolvedSelectedDialogueDetail ? (
                            <button
                                onClick={onCloseDetail}
                                className="rounded-[0.85rem] p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
                            >
                                <X size={16} />
                            </button>
                        ) : undefined}
                    />

                    {resolvedDialogueDetailLoading ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading', { defaultValue: copy.loading })}</div>
                    ) : resolvedSelectedDialogueDetail ? (
                        <ApplicationDossierDetail
                            dialogue={resolvedSelectedDialogueDetail}
                            dossier={resolvedSelectedDialogueDetail}
                            companyId={companyId}
                            locale={i18n.language}
                            onCreateAssessmentFromDialogue={handleCreateAssessment}
                            onCreateAssessmentFromApplication={handleCreateAssessment}
                            onInviteCandidateFromDialogue={handleInviteCandidate}
                            onInviteCandidateFromApplication={handleInviteCandidate}
                        />
                    ) : (
                        <div className="rounded-[1rem] border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                            {t('company.applications.detail.select_prompt', { defaultValue: copy.selectPrompt })}
                        </div>
                    )}
                </WorkspacePanel>
            </div>
        </div>
    );
};

export default CompanyApplicationsWorkspace;
