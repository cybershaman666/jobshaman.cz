import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, X, XCircle } from 'lucide-react';

interface ApplyFollowupModalProps {
    isOpen: boolean;
    jobTitle?: string;
    company?: string;
    onConfirm: () => void;
    onReject: () => void;
    onLater?: () => void;
}

const ApplyFollowupModal: React.FC<ApplyFollowupModalProps> = ({
    isOpen,
    jobTitle,
    company,
    onConfirm,
    onReject,
    onLater
}) => {
    const { t } = useTranslation();

    if (!isOpen) return null;

    return (
        <div className="app-modal-backdrop z-[180]">
            <div className="absolute inset-0" onClick={onLater}></div>
            <div className="app-modal-panel max-w-lg animate-in zoom-in-95 duration-300 p-8 text-center">
                <div className="app-modal-topline" />
                <div className="w-16 h-16 bg-[rgba(var(--accent-rgb),0.1)] text-[var(--accent)] rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={32} />
                </div>
                <h2 className="text-2xl font-black text-[var(--text-strong)] mb-3 tracking-tight">
                    {t('apply.followup_title')}
                </h2>
                <p className="text-[var(--text-muted)] mb-8 leading-relaxed">
                    {t('apply.followup_desc', {
                        title: jobTitle || t('apply.followup_generic_title'),
                        company: company || t('apply.followup_generic_company')
                    })}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={onConfirm}
                        className="app-button-primary w-full justify-center py-3.5"
                    >
                        {t('apply.followup_yes')}
                    </button>
                    <button
                        onClick={onReject}
                        className="w-full px-4 py-3.5 bg-[var(--surface-subtle)] text-[var(--text-strong)] border border-[var(--border-subtle)] rounded-xl font-bold hover:bg-[var(--surface)] transition-all flex items-center justify-center gap-2"
                    >
                        <XCircle size={18} />
                        {t('apply.followup_no')}
                    </button>
                </div>

                {onLater && (
                    <button
                        onClick={onLater}
                        className="text-sm font-bold text-[var(--text-faint)] hover:text-[var(--text-strong)] transition-colors underline underline-offset-4"
                    >
                        {t('apply.followup_later')}
                    </button>
                )}

                {!onLater && (
                    <button
                        onClick={onReject}
                        className="absolute top-6 right-6 p-2 text-[var(--text-faint)] hover:text-[var(--text-strong)] transition-colors"
                    >
                        <X size={20} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ApplyFollowupModal;
