import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X,
    MapPin,
    Briefcase,
    Bookmark,
    Handshake,
    Info,
    Sparkles,
    ArrowUpRight,
    CircleDollarSign,
    Clock3,
    Gauge,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CommuteAnalysis, Job, JobHumanContext, JobPublicPerson, UserProfile } from '../types';
import { calculateCommuteReality, isRemoteJob } from '../services/commuteService';
import JHIChart from './JHIChart';
import { cn, Badge, MetricTile } from './ui/primitives';
import { fetchJobHumanContext } from '../services/jobService';
import { getFallbackCompanyAvatarUrl, isStockCompanyAvatarUrl } from '../utils/companyStockAvatars';

interface RoleDetailPanelProps {
    job: Job | null;
    isOpen: boolean;
    onClose: () => void;
    onOpenProfile?: () => void;
    onToggleSave: (jobId: string) => void;
    isSaved: boolean;
    userProfile: UserProfile;
    variant?: 'side' | 'modal' | 'docked';
    className?: string;
}

export const RoleDetailPanel: React.FC<RoleDetailPanelProps> = ({
    job,
    isOpen,
    onClose,
    onOpenProfile,
    onToggleSave,
    isSaved,
    userProfile,
    variant = 'side',
    className
}) => {
    if (!job) return null;

    const getInitials = (value: string): string => {
        const parts = String(value || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
        if (!parts.length) return 'JS';
        return parts.map((part) => part[0]?.toUpperCase() || '').join('');
    };

    const { i18n } = useTranslation();
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [commuteAnalysis, setCommuteAnalysis] = useState<CommuteAnalysis | null>(null);
    const [humanContext, setHumanContext] = useState<JobHumanContext | null>(null);
    const isDarkTheme = useMemo(() => {
        if (typeof document === 'undefined') return false;
        return document.documentElement.classList.contains('dark');
    }, []);

    const remoteRole = isRemoteJob(job);
    const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = locale === 'cs' || locale === 'sk';
    const isImported = job.listingKind === 'imported';
    const isNativeChallenge = !isImported && Boolean(job.company_id) && String(job.source || '').trim().toLowerCase() === 'jobshaman.cz';
    const publisher: JobPublicPerson | null = humanContext?.publisher || null;

    const companyLogoUrl = useMemo(() => {
        const raw = String(job.companyProfile?.logo_url || '').trim();
        return raw || null;
    }, [job.companyProfile?.logo_url]);

    const headerAvatarUrl = useMemo(() => {
        const publisherAvatar = String(publisher?.avatar_url || '').trim();
        if (publisherAvatar) return publisherAvatar;
        if (companyLogoUrl) return companyLogoUrl;
        return getFallbackCompanyAvatarUrl(job.company);
    }, [companyLogoUrl, job.company, publisher?.avatar_url]);

    const headerMetaLine = useMemo(() => {
        if (publisher) {
            const role = String(publisher.display_role || '').trim();
            return role ? `${publisher.display_name} · ${role}` : publisher.display_name;
        }
        return isCsLike ? 'Tým' : 'Team';
    }, [isCsLike, publisher]);

    const useHeaderMonogram = isStockCompanyAvatarUrl(headerAvatarUrl);
    const headerInitials = getInitials(publisher?.display_name || job.company);

    const listingBadge = useMemo(() => {
        if (isImported) return isCsLike ? 'Importovaná nabídka' : 'Imported listing';
        if (job.challenge_format === 'micro_job') return isCsLike ? 'Mini výzva' : 'Mini challenge';
        return isCsLike ? 'Výzva' : 'Challenge';
    }, [isCsLike, isImported, job.challenge_format]);

    const workModelLabel = useMemo(() => {
        const raw = String(job.work_model || job.type || '').trim();
        return raw || (isCsLike ? 'Domluvou' : 'Flexible');
    }, [isCsLike, job.type, job.work_model]);

    const salaryLabel = useMemo(() => {
        const explicit = String(job.salaryRange || '').trim();
        if (explicit) return explicit;
        const from = Number((job as any).salary_from || 0);
        const to = Number((job as any).salary_to || 0);
        const currency = String((job as any).salary_currency || (isCsLike ? 'CZK' : 'EUR'));
        if (from && to) return `${from.toLocaleString(i18n.language)} - ${to.toLocaleString(i18n.language)} ${currency}`;
        if (from || to) return `${(from || to).toLocaleString(i18n.language)} ${currency}`;
        return isCsLike ? 'Mzda domluvou' : 'Compensation flexible';
    }, [i18n.language, isCsLike, job]);

    const heroSignalScore = useMemo(() => {
        const raw = Number(job.priorityScore ?? job.aiMatchScore ?? job.searchScore ?? job.jhi?.score ?? 0);
        if (!Number.isFinite(raw) || raw <= 0) return null;
        return Math.max(0, Math.min(99, Math.round(raw)));
    }, [job.aiMatchScore, job.jhi?.score, job.priorityScore, job.searchScore]);

    const heroSignalDisplay = heroSignalScore ?? Math.max(12, Math.round(job.jhi?.score || 0));

    const signalLabel = useMemo(() => {
        if (heroSignalDisplay >= 80) return isCsLike ? 'Silný match' : 'Strong match';
        if (heroSignalDisplay >= 65) return isCsLike ? 'Slibný směr' : 'Promising fit';
        return isCsLike ? 'Stojí za pohled' : 'Worth a look';
    }, [heroSignalDisplay, isCsLike]);

    useEffect(() => {
        let cancelled = false;
        const loadHumanContext = async () => {
            if (!isOpen || !isNativeChallenge) {
                setHumanContext(null);
                return;
            }
            try {
                const payload = await fetchJobHumanContext(job.id);
                if (!cancelled) setHumanContext(payload);
            } catch (error) {
                console.warn('Human context fetch failed:', error);
                if (!cancelled) setHumanContext(null);
            }
        };
        void loadHumanContext();
        return () => {
            cancelled = true;
        };
    }, [isNativeChallenge, isOpen, job.id]);

    useEffect(() => {
        if (!isOpen) return;
        const el = scrollRef.current;
        if (!el) return;
        el.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [isOpen, job.id]);

    useEffect(() => {
        if (!userProfile?.isLoggedIn) {
            setCommuteAnalysis(null);
            return;
        }
        if ((!userProfile.address && !userProfile.coordinates) && !remoteRole) {
            setCommuteAnalysis(null);
            return;
        }
        try {
            const safeJob = {
                ...job,
                benefits: Array.isArray((job as any).benefits) ? (job as any).benefits : [],
                tags: Array.isArray((job as any).tags) ? (job as any).tags : [],
            } as Job;
            const profileForCalc = userProfile.address
                ? userProfile
                : {
                    ...userProfile,
                    address: isCsLike ? 'Vaše aktuální poloha' : 'Your current location',
                };
            setCommuteAnalysis(calculateCommuteReality(safeJob, profileForCalc));
        } catch (err) {
            console.warn('Failed to calculate commute reality', err);
            setCommuteAnalysis(null);
        }
    }, [isCsLike, job, remoteRole, userProfile]);

    const financialCopy = useMemo(() => {
        if (isCsLike) {
            return {
                quickView: 'Rychlý přehled',
                marketSignal: 'AI signál',
                package: 'Finanční rámec',
                workSetup: 'Režim práce',
                location: 'Lokalita',
                coreChallenge: 'Jádro role',
                noDescription: 'Pro tuhle roli zatím není dostupný detailní popis.',
                title: 'Finanční a dojezdová realita',
                realitySummary: 'Co z nabídky zůstane po započtení čistého příjmu, benefitů a dojíždění.',
                loginPrompt: 'Přihlaste se, ať se dopočítá čistý příjem a realita dojezdu podle Vašeho profilu.',
                addressPrompt: 'Doplňte adresu nebo souřadnice v profilu, ať se dá spočítat realita dojezdu.',
                openProfile: 'Otevřít profil',
                gross: 'Hrubá mzda',
                net: 'Čistý základ',
                benefits: 'Benefity',
                commute: 'Dojíždění',
                oneWay: 'Jedna cesta',
                dailyTime: 'Denně čas',
                realValue: 'Reálná hodnota',
                formula: '{{net}} + {{benefits}} − {{commute}} = {{total}}',
                jhiImpact: 'Dopad do JHI',
                commuteFailed: 'Realitu dojezdu se nepodařilo spočítat.',
                signalFootnote: 'Kombinace směru role, kontextu firmy a kvality nabídky.',
                saveLabel: 'Sledovat nabídku',
                savedLabel: 'Uloženo',
                saveBody: 'Uložit pro později',
                savedBody: 'Máte ji po ruce',
                handshakeButton: 'Podat ruku {{team}}',
                handshakeFallback: 'týmu',
                handshakeHint: 'Handshake otevře přímý dialog nad konkrétní situací z této role.',
            };
        }
        return {
            quickView: 'Quick view',
            marketSignal: 'AI signal',
            package: 'Compensation',
            workSetup: 'Work setup',
            location: 'Location',
            coreChallenge: 'The core challenge',
            noDescription: 'A detailed description is not available for this role yet.',
            title: 'Financial and commute reality',
            realitySummary: 'What remains from the offer once net pay, benefits, and commute are counted in.',
            loginPrompt: 'Sign in to compute net income and commute reality from your profile.',
            addressPrompt: 'Add your address (or coordinates) to compute commute reality.',
            openProfile: 'Open profile',
            gross: 'Gross salary',
            net: 'Net base',
            benefits: 'Benefits',
            commute: 'Commute',
            oneWay: 'One way',
            dailyTime: 'Daily time',
            realValue: 'Real value',
            formula: '{{net}} + {{benefits}} − {{commute}} = {{total}}',
            jhiImpact: 'JHI impact',
            commuteFailed: 'Commute reality could not be computed.',
            signalFootnote: 'A blend of role direction, company context, and listing quality.',
            saveLabel: 'Track role',
            savedLabel: 'Saved',
            saveBody: 'Save for later',
            savedBody: 'Kept close',
            handshakeButton: 'Handshake with {{team}}',
            handshakeFallback: 'the team',
            handshakeHint: 'Handshake starts a direct dialogue around the concrete situation in this role.',
        };
    }, [isCsLike]);

    const softTileClass = 'relative overflow-hidden rounded-[1.65rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,250,248,0.82))] p-4 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.62))]';
    const softPanelClass = 'relative overflow-hidden rounded-[2.15rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(246,250,247,0.8))] p-5 shadow-[0_28px_70px_-44px_rgba(15,23,42,0.24)] backdrop-blur-xl dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.86),rgba(15,23,42,0.7))] sm:p-6';
    const panelGlow = 'absolute inset-x-6 top-0 h-20 rounded-full bg-[radial-gradient(circle,rgba(var(--accent-rgb),0.14),transparent_70%)] blur-2xl';

    const content = (
        <div className="flex h-full flex-col overflow-hidden">
            <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-[linear-gradient(135deg,#7c8278_0%,#8a9084_24%,#9fa496_56%,#6f7669_100%)] px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-85"
                    style={{
                        backgroundImage: [
                            'radial-gradient(circle at 14% 24%, rgba(255,255,255,0.24), transparent 42%)',
                            'radial-gradient(circle at 82% 20%, rgba(255,255,255,0.12), transparent 46%)',
                            'radial-gradient(circle at 68% 72%, rgba(188,255,108,0.18), transparent 34%)',
                            'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(0,0,0,0.18))',
                        ].join(', ')
                    }}
                />

                <div
                    aria-hidden
                    className="absolute inset-x-[16%] top-[22%] h-40 rotate-[-18deg] rounded-[2.5rem] border border-white/20 bg-[linear-gradient(135deg,rgba(255,255,255,0.16),rgba(255,255,255,0.02))] shadow-[0_18px_48px_-24px_rgba(15,23,42,0.35)] backdrop-blur-[2px]"
                >
                    <div className="absolute inset-4 rounded-[2rem] border border-white/12" />
                    <div className="absolute inset-x-6 top-8 h-px bg-white/30" />
                    <div className="absolute inset-x-10 top-14 h-px bg-white/20" />
                    <div className="absolute inset-x-12 top-20 h-px bg-lime-300/50" />
                    <div className="absolute bottom-8 left-10 right-16 top-8 grid grid-cols-4 gap-3 opacity-40">
                        {Array.from({ length: 12 }).map((_, index) => (
                            <span key={index} className="rounded-full border border-white/16" />
                        ))}
                    </div>
                </div>

                <motion.div
                    aria-hidden
                    animate={{ x: [0, 18, 0], y: [0, -10, 0], rotate: [0, 18, 0], opacity: [0.22, 0.34, 0.22] }}
                    transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
                    className={cn(
                        'absolute -left-12 -top-14 h-56 w-56 rounded-[48%_52%_55%_45%/55%_45%_55%_45%] bg-white/28 blur-3xl'
                    )}
                />
                <motion.div
                    aria-hidden
                    animate={{ x: [0, -14, 0], y: [0, 12, 0], rotate: [0, -12, 0], opacity: [0.16, 0.28, 0.16] }}
                    transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
                    className={cn(
                        'absolute -bottom-20 -right-16 h-64 w-64 rounded-[55%_45%_45%_55%/45%_55%_45%_55%] bg-black/20 blur-3xl'
                    )}
                />

                <button
                    onClick={onClose}
                    className="absolute right-5 top-5 z-10 rounded-full bg-black/12 p-2.5 text-white transition-all backdrop-blur-md hover:bg-black/20 sm:right-6 sm:top-6"
                    type="button"
                >
                    <X size={20} />
                </button>

                <div className="relative z-10 grid gap-4 pt-10">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3 rounded-[1.35rem] bg-black/12 px-3.5 py-3 backdrop-blur-md ring-1 ring-white/15">
                            {useHeaderMonogram ? (
                                <div className="flex h-12 w-12 items-center justify-center rounded-[1.15rem] bg-white/14 text-xs font-bold text-white ring-1 ring-white/20">
                                    {headerInitials}
                                </div>
                            ) : (
                                <img
                                    src={headerAvatarUrl}
                                    alt={publisher?.display_name || job.company}
                                    className="h-12 w-12 rounded-[1.15rem] object-cover ring-1 ring-white/20"
                                    loading="lazy"
                                />
                            )}
                            <div className="min-w-0">
                                <div className="truncate text-sm font-semibold text-white">{job.company}</div>
                                <div className="truncate text-xs text-white/78">{headerMetaLine}</div>
                            </div>
                        </div>
                        <Badge variant="teal" className="border-none bg-white/92 text-[var(--accent)] shadow-sm">
                            <Sparkles size={12} className="mr-1" />
                            {listingBadge}
                        </Badge>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_14rem] lg:items-end">
                        <div className="space-y-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/68">
                                {financialCopy.quickView}
                            </div>
                            <div className="max-w-[28rem] text-3xl font-semibold leading-[0.95] tracking-[-0.06em] text-white sm:text-[2.7rem]">
                                {job.title}
                            </div>
                            <div className="flex flex-wrap gap-2.5">
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/14 px-3 py-1.5 text-sm text-white/92 ring-1 ring-white/14">
                                    <MapPin size={14} className="text-lime-200" />
                                    {job.location}
                                </div>
                                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white/80 ring-1 ring-white/12">
                                    <Briefcase size={14} />
                                    {workModelLabel}
                                </div>
                            </div>
                        </div>

                        <div className="rounded-[1.75rem] border border-white/14 bg-black/16 p-4 text-white shadow-[0_18px_48px_-28px_rgba(15,23,42,0.5)] backdrop-blur-md">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/58">
                                        {financialCopy.marketSignal}
                                    </div>
                                    <div className="mt-3 flex items-end gap-2">
                                        <div className="text-4xl font-semibold leading-none tracking-[-0.06em]">
                                            {heroSignalDisplay}
                                        </div>
                                        <div className="pb-1 text-sm text-white/62">/100</div>
                                    </div>
                                </div>
                                <div className="rounded-full bg-lime-300/18 p-2 text-lime-200 ring-1 ring-lime-200/25">
                                    <Gauge size={16} />
                                </div>
                            </div>
                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/12">
                                <div
                                    className="h-full rounded-full bg-[linear-gradient(90deg,#ffffff_0%,#d9ff75_52%,#b8ff46_100%)]"
                                    style={{ width: `${heroSignalDisplay}%` }}
                                />
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                                <span className="text-xs text-white/82">{signalLabel}</span>
                                <span className="text-right text-[10px] leading-4 text-white/54">{financialCopy.signalFootnote}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div
                ref={scrollRef}
                className="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-[radial-gradient(circle_at_top,rgba(var(--accent-rgb),0.08),transparent_32%),linear-gradient(180deg,rgba(244,248,245,0.94),rgba(238,243,240,0.98))] p-5 dark:bg-[radial-gradient(circle_at_top,rgba(var(--accent-rgb),0.14),transparent_28%),linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))] sm:p-6"
            >
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className={softTileClass}>
                        <div aria-hidden className={panelGlow} />
                        <div className="flex items-start justify-between gap-3">
                            <div className="relative z-10">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                                    {financialCopy.package}
                                </div>
                                <div className="mt-3 text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text-strong)]">
                                    {salaryLabel}
                                </div>
                            </div>
                            <div className="relative z-10 rounded-full bg-[rgba(var(--accent-rgb),0.1)] p-2 text-[var(--accent)] ring-1 ring-[rgba(var(--accent-rgb),0.14)]">
                                <CircleDollarSign size={16} />
                            </div>
                        </div>
                    </div>

                    <div className={softTileClass}>
                        <div aria-hidden className={panelGlow} />
                        <div className="flex items-start justify-between gap-3">
                            <div className="relative z-10">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                                    {financialCopy.workSetup}
                                </div>
                                <div className="mt-3 text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text-strong)]">
                                    {workModelLabel}
                                </div>
                            </div>
                            <div className="relative z-10 rounded-full bg-[rgba(var(--accent-rgb),0.1)] p-2 text-[var(--accent)] ring-1 ring-[rgba(var(--accent-rgb),0.14)]">
                                <Briefcase size={16} />
                            </div>
                        </div>
                    </div>

                    <div className={softTileClass}>
                        <div aria-hidden className={panelGlow} />
                        <div className="flex items-start justify-between gap-3">
                            <div className="relative z-10">
                                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                                    {financialCopy.location}
                                </div>
                                <div className="mt-3 text-lg font-semibold leading-tight tracking-[-0.04em] text-[var(--text-strong)]">
                                    {job.location}
                                </div>
                            </div>
                            <div className="relative z-10 rounded-full bg-[rgba(var(--accent-rgb),0.1)] p-2 text-[var(--accent)] ring-1 ring-[rgba(var(--accent-rgb),0.14)]">
                                <MapPin size={16} />
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleSave(job.id);
                        }}
                        className={cn(
                            'relative flex min-h-[7.5rem] flex-col justify-between overflow-hidden rounded-[1.65rem] border p-4 text-left transition-all duration-300 shadow-[0_22px_46px_-34px_rgba(15,23,42,0.22)] backdrop-blur-xl',
                            isSaved
                                ? 'border-[rgba(var(--accent-rgb),0.24)] bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.12),rgba(255,255,255,0.72))] text-[var(--accent)] dark:bg-[linear-gradient(180deg,rgba(var(--accent-rgb),0.18),rgba(15,23,42,0.72))]'
                                : 'border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(247,250,248,0.82))] text-[var(--text-strong)] hover:border-[rgba(var(--accent-rgb),0.22)] dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.62))]'
                        )}
                        type="button"
                    >
                        <div aria-hidden className={panelGlow} />
                        <div className="flex items-start justify-between gap-3">
                            <div className="relative z-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                                {isSaved ? financialCopy.savedLabel : financialCopy.saveLabel}
                            </div>
                            <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} className="relative z-10" />
                        </div>
                        <div className="relative z-10 flex items-center gap-2 text-sm font-medium">
                            <span>{isSaved ? financialCopy.savedBody : financialCopy.saveBody}</span>
                            <ArrowUpRight size={15} />
                        </div>
                    </button>
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.18fr)_minmax(17rem,0.82fr)]">
                    <div className={softPanelClass}>
                        <div aria-hidden className={panelGlow} />
                        <div className="relative z-10">
                        <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--text-strong)]">
                            <Info size={20} className="text-[var(--accent)]" />
                            {financialCopy.coreChallenge}
                        </h3>
                        <div className="mt-4 whitespace-pre-wrap text-[15px] leading-7 text-[var(--text)]">
                            {job.description || financialCopy.noDescription}
                        </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className={cn(softPanelClass, 'border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(155deg,rgba(255,255,255,0.94),rgba(var(--accent-rgb),0.08),rgba(246,250,247,0.82))] dark:bg-[linear-gradient(160deg,rgba(15,23,42,0.86),rgba(var(--accent-rgb),0.14),rgba(15,23,42,0.72))]')}>
                            <div aria-hidden className={panelGlow} />
                            <div className="relative z-10 flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                                        {financialCopy.title}
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                                        {financialCopy.realitySummary}
                                    </p>
                                </div>
                                <div className="rounded-full bg-[rgba(var(--accent-rgb),0.08)] p-2 text-[var(--accent)]">
                                    <Clock3 size={16} />
                                </div>
                            </div>

                            {!userProfile.isLoggedIn ? (
                                <div className="relative z-10 mt-5 space-y-3">
                                    <div className="text-sm leading-6 text-[var(--text-muted)]">{financialCopy.loginPrompt}</div>
                                </div>
                            ) : (!userProfile.address && !userProfile.coordinates && !remoteRole) ? (
                                <div className="relative z-10 mt-5 space-y-3">
                                    <div className="text-sm leading-6 text-[var(--text-muted)]">{financialCopy.addressPrompt}</div>
                                    <button
                                        type="button"
                                        className="app-button-secondary w-fit"
                                        onClick={() => onOpenProfile?.()}
                                        disabled={!onOpenProfile}
                                    >
                                        {financialCopy.openProfile}
                                    </button>
                                </div>
                            ) : commuteAnalysis ? (
                                <div className="relative z-10 mt-5 space-y-4">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <MetricTile
                                            label={financialCopy.realValue}
                                            value={`${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                            tone="accent"
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.jhiImpact}
                                            value={`${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}`}
                                            tone={commuteAnalysis.jhiImpact >= 0 ? 'success' : 'warning'}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.gross}
                                            value={`${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.net}
                                            value={`${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.benefits}
                                            value={`${commuteAnalysis.financialReality.benefitsValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.commute}
                                            value={`${commuteAnalysis.financialReality.commuteCost.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.oneWay}
                                            value={remoteRole ? '0 km' : `${commuteAnalysis.distanceKm} km`}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                        <MetricTile
                                            label={financialCopy.dailyTime}
                                            value={remoteRole ? '0 min' : `${commuteAnalysis.timeMinutes * 2} min`}
                                            className="rounded-[1.45rem] border-white/60 bg-white/72 dark:border-white/10 dark:bg-white/5"
                                        />
                                    </div>
                                    <div className="rounded-[1.45rem] border border-white/60 bg-white/76 px-4 py-3 text-sm text-[var(--text-muted)] shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] dark:border-white/10 dark:bg-white/5">
                                        {financialCopy.formula
                                            .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
                                            .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
                                            .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
                                            .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)}
                                    </div>
                                </div>
                            ) : (
                                <div className="relative z-10 mt-5 text-sm leading-6 text-[var(--text-muted)]">
                                    {financialCopy.commuteFailed}
                                </div>
                            )}
                        </div>

                        {job.jhi ? (
                            <div className={softPanelClass}>
                                <div aria-hidden className={panelGlow} />
                                <div className="relative z-10 flex items-center justify-between gap-3">
                                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                                        JHI index
                                    </div>
                                    <div className="rounded-full bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-sm font-semibold text-[var(--accent)]">
                                        {Math.round(job.jhi.score || 0)}/100
                                    </div>
                                </div>
                                <div className="relative z-10 mt-4">
                                    <JHIChart jhi={job.jhi} theme={isDarkTheme ? 'dark' : 'light'} />
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>

            <div className="shrink-0 border-t border-white/40 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(241,246,242,0.92))] p-6 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.78),rgba(15,23,42,0.92))] sm:p-8">
                <button
                    className="flex w-full items-center justify-center gap-3 rounded-[1.35rem] bg-[linear-gradient(135deg,var(--accent),var(--accent-green))] py-4 text-base font-semibold text-white shadow-[0_18px_34px_-22px_rgba(var(--accent-rgb),0.55)] transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_44px_-22px_rgba(var(--accent-rgb),0.58)] active:scale-[0.98]"
                    type="button"
                >
                    <Handshake size={22} />
                    {financialCopy.handshakeButton.replace('{{team}}', publisher?.display_name || financialCopy.handshakeFallback)}
                </button>
                <p className="mt-4 text-center text-[13px] text-[var(--text-muted)]">
                    {financialCopy.handshakeHint}
                </p>
            </div>
        </div>
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {variant === 'side' ? (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onClose}
                                className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm lg:hidden"
                            />

                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                                className={cn(
                                    'fixed top-0 right-0 z-[70] h-full w-full max-w-lg overflow-hidden border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl',
                                    className
                                )}
                            >
                                {content}
                            </motion.div>
                        </>
                    ) : variant === 'modal' ? (
                        <>
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onClose}
                                className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 18, scale: 0.985 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                                className={cn(
                                    'fixed left-1/2 top-[calc(var(--app-header-height)+16px)] z-[90] max-h-[calc(100dvh-var(--app-header-height)-32px)] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--surface)] shadow-[var(--shadow-overlay)]',
                                    className
                                )}
                            >
                                {content}
                            </motion.div>
                        </>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.18 }}
                            className={cn(
                                'w-full overflow-hidden rounded-[2rem] border border-[rgba(var(--accent-rgb),0.14)] bg-[var(--surface)] shadow-[var(--shadow-soft)]',
                                className
                            )}
                        >
                            {content}
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
};

export default RoleDetailPanel;
