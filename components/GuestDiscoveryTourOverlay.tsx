import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';

export interface GuestDiscoveryTourStep {
    id: string;
    title: string;
    body: string;
    selector: string;
}

interface GuestDiscoveryTourOverlayProps {
    open: boolean;
    steps: GuestDiscoveryTourStep[];
    labels?: {
        skip: string;
        back: string;
        next: string;
        finish: string;
        close: string;
    };
    onComplete: () => void;
    onSkip: () => void;
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const GuestDiscoveryTourOverlay: React.FC<GuestDiscoveryTourOverlayProps> = ({
    open,
    steps,
    labels,
    onComplete,
    onSkip
}) => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

    useEffect(() => {
        if (!open) return;
        setActiveIndex(0);
    }, [open]);

    const activeStep = steps[activeIndex] || null;

    useEffect(() => {
        if (!open || !activeStep) return;

        const syncRect = () => {
            const target = document.querySelector(activeStep.selector) as HTMLElement | null;
            if (!target) {
                setTargetRect(null);
                return;
            }
            if (target.offsetParent === null) {
                setTargetRect(null);
                return;
            }
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
            window.requestAnimationFrame(() => {
                const rect = target.getBoundingClientRect();
                if (rect.width <= 0 || rect.height <= 0) {
                    setTargetRect(null);
                    return;
                }
                setTargetRect(rect);
            });
        };

        const rafId = window.requestAnimationFrame(syncRect);
        window.addEventListener('resize', syncRect);
        window.addEventListener('scroll', syncRect, true);
        return () => {
            window.cancelAnimationFrame(rafId);
            window.removeEventListener('resize', syncRect);
            window.removeEventListener('scroll', syncRect, true);
        };
    }, [activeStep, open]);

    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onSkip();
                return;
            }
            if (event.key === 'ArrowRight') {
                setActiveIndex((prev) => clamp(prev + 1, 0, steps.length - 1));
            }
            if (event.key === 'ArrowLeft') {
                setActiveIndex((prev) => clamp(prev - 1, 0, steps.length - 1));
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onSkip, open, steps.length]);

    const popoverStyle = useMemo(() => {
        if (!targetRect) return null;
        const width = Math.min(380, window.innerWidth - 32);
        const prefersBelow = targetRect.top < window.innerHeight * 0.38;
        const top = prefersBelow
            ? targetRect.bottom + 18
            : targetRect.top - 18;
        const resolvedTop = prefersBelow
            ? clamp(top, 16, window.innerHeight - 220)
            : clamp(top - 220, 16, window.innerHeight - 220);
        const left = clamp(
            targetRect.left + targetRect.width / 2 - width / 2,
            16,
            window.innerWidth - width - 16
        );

        return {
            width,
            top: resolvedTop,
            left
        };
    }, [targetRect]);

    if (!open || !activeStep) return null;

    const isLastStep = activeIndex === steps.length - 1;

    return (
        <div className="fixed inset-0 z-[230]">
            <div className="absolute inset-0 bg-slate-950/62 backdrop-blur-[1.5px]" />

            {targetRect ? (
                <div
                    className="pointer-events-none absolute rounded-[1.4rem] border-2 border-[rgba(var(--accent-rgb),0.78)] shadow-[0_0_0_9999px_rgba(2,6,23,0.62)] transition-all duration-300"
                    style={{
                        top: Math.max(8, targetRect.top - 8),
                        left: Math.max(8, targetRect.left - 8),
                        width: Math.max(48, targetRect.width + 16),
                        height: Math.max(48, targetRect.height + 16)
                    }}
                />
            ) : null}

            <div
                className="absolute"
                style={popoverStyle || {
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: Math.min(420, window.innerWidth - 32)
                }}
            >
                <div className="app-surface rounded-[1.6rem] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--surface-elevated)] p-5 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.55)]">
                    <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2">
                                <div className="app-eyebrow w-fit">
                                    <Sparkles size={12} />
                                    {activeIndex + 1} / {steps.length}
                                </div>
                                <div className="text-xl font-semibold tracking-[-0.03em] text-[var(--text-strong)]">
                                    {activeStep.title}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onSkip}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-muted)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-strong)]"
                                aria-label={labels?.close || 'Close tour'}
                            >
                                <X size={16} />
                            </button>
                        </div>

                        <p className="text-sm leading-7 text-[var(--text-muted)]">{activeStep.body}</p>

                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                            <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.9),rgba(251,191,36,0.95))] transition-all duration-300"
                                style={{ width: `${((activeIndex + 1) / steps.length) * 100}%` }}
                            />
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <button type="button" onClick={onSkip} className="app-button-secondary">
                                {labels?.skip || 'Skip'}
                            </button>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveIndex((prev) => clamp(prev - 1, 0, steps.length - 1))}
                                    className="app-button-secondary"
                                    disabled={activeIndex === 0}
                                >
                                    <ArrowLeft size={16} />
                                    {labels?.back || 'Back'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isLastStep) {
                                            onComplete();
                                            return;
                                        }
                                        setActiveIndex((prev) => clamp(prev + 1, 0, steps.length - 1));
                                    }}
                                    className="app-button-primary"
                                >
                                    {isLastStep ? (labels?.finish || 'Finish') : (labels?.next || 'Next')}
                                    <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GuestDiscoveryTourOverlay;
