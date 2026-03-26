import React from 'react';
import { ArrowRight, Brain, CheckCircle2, ShieldCheck, Sparkles, Target, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../types';
import { redirectToCheckout } from '../services/stripeService';
import { getPremiumPriceDisplay } from '../services/premiumPricingService';

interface PremiumUpgradeModalProps {
    show: { open: boolean; feature?: string };
    onClose: () => void;
    userProfile: UserProfile;
    onAuth: () => void;
}

const PremiumUpgradeModal: React.FC<PremiumUpgradeModalProps> = ({
    show,
    onClose,
    userProfile,
    onAuth
}) => {
    const { t, i18n } = useTranslation();
    const price = getPremiumPriceDisplay(i18n.language || 'cs');
    const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
    const isCsLike = locale === 'cs' || locale === 'sk';
    const isGermanLike = locale === 'de' || locale === 'at';
    const isPolish = locale === 'pl';

    if (!show.open) return null;

    const featureName = show.feature || (
        isCsLike
            ? 'Premium funkce'
            : isGermanLike
                ? 'Premium-Funktion'
                : isPolish
                    ? 'Funkcja premium'
                    : 'Premium feature'
    );
    const copy = isCsLike ? {
        kicker: 'Premium',
        title: 'Silnější podpora pro skutečný výběr práce',
        body: `Funkce „${featureName}“ je součástí premium vrstvy. Ta přidává víc prostoru pro dialogy, přesnější doporučení a chytřejší podporu při rozhodování.`,
        primary: 'Odemknout premium',
        later: 'Možná později',
        note: 'Premium dává větší šanci, že z relevantní nabídky vznikne skutečný dialog, ne jen další odložená karta.',
        priceLabel: 'Premium přidá navíc',
        whyLabel: 'Proč to dává smysl',
        featureGroups: [
            {
                icon: ShieldCheck,
                title: 'Více dialogových slotů',
                body: 'Můžete držet více aktivních odpovědí najednou a nezaseknout se na základním limitu.'
            },
            {
                icon: Sparkles,
                title: 'AI průvodce životní situací',
                body: 'Pomůže s profilem, podpůrným kontextem i tím, co má v hledání opravdu prioritu.'
            },
            {
                icon: Target,
                title: 'Personalizovaný JHI index',
                body: 'Shoda se počítá podle vašich preferencí, ne jen podle obecného modelu.'
            },
            {
                icon: Brain,
                title: 'Detailní report JCFPM',
                body: 'Uvidíte plný rozbor osobnostního nastavení a to, jak upravil doporučení systému.'
            }
        ]
    } : isGermanLike ? {
        kicker: 'Premium',
        title: 'Eine stärkere Ebene für echte Jobentscheidungen',
        body: `Die Funktion „${featureName}“ gehört zur Premium-Ebene. Sie bringt mehr Raum für aktive Dialoge, präzisere Priorisierung und bessere Unterstützung bei Entscheidungen.`,
        primary: 'Premium freischalten',
        later: 'Vielleicht später',
        note: 'Premium erhöht die Chance, dass aus einer relevanten Rolle ein echter Dialog wird und nicht nur eine weitere gemerkte Karte.',
        priceLabel: 'Premium bringt zusätzlich',
        whyLabel: 'Warum das sinnvoll ist',
        featureGroups: [
            {
                icon: ShieldCheck,
                title: 'Mehr Dialog-Slots',
                body: 'Halten Sie mehr aktive Antworten gleichzeitig offen, statt zu früh am Basislimit zu landen.'
            },
            {
                icon: Sparkles,
                title: 'KI-Guide für Lebenskontext',
                body: 'Hilft, Profil, unterstützenden Kontext und echte Prioritäten in der Suche zu schärfen.'
            },
            {
                icon: Target,
                title: 'Personalisierter JHI-Index',
                body: 'Die Passung wird nach Ihren eigenen Prioritäten berechnet, nicht nur nach einem generischen Modell.'
            },
            {
                icon: Brain,
                title: 'Detaillierter JCFPM-Bericht',
                body: 'Zeigt die vollständige Persönlichkeitsauswertung und wie sie die Systemempfehlungen verändert.'
            }
        ]
    } : isPolish ? {
        kicker: 'Premium',
        title: 'Silniejsza warstwa do realnych decyzji zawodowych',
        body: `Funkcja „${featureName}” jest częścią warstwy premium. Daje więcej miejsca na aktywne dialogi, trafniejsze priorytety i lepsze wsparcie przy podejmowaniu decyzji.`,
        primary: 'Odblokuj premium',
        later: 'Może później',
        note: 'Premium zwiększa szansę, że z trafnej oferty powstanie prawdziwa rozmowa, a nie tylko kolejna zapisana karta.',
        priceLabel: 'Premium dodaje',
        whyLabel: 'Dlaczego to ma sens',
        featureGroups: [
            {
                icon: ShieldCheck,
                title: 'Więcej slotów dialogowych',
                body: 'Możesz utrzymać więcej aktywnych odpowiedzi jednocześnie zamiast zbyt szybko dobijać do podstawowego limitu.'
            },
            {
                icon: Sparkles,
                title: 'Przewodnik AI po kontekście życiowym',
                body: 'Pomaga dopracować profil, kontekst wspierający i to, co naprawdę powinno mieć priorytet w wyszukiwaniu.'
            },
            {
                icon: Target,
                title: 'Spersonalizowany indeks JHI',
                body: 'Dopasowanie liczy się według Twoich priorytetów, a nie tylko według ogólnego modelu.'
            },
            {
                icon: Brain,
                title: 'Szczegółowy raport JCFPM',
                body: 'Pokazuje pełny rozkład profilu osobowościowego i to, jak zmienia interpretację systemu.'
            }
        ]
    } : {
        kicker: 'Premium',
        title: 'A stronger layer for real job decisions',
        body: `“${featureName}” is part of the premium layer. It adds more room for active dialogues, sharper prioritization, and better decision support.`,
        primary: 'Unlock premium',
        later: 'Maybe later',
        note: 'Premium improves the chance that a relevant role becomes a real conversation instead of just another saved card.',
        priceLabel: 'Premium adds',
        whyLabel: 'Why it matters',
        featureGroups: [
            {
                icon: ShieldCheck,
                title: 'More dialogue slots',
                body: 'Keep more active replies open at once instead of hitting the basic limit too early.'
            },
            {
                icon: Sparkles,
                title: 'AI life-context guide',
                body: 'It helps shape your profile, supporting context, and what should really matter in search.'
            },
            {
                icon: Target,
                title: 'Personalized JHI score',
                body: 'Fit is calculated around your own priorities, not just a generic model.'
            },
            {
                icon: Brain,
                title: 'Detailed JCFPM report',
                body: 'See the full personality breakdown and how it changes the system’s interpretation of your profile.'
            }
        ]
    };

    const handleCheckout = () => {
        if (!userProfile.isLoggedIn || !userProfile.id) {
            onAuth();
            onClose();
            return;
        }
        redirectToCheckout('premium', userProfile.id);
    };

    return (
        <div className="app-modal-backdrop z-[200]">
            <div className="absolute inset-0" onClick={onClose}></div>

            <div className="app-modal-panel max-w-4xl overflow-hidden">
                <div className="app-modal-topline" />
                <button
                    type="button"
                    onClick={onClose}
                    className="app-modal-close"
                    aria-label={t('common.close', { defaultValue: 'Zavřít' })}
                >
                    <X size={18} />
                </button>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                    <div className="app-modal-surface app-modal-header-safe space-y-5 border-b px-6 py-6 pt-14 lg:rounded-none lg:border-b-0 lg:border-r lg:border-l-0 lg:border-t-0 lg:px-7 lg:py-7 lg:pt-7">
                        <div className="space-y-4">
                            <span className="app-modal-kicker">
                                <Sparkles size={12} />
                                {copy.kicker}
                            </span>
                            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] lg:text-[2.35rem]">
                                {copy.title}
                            </h2>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                                {copy.body}
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            {copy.featureGroups.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <div
                                        key={item.title}
                                        className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4"
                                    >
                                        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                                            <Icon size={18} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="text-sm font-semibold text-[var(--text-strong)]">{item.title}</div>
                                            <p className="text-sm leading-6 text-[var(--text-muted)]">{item.body}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="app-modal-surface border-t px-4 py-4 lg:rounded-none lg:border-t-0 lg:border-l lg:border-r-0 lg:border-b-0 lg:px-6 lg:py-6 bg-[var(--surface-subtle)]">
                        <div
                            className="rounded-[calc(var(--radius-xl)+4px)] border border-[var(--accent-soft)] p-5 shadow-[0_24px_60px_-40px_rgba(var(--accent-rgb),0.3)] bg-white dark:bg-slate-900"
                        >
                            <div className="space-y-4">
                                <div className="app-eyebrow w-fit !bg-white !text-[var(--accent-strong)]">
                                    <CheckCircle2 size={12} />
                                    {featureName}
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-[var(--text-muted)]">{copy.priceLabel}</div>
                                    <div className="mt-1 text-3xl font-bold tracking-tight text-[var(--text-strong)]">
                                        {price.eurLabel}
                                        <span className="ml-2 text-base font-medium text-[var(--text-muted)]">{price.billingLabel}</span>
                                    </div>
                                    <div className="mt-2 text-sm text-[var(--text-muted)]">
                                        ≈ {price.czkLabel} / {price.plnLabel}
                                    </div>
                                </div>

                                <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
                                    <div className="space-y-2">
                                        <div className="text-sm font-bold text-[var(--text-strong)]">
                                            {copy.whyLabel}
                                        </div>
                                        <p className="text-sm leading-6 text-[var(--text-muted)]">
                                            {copy.note}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    {copy.featureGroups.map((item) => (
                                        <div key={item.title} className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-white px-3 py-2.5">
                                            <CheckCircle2 size={16} className="mt-0.5 text-[var(--accent-strong)]" />
                                            <span className="text-sm text-[var(--text-muted)] font-medium">{item.title}</span>
                                        </div>
                                    ))}
                                </div>

                                <button type="button" onClick={handleCheckout} className="app-button-primary w-full justify-center">
                                    {copy.primary}
                                    <ArrowRight size={16} />
                                </button>
                                <button type="button" onClick={onClose} className="app-button-secondary w-full justify-center">
                                    {copy.later}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PremiumUpgradeModal;
