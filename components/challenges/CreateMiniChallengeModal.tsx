import React, { useState } from 'react';
import { X, Leaf, Send, MapPin } from 'lucide-react';

interface CreateMiniChallengeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    isCsLike: boolean;
    locale?: string;
}

const CreateMiniChallengeModal: React.FC<CreateMiniChallengeModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    locale = 'en',
}) => {
    const language = String(locale || 'en').split('-')[0].toLowerCase();
    const copy = language === 'cs'
        ? {
            kicker: 'Mini výzva',
            title: 'Co je potřeba vyřešit?',
            shortTitle: 'Krátký název',
            shortTitlePlaceholder: 'Např. Pomoc s instalací panelů',
            detail: 'Detailní popis problému',
            detailPlaceholder: 'Popište co nejpřesněji, co je cílem vyřešení...',
            time: 'Časový odhad',
            timePlaceholder: 'Cca 2 hodiny',
            location: 'Lokalita',
            locationPlaceholder: 'Praha, Remote...',
            reward: 'Odměna',
            rewardPlaceholder: 'Např. 2000 Kč nebo reference do portfolia',
            note: 'Po úspěšném dokončení této výzvy si ji budete moci přidat do svého profilu jako certifikovanou referenci.',
            submit: 'Zveřejnit mini výzvu',
        }
        : language === 'sk'
            ? {
                kicker: 'Mini výzva',
                title: 'Čo je potrebné vyriešiť?',
                shortTitle: 'Krátky názov',
                shortTitlePlaceholder: 'Napr. Pomoc s inštaláciou panelov',
                detail: 'Detailný popis problému',
                detailPlaceholder: 'Popíšte čo najpresnejšie, čo je cieľom vyriešenia...',
                time: 'Časový odhad',
                timePlaceholder: 'Cca 2 hodiny',
                location: 'Lokalita',
                locationPlaceholder: 'Bratislava, Remote...',
                reward: 'Odmena',
                rewardPlaceholder: 'Napr. 2000 Kč alebo referencia do portfólia',
                note: 'Po úspešnom dokončení tejto výzvy si ju budete môcť pridať do svojho profilu ako certifikovanú referenciu.',
                submit: 'Zverejniť mini výzvu',
            }
            : language === 'de'
                ? {
                    kicker: 'Mini-Challenge',
                    title: 'Was soll gelöst werden?',
                    shortTitle: 'Kurzer Titel',
                    shortTitlePlaceholder: 'z. B. Hilfe bei der Installation von Panels',
                    detail: 'Detaillierte Problembeschreibung',
                    detailPlaceholder: 'Beschreiben Sie so genau wie möglich, was gelöst werden soll...',
                    time: 'Zeitaufwand',
                    timePlaceholder: 'ca. 2 Stunden',
                    location: 'Ort',
                    locationPlaceholder: 'Wien, Remote...',
                    reward: 'Vergütung',
                    rewardPlaceholder: 'z. B. 100 € oder Portfolioreferenz',
                    note: 'Nach erfolgreichem Abschluss können Sie diese Challenge als zertifizierte Referenz zu Ihrem Profil hinzufügen.',
                    submit: 'Mini-Challenge veröffentlichen',
                }
                : language === 'pl'
                    ? {
                        kicker: 'Mini wyzwanie',
                        title: 'Co trzeba rozwiązać?',
                        shortTitle: 'Krótki tytuł',
                        shortTitlePlaceholder: 'np. Pomoc przy instalacji paneli',
                        detail: 'Szczegółowy opis problemu',
                        detailPlaceholder: 'Opisz możliwie precyzyjnie, co trzeba rozwiązać...',
                        time: 'Szacowany czas',
                        timePlaceholder: 'około 2 godziny',
                        location: 'Lokalizacja',
                        locationPlaceholder: 'Warszawa, Remote...',
                        reward: 'Wynagrodzenie',
                        rewardPlaceholder: 'np. 400 zł albo referencja do portfolio',
                        note: 'Po ukończeniu tego wyzwania będzie można dodać je do profilu jako certyfikowaną referencję.',
                        submit: 'Opublikuj mini wyzwanie',
                    }
                    : {
                        kicker: 'Mini challenge',
                        title: 'What needs solving?',
                        shortTitle: 'Short Title',
                        shortTitlePlaceholder: 'e.g. Help with panel installation',
                        detail: 'Detailed Problem Description',
                        detailPlaceholder: 'Describe as accurately as possible what needs to be solved...',
                        time: 'Time Estimate',
                        timePlaceholder: 'e.g. 2 hours',
                        location: 'Location',
                        locationPlaceholder: 'Prague, Remote...',
                        reward: 'Reward',
                        rewardPlaceholder: 'e.g. $100 or portfolio reference',
                        note: 'After successful completion of this challenge, you will be able to add it to your profile as a certified reference.',
                        submit: 'Publish mini challenge',
                    };
    const [title, setTitle] = useState('');
    const [problem, setProblem] = useState('');
    const [timeEstimate, setTimeEstimate] = useState('');
    const [reward, setReward] = useState('');
    const [location, setLocation] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            title,
            problem,
            timeEstimate,
            reward,
            location,
            challenge_format: 'micro_job',
            created_at: new Date().toISOString(),
        });
        onClose();
        // Reset form
        setTitle('');
        setProblem('');
        setTimeEstimate('');
        setReward('');
        setLocation('');
    };

    return (
        <div className="app-modal-backdrop">
            <div className="absolute inset-0" onClick={onClose}></div>
            <div className="app-modal-panel max-w-lg animate-in zoom-in-95 duration-300">
                <div className="app-modal-topline" />
                <div className="p-6 sm:p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-[rgba(var(--accent-green-rgb),0.1)] text-[var(--accent-green)]">
                                <Leaf size={22} />
                            </div>
                            <div>
                                <div className="app-modal-kicker mb-1">
                                    {copy.kicker}
                                </div>
                                <h2 className="text-2xl font-black tracking-tight text-[var(--text-strong)]">
                                    {copy.title}
                                </h2>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition text-[var(--text-faint)] hover:text-[var(--text-strong)]"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="sm:space-y-6 space-y-5">
                        <div className="space-y-1.5">
                            <label className="app-modal-label">
                                {copy.shortTitle}
                            </label>
                            <input
                                required
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={copy.shortTitlePlaceholder}
                                className="app-modal-input"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="app-modal-label">
                                {copy.detail}
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={problem}
                                onChange={(e) => setProblem(e.target.value)}
                                placeholder={copy.detailPlaceholder}
                                className="app-modal-input resize-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="app-modal-label">
                                    {copy.time}
                                </label>
                                <input
                                    type="text"
                                    value={timeEstimate}
                                    onChange={(e) => setTimeEstimate(e.target.value)}
                                    placeholder={copy.timePlaceholder}
                                    className="app-modal-input"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="app-modal-label">
                                    {copy.location}
                                </label>
                                <div className="relative">
                                    <MapPin size={16} className="absolute left-3 top-3.5 text-[var(--text-faint)]" />
                                    <input
                                        type="text"
                                        value={location}
                                        onChange={(e) => setLocation(e.target.value)}
                                        placeholder={copy.locationPlaceholder}
                                        className="app-modal-input pl-10"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="app-modal-label">
                                {copy.reward}
                            </label>
                            <input
                                type="text"
                                value={reward}
                                onChange={(e) => setReward(e.target.value)}
                                placeholder={copy.rewardPlaceholder}
                                className="app-modal-input"
                            />
                        </div>

                        <div className="rounded-xl bg-[rgba(var(--accent-rgb),0.04)] p-4 border border-[rgba(var(--accent-rgb),0.1)]">
                            <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                                {copy.note}
                            </p>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="app-button-primary w-full justify-center py-4 text-base font-bold shadow-lg shadow-[rgba(var(--accent-rgb),0.2)]"
                            >
                                <Send size={18} />
                                {copy.submit}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateMiniChallengeModal;
