import React, { useEffect, useState } from 'react';
import { SavedFilterSet, getSavedFilterSets, deleteFilterSet, updateFilterSetUsage, saveFilterSet, toggleFavorite } from '../services/savedFiltersService';

interface SavedFiltersMenuProps {
    onLoadFilter: (filters: SavedFilterSet['filters']) => void;
    currentFilters: SavedFilterSet['filters'];
    hasActiveFilters: boolean;
}

export const SavedFiltersMenu: React.FC<SavedFiltersMenuProps> = ({ onLoadFilter, currentFilters, hasActiveFilters }) => {
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
            alert('Please enter a name for this filter set');
            return;
        }

        const result = await saveFilterSet(saveName, currentFilters);
        if (result) {
            await loadSavedFilters();
            setShowSaveModal(false);
            setSaveName('');
        } else {
            alert('Failed to save filter set');
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Delete this saved search?')) {
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
                        title="Save current filter combination"
                    >
                        💾 Save Search
                    </button>
                )}

                {saved.length > 0 && (
                    <button
                        className="btn-load-filter"
                        onClick={() => setShowMenu(!showMenu)}
                        title="Load a saved search"
                    >
                        📂 Saved ({saved.length})
                    </button>
                )}
            </div>

            {showMenu && (
                <div className="saved-filters-dropdown">
                    <div className="saved-filters-header">
                        <h4>Saved Searches</h4>
                        <button onClick={() => setShowMenu(false)}>×</button>
                    </div>
                    <div className="saved-list">
                        {sortedSaved.map(filterSet => (
                            <div key={filterSet.id} className="saved-item">
                                <button
                                    className="saved-item-favorite"
                                    onClick={() => handleToggleFavorite(filterSet.id, filterSet.isFavorite)}
                                    title={filterSet.isFavorite ? 'Unfavorite' : 'Favorite'}
                                >
                                    {filterSet.isFavorite ? '⭐' : '☆'}
                                </button>

                                <button
                                    className="saved-item-load"
                                    onClick={() => handleLoad(filterSet)}
                                >
                                    <span className="saved-item-name">{filterSet.name}</span>
                                    <span className="saved-item-usage">Used {filterSet.usageCount}×</span>
                                </button>

                                <button
                                    className="saved-item-delete"
                                    onClick={() => handleDelete(filterSet.id)}
                                    title="Delete"
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
                        <h3>Save Filter Set</h3>
                        <input
                            type="text"
                            value={saveName}
                            onChange={e => setSaveName(e.target.value)}
                            placeholder="Enter a name..."
                            maxLength={100}
                            autoFocus
                            onKeyDown={e => e.key === 'Enter' && handleSave()}
                        />
                        <div className="modal-actions">
                            <button onClick={() => setShowSaveModal(false)}>Cancel</button>
                            <button onClick={handleSave} className="btn-primary">Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
