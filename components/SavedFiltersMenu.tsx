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
        <div className="saved-filters-menu">
            <div className="saved-filters-actions">
                {hasActiveFilters && (
                    <button
                        className="btn-save-filter"
                        onClick={() => setShowSaveModal(true)}
                        title={t('saved_filters.save_current_title')}
                    >
                        💾 {t('saved_filters.save_search')}
                    </button>
                )}

                {saved.length > 0 && (
                    <button
                        className="btn-load-filter"
                        onClick={() => setShowMenu(!showMenu)}
                        title={t('saved_filters.load_saved_title')}
                    >
                        📂 {t('saved_filters.saved_count', { count: saved.length })}
                    </button>
                )}
            </div>

            {showMenu && (
                <div className="saved-filters-dropdown">
                    <div className="saved-filters-header">
                        <h4>{t('saved_filters.saved_searches')}</h4>
                        <button onClick={() => setShowMenu(false)}>×</button>
                    </div>
                    <div className="saved-list">
                        {sortedSaved.map(filterSet => (
                            <div key={filterSet.id} className="saved-item">
                                <button
                                    className="saved-item-favorite"
                                    onClick={() => handleToggleFavorite(filterSet.id, filterSet.isFavorite)}
                                    title={filterSet.isFavorite ? t('saved_filters.unfavorite') : t('saved_filters.favorite')}
                                >
                                    {filterSet.isFavorite ? '⭐' : '☆'}
                                </button>

                                <button
                                    className="saved-item-load"
                                    onClick={() => handleLoad(filterSet)}
                                >
                                    <span className="saved-item-name">{filterSet.name}</span>
                                    <span className="saved-item-usage">{t('saved_filters.used_count', { count: filterSet.usageCount })}</span>
                                </button>

                                <button
                                    className="saved-item-delete"
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
                <div className="modal-overlay" onClick={() => setShowSaveModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>{t('saved_filters.modal_title')}</h3>
                        <input
                            type="text"
                            value={saveName}
                            onChange={e => setSaveName(e.target.value)}
                            placeholder={t('saved_filters.modal_placeholder')}
                            maxLength={100}
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                        />
                        <div className="modal-actions">
                            <button onClick={() => setShowSaveModal(false)}>{t('saved_filters.cancel')}</button>
                            <button onClick={handleSave} className="btn-primary">{t('saved_filters.save')}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
