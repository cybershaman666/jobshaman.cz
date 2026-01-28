import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CVDocument } from '../types';
import { getUserCVDocuments, updateUserCVSelection, deleteCVDocument, uploadCVDocument } from '../services/supabaseService';
import { FileText, Download, Trash2, Check, Upload, Calendar } from 'lucide-react';

interface CVManagerProps {
  userId: string;
  onCVSelected?: (cv: CVDocument) => void;
}

const CVManager: React.FC<CVManagerProps> = ({ userId, onCVSelected }) => {
  const { t } = useTranslation();
  const [cvs, setCvs] = useState<CVDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

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
      const newCV = await uploadCVDocument(userId, file);
      if (newCV) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('cs-CZ', {
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
      <div className="p-6 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">{t('app.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 rounded-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">{t('cv_manager.title')}</h3>
        <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer transition-colors">
          <Upload size={16} />
          <span>{t('cv_manager.upload_new')}</span>
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
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-3"></div>
            <span className="text-blue-700">{t('profile.uploading')}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {cvs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <FileText size={48} className="mx-auto mb-4 text-gray-300" />
            <p>{t('cv_manager.no_cvs')}</p>
            <p className="text-sm">{t('cv_manager.first_cv_desc')}</p>
          </div>
        ) : (
          cvs.map((cv) => (
            <div
              key={cv.id}
              className={`p-4 border rounded-lg transition-all ${cv.isActive
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-gray-400" />
                    <div>
                      <h4 className="font-medium text-gray-900">{cv.originalName}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(cv.uploadedAt)}
                        </span>
                        <span>{formatFileSize(cv.fileSize)}</span>
                        {cv.isActive && (
                          <span className="flex items-center gap-1 text-green-600 font-medium">
                            <Check size={14} />
                            {t('cv_manager.active')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {cv.parsedData && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="text-sm text-gray-600">
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
                  <a
                    href={cv.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title={t('cv_manager.download')}
                  >
                    <Download size={16} />
                  </a>

                  {!cv.isActive && (
                    <button
                      onClick={() => handleSelectCV(cv.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                      title={t('cv_manager.set_active')}
                    >
                      <Check size={16} />
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteCV(cv.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>{t('cv_manager.tip_title')}</strong> {t('cv_manager.tip_desc')}
          </p>
        </div>
      )}
    </div>
  );
};

export default CVManager;