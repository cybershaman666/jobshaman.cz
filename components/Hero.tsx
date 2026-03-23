import React from 'react';
import { Search, MapPin, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HeroProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterCity: string;
    setFilterCity: (city: string) => void;
    performSearch: (term: string) => void;
}

const Hero: React.FC<HeroProps> = ({
    searchTerm,
    setSearchTerm,
    filterCity,
    setFilterCity,
    performSearch
}) => {
    const { t } = useTranslation();

    const handleSearch = () => {
        performSearch(searchTerm);
        // Scroll to results
        const resultsElement = document.getElementById('challenge-discovery');
        if (resultsElement) {
            resultsElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section className="relative overflow-hidden pt-8 pb-16 sm:pt-12 sm:pb-24 px-4 sm:px-6 lg:px-8">
            {/* Background Panorama - Apple/Arc style subtle integration */}
            <div className="absolute top-0 left-0 w-full h-[300px] pointer-events-none -z-10 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg)] to-[var(--bg)] z-10" />
                <img
                    src="/hero-panorama.png"
                    alt=""
                    className="w-full h-full object-cover object-top opacity-30 dark:opacity-20 scale-105"
                />
            </div>

            <div className="max-w-4xl mx-auto text-center relative z-20">
                <div className="app-eyebrow mb-6">
                    <Sparkles size={14} />
                    {t('hero.new_way_to_work', { defaultValue: 'Work is how we shape the world' })}
                </div>

                <h1 className="app-display text-4xl sm:text-6xl font-extrabold tracking-tight text-[var(--text-strong)] mb-6 leading-[1.1]">
                    {t('hero.title', { defaultValue: 'Najdi problém, který stojí za řešení.' })}
                </h1>

                <p className="text-lg sm:text-xl text-[var(--text-muted)] mb-10 max-w-2xl mx-auto leading-relaxed">
                    {t('hero.subtitle', { defaultValue: 'Zapomeň na job description. Najdi misi, která dává smysl, a tým, který tvůj vklad skutečně ocení.' })}
                </p>

                {/* Integrated Search Bar */}
                <div className="app-frost-panel max-w-3xl mx-auto rounded-[2rem] border p-2 sm:p-3 shadow-[var(--shadow-card)]">
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                        <div className="app-command-field flex-1 w-full rounded-full border-transparent bg-[var(--surface-muted)]">
                            <Search size={20} className="text-[var(--text-faint)]" />
                            <input
                                type="text"
                                placeholder={t('hero.search_placeholder', { defaultValue: 'Role / Problém / Firma' })}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full bg-transparent outline-none text-[var(--text-strong)] placeholder:text-[var(--text-faint)]"
                            />
                        </div>

                        <div className="app-command-field flex-1 w-full rounded-full border-transparent bg-[var(--surface-muted)]">
                            <MapPin size={20} className="text-[var(--text-faint)]" />
                            <input
                                type="text"
                                placeholder={t('hero.location_placeholder', { defaultValue: 'Místo konání' })}
                                value={filterCity}
                                onChange={(e) => setFilterCity(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                className="w-full bg-transparent outline-none text-[var(--text-strong)] placeholder:text-[var(--text-faint)]"
                            />
                        </div>

                        <button
                            onClick={handleSearch}
                            className="app-button-primary w-full sm:w-auto px-8 py-3.5 rounded-full font-bold"
                        >
                            {t('hero.search_cta', { defaultValue: 'Hledat' })}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Hero;
