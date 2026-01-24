import React, { useState } from 'react';
import { BookOpen, Clock, Award, TrendingUp, ShoppingBag, Star, Users, Target, Sparkles, ChevronRight, Lock, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { LearningResource, SkillsGapAnalysis } from '../types';

interface SkillsGapBoxProps {
  skillsGapAnalysis: SkillsGapAnalysis | null;
  isLoading?: boolean;
  error?: string | null;
  theme?: 'light' | 'dark';
  onResourceClick?: (resource: LearningResource) => void;
  userProfile?: {
    isLoggedIn: boolean;
    hasCV: boolean;
    name?: string;
  };
}

interface MarketplaceCourse extends LearningResource {
  isPremium?: boolean;
  instructor?: string;
  certificate_type?: string;
  job_placement_assistance?: boolean;
  flexible_payment?: boolean;
  company_sponsored?: boolean;
  is_government_funded?: boolean;
  funding_amount_czk?: number;
  location?: string;
  partner_name?: string;
}

const SkillsGapBox: React.FC<SkillsGapBoxProps> = ({
  skillsGapAnalysis,
  isLoading = false,
  error = null,
  onResourceClick,
  userProfile = { isLoggedIn: false, hasCV: false }
}) => {
  const [selectedTab, setSelectedTab] = useState<'courses' | 'marketplace'>('courses');

  // Sample marketplace data (in real app, this would come from API)
  const marketplaceCourses: MarketplaceCourse[] = [
    {
      id: 'mkt-1',
      title: 'Řidičský průkaz skupiny B',
      description: 'Intenzivní kurz pro získání řidičského průkazu s teoretickou i praktickou výukou. Záruka úspěchu.',
      skill_tags: ['Řidičský průkaz', 'Mobilita'],
      url: '#',
      provider: 'Autoškola DrivePro',
      duration_hours: 40,
      difficulty: 'Beginner',
      price: 12000,
      currency: 'Kč',
      rating: 4.8,
      reviews_count: 234,
      created_at: new Date().toISOString(),
      isPremium: false,
      instructor: 'Ing. Novák',
      certificate_type: 'Oficiální ŘP',
      job_placement_assistance: true,
      flexible_payment: true
    },
    {
      id: 'mkt-gov-1',
      title: 'Řidičský průkaz skupiny C+E - Rekvalifikační kurz',
      description: 'Rekvalifikační kurz pro nezaměstnané financovaný Úřadem práce. Získáte skupinu C+E a zvýšíte si šance na trhu práce.',
      skill_tags: ['Řidičský průkaz', 'Nákladní doprava', 'Rekvalifikace'],
      url: '#',
      provider: 'Autoškola Centrum',
      duration_hours: 120,
      difficulty: 'Beginner',
      price: 45000,
      currency: 'Kč',
      rating: 4.7,
      reviews_count: 189,
      created_at: new Date().toISOString(),
      isPremium: false,
      instructor: 'Mgr. Dvořák',
      certificate_type: 'Oficiální ŘP C+E',
      job_placement_assistance: true,
      is_government_funded: true,
      funding_amount_czk: 50000,
      location: 'Praha',
      partner_name: 'Úřad práce - Rekvalifikační program'
    },
    {
      id: 'mkt-gov-2',
      title: 'Zváračské kurzy - Rekvalifikace AWS',
      description: 'Rekvalifikační zváračský kurz financovaný Úřadem práce. Pro nezaměstnané do 50 let s možností získání certifikace AWS.',
      skill_tags: ['Svařování', 'Průmyslové certifikace', 'AWS', 'Rekvalifikace'],
      url: '#',
      provider: 'Weld Academy CZ',
      duration_hours: 200,
      difficulty: 'Intermediate',
      price: 50000,
      currency: 'Kč',
      rating: 4.9,
      reviews_count: 267,
      created_at: new Date().toISOString(),
      isPremium: false,
      instructor: 'Ing. Svoboda',
      certificate_type: 'AWS Certificate + ŘP',
      job_placement_assistance: true,
      is_government_funded: true,
      funding_amount_czk: 50000,
      location: 'Brno',
      partner_name: 'Úřad práce - Dotační program'
    },
    {
      id: 'mkt-2',
      title: 'Zváračské kurzy - certifikace AWS',
      description: 'Kompletní příprava na certifikaci AWS Certified Welder. Moderní vybavení a zkušení instruktoři.',
      skill_tags: ['Svařování', 'Průmyslové certifikace', 'AWS'],
      url: '#',
      provider: 'Weld Academy CZ',
      duration_hours: 120,
      difficulty: 'Intermediate',
      price: 35000,
      currency: 'Kč',
      rating: 4.9,
      reviews_count: 189,
      created_at: new Date().toISOString(),
      isPremium: true,
      instructor: 'Mgr. Svoboda',
      certificate_type: 'AWS Certificate',
      job_placement_assistance: true,
      company_sponsored: true
    },
    {
      id: 'mkt-3',
      title: 'Java Backend Developer Certificate',
      description: 'Kompletní kurz vývoje backend aplikací v Jave s certifikací. Garance pracovního umístění.',
      skill_tags: ['Java', 'Backend', 'Spring Boot', 'Microservices'],
      url: '#',
      provider: 'IT Academy Prague',
      duration_hours: 200,
      difficulty: 'Advanced',
      price: 85000,
      currency: 'Kč',
      rating: 4.7,
      reviews_count: 412,
      created_at: new Date().toISOString(),
      isPremium: true,
      instructor: 'PhD. Dvořák',
      certificate_type: 'Professional Certificate',
      job_placement_assistance: true,
      flexible_payment: true,
      company_sponsored: true
    }
  ];

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-500"></div>
        </div>
      </div>
    );
  }

  // Show placeholder for non-logged in users
  if (!userProfile.isLoggedIn) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="text-center space-y-6">
          {/* Header */}
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-gradient-to-br slate-100 dark:bg-slate-800 rounded-xl">
              <Sparkles className="w-8 h-8 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                Přestaňte jen snít o lepší práci
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Získejte konkurenční výhodu s kurzy šitými na míru
              </p>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <Target className="w-6 h-6 text-slate-600 dark:text-slate-400 mb-2" />
              <h4 className="font-semibold text-slate-900 dark:text-slate-600 dark:text-slate-400 mb-1">Cílený rozvoj</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">Kurzy na míru podle vašeho CV a požadavků trhu</p>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <TrendingUp className="w-6 h-6 text-slate-600 dark:text-slate-400 mb-2" />
              <h4 className="font-semibold text-slate-900 dark:text-slate-600 dark:text-slate-400 mb-1">Kariérní růst</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">Zvyšte si mzdu až o 40% novými dovednostmi</p>
            </div>
            <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-700">
              <Users className="w-6 h-6 text-slate-600 dark:text-slate-400 mb-2" />
              <h4 className="font-semibold text-slate-900 dark:text-slate-600 dark:text-slate-400 mb-1">Ověřeno zaměstnavateli</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300">Certifikace, které skutečně hledají</p>
            </div>
          </div>

      {/* Government Funding Info */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl p-6 text-slate-600 dark:text-slate-400">
        <h4 className="text-lg font-bold mb-2 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          Rekvalifikační kurzy od Úřadu práce
        </h4>
        <p className="text-sm opacity-90 mb-4">
          Jako nezaměstnaný můžete získat <span className="font-bold">až 50 000 Kč</span> na rekvalifikační kurz! 
          Řidičské průkazy, svářečské certifikace, a další kurzy mohou být hrazeny státem.
        </p>
        <div className="bg-white/20 backdrop-blur rounded-lg p-4 space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-200" />
            <span className="text-sm font-medium">Řidičské průkazy (B, C, C+E)</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-200" />
            <span className="text-sm font-medium">Svářečské a průmyslové certifikace</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-200" />
            <span className="text-sm font-medium">IT kurzy a jazykové vzdělání</span>
          </div>
        </div>
        <div className="mt-4 text-center">
          <span className="text-xs opacity-75">Pro výběr rekvalifikačního kurzu se přihlaste na Úřadu práce</span>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-gradient-to-r slate-600 rounded-xl p-6 text-slate-600 dark:text-slate-400">
        <h4 className="text-lg font-bold mb-2">Přihlaste se a vyplňte své CV</h4>
        <p className="text-sm opacity-90 mb-4">
          Získáte personalizovanou analýzu dovednostních mezer a doporučení na kurzy, 
          které vám pomohou získat vysněnou práci.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Lock className="w-4 h-4" />
          <span className="text-sm font-medium">Po přihlášení se odemkne pokročilá analýza</span>
        </div>
      </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">Došlo k chybě při načítání analýzy dovedností</span>
        </div>
      </div>
    );
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
      case 'Beginner': return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
      case 'Intermediate': return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
      case 'Advanced': return 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30';
      default: return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30';
    }
  };

  // Handle logged in users without CV or skills analysis
  if (userProfile.isLoggedIn && (!userProfile.hasCV || !skillsGapAnalysis)) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 bg-gradient-to-br slate-100 dark:bg-slate-800 rounded-xl">
              <Sparkles className="w-8 h-8 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-left">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {!userProfile.hasCV ? "Doplňte své CV" : "Probíhá analýza"}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {!userProfile.hasCV 
                  ? "Pro získání personalizovaných doporučení kurzy vyplňte své CV"
                  : "Analyzujeme vaše dovednosti a připravujeme doporučení"
                }
              </p>
            </div>
          </div>
          
          {/* Demo Warning */}
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="p-1 bg-amber-500 rounded-full">
                <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-sm">
                <span className="font-semibold text-amber-800 dark:text-amber-200">Demo data:</span>
                <span className="text-amber-700 dark:text-amber-300 ml-1">Kurzy jsou pro demonstrační účely.</span>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <button
              onClick={() => {
                // This would navigate to profile/CV editor
                alert("Přesměrování na editor CV...");
              }}
              className="px-6 py-3 bg-gradient-to-r slate-600 hover:slate-700 text-slate-600 dark:text-slate-400 font-medium rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              {!userProfile.hasCV ? "Doplňit CV" : "Zobrazit marketplace"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { recommended_resources = [], match_percentage = 0, missing_skills = [] } = skillsGapAnalysis || {};

  return (
      <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
      
      {/* Header with Tabs */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-gradient-to-br slate-100 dark:bg-slate-800 rounded-lg">
            <TrendingUp className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">
              Investujte do své kariéry
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {match_percentage}% shoda • Zvyšte si konkurenceschopnost
            </p>
          </div>
        </div>

        {/* Demo Warning */}
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="p-1 bg-amber-500 rounded-full">
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-semibold text-amber-800 dark:text-amber-200">Demo data:</span>
              <span className="text-amber-700 dark:text-amber-300 ml-1">Doporučené kurzy jsou pro demonstrační účely.</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setSelectedTab('courses')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              selectedTab === 'courses'
                ? 'bg-gradient-to-r slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/30'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Doporučené kurzy
          </button>
          <button
            onClick={() => setSelectedTab('marketplace')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              selectedTab === 'marketplace'
                ? 'bg-gradient-to-r slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 shadow-md'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900/30'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            Marketplace
          </button>
        </div>
      </div>

      {/* Skills Gap Overview */}
      <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-700 mb-6">
        <h4 className="text-sm font-bold text-slate-900 dark:text-slate-600 dark:text-slate-400 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          Chybějící dovednosti ({missing_skills.length})
        </h4>
        <div className="flex flex-wrap gap-2">
          {missing_skills.map((skill: string, index: number) => (
            <span
              key={index}
              className="px-3 py-1 bg-gradient-to-r from-rose-100 to-pink-100 text-rose-700 dark:from-rose-900/30 dark:to-pink-900/30 dark:text-rose-400 rounded-full text-sm font-medium border border-rose-200 dark:border-rose-700"
            >
              {skill}
            </span>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {selectedTab === 'courses' && recommended_resources.length > 0 && (
          <>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                Kurzy pro váš růst
              </h4>
            
            <div className="grid gap-4">
              {recommended_resources.map((resource: LearningResource) => (
                <div
                  key={resource.id}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-900 dark:text-slate-600 dark:text-slate-400 mb-1">
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
                      <div className="text-lg font-bold text-slate-600 dark:text-slate-400">
                        {formatPrice(resource.price, resource.currency)}
                      </div>
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getDifficultyColor(resource.difficulty)}`}>
                        {resource.difficulty}
                      </div>
                    </div>
                  </div>
                  
                  {/* Skill Tags */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {resource.skill_tags.slice(0, 3).map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 rounded text-xs"
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
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r slate-600 hover:slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                    >
                      Zobrazit kurz
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {selectedTab === 'marketplace' && (
          <>
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                Kurzy od prověřených poskytovatelů
              </h4>
            
            <div className="grid gap-4">
              {marketplaceCourses.map((course) => (
                <div
                  key={course.id}
                  className="bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-lg p-4 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    {/* Course Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h5 className="font-semibold text-slate-900 dark:text-slate-600 dark:text-slate-400">
                          {course.title}
                        </h5>
                        {course.isPremium && (
                          <span className="px-2 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full">
                            PREMIUM
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-300 mb-3 line-clamp-2">
                        {course.description}
                      </p>
                      
                      {/* Course Features */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {course.is_government_funded && (
                        <span className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-600 dark:text-slate-400 text-xs font-bold rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          Hrazeno Úřadem práce
                          {course.funding_amount_czk && (
                            <span className="bg-white/20 px-1 rounded text-xs">
                              -{course.funding_amount_czk.toLocaleString('cs-CZ')} Kč
                            </span>
                          )}
                        </span>
                      )}
                      {course.job_placement_assistance && (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 rounded text-xs font-medium flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Záruka umístění
                        </span>
                      )}
                      {course.flexible_payment && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-xs font-medium">
                          Flexibilní platba
                        </span>
                      )}
                      {course.company_sponsored && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 rounded text-xs font-medium">
                            Firemní sponsoring
                          </span>
                      )}
                    </div>
                      
                      <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-medium">{course.provider}</span>
                        {course.instructor && <span>Lektor: {course.instructor}</span>}
                        {course.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {course.location}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDuration(course.duration_hours)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          {course.rating}/5 ({course.reviews_count} hodnocení)
                        </span>
                        {course.certificate_type && (
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded text-xs">
                            {course.certificate_type}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Price Section */}
                    <div className="text-right">
                      <div className="flex flex-col items-end">
                        {course.is_government_funded ? (
                          <>
                            <div className="text-xs text-slate-500 line-through">
                              {formatPrice(course.price, course.currency)}
                            </div>
                            <div className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-1">
                              <span>ZDARMA</span>
                              <span className="text-xs bg-white/20 px-1 rounded">
                                Úřad práce hradí
                              </span>
                            </div>
                          </>
                        ) : (
                            <div className="text-2xl font-bold bg-gradient-to-r slate-600 bg-clip-text text-transparent">
                              {formatPrice(course.price, course.currency)}
                            </div>
                        )}
                      </div>
                      <div className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${getDifficultyColor(course.difficulty)}`}>
                        {course.difficulty}
                      </div>
                    </div>
                  </div>
                  
                  {/* Skill Tags */}
                  <div className="flex flex-wrap gap-1 mt-3">
                    {course.skill_tags.map((tag: string, index: number) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  {/* Action Button */}
                  <div className="mt-4 flex justify-between items-center">
                    <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                      Provozovatel kurzu • {course.provider}
                    </div>
                    <button
                      onClick={() => onResourceClick?.(course)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r slate-600 hover:slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg"
                    >
                      Detail kurzu
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Learning Summary */}
      {(selectedTab === 'courses' && recommended_resources.length > 0) && (
        <div className="mt-6 p-4 bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 rounded-lg border border-slate-200 dark:border-slate-700">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Investice do vaší budoucnosti
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-600 dark:text-slate-300">Celková doba:</span>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {formatDuration(recommended_resources.reduce((sum: number, r: LearningResource) => sum + r.duration_hours, 0))}
              </div>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-300">Celková cena:</span>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                {formatPrice(
                  recommended_resources.reduce((sum: number, r: LearningResource) => sum + r.price, 0),
                  'Kč'
                )}
              </div>
            </div>
            <div>
              <span className="text-slate-600 dark:text-slate-300">Potenciál růstu:</span>
              <div className="font-bold text-slate-900 dark:text-slate-100">
                +{Math.round(100 - match_percentage)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SkillsGapBox;