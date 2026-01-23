import React, { useState } from 'react';
import { 
  ShoppingBag, 
  Users, 
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
}

interface MarketplacePageProps {
  theme?: 'light' | 'dark';
  userProfile: UserProfile;
}

const MarketplacePage: React.FC<MarketplacePageProps> = ({ 
  userProfile
}) => {
  const [viewMode, setViewMode] = useState<'browse' | 'commercial' | 'government'>('browse');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState('all');
  const [priceRange, setPriceRange] = useState<'free' | 'paid' | 'all'>('all');
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReviewCourse, setSelectedReviewCourse] = useState<Course | null>(null);

  // Sample marketplace data (in real app, this would come from API)
  const allCourses: Course[] = [
    // Government funded courses
    {
      id: 'gov-1',
      title: 'Elektrikář - Montážní elektrikářská činnost',
      description: 'Kurz pro získání osvědčení o odborné způsobilosti pro montážní elektrikářské činnosti. Vysoká poptávka na trhu práce.',
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
      title: 'Řidičský průkaz skupiny C+E',
      description: 'Profesionální řidičský průkaz pro nákladní dopravu. Rekvalifikační kurz s garancí umístění.',
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
      title: 'Java Backend Developer Certificate',
      description: 'Kompletní kurz vývoje backend aplikací v Jave s certifikací. Garance pracovního umístění.',
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
      title: 'Python pro datovou vědu',
      description: 'Moderní kurz Pythonu zaměřený na analýzu dat, strojové učení a AI. Ideální pro kariérní růst.',
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
  ];

  const categories = [
    { id: 'all', name: 'Všechny kategorie' },
    { id: 'driving', name: 'Řidičské průkazy' },
    { id: 'technical', name: 'Technické kurzy' },
    { id: 'it', name: 'IT a programování' },
    { id: 'business', name: 'Business a management' },
    { id: 'marketing', name: 'Marketing a sales' },
    { id: 'languages', name: 'Jazyky' }
  ];

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)} dní`;
  };

  const formatPrice = (price: number, currency: string) => {
    if (price === 0) return 'Zdarma';
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

  // Helper function to translate difficulty to Czech
  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'Beginner': return 'Začátečník';
      case 'Intermediate': return 'Mírně pokročilý';
      case 'Advanced': return 'Pokročilý';
      default: return difficulty;
    }
  };

  const filteredCourses = allCourses.filter(course => {
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
  });



  return (
    <div className="min-h-screen bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-cyan-200 dark:border-cyan-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl">
              <ShoppingBag className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-900 to-blue-900 bg-clip-text text-transparent">
                Kurzy a Rekvalifikace
              </h1>
              <p className="text-slate-600 dark:text-slate-300 text-lg mt-2">
                Investujte do své budoucnosti. Najděte si dokonalý kurz pro vaši kariéru.
              </p>
              <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-amber-500 rounded-full">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold text-amber-800 dark:text-amber-200">Demo data:</span>
                    <span className="text-amber-700 dark:text-amber-300 ml-1">Toto jsou ukázkové kurzy pro demonstraci. Reálné kurzy budou dostupné brzy.</span>
                  </div>
                </div>
              </div>
            </div>
            
            {userProfile.isLoggedIn && (
              <div className="text-right">
                <button 
                  onClick={() => setShowPartnerModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg hover:shadow-xl"
                >
                  <Plus className="w-4 h-4" />
                  Nabídnout kurz
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 p-1 bg-white/60 dark:bg-slate-800/60 backdrop-blur rounded-xl border border-cyan-100 dark:border-cyan-700 shadow-lg">
          <button
            onClick={() => setViewMode('browse')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              viewMode === 'browse'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                : 'text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/30'
            }`}
          >
            <Briefcase className="w-5 h-5" />
            <span className="text-lg font-semibold">Všechny kurzy</span>
          </button>
          <button
            onClick={() => setViewMode('government')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              viewMode === 'government'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                : 'text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
            }`}
          >
            <Building className="w-5 h-5" />
            <span className="text-lg font-semibold">Rekvalifikační kurzy</span>
          </button>
          <button
            onClick={() => setViewMode('commercial')}
            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
              viewMode === 'commercial'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md'
                : 'text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/30'
            }`}
          >
            <ShoppingBag className="w-5 h-5" />
            <span className="text-lg font-semibold">Komerční kurzy</span>
          </button>
        </div>
      </div>

      {/* Government Funding Highlight (only on browse view) */}
      {viewMode === 'browse' && (
        <div className="max-w-7xl mx-auto px-4 pb-6">
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-6 border border-emerald-200 dark:border-emerald-700">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mb-2">
                  Rekvalifikační kurzy od Úřadu práce
                </h3>
                <p className="text-emerald-700 dark:text-emerald-300 text-lg">
                  Jako nezaměstnaný můžete získat <span className="font-bold">až 50 000 Kč</span> na rekvalifikační kurz!
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div className="bg-white/80 dark:bg-emerald-900/20 backdrop-blur rounded-lg p-4">
                    <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">Technické profese</h4>
                    <p className="text-emerald-700 dark:text-emerald-300 text-sm">Elektrikář, Svářeč, Instalatér</p>
                  </div>
                  <div className="bg-white/80 dark:bg-emerald-900/20 backdrop-blur rounded-lg p-4">
                    <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">Technické kurzy</h4>
                    <p className="text-emerald-700 dark:text-emerald-300 text-sm">Svářečství, IT certifikace</p>
                  </div>
                  <div className="bg-white/80 dark:bg-emerald-900/20 backdrop-blur rounded-lg p-4">
                    <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">Jazykové kurzy</h4>
                    <p className="text-emerald-700 dark:text-emerald-300 text-sm">Angličtina, Němčina a další</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search */}
      <div className="max-w-7xl mx-auto px-4 pb-6">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-lg border border-cyan-100 dark:border-cyan-700">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Hledání</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Hledat kurzy..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-cyan-200 dark:border-cyan-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Kategorie</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-cyan-200 dark:border-cyan-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Obtížnost</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-cyan-200 dark:border-cyan-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="all">Všechny</option>
                <option value="Beginner">Začátečník</option>
                <option value="Intermediate">Mírně pokročilý</option>
                <option value="Advanced">Pokročilý</option>
              </select>
            </div>

            {/* Price Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cena</label>
              <select
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value as 'free' | 'paid' | 'all')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-purple-200 dark:border-purple-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">Všechny</option>
                <option value="free">Zdarma (rekvalifikační)</option>
                <option value="paid">Placené</option>
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
                className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-cyan-100 dark:border-cyan-700 hover:border-cyan-300 dark:hover:border-cyan-600 transition-all hover:shadow-xl group overflow-hidden min-h-[450px] flex flex-col"
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
                        <span className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          Hrazeno Úřadem práce
                        </span>
                      )}
                      {course.company_sponsored && (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-bold rounded-full">
                          Firemní sleva
                        </span>
                      )}
                      {userProfile.isLoggedIn && course.user_is_verified_graduate && (
                        <span className="px-2 py-1 bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold rounded-full flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3 h-3" />
                          Ověřený absolvent
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
                    {course.location && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded text-xs font-medium flex items-center gap-1">
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
                        className="px-2 py-1 bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                    {course.skill_tags.length > 3 && (
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 rounded text-xs">
                        +{course.skill_tags.length - 3} další
                      </span>
                    )}
                  </div>

                  {/* Spacer to push content down */}
                  <div className="flex-1"></div>
                </div>

                {/* Bottom Section - Separated into distinct areas */}
                <div className="border-t border-cyan-100 dark:border-cyan-700 bg-slate-50/50 dark:bg-slate-900/50">
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
                      {course.enrollment_count && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {course.enrollment_count > 999 ? '999+' : course.enrollment_count}
                        </span>
                      )}
                    </div>
                    {course.reviews_count > 0 && (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Star className="w-3 h-3" />
                        {course.reviews_count} recenzí
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
                          <div className="text-lg font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            ZDARMA
                          </div>
                        </>
                      ) : (
                        <div className="text-xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                          {formatPrice(course.price, course.currency)}
                        </div>
                      )}
                    </div>
                       
                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {course.reviews_count > 0 && (
                        <button
                          onClick={() => {
                            setSelectedReviewCourse(course);
                            setShowReviewModal(true);
                          }}
                          className="px-3 py-2 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-medium rounded-lg hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-all flex items-center gap-1 flex-shrink-0 border border-amber-200 dark:border-amber-700"
                        >
                          <Star className="w-3 h-3" />
                          Recenze
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          // Handle course enrollment/Detail view
                          if (userProfile.isLoggedIn) {
                            alert(`Registrace na kurz: ${course.title}`);
                          } else {
                            alert(`Pro registraci se nejprve přihlaste.`);
                          }
                        }}
                        className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white text-sm font-medium rounded-lg transition-all shadow-md hover:shadow-lg flex items-center gap-1.5 flex-shrink-0"
                      >
                        {userProfile.isLoggedIn ? 'Přihlásit se' : 'Detail'}
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
            <p className="text-slate-600 dark:text-slate-400 text-lg">Žádné kurzy nebyly nalezeny</p>
            <p className="text-slate-500 dark:text-slate-500 text-sm mt-2">Zkuste upravit filtry nebo hledaný výraz</p>
          </div>
        )}
      </div>
      
      {/* Partner Offer Modal */}
      <PartnerOfferModal 
        isOpen={showPartnerModal}
        onClose={() => setShowPartnerModal(false)}
      />
      
      {/* Course Review Modal */}
      {selectedReviewCourse && (
        <CourseReviewModal 
          isOpen={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedReviewCourse(null);
          }}
          course={selectedReviewCourse}
          isVerifiedGraduate={true} // This would come from career_tracks table
        />
      )}
    </div>
  );
};

export default MarketplacePage;