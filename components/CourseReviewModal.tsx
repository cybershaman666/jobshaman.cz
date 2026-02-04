import React, { useState } from 'react';
import { X, Star, Send, CheckCircle, Loader2, Briefcase, TrendingUp } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  provider: string;
  duration_hours: number;
  rating: number;
  reviews_count: number;
}

interface CourseReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: Course;
  isVerifiedGraduate: boolean;
  reviewerId?: string | null;
  onSubmitted?: () => void;
}

type Step = 'form' | 'submitting' | 'success';

const CourseReviewModal: React.FC<CourseReviewModalProps> = ({ 
  isOpen, 
  onClose, 
  course, 
  isVerifiedGraduate,
  reviewerId,
  onSubmitted
}) => {
  const [step, setStep] = useState<Step>('form');
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');

  const [careerImpact, setCareerImpact] = useState({
    newSkills: [] as string[],
    salaryIncrease: '',
    newJob: false,
    promotion: false
  });

  if (!isOpen) return null;
  if (!isVerifiedGraduate) return null;
  if (!reviewerId) return null;

  const handleSubmit = async () => {
    if (rating === 0) return;
    
    setStep('submitting');
    
    // Simulate API call to save review
    try {
      const { createCourseReview } = await import('../services/supabaseService');
      await createCourseReview({
        course_id: course.id,
        reviewer_id: reviewerId,
        rating,
        comment,
        is_verified_graduate: true
      });
      
      setStep('success');
      if (onSubmitted) onSubmitted();
    } catch (error) {
      console.error('Error submitting review:', error);
      setStep('form');
    }
  };

  const renderStars = () => {
    return (
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="transition-colors"
          >
            <Star
              size={24}
              className={`${
                star <= (hoveredStar || rating)
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-slate-300 fill-slate-300'
              } transition-colors hover:scale-110`}
            />
          </button>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    if (step === 'success') {
      return (
        <div className="text-center py-12 px-6 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <CheckCircle size={40} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Recenze odeslána</h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8 max-w-md mx-auto">
            Děkujeme za vaši recenzi kurzu "{course.title}". Vaše zkušenost pomůže ostatním uchazečům!
          </p>
          
          <div className="bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-700 rounded-xl p-6 max-w-sm mx-auto">
            <div className="flex items-center gap-3 text-cyan-700 dark:text-cyan-300 mb-3">
              <TrendingUp className="w-5 h-5" />
              <span className="font-bold text-sm">Vaše kariérní dopad</span>
            </div>
            <div className="space-y-2 text-sm text-cyan-800 dark:text-cyan-200">
              <div className="flex justify-between">
                <span>Hodnocení:</span>
                <span className="font-bold">{rating}/5 ⭐</span>
              </div>
              <div className="flex justify-between">
                <span>Přispělo ke kariéře:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">Ano</span>
              </div>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="mt-8 px-6 py-2 bg-slate-800 text-white border border-slate-700 rounded-lg font-medium hover:bg-slate-700 transition-colors"
          >
            Zavřít
          </button>
        </div>
      );
    }

    if (step === 'submitting') {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 animate-in fade-in">
          <Loader2 size={48} className="text-cyan-600 dark:text-cyan-500 animate-spin mb-6" />
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Odesílám recenzi...</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Ukládám vaši zkušenost s kurzem.</p>
        </div>
      );
    }

    return (
      <div className="p-6 sm:p-8 space-y-6">
        {/* Header */}
        <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Ohodnotit kurz</h2>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Briefcase className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-white">{course.title}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{course.provider}</p>
            </div>
          </div>
        </div>

        {/* Verification Badge */}
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-100">Ověřený absolvent</h4>
              <p className="text-sm text-emerald-700 dark:text-emerald-300">
                Jste ověřený absolvent tohoto kurzu. Vaše recenze bude označena jako ověřená.
              </p>
            </div>
          </div>
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Celkové hodnocení *</label>
          {renderStars()}
          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Špatné</span>
            <span>Vynikající</span>
          </div>
        </div>

        {/* Comment */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Komentář k recenzi</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Sdílejte své zkušenosti s kurzem. Co se vám líbilo? Co by se dalo zlepšit? Pomohl vám kurz v kariéře?"
            className="w-full h-32 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm leading-relaxed text-slate-800 dark:text-slate-200 placeholder:text-slate-500 resize-none"
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {comment.length}/500 znaků
          </p>
        </div>

        {/* Career Impact */}
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Kariérní dopad</h4>
          
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="newJob"
                checked={careerImpact.newJob}
                onChange={(e) => setCareerImpact(prev => ({...prev, newJob: e.target.checked}))}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <label htmlFor="newJob" className="text-sm text-slate-700 dark:text-slate-300">
                Našel/a jsem si práci díky tomuto kurzu
              </label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="promotion"
                checked={careerImpact.promotion}
                onChange={(e) => setCareerImpact(prev => ({...prev, promotion: e.target.checked}))}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <label htmlFor="promotion" className="text-sm text-slate-700 dark:text-slate-300">
                Získal/a jsem povýšení
              </label>
            </div>

            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Nárůst platu (volitelné)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={careerImpact.salaryIncrease}
                  onChange={(e) => setCareerImpact(prev => ({...prev, salaryIncrease: e.target.value}))}
                  placeholder="např. 15%"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-slate-700 dark:text-slate-300 mb-2">
                Nové dovednosti (volitelné)
              </label>
              <input
                type="text"
                placeholder="např. React, TypeScript, projektové řízení"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:outline-none text-sm text-slate-900 dark:text-white placeholder:text-slate-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={onClose}
            className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-medium rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            Zrušit
          </button>
          <button 
            onClick={handleSubmit}
            disabled={rating === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 text-white font-bold rounded-xl hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(8,145,178,0.4)]"
          >
            <Send size={18} />
            Odeslat recenzi
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>
      <div className="relative bg-white dark:bg-[#0b1121] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] overflow-y-auto ring-1 ring-black/5 dark:ring-white/10 transition-colors duration-300">
        {step !== 'success' && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full z-10 transition-colors"
          >
            <X size={20} />
          </button>
        )}
        {renderContent()}
      </div>
    </div>
  );
};

export default CourseReviewModal;
