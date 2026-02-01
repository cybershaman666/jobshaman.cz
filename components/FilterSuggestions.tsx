import React, { useEffect, useState } from 'react';
import AnalyticsService, { PopularFilterCombination } from '../services/analyticsService';

interface FilterSuggestionsProps {
    onApplyFilter: (filters: PopularFilterCombination['filters']) => void;
    hasActiveFilters: boolean;
}

export const FilterSuggestions: React.FC<FilterSuggestionsProps> = ({ onApplyFilter, hasActiveFilters }) => {
    const [suggestions, setSuggestions] = useState<PopularFilterCombination[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSuggestions();
    }, []);

    const loadSuggestions = async () => {
        try {
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
            <div className="filter-suggestions loading">
                <div className="suggestion-skeleton"></div>
            </div>
        );
    }

    return (
        <div className="filter-suggestions">
            <h4 className="suggestions-title">🔥 Popular Searches</h4>
            <div className="suggestion-chips">
                {suggestions.map((suggestion, index) => (
                    <button
                        key={index}
                        onClick={() => onApplyFilter(suggestion.filters)}
                        className="suggestion-chip"
                        title={`${suggestion.avgResults} average results • ${suggestion.usageCount} uses`}
                    >
                        <span className="chip-text">
                            {AnalyticsService.formatFilterCombination(suggestion.filters)}
                        </span>
                        <span className="chip-count">
                            {suggestion.usageCount}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};
