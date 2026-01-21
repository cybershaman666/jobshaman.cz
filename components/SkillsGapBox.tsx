import React from 'react';
import { BookOpen, Clock, Award, ExternalLink, TrendingUp } from 'lucide-react';
import { LearningResource, SkillsGapAnalysis } from '../types';

interface SkillsGapBoxProps {
  skillsGapAnalysis: SkillsGapAnalysis | null;
  isLoading?: boolean;
  error?: string | null;
  theme?: 'light' | 'dark';
  onResourceClick?: (resource: LearningResource) => void;
}

const SkillsGapBox: React.FC<SkillsGapBoxProps> = ({
  skillsGapAnalysis,
  isLoading = false,
  error = null,
  onResourceClick
}) => {


  if (isLoading) {
    return (
      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
        </div>
      </div>
    );
  }

  // Don't show if no gap analysis or no missing skills
  if (error || !skillsGapAnalysis || skillsGapAnalysis.missing_skills.length === 0) {
    return null;
  }

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)} dní`;
  };

  const formatPrice = (price: number, currency: string) => {
    return `${price.toLocaleString('cs-CZ')} ${currency}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30';
      case 'Intermediate': return 'text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30';
      case 'Advanced': return 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-900/30';
      default: return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30';
    }
  };

  const { recommended_resources, match_percentage, missing_skills } = skillsGapAnalysis;

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-700">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500 rounded-lg">
          <TrendingUp className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-indigo-900 dark:text-indigo-100">
            Zvyš svou šanci na úspěch
          </h3>
          <p className="text-sm text-indigo-700 dark:text-indigo-300">
            {match_percentage}% shoda se požadavky • Doporučené kurzy
          </p>
        </div>
      </div>

      {/* Skills Gap Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-indigo-100 dark:border-indigo-700 mb-6">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3">Chybějící dovednosti</h4>
        <div className="flex flex-wrap gap-2">
          {missing_skills.map((skill, index) => (
            <span
              key={index}
              className="px-3 py-1 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded-full text-sm font-medium"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Recommended Resources */}
      {recommended_resources.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Doporučené zdroje
          </h4>
          
          <div className="grid gap-4">
            {recommended_resources.map((resource) => (
              <div
                key={resource.id}
                className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-indigo-100 dark:border-indigo-700 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h5 className="font-semibold text-slate-900 dark:text-white mb-1">
                      {resource.title}
                    </h5>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 line-clamp-2">
                      {resource.description}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium">{resource.provider}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(resource.duration_hours)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award className="w-3 h-3" />
                        {resource.rating}/5 ({resource.reviews_count})
                      </span>
                    </div>
                  </div>
                  
                  <div className="ml-4 text-right">
                    <div className="text-lg font-bold text-slate-900 dark:text-white">
                      {formatPrice(resource.price, resource.currency)}
                    </div>
                    <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                      {resource.difficulty}
                    </div>
                  </div>
                </div>
                
                {/* Skill Tags */}
                <div className="flex flex-wrap gap-1 mt-3">
                  {resource.skill_tags.slice(0, 3).map((tag, index) => (
                    <span
                      key={index}
                      className="px-2 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {resource.skill_tags.length > 3 && (
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded text-xs">
                      +{resource.skill_tags.length - 3} více
                    </span>
                  )}
                </div>
                
                {/* Action Button */}
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => onResourceClick?.(resource)}
                    className="flex items-center gap-2 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Zobrazit kurz
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Learning Summary */}
      {recommended_resources.length > 0 && (
        <div className="mt-6 p-4 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg border border-indigo-200 dark:border-indigo-700">
          <h4 className="text-sm font-bold text-indigo-900 dark:text-indigo-100 mb-2">Souhrn učení</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-indigo-700 dark:text-indigo-300">Celková doba:</span>
              <div className="font-bold text-indigo-900 dark:text-indigo-100">
                {formatDuration(recommended_resources.reduce((sum, r) => sum + r.duration_hours, 0))}
              </div>
            </div>
            <div>
              <span className="text-indigo-700 dark:text-indigo-300">Celková cena:</span>
              <div className="font-bold text-indigo-900 dark:text-indigo-100">
                {formatPrice(
                  recommended_resources.reduce((sum, r) => sum + r.price, 0),
                  'Kč'
                )}
              </div>
            </div>
            <div>
              <span className="text-indigo-700 dark:text-indigo-300">Průměrné hodnocení:</span>
              <div className="font-bold text-indigo-900 dark:text-indigo-100">
                {(recommended_resources.reduce((sum, r) => sum + r.rating, 0) / recommended_resources.length).toFixed(1)}/5
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsGapBox;