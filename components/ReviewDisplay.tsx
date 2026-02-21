import React from 'react';
import { useTranslation } from 'react-i18next';
import { Star, Calendar, User, Filter } from 'lucide-react';

interface ResourceReview {
  id: string;
  resource_id: string;
  candidate_id?: string;
  rating: number;
  comment: string;
  is_verified_graduate: boolean;
  created_at: string;
  candidate_name?: string;
  candidate_avatar?: string;
  helpful_count?: number;
  unhelpful_count?: number;
}

interface ReviewDisplayProps {
  reviews: ResourceReview[];
  resourceTitle: string;
  averageRating: number;
  totalReviews: number;
  onVote?: (reviewId: string, isHelpful: boolean) => void;
  canVote?: boolean;
}

const ReviewDisplay: React.FC<ReviewDisplayProps> = ({ 
  reviews, 
  resourceTitle, 
  averageRating, 
  totalReviews,
  onVote,
  canVote = false
}) => {
  const { t, i18n } = useTranslation();
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(i18n.language || 'en', {
      day: 'numeric',
      month: 'short', 
      year: 'numeric'
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={`${
              star <= rating 
                ? 'text-yellow-400 fill-yellow-400' 
                : 'text-slate-300 fill-slate-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const sortReviews = [...reviews].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
    if (rating >= 3.5) return 'text-cyan-600 bg-cyan-100 dark:text-cyan-400 dark:bg-cyan-900/30';
    return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 max-h-[80vh] overflow-hidden flex flex-col">
      
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/30">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white truncate">
              {t('review_display.title', { course: resourceTitle })}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-2">
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {t('review_display.average_rating')}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <div className="text-3xl font-bold text-slate-900 dark:text-white">
                      {averageRating.toFixed(1)}
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('review_display.from_reviews', { count: totalReviews })}
                    </div>
                  </div>
                  <div className="flex">
                    {renderStars(Math.round(averageRating))}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="px-3 py-2 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                  <div className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    {t('review_display.total_reviews', { count: totalReviews })}
                  </div>
                </div>
                <button className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  <Filter size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-6">
          {reviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {t('review_display.empty_title')}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                {t('review_display.empty_desc')}
              </p>
            </div>
          ) : (
            sortReviews.map((review) => (
              <div 
                key={review.id} 
                className={`bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border transition-all hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 ${
                  review.is_verified_graduate 
                    ? 'border-emerald-200 dark:border-emerald-800' 
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                {/* Review Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {review.candidate_avatar ? (
                      <img 
                        src={review.candidate_avatar} 
                        alt={review.candidate_name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center">
                        <User size={20} className="text-slate-500 dark:text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-slate-900 dark:text-white truncate">
                          {review.candidate_name || t('review_display.anonymous_candidate')}
                        </h4>
                        {review.is_verified_graduate && (
                          <span className="px-2 py-1 bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded text-xs font-medium text-emerald-700 dark:text-emerald-400 ml-2">
                            {t('review_display.verified_graduate')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <Calendar className="w-3 h-3" />
                        {formatDate(review.created_at)}
                      </div>
                    </div>
                  </div>
                  
                  {/* Rating */}
                  <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${getRatingColor(review.rating)}`}>
                    <span className="font-bold">{review.rating}</span>
                    <Star className="w-4 h-4 fill-current" />
                  </div>
                </div>

                {/* Review Content */}
                <div className="mb-4">
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {review.comment}
                  </p>
                </div>

                {/* Helpful Indicator */}
                <div className="flex items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => onVote?.(review.id, true)}
                    disabled={!canVote}
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                  >
                    <Star size={14} />
                    <span>{t('review_display.helpful', { count: (review as any).helpful_count || 0 })}</span>
                  </button>
                  <button
                    onClick={() => onVote?.(review.id, false)}
                    disabled={!canVote}
                    className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors disabled:opacity-50"
                  >
                    <div className="w-4 h-4 border-2 border-slate-300 rounded"></div>
                    <span>{t('review_display.not_helpful', { count: (review as any).unhelpful_count || 0 })}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewDisplay;
