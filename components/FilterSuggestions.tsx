import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AnalyticsService, { PopularFilterCombination } from '../services/analyticsService';
import { UserProfile } from '../types';

interface FilterSuggestionsProps {
    onApplyFilter: (filters: PopularFilterCombination['filters']) => void;
    hasActiveFilters: boolean;
    userProfile: UserProfile;
}

export const FilterSuggestions: React.FC<FilterSuggestionsProps> = ({ onApplyFilter, hasActiveFilters, userProfile }) => {
    const { t } = useTranslation();
    const [suggestions, setSuggestions] = useState<PopularFilterCombination[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSuggestions();
    }, [userProfile.isLoggedIn, userProfile.id]);

    const loadSuggestions = async () => {
        try {
            if (userProfile.isLoggedIn) {
                const personal = await AnalyticsService.getUserPopularFilterCombinations(5);
                if (personal.length > 0) {
                    setSuggestions(personal);
                    return;
                }
            }

            const popular = await AnalyticsService.getPopularFilterCombinations(5);
            setSuggestions(popular);
        } catch (error) {
            console.error('Failed to load suggestions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Only show when no active filters
    if (hasActiveFilters || suggestions.length === 0) {
        return null;
    }

    if (isLoading) {
        return (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/30 px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                {t('common.loading', { defaultValue: 'Loading...' })}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-950/30 p-3">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                {userProfile.isLoggedIn ? t('filter_suggestions.title_personal') : t('filter_suggestions.title_popular')}
            </h4>
            <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onApplyFilter(suggestion.filters)}
                        className="inline-flex max-w-full items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/55 px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-200 transition-colors hover:border-cyan-300 dark:hover:border-cyan-700 hover:bg-cyan-50/70 dark:hover:bg-cyan-950/20"
                        title={`${suggestion.avgResults} average results • ${suggestion.usageCount} uses`}
                    >
                        <span className="min-w-0 flex-1 truncate font-medium">
                            {AnalyticsService.formatFilterCombination(suggestion.filters)}
                        </span>
                        <span className="rounded-full bg-white dark:bg-slate-950 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                            {suggestion.usageCount}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
