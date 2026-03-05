import React, { useEffect, useState } from 'react';
import { SavedFilterSet, getSavedFilterSets, deleteFilterSet, updateFilterSetUsage, saveFilterSet, toggleFavorite } from '../services/savedFiltersService';
import { useTranslation } from 'react-i18next';

interface SavedFiltersMenuProps {
    onLoadFilter: (filters: SavedFilterSet['filters']) => void;
    currentFilters: SavedFilterSet['filters'];
    hasActiveFilters: boolean;
}

export const SavedFiltersMenu: React.FC<SavedFiltersMenuProps> = ({ onLoadFilter, currentFilters, hasActiveFilters }) => {
    const { t } = useTranslation();
    const [saved, setSaved] = useState<SavedFilterSet[]>([]);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        loadSavedFilters();
    }, []);

    const loadSavedFilters = async () => {
        try {
            const filters = await getSavedFilterSets();
            setSaved(filters);
        } catch (error) {
            console.error('Failed to load saved filters:', error);
        }
    };

    const handleSave = async () => {
        if (!saveName.trim()) {
            alert(t('saved_filters.errors.enter_name'));
            return;
        }

        const result = await saveFilterSet(saveName, currentFilters);
        if (result) {
            await loadSavedFilters();
            setShowSaveModal(false);
            setSaveName('');
        } else {
            alert(t('saved_filters.errors.save_failed'));
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm(t('saved_filters.confirm_delete'))) {
            const success = await deleteFilterSet(id);
            if (success) {
                await loadSavedFilters();
            }
        }
    };

    const handleLoad = async (filterSet: SavedFilterSet) => {
        onLoadFilter(filterSet.filters);
        await updateFilterSetUsage(filterSet.id);
        await loadSavedFilters();
        setShowMenu(false);
    };

    const handleToggleFavorite = async (id: string, isFavorite: boolean) => {
        await toggleFavorite(id, !isFavorite);
        await loadSavedFilters();
    };

    const sortedSaved = [...saved].sort((a, b) => {
        // Favorites first
        if (a.isFavorite !== b.isFavorite) {
            return a.isFavorite ? -1 : 1;
        }
        // Then by last used
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
    });

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                {hasActiveFilters && (
                    <button
                        className="inline-flex items-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/55 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:border-cyan-300 dark:hover:border-cyan-700 hover:bg-cyan-50/70 dark:hover:bg-cyan-950/20"
                        onClick={() => setShowSaveModal(true)}
                        title={t('saved_filters.save_current_title')}
                    >
                        💾 {t('saved_filters.save_search')}
                    </button>
                )}

                {saved.length > 0 && (
                    <button
                        className="inline-flex items-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/55 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:border-cyan-300 dark:hover:border-cyan-700 hover:bg-cyan-50/70 dark:hover:bg-cyan-950/20"
                        onClick={() => setShowMenu(!showMenu)}
                        title={t('saved_filters.load_saved_title')}
                    >
                        📂 {t('saved_filters.saved_count', { count: saved.length })}
                    </button>
                )}
            </div>

            {showMenu && (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white/92 dark:bg-slate-950/80 p-3 shadow-[0_18px_32px_-24px_rgba(15,23,42,0.35)]">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">{t('saved_filters.saved_searches')}</h4>
                        <button onClick={() => setShowMenu(false)} className="inline-flex h-6 w-6 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                            ×
                        </button>
                    </div>
                    <div className="mt-2 space-y-2">
                        {sortedSaved.map(filterSet => (
                            <div key={filterSet.id} className="flex items-center gap-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/55 p-2">
                                <button
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm"
                                    onClick={() => handleToggleFavorite(filterSet.id, filterSet.isFavorite)}
                                    title={filterSet.isFavorite ? t('saved_filters.unfavorite') : t('saved_filters.favorite')}
                                >
                                    {filterSet.isFavorite ? '⭐' : '☆'}
                                </button>

                                <button
                                    className="min-w-0 flex-1 text-left"
                                    onClick={() => handleLoad(filterSet)}
                                >
                                    <span className="block truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{filterSet.name}</span>
                                    <span className="block text-[10px] text-slate-500 dark:text-slate-400">{t('saved_filters.used_count', { count: filterSet.usageCount })}</span>
                                </button>

                                <button
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    onClick={() => handleDelete(filterSet.id)}
                                    title={t('saved_filters.delete')}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {showSaveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4" onClick={() => setShowSaveModal(false)}>
                    <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t('saved_filters.modal_title')}</h3>
                        <input
                            type="text"
                            value={saveName}
                            onChange={e => setSaveName(e.target.value)}
                            placeholder={t('saved_filters.modal_placeholder')}
                            maxLength={100}
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                            className="mt-3 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500 dark:[color-scheme:dark]"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <button onClick={() => setShowSaveModal(false)} className="rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                                {t('saved_filters.cancel')}
                            </button>
                            <button onClick={handleSave} className="rounded-xl bg-slate-950 dark:bg-white px-3 py-2 text-xs font-semibold text-white dark:text-slate-950">
                                {t('saved_filters.save')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
