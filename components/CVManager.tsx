import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CVDocument } from '../types';
import { getUserCVDocuments, updateUserCVSelection, deleteCVDocument, uploadCVDocument, updateCVDocumentMetadata, updateCVDocumentParsedData } from '../services/supabaseService';
import { parseCvFile } from '../services/cvUploadService';
import { FileText, Download, Trash2, Check, Upload, Calendar, RefreshCw, Tag, Eye, ExternalLink, X } from 'lucide-react';

interface CVManagerProps {
  userId: string;
  onCVSelected?: (cv: CVDocument) => void;
  isPremium?: boolean;
}

const CVManager: React.FC<CVManagerProps> = ({ userId, onCVSelected, isPremium = false }) => {
  const { t } = useTranslation();
  const locale = typeof navigator !== 'undefined' ? navigator.language.toLowerCase().split('-')[0] : 'en';
  const [cvs, setCvs] = useState<CVDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reparsingId, setReparsingId] = useState<string | null>(null);
  const [previewCv, setPreviewCv] = useState<CVDocument | null>(null);

  const copy = ({
    cs: {
      title: 'Knihovna dokumentů',
      upload: 'Přidat dokument',
      emptyTitle: 'Zatím tu nejsou žádné podpůrné dokumenty.',
      emptyBody: 'Přidejte CV nebo jiný doplňující dokument. V handshaku zůstávají volitelné.',
      active: 'Aktivně používaný',
      tipTitle: 'Tip:',
      tipBody: 'Držte si 1 až 2 aktuální podpůrné dokumenty. Nejsou povinné, ale mohou doplnit kontext tam, kde to dává smysl.',
      preview: 'Zobrazit',
      previewTitle: 'Náhled dokumentu',
      previewOpenNew: 'Otevřít v nové kartě',
      previewFallback: 'Tento typ souboru nejde spolehlivě zobrazit přímo v aplikaci. Otevřete ho v nové kartě.',
    },
    sk: {
      title: 'Knižnica dokumentov',
      upload: 'Pridať dokument',
      emptyTitle: 'Zatiaľ tu nie sú žiadne podporné dokumenty.',
      emptyBody: 'Pridajte CV alebo iný doplňujúci dokument. V handshaku zostávajú voliteľné.',
      active: 'Aktívne používaný',
      tipTitle: 'Tip:',
      tipBody: 'Majte pripravené 1 až 2 aktuálne podporné dokumenty. Nie sú povinné, ale v správnej chvíli doplnia kontext.',
      preview: 'Zobraziť',
      previewTitle: 'Náhľad dokumentu',
      previewOpenNew: 'Otvoriť v novej karte',
      previewFallback: 'Tento typ súboru sa nedá spoľahlivo zobraziť priamo v aplikácii. Otvorte ho v novej karte.',
    },
    de: {
      title: 'Dokumentenbibliothek',
      upload: 'Dokument hinzufügen',
      emptyTitle: 'Noch keine unterstützenden Dokumente vorhanden.',
      emptyBody: 'Fügen Sie ein CV oder ein anderes Zusatzdokument hinzu. Im Handshake bleiben diese Unterlagen optional.',
      active: 'Aktuell verwendet',
      tipTitle: 'Tipp:',
      tipBody: 'Halten Sie 1 bis 2 aktuelle Zusatzdokumente bereit. Sie sind optional, können aber nützlichen Kontext ergänzen.',
      preview: 'Vorschau',
      previewTitle: 'Dokumentvorschau',
      previewOpenNew: 'In neuem Tab öffnen',
      previewFallback: 'Dieser Dateityp lässt sich in der App nicht zuverlässig anzeigen. Öffnen Sie ihn in einem neuen Tab.',
    },
    at: {
      title: 'Dokumentenbibliothek',
      upload: 'Dokument hinzufügen',
      emptyTitle: 'Noch keine unterstützenden Dokumente vorhanden.',
      emptyBody: 'Fügen Sie ein CV oder ein anderes Zusatzdokument hinzu. Im Handshake bleiben diese Unterlagen optional.',
      active: 'Aktuell verwendet',
      tipTitle: 'Tipp:',
      tipBody: 'Halten Sie 1 bis 2 aktuelle Zusatzdokumente bereit. Sie sind optional, können aber nützlichen Kontext ergänzen.',
      preview: 'Vorschau',
      previewTitle: 'Dokumentvorschau',
      previewOpenNew: 'In neuem Tab öffnen',
      previewFallback: 'Dieser Dateityp lässt sich in der App nicht zuverlässig anzeigen. Öffnen Sie ihn in einem neuen Tab.',
    },
    pl: {
      title: 'Biblioteka dokumentów',
      upload: 'Dodaj dokument',
      emptyTitle: 'Nie ma tu jeszcze żadnych materiałów wspierających.',
      emptyBody: 'Dodaj CV lub inny dokument uzupełniający. W handshaku pozostają one opcjonalne.',
      active: 'Aktualnie używany',
      tipTitle: 'Wskazówka:',
      tipBody: 'Trzymaj 1-2 aktualne dokumenty wspierające. Są opcjonalne, ale czasem dobrze uzupełniają kontekst.',
      preview: 'Podgląd',
      previewTitle: 'Podgląd dokumentu',
      previewOpenNew: 'Otwórz w nowej karcie',
      previewFallback: 'Tego typu pliku nie da się wiarygodnie podejrzeć bezpośrednio w aplikacji. Otwórz go w nowej karcie.',
    },
    en: {
      title: 'Document library',
      upload: 'Add document',
      emptyTitle: 'No supporting documents yet.',
      emptyBody: 'Add a CV or another supporting file. In the handshake flow, these stay optional.',
      active: 'Currently in use',
      tipTitle: 'Tip:',
      tipBody: 'Keep 1 to 2 current supporting documents ready. They are optional, but useful when extra context helps.',
      preview: 'Preview',
      previewTitle: 'Document preview',
      previewOpenNew: 'Open in new tab',
      previewFallback: 'This file type cannot be previewed reliably inside the app. Open it in a new tab instead.',
    },
  } as const)[(['cs', 'sk', 'de', 'at', 'pl'].includes(locale) ? locale : 'en') as 'cs' | 'sk' | 'de' | 'at' | 'pl' | 'en'];

  const canPreviewInline = (cv: CVDocument | null) => {
    if (!cv) return false;
    const name = String(cv.originalName || cv.fileName || '').toLowerCase();
    const type = String(cv.contentType || '').toLowerCase();
    return type.includes('pdf') || name.endsWith('.pdf');
  };

  useEffect(() => {
    loadCVs();
  }, [userId]);

  const loadCVs = async () => {
    setLoading(true);
    try {
      const userCVs = await getUserCVDocuments(userId);
      setCvs(userCVs);
    } catch (error) {
      console.error('Failed to load CVs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.docx')) {
      alert(t('profile.cv_type_error'));
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert(t('profile.cv_size_error'));
      return;
    }

    setUploading(true);
    try {
      const suggestedLabel = prompt(t('cv_manager.label_prompt'), '');
      const suggestedLocale = prompt(t('cv_manager.locale_prompt'), '');
      const newCV = await uploadCVDocument(userId, file, {
        label: suggestedLabel || undefined,
        locale: suggestedLocale || undefined
      });
      if (newCV) {
        await updateUserCVSelection(userId, newCV.id);
        await loadCVs(); // Refresh list
        if (onCVSelected) {
          onCVSelected(newCV);
        }
        alert(t('cv_manager.upload_success'));
      }
    } catch (error) {
      console.error('CV upload failed:', error);
      alert(t('profile.cv_upload_error'));
    } finally {
      setUploading(false);
      if (event.target) {
        (event.target as HTMLInputElement).value = '';
      }
    }
  };

  const handleSelectCV = async (cvId: string) => {
    if (cvs.find(cv => cv.id === cvId)?.isActive) {
      return; // Already selected
    }

    try {
      const success = await updateUserCVSelection(userId, cvId);
      if (success) {
        await loadCVs(); // Refresh list
        const selectedCV = cvs.find(cv => cv.id === cvId);
        if (selectedCV && onCVSelected) {
          onCVSelected(selectedCV);
        }
      }
    } catch (error) {
      console.error('Failed to select CV:', error);
      alert(t('cv_manager.select_error'));
    }
  };

  const handleDeleteCV = async (cvId: string) => {
    const cv = cvs.find(c => c.id === cvId);
    if (!cv) return;

    if (!confirm(t('cv_manager.delete_confirm', { name: cv.originalName }))) {
      return;
    }

    try {
      const success = await deleteCVDocument(userId, cvId);
      if (success) {
        await loadCVs(); // Refresh list
        alert(t('cv_manager.delete_success'));
      }
    } catch (error) {
      console.error('Failed to delete CV:', error);
      alert(t('cv_manager.delete_error'));
    }
  };

  const handleEditLabel = async (cvId: string) => {
    const cv = cvs.find(c => c.id === cvId);
    if (!cv) return;
    const label = prompt(t('cv_manager.label_prompt'), cv.label || cv.originalName || '');
    if (label === null) return;
    const locale = prompt(t('cv_manager.locale_prompt'), cv.locale || '');
    const success = await updateCVDocumentMetadata(userId, cvId, {
      label: label.trim() ? label.trim() : null,
      locale: locale?.trim() || null
    });
    if (success) {
      await loadCVs();
    } else {
      alert(t('cv_manager.update_error'));
    }
  };

  const handleReparseCV = async (cvId: string) => {
    const cv = cvs.find(c => c.id === cvId);
    if (!cv) return;
    setReparsingId(cvId);
    try {
      const response = await fetch(cv.fileUrl);
      const blob = await response.blob();
      const file = new File([blob], cv.originalName || 'cv', { type: cv.contentType || blob.type || 'application/pdf' });
      const parsedData = await parseCvFile(file, { isPremium });
      const success = await updateCVDocumentParsedData(userId, cvId, parsedData);
      if (success) {
        await loadCVs();
        alert(t('cv_manager.reparse_success'));
      } else {
        alert(t('cv_manager.reparse_error'));
      }
    } catch (error) {
      console.error('CV reparse failed:', error);
      alert(t('cv_manager.reparse_error'));
    } finally {
      setReparsingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(locale === 'at' ? 'de-AT' : locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-cyan-400"></div>
          <span className="ml-3 text-gray-600 dark:text-slate-300">{t('app.loading')}</span>
        </div>
      </div>
    );
  }

  return (
      <div className="p-6 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-lg">
        <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">{copy.title}</h3>
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:bg-cyan-600 dark:hover:bg-cyan-500 cursor-pointer transition-colors">
          <Upload size={16} />
          <span>{copy.upload}</span>
          <input
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {uploading && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-cyan-950/30 border border-blue-200 dark:border-cyan-800 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-cyan-400 mr-3"></div>
            <span className="text-blue-700 dark:text-cyan-300">{t('profile.uploading')}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {cvs.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-slate-400">
            <FileText size={48} className="mx-auto mb-4 text-gray-300 dark:text-slate-600" />
            <p>{copy.emptyTitle}</p>
            <p className="text-sm">{copy.emptyBody}</p>
          </div>
        ) : (
          cvs.map((cv) => (
            <div
              key={cv.id}
              className={`p-4 border rounded-lg transition-all ${cv.isActive
                ? 'border-blue-500 dark:border-cyan-500 bg-blue-50 dark:bg-cyan-950/25 shadow-sm'
                : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-slate-600'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-gray-400 dark:text-slate-500" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100">{cv.label || cv.originalName}</h4>
                        {cv.locale && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-200">
                            {cv.locale}
                          </span>
                        )}
                        {!cv.label && (
                          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-50 dark:bg-slate-700/60 text-slate-400 dark:text-slate-300">
                            {t('cv_manager.no_label')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-slate-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(cv.uploadedAt)}
                        </span>
                        <span>{formatFileSize(cv.fileSize)}</span>
                        {cv.isActive && (
                          <span className="flex items-center gap-1 text-green-600 dark:text-emerald-400 font-medium">
                            <Check size={14} />
                            {copy.active}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {cv.parsedData && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700">
                      <div className="text-sm text-gray-600 dark:text-slate-300">
                        <span className="font-medium">
                          {t('cv_manager.stats', {
                            skills: cv.parsedData.skills?.length || 0,
                            exp: cv.parsedData.workHistory?.length || 0,
                            edu: cv.parsedData.education?.length || 0
                          })}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => setPreviewCv(cv)}
                    className="p-2 text-sky-600 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-500/15 rounded-lg transition-colors"
                    title={copy.preview}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => handleReparseCV(cv.id)}
                    className="p-2 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/15 rounded-lg transition-colors"
                    title={t('cv_manager.reparse')}
                    disabled={reparsingId === cv.id}
                  >
                    <RefreshCw size={16} className={reparsingId === cv.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => handleEditLabel(cv.id)}
                    className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    title={t('cv_manager.edit_label')}
                  >
                    <Tag size={16} />
                  </button>
                  <a
                    href={cv.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 dark:text-cyan-300 hover:bg-blue-50 dark:hover:bg-cyan-500/15 rounded-lg transition-colors"
                    title={t('cv_manager.download')}
                  >
                    <Download size={16} />
                  </a>

                  {!cv.isActive && (
                    <button
                      onClick={() => handleSelectCV(cv.id)}
                      className="p-2 text-green-600 dark:text-emerald-400 hover:bg-green-50 dark:hover:bg-emerald-500/15 rounded-lg transition-colors"
                      title={t('cv_manager.set_active')}
                    >
                      <Check size={16} />
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteCV(cv.id)}
                    className="p-2 text-red-600 dark:text-rose-400 hover:bg-red-50 dark:hover:bg-rose-500/15 rounded-lg transition-colors"
                    title={t('cv_manager.delete')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {cvs.length > 0 && (
        <div className="mt-6 p-4 bg-yellow-50 dark:bg-amber-950/30 border border-yellow-200 dark:border-amber-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-amber-200">
            <strong>{copy.tipTitle}</strong> {copy.tipBody}
          </p>
        </div>
      )}

      {previewCv && (
        <div className="app-modal-backdrop p-3 sm:p-4">
          <div className="app-modal-panel max-w-5xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3 sm:px-5">
              <div>
                <div className="text-base font-semibold text-[var(--text-strong)]">{copy.previewTitle}</div>
                <div className="text-xs text-[var(--text-muted)]">{previewCv.label || previewCv.originalName}</div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewCv.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-strong)] transition hover:bg-[var(--surface)]"
                >
                  <ExternalLink size={15} />
                  {copy.previewOpenNew}
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewCv(null)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-muted)] text-[var(--text-strong)] transition hover:bg-[var(--surface)]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            {canPreviewInline(previewCv) ? (
              <iframe
                src={previewCv.fileUrl}
                title={previewCv.originalName || previewCv.fileName}
                className="h-[75dvh] w-full bg-white"
              />
            ) : (
              <div className="p-6 text-center">
                <FileText size={40} className="mx-auto mb-3 text-[var(--text-faint)]" />
                <p className="text-sm text-[var(--text-muted)]">{copy.previewFallback}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CVManager;
