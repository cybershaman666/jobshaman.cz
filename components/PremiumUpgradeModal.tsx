import React from 'react';
import { CheckCircle, Sparkles } from 'lucide-react';
import { UserProfile } from '../types';
import { redirectToCheckout } from '../services/stripeService';

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
    if (!show.open) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
                onClick={onClose}
            ></div>
            <div className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 p-10 text-center">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-cyan-600 to-blue-600"></div>

                <div className="w-20 h-20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Sparkles size={40} />
                </div>

                <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Odemkněte JobShaman Premium</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                    Funkce <span className="font-bold text-cyan-600 dark:text-cyan-400">"{show.feature}"</span> a další AI nástroje jsou dostupné pouze pro prémiové členy.
                </p>

                <div className="grid grid-cols-1 gap-3 mb-8 text-left">
                        {[
                            'Neomezená AI analýza pracovních inzerátů',
                            'Automatické generování motivačních dopisů',
                            'Inteligentní optimalizace CV na míru pozice',
                            'Prioritní zobrazení pro náborače'
                        ].map((f, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-100 dark:border-slate-800">
                            <CheckCircle size={16} className="text-emerald-500 flex-shrink-0" />
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{f}</span>
                        </div>
                    ))}
                </div>

                <button
                    onClick={() => {
                        if (!userProfile.isLoggedIn || !userProfile.id) {
                            onAuth();
                            onClose();
                            return;
                        }
                        redirectToCheckout('premium', userProfile.id);
                    }}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl transition-all shadow-xl hover:scale-[1.02] active:scale-95 mb-4"
                >
                    Upgradovat na Premium za 199 Kč/měsíc
                </button>

                <button
                    onClick={onClose}
                    className="text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                    Možná později
                </button>
            </div>
        </div>
    );
};

export default PremiumUpgradeModal;