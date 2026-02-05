import React, { useState, useEffect, useMemo } from 'react';
import {
  ShoppingBag,
  Star,
  Clock,
  Target,
  Plus,
  Search,
  ChevronRight,
  MapPin,
  Briefcase,
  Building,
  CheckCircle
} from 'lucide-react';
import { UserProfile } from '../types';
import PartnerOfferModal from './PartnerOfferModal';
import CourseReviewModal from './CourseReviewModal';
import ReviewDisplay from './ReviewDisplay';
import { useTranslation } from 'react-i18next';
import { getCourseReviewStats, getCourseReviews, voteCourseReview } from '../services/supabaseService';

interface Course {
  id: string;
  title: string;
  description: string;
  provider: string;
  instructor?: string;
  duration_hours: number;
  price: number;
  currency: string;
  rating: number;
  reviews_count: number;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  skill_tags: string[];
  certificate_type?: string;
  job_placement_assistance?: boolean;
  flexible_payment?: boolean;
  company_sponsored?: boolean;
  enrollment_count?: number;
  completion_rate?: number;
  created_at: string;
  status?: 'active' | 'draft' | 'archived';
  is_government_funded?: boolean;
  funding_amount_czk?: number;
  location?: string;
  lat?: number;
  lng?: number;
  partner_id?: string;
  partner_name?: string;
  user_is_verified_graduate?: boolean;
  is_premium_partner?: boolean;
}

interface MarketplacePageProps {
  theme?: 'light' | 'dark';
  userProfile: UserProfile;
}

