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
        <div className="fixed inset-0 z-[180] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={onLater}></div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 p-8 text-center">
                <div className="w-14 h-14 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={28} />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                    {t('apply.followup_title')}
                </h2>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                    {t('apply.followup_desc', {
                        title: jobTitle || t('apply.followup_generic_title'),
                        company: company || t('apply.followup_generic_company')
                    })}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    <button
                        onClick={onConfirm}
                        className="w-full px-4 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-500 transition-colors"
                    >
                        {t('apply.followup_yes')}
                    </button>
                    <button
                        onClick={onReject}
                        className="w-full px-4 py-3 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <XCircle size={16} />
                        {t('apply.followup_no')}
                    </button>
                </div>

                {onLater && (
                    <button
                        onClick={onLater}
                        className="text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                        {t('apply.followup_later')}
                    </button>
                )}

                {!onLater && (
                    <button
                        onClick={onReject}
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
        </div>
    );
};

export default ApplyFollowupModal;
