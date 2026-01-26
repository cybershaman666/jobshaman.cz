import React from 'react';
import { useTranslation } from 'react-i18next';

interface FooterProps { }

const Footer: React.FC<FooterProps> = () => {
    const { t } = useTranslation();
    return (
        <footer className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        {t('footer.rights_reserved')}
                    </div>
                    <div className="flex gap-6 text-sm">
                        <a
                            href="/podminky-uziti"
                            target="_blank"
                            className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        >
                            {t('footer.terms')}
                        </a>
                        <a
                            href="/ochrana-osobnich-udaju"
                            target="_blank"
                            className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        >
                            {t('footer.privacy')}
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;