import React, { useEffect } from 'react';
import { ArrowRight, CheckCircle2, Sparkles, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserProfile } from '../types';

export interface PremiumFeatureExplainContent {
    id: string;
    label: string;
    title: string;
    summary: string;
    whyTitle: string;
    whyBody: string;
    premiumTitle: string;
    premiumBody: string;
    premiumEffects?: string[];
    premiumActiveNote?: string;
}

interface PremiumFeatureExplainModalProps {
    open: boolean;
    feature: PremiumFeatureExplainContent | null;
    userProfile: UserProfile;
    onClose: () => void;
    onOpenPremium: (featureLabel: string) => void;
}

const PremiumFeatureExplainModal: React.FC<PremiumFeatureExplainModalProps> = ({
    open,
    feature,
    userProfile,
    onClose,
    onOpenPremium
}) => {
    const { t, i18n } = useTranslation();
    const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
    const hasPremiumAccess = ['premium', 'pro', 'business'].includes(String(userProfile.subscription?.tier || 'free').toLowerCase());
    const copy = (() => {
        if (locale === 'sk') {
            return {
                active: 'Premium je aktívne',
                feature: 'Premium funkcia',
                practical: 'Praktický dopad v aplikácii',
                fallbackActiveNote: 'Túto vrstvu už máte odomknutú. V discovery sa správa ako plne aktívna súčasť rozhodovania.',
                cta: 'Zobraziť premium',
                close: 'Zavrieť'
            };
        }
        if (locale === 'de' || locale === 'at') {
            return {
                active: 'Premium ist aktiv',
                feature: 'Premium-Funktion',
                practical: 'Praktische Auswirkung in der App',
                fallbackActiveNote: 'Diese Ebene ist für dich bereits freigeschaltet. In der Discovery arbeitet sie als aktiver Teil der Entscheidungslogik.',
                cta: 'Premium ansehen',
                close: 'Schließen'
            };
        }
        if (locale === 'pl') {
            return {
                active: 'Premium jest aktywne',
                feature: 'Funkcja premium',
                practical: 'Praktyczny efekt w aplikacji',
                fallbackActiveNote: 'Ta warstwa jest już dla Ciebie odblokowana. W discovery działa jako aktywna część logiki decyzyjnej.',
                cta: 'Pokaż premium',
                close: 'Zamknij'
            };
        }
        if (locale === 'cs') {
            return {
                active: 'Premium je aktivní',
                feature: 'Premium funkce',
                practical: 'Praktický dopad v aplikaci',
                fallbackActiveNote: 'Tuto vrstvu už máte odemčenou. V discovery se bude chovat jako plně aktivní součást rozhodování.',
                cta: 'Zobrazit premium',
                close: 'Zavřít'
            };
        }
        return {
            active: 'Premium is active',
            feature: 'Premium feature',
            practical: 'Practical effect in the app',
            fallbackActiveNote: 'You already have this layer unlocked. It behaves as a fully active part of discovery.',
            cta: 'See premium',
            close: 'Close'
        };
    })();

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open || !feature) return null;

    return (
        <div className="app-modal-backdrop z-[220]">
            <div className="absolute inset-0" onClick={onClose} />

            <div className="app-modal-panel max-w-3xl overflow-hidden">
                <div className="app-modal-topline" />
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-strong)]"
                    aria-label={t('common.close', { defaultValue: 'Zavřít' })}
                >
                    <X size={16} />
                </button>

                <div className="grid gap-0 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
                    <div className="app-modal-surface space-y-6 border-b px-6 py-6 lg:rounded-none lg:border-b-0 lg:border-r lg:border-l-0 lg:border-t-0 lg:px-7 lg:py-7">
                        <span className="app-modal-kicker">
                            <Sparkles size={12} />
                            {feature.label}
                        </span>
                        <div className="space-y-3">
                            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-[var(--text-strong)] lg:text-[2.2rem]">
                                {feature.title}
                            </h2>
                            <p className="max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                                {feature.summary}
                            </p>
                        </div>

                        <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4">
                            <div className="space-y-2">
                                <div className="text-sm font-semibold text-[var(--text-strong)]">{feature.whyTitle}</div>
                                <p className="text-sm leading-6 text-[var(--text-muted)]">{feature.whyBody}</p>
                            </div>
                        </div>
                    </div>

                    <div className="app-modal-surface border-t px-4 py-4 lg:rounded-none lg:border-t-0 lg:border-l lg:border-r-0 lg:border-b-0 lg:px-6 lg:py-6 bg-[var(--surface-subtle)]">
                        <div className="rounded-[calc(var(--radius-xl)+4px)] border border-[var(--accent-soft)] p-5 shadow-[0_24px_60px_-40px_rgba(var(--accent-rgb),0.3)] bg-white dark:bg-slate-900">
                            <div className="space-y-4">
                                <div className="app-eyebrow w-fit !bg-white !text-[var(--accent-strong)]">
                                    <CheckCircle2 size={12} />
                                    {hasPremiumAccess ? copy.active : copy.feature}
                                </div>

                                <div className="space-y-2">
                                    <div className="text-base font-bold tracking-tight text-[var(--text-strong)]">
                                        {feature.premiumTitle}
                                    </div>
                                    <p className="text-sm leading-6 text-[var(--text-muted)]">
                                        {feature.premiumBody}
                                    </p>
                                </div>

                                {feature.premiumEffects && feature.premiumEffects.length > 0 ? (
                                    <div className="rounded-[var(--radius-xl)] border border-amber-200/70 bg-white/80 p-4">
                                        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[var(--accent-strong)]">
                                            {copy.practical}
                                        </div>
                                        <div className="space-y-2">
                                            {feature.premiumEffects.map((effect) => (
                                                <div key={effect} className="flex items-start gap-2 text-sm leading-6 text-[var(--text-muted)]">
                                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                                                    <span>{effect}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : null}

                                {hasPremiumAccess ? (
                                    <div className="rounded-[var(--radius-xl)] border border-[var(--border-subtle)] bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--text-muted)]">
                                        {feature.premiumActiveNote || copy.fallbackActiveNote}
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => onOpenPremium(feature.label)}
                                        className="app-button-primary w-full justify-center"
                                    >
                                        {copy.cta}
                                        <ArrowRight size={16} />
                                    </button>
                                )}

                                <button type="button" onClick={onClose} className="app-button-secondary w-full justify-center">
                                    {copy.close}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PremiumFeatureExplainModal;
