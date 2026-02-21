import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, TrendingUp, Clock, Target, Briefcase, Award, Calendar } from 'lucide-react';

interface CareerTrack {
  id: string;
  course_id: string;
  course_title: string;
  status: 'in_progress' | 'completed' | 'hired';
  original_job_title: string;
  original_salary_avg: number;
  new_job_id?: number;
  salary_increase_percent?: number;
  completed_at?: string;
  created_at: string;
  duration_hours?: number;
}

interface CareerProgressTrackerProps {
  tracks: CareerTrack[];
  onClose: () => void;
}

const CareerProgressTracker: React.FC<CareerProgressTrackerProps> = ({ tracks, onClose }) => {
  const { t, i18n } = useTranslation();
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
      case 'hired': return 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30';
      default: return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <Award size={16} />;
      case 'hired': return <Briefcase size={16} />;
      default: return <Target size={16} />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed': return t('career_tracker.status.completed');
      case 'hired': return t('career_tracker.status.hired');
      default: return t('career_tracker.status.in_progress');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language || 'en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const calculateTotalROI = () => {
    const completedTracks = tracks.filter(t => t.status === 'completed' || t.status === 'hired');
    const totalSalaryIncrease = completedTracks.reduce((sum, t) => sum + (Number(t.salary_increase_percent) || 0), 0);
    const avgIncrease = completedTracks.length > 0 ? totalSalaryIncrease / completedTracks.length : 0;
    return avgIncrease.toFixed(1);
  };

  const getProgressBarWidth = (track: CareerTrack) => {
    // Simulate progress based on status
    if (track.status === 'completed') return 100;
    if (track.status === 'hired') return 100;
    // For in_progress, calculate based on time elapsed
    const now = new Date();
    const created = new Date(track.created_at);
    const daysElapsed = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    // Assume average course duration is 3 months (90 days)
    return Math.min(95, Math.floor((daysElapsed / 90) * 100));
  };

  const sortedTracks = [...tracks].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const totalROI = calculateTotalROI();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      <div className="relative bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-[#0b1121] border-b border-slate-200 dark:border-slate-800 p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {t('career_tracker.title')}
                </h2>
                <p className="text-slate-600 dark:text-slate-300 text-sm">
                  {t('career_tracker.subtitle')}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ROI Summary */}
        <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 dark:from-emerald-900/20 dark:to-cyan-900/20 p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('career_tracker.completed_courses')}</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {tracks.filter(t => t.status === 'completed' || t.status === 'hired').length}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('career_tracker.avg_salary_increase')}</div>
              <div className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                {Number(totalROI) > 0 ? `+${totalROI}%` : '0%'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-slate-600 dark:text-slate-400 mb-1">{t('career_tracker.total_roi')}</div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {Number(totalROI) > 0 ? t('career_tracker.roi_excellent') : t('career_tracker.roi_evaluating')}
              </div>
            </div>
          </div>
        </div>

        {/* Career Tracks Timeline */}
        <div className="p-6 space-y-6 max-h-96 overflow-y-auto">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('career_tracker.detail_overview')}</h3>
          
          {sortedTracks.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-slate-400" />
              <p className="text-slate-600 dark:text-slate-300">
                {t('career_tracker.empty_line1')}
                <br />
                {t('career_tracker.empty_line2')}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedTracks.map((track) => (
                <div key={track.id} className="flex gap-6">
                  {/* Date and Status */}
                  <div className="flex-shrink-0 w-32">
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      {formatDate(track.created_at)}
                    </div>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(track.status)}`}>
                      {getStatusIcon(track.status)}
                      {getStatusText(track.status)}
                    </div>
                  </div>

                  {/* Course Info */}
                  <div className="flex-1">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-800">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                            {track.course_title}
                          </h4>
                          <p className="text-sm text-slate-600 dark:text-slate-300">
                            {t('career_tracker.original_position')}: {track.original_job_title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <Clock className="w-3 h-3" />
                          {track.duration_hours ? `${track.duration_hours}h` : t('career_tracker.not_specified')}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-1">
                          <span>{t('career_tracker.progress')}</span>
                          <span>{getProgressBarWidth(track)}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${
                              track.status === 'completed' || track.status === 'hired'
                                ? 'bg-emerald-500' 
                                : 'bg-cyan-500'
                            }`}
                            style={{ width: `${getProgressBarWidth(track)}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Results */}
                      {track.status === 'completed' || track.status === 'hired' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                          {track.new_job_id && (
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                              <div>
                                <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                                  {t('career_tracker.new_job_obtained')}
                                </div>
                              </div>
                            </div>
                          )}
                          {track.salary_increase_percent && (
                            <div className="flex items-center gap-2">
                              <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                              <div>
                                <div className="text-sm font-medium text-cyan-600 dark:text-cyan-400">
                                  {t('career_tracker.salary_increased_by', { percent: track.salary_increase_percent })}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            {t('career_tracker.course_in_progress')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CareerProgressTracker;
