import React from 'react';

interface FooterProps {
    theme?: 'light' | 'dark';
}

const Footer: React.FC<FooterProps> = ({ theme }) => {
    return (
        <footer className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 py-8 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                        © 2026 JobShaman. Všechna práva vyhrazena.
                    </div>
                    <div className="flex gap-6 text-sm">
                        <a
                            href="/podminky-uziti"
                            target="_blank"
                            className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        >
                            Podmínky použití
                        </a>
                        <a
                            href="/ochrana-osobnich-udaju"
                            target="_blank"
                            className="text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                        >
                            Ochrana osobních údajů
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;