const MarketplacePage: React.FC<MarketplacePageProps> = ({
  userProfile
}) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'browse' | 'commercial' | 'government'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [priceRange, setPriceRange] = useState<'free' | 'paid' | 'all'>('all');
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewCourse, setSelectedReviewCourse] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseReviews, setCourseReviews] = useState<any[]>([]);
  const [courseReviewsLoading, setCourseReviewsLoading] = useState(false);
  const [courseReviewAvg, setCourseReviewAvg] = useState(0);
  const [courseReviewCount, setCourseReviewCount] = useState(0);
  const [showCourseReviewForm, setShowCourseReviewForm] = useState(false);

  // Sample marketplace data (in real app, this would come from API)
  const allCourses: Course[] = useMemo(() => [
    // Government funded courses
    {
      id: 'gov-1',
      title: t('marketplace_extra.courses.gov_1.title'),
      description: t('marketplace_extra.courses.gov_1.desc'),
      skill_tags: ['Elektroinstalace', 'Montáže', 'Revize', 'Bezpečnost práce'],
      provider: 'ELEKTRO Institut Praha',
      instructor: 'Ing. Horák',
      duration_hours: 160,
      difficulty: 'Intermediate',
      price: 45000,
      currency: 'Kč',
      rating: 4.7,
      reviews_count: 186,
      created_at: new Date().toISOString(),
      is_government_funded: true,
      funding_amount_czk: 50000,
      location: 'Praha',
      partner_name: 'Úřad práce - Rekvalifikační program'
    },
    {
      id: 'gov-2',
      title: t('marketplace_extra.courses.gov_2.title'),
      description: t('marketplace_extra.courses.gov_2.desc'),
      skill_tags: ['Řidičský průkaz', 'Nákladní doprava', 'C+E'],
      provider: 'Autoškola Profesional',
      instructor: 'Mgr. Dvořák',
      duration_hours: 120,
      difficulty: 'Intermediate',
      price: 50000,
      currency: 'Kč',
      rating: 4.9,
      reviews_count: 189,
      created_at: new Date().toISOString(),
      is_government_funded: true,
      funding_amount_czk: 50000,
      location: 'Brno',
      partner_name: 'Úřad práce - Rekvalifikační program'
    },
    {
      id: 'gov-3',
      title: 'Zváračské kurzy - AWS Certificate',
      description: 'Kompletní příprava na certifikaci AWS Certified Welder. Moderní vybavení a zkušení instruktoři.',
      skill_tags: ['Svařování', 'Průmyslové certifikace', 'AWS', 'Metalurgie'],
      provider: 'Weld Academy CZ',
      instructor: 'Ing. Svoboda',
      duration_hours: 200,
      difficulty: 'Advanced',
      price: 45000,
      currency: 'Kč',
      rating: 4.7,
      reviews_count: 412,
      created_at: new Date().toISOString(),
      is_government_funded: true,
      funding_amount_czk: 50000,
      location: 'Ostrava',
      partner_name: 'Úřad práce - Dotační program'
    },
    // Commercial courses
    {
      id: 'com-1',
      title: t('marketplace_extra.courses.com_1.title'),
      description: t('marketplace_extra.courses.com_1.desc'),
      skill_tags: ['Java', 'Backend', 'Spring Boot', 'Microservices', 'Programming'],
      provider: 'IT Academy Prague',
      instructor: 'PhD. Dvořák',
      duration_hours: 200,
      difficulty: 'Advanced',
      price: 85000,
      currency: 'Kč',
      rating: 4.7,
      reviews_count: 267,
      created_at: new Date().toISOString(),
      job_placement_assistance: true,
      flexible_payment: true,
      enrollment_count: 680,
      completion_rate: 85
    },
    {
      id: 'com-2',
      title: t('marketplace_extra.courses.com_2.title'),
      description: t('marketplace_extra.courses.com_2.desc'),
      skill_tags: ['Python', 'Data Science', 'Machine Learning', 'AI', 'Analytics'],
      provider: 'DataScience Academy',
      instructor: 'Dr. Černý',
      duration_hours: 160,
      difficulty: 'Intermediate',
      price: 75000,
      currency: 'Kč',
      rating: 4.9,
      reviews_count: 342,
      created_at: new Date().toISOString(),
      job_placement_assistance: true,
      flexible_payment: true,
      enrollment_count: 890,
      completion_rate: 92,
      user_is_verified_graduate: true
    },
    {
      id: 'com-3',
      title: 'Digitální marketing & E-commerce',
      description: 'Komplexní kurz digitálního marketingu s zaměřením na e-commerce, sociální sítě a SEO. Praktické projekty.',
      skill_tags: ['Marketing', 'SEO', 'Sociální sítě', 'E-commerce', 'Analytics'],
      provider: 'Marketing Institute',
      instructor: 'Ing. Procházka',
      duration_hours: 120,
      difficulty: 'Intermediate',
      price: 55000,
      currency: 'Kč',
      rating: 4.6,
      reviews_count: 178,
      created_at: new Date().toISOString(),
      job_placement_assistance: true,
      enrollment_count: 456,
      completion_rate: 88
    },
    {
      id: 'com-4',
      title: 'Projektové řízení - Professional',
      description: 'Profesionální kurz projektového řízení s mezinárodní certifikací PMP a Agilními metodikami.',
      skill_tags: ['Projektové řízení', 'Agile', 'Scrum', 'PMP', 'Management'],
      provider: 'PM Academy',
      instructor: 'Mgr. Kaláb',
      duration_hours: 80,
      difficulty: 'Advanced',
      price: 65000,
      currency: 'Kč',
      rating: 4.8,
      reviews_count: 289,
      created_at: new Date().toISOString(),
      job_placement_assistance: true,
      flexible_payment: true,
      company_sponsored: true,
      enrollment_count: 340,
      completion_rate: 91,
      user_is_verified_graduate: true
    }
  ], [t]);

  useEffect(() => {
    setCourses(allCourses);
  }, [allCourses]);

  useEffect(() => {
    const loadStats = async () => {
      const courseIds = allCourses.map((c) => c.id);
      const stats = await getCourseReviewStats(courseIds);
      const statsMap = (stats || []).reduce((acc: any, s: any) => {
        acc[s.course_id] = { avg_rating: s.avg_rating, reviews_count: s.reviews_count };
        return acc;
      }, {});
      setCourses(allCourses.map((course) => ({
        ...course,
        rating: statsMap[course.id]?.avg_rating ?? course.rating,
        reviews_count: statsMap[course.id]?.reviews_count ?? course.reviews_count
      })));
    };
    loadStats();
  }, [allCourses]);

  const categories = [
    { id: 'all', name: t('marketplace.categories.all') },
    { id: 'driving', name: t('marketplace.categories.driving') },
    { id: 'technical', name: t('marketplace.categories.technical') },
    { id: 'it', name: t('marketplace.categories.it') },
    { id: 'business', name: t('marketplace.categories.business') },
    { id: 'marketing', name: t('marketplace.categories.marketing') },
    { id: 'languages', name: t('marketplace.categories.languages') }
  ];

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)} ${t('marketplace.days')}`;
  };

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return t('marketplace.free');
    return `${price.toLocaleString()} ${currency}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-900/30';
      case 'Intermediate': return 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-900/30';
      case 'Advanced': return 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-900/30';
      default: return 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-900/30';
    }
  };

  // Helper function to translate difficulty to Czech
  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return t('marketplace.beginner');
      case 'Intermediate': return t('marketplace.intermediate');
      case 'Advanced': return t('marketplace.advanced');
      default: return difficulty;
    }
  };

  const filteredCourses = courses
    .filter(course => {
      const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.skill_tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'all' || course.skill_tags.some(tag =>
        categories.find(cat => cat.id === selectedCategory)?.name.toLowerCase().includes(tag.toLowerCase())
      );

      const matchesDifficulty = selectedDifficulty === 'all' || course.difficulty === selectedDifficulty;

      // Apply view mode filtering
      const matchesViewMode =
        viewMode === 'browse' ? true :
          viewMode === 'government' ? course.is_government_funded :
            viewMode === 'commercial' ? !course.is_government_funded : false;

      const matchesPrice = priceRange === 'all' ||
        (priceRange === 'free' && course.is_government_funded) ||
        (priceRange === 'paid' && !course.is_government_funded);

      return matchesSearch && matchesCategory && matchesDifficulty && matchesPrice && matchesViewMode;
    })
    .sort((a, b) => {
      const aPremium = (a.is_premium_partner || a.company_sponsored || !!a.partner_id || !!a.partner_name) ? 1 : 0;
      const bPremium = (b.is_premium_partner || b.company_sponsored || !!b.partner_id || !!b.partner_name) ? 1 : 0;
      if (aPremium !== bPremium) return bPremium - aPremium;
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return (b.reviews_count || 0) - (a.reviews_count || 0);
    });

  const openCourseReviews = async (course: Course) => {
    setSelectedReviewCourse(course);
    setShowReviewModal(true);
    setShowCourseReviewForm(false);
    setCourseReviews([]);
    setCourseReviewsLoading(true);
    try {
      const reviews = await getCourseReviews(course.id);
      setCourseReviews(reviews || []);
      const total = (reviews || []).length;
      const avg = total > 0 ? (reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / total) : 0;
      setCourseReviewAvg(avg);
      setCourseReviewCount(total);
    } finally {
      setCourseReviewsLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <div className="p-3 bg-cyan-50 dark:bg-slate-800 rounded-xl flex-shrink-0 border border-cyan-100 dark:border-slate-700">
                <ShoppingBag className="w-8 h-8 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                  {t('marketplace.title')}
                </h1>
                <p className="text-slate-600 dark:text-slate-300 text-lg mt-2">
                  {t('marketplace.subtitle')}
                </p>
                <div className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-sm text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{t('marketplace.demo_label')}</span>
                  <span className="opacity-90">{t('marketplace.demo_data')}</span>
                </div>
              </div>
            </div>

            <div className="flex-shrink-0">
              {userProfile.isLoggedIn ? (
                <button
                  onClick={() => setShowPartnerModal(true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  {t('marketplace.offer_course')}
                </button>
              ) : (
                <div className="w-full h-10"></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 p-1 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <button
            onClick={() => setViewMode('browse')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'browse'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-lg font-semibold">{t('marketplace.all_courses')}</span>
          </button>
          <button
            onClick={() => setViewMode('government')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'government'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
          >
            <Building className="w-5 h-5" />
            <span className="text-lg font-semibold">{t('marketplace.retraining_courses')}</span>
          </button>
          <button
            onClick={() => setViewMode('commercial')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'commercial'
              ? 'bg-cyan-600 text-white shadow-md'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50'
              }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-lg font-semibold">{t('marketplace.commercial_courses')}</span>
          </button>
        </div>
      </div>

      {/* Government Funding Highlight (only on browse view) */}
      {viewMode === 'browse' && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="rounded-xl p-6 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-cyan-50 dark:bg-slate-700/40 rounded-lg border border-cyan-100 dark:border-slate-700">
                <CheckCircle className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                  {t('marketplace.funding_title')}
                </h3>
                <p className="text-slate-600 dark:text-slate-300">
                  {t('marketplace.funding_desc')}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('marketplace_extra.funding_categories.technical_professions')}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('marketplace_extra.funding_categories.technical_courses')}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300">
                    {t('marketplace_extra.funding_categories.language_courses')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-slate-200 dark:border-slate-700">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('marketplace.search_placeholder').split('...')[0]}</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder={t('marketplace.search_placeholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('marketplace.category')}</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('marketplace.difficulty')}</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">{t('marketplace.all_diffs')}</option>
                <option value="Beginner">{t('marketplace.beginner')}</option>
                <option value="Intermediate">{t('marketplace.intermediate')}</option>
                <option value="Advanced">{t('marketplace.advanced')}</option>
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">{t('marketplace.price')}</label>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value as 'free' | 'paid' | 'all')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">{t('marketplace.all_courses')}</option>
                <option value="free">{t('marketplace.free_retraining')}</option>
                <option value="paid">{t('marketplace.commercial_courses')}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        {filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all hover:shadow-xl group overflow-hidden min-h-[450px] flex flex-col"
              >
                {/* Course Header */}
                <div className="p-6 flex-1 flex flex-col">
                  {/* Provider Section - More Prominent */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <Building className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                      <span className="font-semibold text-cyan-900 dark:text-cyan-100 text-sm">{course.provider}</span>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(course.difficulty)}`}>
                      {getDifficultyText(course.difficulty)}
                    </div>
                  </div>

                  {/* Title and Badges */}
                  <div className="mb-4">
                    <div className="flex items-start gap-2 mb-3">
                      <h4 className="text-lg font-bold text-slate-900 dark:text-white flex-1 min-w-0 leading-tight">
                        {course.title}
                      </h4>
                    </div>

                    {/* Funding Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {course.is_government_funded && (
                        <span className="px-2 py-1 bg-cyan-600 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          {t('marketplace.retraining_courses')}
                        </span>
                      )}
                      {course.company_sponsored && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold rounded-full">
                          {t('marketplace.sponsored_discount')}
                        </span>
                      )}
                      {userProfile.isLoggedIn && course.user_is_verified_graduate && (
                        <span className="px-2 py-1 bg-cyan-600 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          {t('marketplace.verified_graduate')}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-slate-600 dark:text-slate-300 text-sm mb-4 line-clamp-2 leading-relaxed flex-shrink-0">
                    {course.description}
                  </p>

                  {/* Course Features */}
                  <div className="flex flex-wrap gap-1.5 mb-4 flex-shrink-0">
                    {course.job_placement_assistance && (
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded text-xs font-medium flex items-center gap-1">
                        <Target className="w-3 h-3" />
                        {t('marketplace.placement_guarantee')}
                      </span>
                    )}
                    {course.flexible_payment && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300 rounded text-xs font-medium">
                        {t('marketplace.flexible_payment')}
                      </span>
                    )}
                    {course.location && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 rounded text-xs font-medium flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-24">{course.location}</span>
                      </span>
                    )}
                  </div>

                  {/* Skill Tags */}
                  <div className="flex flex-wrap gap-1 mb-4 flex-shrink-0">
                    {course.skill_tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-cyan-100 text-slate-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {course.skill_tags.length > 3 && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded text-xs">
                        {t('marketplace.more_tags', { count: course.skill_tags.length - 3 })}
                      </span>
                    )}
                  </div>

                  {/* Spacer to push content down */}
                  <div className="flex-1"></div>
                </div>

                {/* Bottom Section - Separated into distinct areas */}
                <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                  {/* Stats Row */}
                  <div className="px-6 py-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(course.duration_hours)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 text-amber-500" />
                        {course.rating}/5
                      </span>
                    </div>
                    {course.reviews_count > 0 && (
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        {course.reviews_count} {t('marketplace.reviews')}
                      </span>
                    )}
                  </div>

                  {/* Price and Action Row */}
                  <div className="px-6 py-4 flex items-center justify-between gap-3">
                    {/* Price Section */}
                    <div className="flex flex-col">
                      {course.is_government_funded ? (
                        <>
                          <div className="text-xs text-slate-500 line-through">
                            {formatPrice(course.price, course.currency)}
                          </div>
                          <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                            {t('marketplace.free').toUpperCase()}
                          </div>
                        </>
                      ) : (
                        <div className="text-xl font-bold text-cyan-600 dark:text-cyan-400">
                          {formatPrice(course.price, course.currency)}
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {(course.reviews_count > 0 || userProfile.isLoggedIn) && (
                        <button
                          onClick={() => openCourseReviews(course)}
                          className="px-3 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-all flex items-center gap-1 flex-shrink-0 border border-slate-200 dark:border-slate-600"
                        >
                          <Star className="w-3 h-3" />
                          {t('marketplace.reviews_btn')}
                        </button>
                      )}

                      <button
                        onClick={() => {
                          // Handle course enrollment/Detail view
                          if (userProfile.isLoggedIn) {
                            alert(t('marketplace.enroll_alert', { title: course.title }));
                          } else {
                            alert(t('marketplace.login_to_enroll_alert'));
                          }
                        }}
                        className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 flex-shrink-0"
                      >
                        {userProfile.isLoggedIn ? t('marketplace.enroll') : t('marketplace.detail')}
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-600 dark:text-slate-400 text-lg">{t('marketplace.no_courses')}</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">{t('app.try_adjust_filters')}</p>
          </div>
        )}
      </div>

      {/* Partner Offer Modal */}
      <PartnerOfferModal
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
      />

      {/* Course Reviews Modal */}
      {showReviewModal && selectedReviewCourse && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => {
            setShowReviewModal(false);
            setShowCourseReviewForm(false);
            setSelectedReviewCourse(null);
          }}></div>
          <div className="relative w-full max-w-4xl z-10">
            {courseReviewsLoading ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-10 text-center text-slate-500">
                {t('app.loading')}
              </div>
            ) : (
              <ReviewDisplay
                reviews={courseReviews}
                resourceTitle={selectedReviewCourse.title}
                averageRating={courseReviewAvg || selectedReviewCourse.rating || 0}
                totalReviews={courseReviewCount || selectedReviewCourse.reviews_count || 0}
                canVote={userProfile.isLoggedIn}
                onVote={async (reviewId, isHelpful) => {
                  if (!userProfile.id) return;
                  await voteCourseReview({ review_id: reviewId, voter_id: userProfile.id, is_helpful: isHelpful });
                  if (selectedReviewCourse) {
                    await openCourseReviews(selectedReviewCourse);
                  }
                }}
              />
            )}
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setShowCourseReviewForm(false);
                  setSelectedReviewCourse(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
              >
                {t('app.close') || 'Zavřít'}
              </button>
              {userProfile.isLoggedIn && (
                <button
                  onClick={() => setShowCourseReviewForm(true)}
                  className="px-4 py-2 rounded-lg bg-cyan-600 text-white text-sm font-semibold"
                >
                  {t('marketplace.reviews_add') || 'Napsat recenzi'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Course Review Modal */}
      {selectedReviewCourse && (
        <CourseReviewModal
          isOpen={showCourseReviewForm}
          onClose={() => {
            setShowCourseReviewForm(false);
          }}
          course={selectedReviewCourse}
          isVerifiedGraduate={true} // This would come from career_tracks table
          reviewerId={userProfile.id}
          onSubmitted={async () => {
            if (!selectedReviewCourse) return;
            await openCourseReviews(selectedReviewCourse);
          }}
        />
      )}
    </div>
  );
};

export default MarketplacePage;
