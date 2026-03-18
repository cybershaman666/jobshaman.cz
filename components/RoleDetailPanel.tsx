import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Briefcase, Bookmark, Handshake, Info, Sparkles } from 'lucide-react';
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
                coreChallenge: 'Jádro role',
                noDescription: 'Pro tuhle roli zatím není dostupný detailní popis.',
                title: 'Finanční a dojezdová realita',
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
                handshakeButton: 'Podat ruku {{team}}',
                handshakeFallback: 'týmu',
                handshakeHint: 'Handshake otevře přímý dialog nad konkrétní situací z této role.',
            };
        }
        return {
            coreChallenge: 'The core challenge',
            noDescription: 'A detailed description is not available for this role yet.',
            title: 'Financial and commute reality',
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
            handshakeButton: 'Handshake with {{team}}',
            handshakeFallback: 'the team',
            handshakeHint: 'Handshake starts a direct dialogue around the concrete situation in this role.',
        };
    }, [isCsLike]);

    const content = (
        <div className="h-full overflow-hidden flex flex-col">
            {/* Header gradient – teal */}
            <div className="relative h-40 overflow-hidden shrink-0 bg-[linear-gradient(135deg,var(--accent),var(--accent-green))]">
                <div
                    aria-hidden
                    className="absolute inset-0 opacity-60"
                    style={{
                        backgroundImage: [
                            'radial-gradient(circle at 14% 26%, rgba(255,255,255,0.22), transparent 48%)',
                            'radial-gradient(circle at 88% 18%, rgba(255,255,255,0.16), transparent 50%)',
                            'radial-gradient(circle at 78% 88%, rgba(0,0,0,0.18), transparent 55%)',
                        ].join(', ')
                    }}
                />

                <motion.div
                    aria-hidden
                    animate={{ x: [0, 18, 0], y: [0, -10, 0], rotate: [0, 18, 0], opacity: [0.22, 0.34, 0.22] }}
                    transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
                    className={cn(
                        "absolute -top-14 -left-12 h-56 w-56 blur-3xl",
                        "rounded-[48%_52%_55%_45%/55%_45%_55%_45%]",
                        "bg-white/30"
                    )}
                />
                <motion.div
                    aria-hidden
                    animate={{ x: [0, -14, 0], y: [0, 12, 0], rotate: [0, -12, 0], opacity: [0.16, 0.28, 0.16] }}
                    transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
                    className={cn(
                        "absolute -bottom-20 -right-16 h-64 w-64 blur-3xl",
                        "rounded-[55%_45%_45%_55%/45%_55%_45%_55%]",
                        "bg-black/20"
                    )}
                />

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2.5 rounded-full bg-black/10 hover:bg-black/20 text-white transition-all backdrop-blur-md z-10"
                    type="button"
                >
                    <X size={20} />
                </button>

                <div className="absolute bottom-5 left-5 right-5 z-10 flex items-end justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-black/10 px-3 py-2 backdrop-blur-md ring-1 ring-white/15">
                        {useHeaderMonogram ? (
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/14 text-xs font-bold text-white ring-1 ring-white/20">
                                {headerInitials}
                            </div>
                        ) : (
                            <img
                                src={headerAvatarUrl}
                                alt={publisher?.display_name || job.company}
                                className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/20"
                                loading="lazy"
                            />
                        )}
                        <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{job.company}</div>
                            <div className="truncate text-xs text-white/80">{headerMetaLine}</div>
                        </div>
                    </div>
                    <Badge variant="teal" className="bg-white/90 dark:bg-white/10 text-[var(--accent)] border-none shadow-sm">
                        <Sparkles size={12} className="mr-1" />
                        {listingBadge}
                    </Badge>
                </div>
            </div>

            {/* Content */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 custom-scrollbar">
                {/* Title Section */}
                <div className="space-y-5">
                    <div className="flex justify-between items-start gap-4">
                        <div className="space-y-1.5 flex-1">
                            <h2 className="text-2xl sm:text-3xl font-bold font-serif text-[var(--text-strong)] leading-tight">
                                {job.title}
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[var(--text-muted)]">{job.location}</span>
                            </div>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onToggleSave(job.id);
                            }}
                            className={cn(
                                "shrink-0 p-3 rounded-2xl border transition-all duration-300",
                                isSaved
                                    ? "bg-[rgba(var(--accent-rgb),0.10)] border-[rgba(var(--accent-rgb),0.22)] text-[var(--accent)] shadow-sm"
                                    : "bg-white border-[var(--border-subtle)] text-[var(--text-muted)] hover:border-[rgba(var(--accent-rgb),0.32)] hover:text-[var(--accent)]"
                            )}
                            type="button"
                        >
                            <Bookmark size={22} fill={isSaved ? "currentColor" : "none"} />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                        <Badge icon={<MapPin size={14} />} variant="subtle" className="px-3 py-1.5">{job.location}</Badge>
                        <Badge icon={<Briefcase size={14} />} variant="subtle" className="px-3 py-1.5">{job.work_model}</Badge>
                        {job.salaryRange && (
                            <Badge variant="accent" className="px-3 py-1.5 font-bold">
                                {job.salaryRange}
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Challenge Description */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-strong)]">
                        <Info size={20} className="text-[var(--accent)]" />
                        {financialCopy.coreChallenge}
                    </h3>
                    <div className="text-[var(--text)] leading-relaxed text-base">
                        {job.description || financialCopy.noDescription}
                    </div>
                </div>

                {/* Financial + Commute Reality */}
                <div className="space-y-4 rounded-[2rem] border border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(var(--accent-rgb),0.04))] p-6">
                    <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                        {financialCopy.title}
                    </div>
                    {!userProfile.isLoggedIn ? (
                        <div className="space-y-3">
                            <div className="text-sm leading-6 text-[var(--text-muted)]">{financialCopy.loginPrompt}</div>
                        </div>
                    ) : (!userProfile.address && !userProfile.coordinates && !remoteRole) ? (
                        <div className="space-y-3">
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
                        <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <MetricTile
                                    label={financialCopy.realValue}
                                    value={`${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                    tone="accent"
                                />
                                <MetricTile
                                    label={financialCopy.jhiImpact}
                                    value={`${commuteAnalysis.jhiImpact > 0 ? '+' : ''}${commuteAnalysis.jhiImpact}`}
                                    tone={commuteAnalysis.jhiImpact >= 0 ? 'success' : 'warning'}
                                />
                                <MetricTile
                                    label={financialCopy.gross}
                                    value={`${commuteAnalysis.financialReality.grossMonthlySalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                />
                                <MetricTile
                                    label={financialCopy.net}
                                    value={`${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                />
                                <MetricTile
                                    label={financialCopy.benefits}
                                    value={`${commuteAnalysis.financialReality.benefitsValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                />
                                <MetricTile
                                    label={financialCopy.commute}
                                    value={`${commuteAnalysis.financialReality.commuteCost.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`}
                                />
                                <MetricTile
                                    label={financialCopy.oneWay}
                                    value={remoteRole ? '0 km' : `${commuteAnalysis.distanceKm} km`}
                                />
                                <MetricTile
                                    label={financialCopy.dailyTime}
                                    value={remoteRole ? '0 min' : `${commuteAnalysis.timeMinutes * 2} min`}
                                />
                            </div>
                            <div className="rounded-[1.25rem] border border-[var(--border-subtle)] bg-white/70 px-4 py-3 text-sm text-[var(--text-muted)]">
                                {financialCopy.formula
                                    .replace('{{net}}', `${commuteAnalysis.financialReality.netBaseSalary.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
                                    .replace('{{benefits}}', `${commuteAnalysis.financialReality.benefitsValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
                                    .replace('{{commute}}', `${commuteAnalysis.financialReality.commuteCost.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)
                                    .replace('{{total}}', `${commuteAnalysis.financialReality.finalRealMonthlyValue.toLocaleString(i18n.language)} ${commuteAnalysis.financialReality.currency}`)}
                            </div>
                        </div>
                    ) : (
                        <div className="text-sm leading-6 text-[var(--text-muted)]">
                            {financialCopy.commuteFailed}
                        </div>
                    )}
                </div>

                {/* JHI Index */}
                {job.jhi ? (
                    <div className="space-y-4 rounded-[2rem] border border-[rgba(var(--accent-rgb),0.14)] bg-white/70 p-6">
                        <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--text-faint)]">
                                {isCsLike ? 'JHI index' : 'JHI index'}
                            </div>
                            <div className="text-sm font-semibold text-[var(--accent)]">
                                {Math.round(job.jhi.score || 0)}/100
                            </div>
                        </div>
                        <JHIChart jhi={job.jhi} theme={isDarkTheme ? 'dark' : 'light'} />
                    </div>
                ) : null}
            </div>

            {/* Footer Actions */}
            <div className="p-6 sm:p-8 border-t border-[var(--border)] bg-[var(--surface-muted)]/30 shrink-0">
                <button
                    className="w-full py-4 bg-[var(--accent)] text-white text-base font-semibold rounded-xl flex items-center justify-center gap-3 shadow-[0_4px_16px_rgba(var(--accent-rgb),0.35)] hover:bg-[var(--accent-green)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
                    type="button"
                >
                    <Handshake size={22} />
                    {financialCopy.handshakeButton.replace('{{team}}', publisher?.display_name || financialCopy.handshakeFallback)}
                </button>
                <p className="text-center text-[13px] text-[var(--text-muted)] mt-4">
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
                            {/* Backdrop for mobile */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={onClose}
                                className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
                            />

                            {/* Panel */}
                            <motion.div
                                initial={{ x: '100%' }}
                                animate={{ x: 0 }}
                                exit={{ x: '100%' }}
                                transition={{ type: 'spring', damping: 28, stiffness: 220 }}
                                className={cn(
                                    "fixed top-0 right-0 h-full w-full max-w-lg bg-[var(--surface)] shadow-2xl z-[70] overflow-hidden border-l border-[var(--border)]",
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
                                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]"
                            />
                            <motion.div
                                initial={{ opacity: 0, y: 16, scale: 0.985 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: 18, scale: 0.985 }}
                                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                                className={cn(
                                    "fixed left-1/2 top-[calc(var(--app-header-height)+16px)] z-[90] w-[min(720px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--surface)] shadow-[var(--shadow-overlay)]",
                                    "max-h-[calc(100dvh-var(--app-header-height)-32px)]",
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
                                "w-full overflow-hidden rounded-[2rem] border border-[rgba(var(--accent-rgb),0.14)] bg-[var(--surface)] shadow-[var(--shadow-soft)]",
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
