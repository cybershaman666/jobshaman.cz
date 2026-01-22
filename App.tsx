import React, { useState, useEffect } from 'react';
import { Job, ViewState, UserProfile, CompanyProfile } from './types';
import JobCard from './components/JobCard';
import ApplicationModal from './components/ApplicationModal';
import { fetchRealJobs } from './services/jobService';
import { supabase, signOut, getUserProfile } from './services/supabaseService';
import { 
  Search, 
  Filter, 
  UserCircle,
  LogOut,
  Moon,
  Sun
} from 'lucide-react';

// --- DEFAULTS ---
const DEFAULT_USER_PROFILE: UserProfile = {
  isLoggedIn: false,
  full_name: '',
  avatar_url: '',
  role: 'candidate'
};

// --- APP ---
const App: React.FC = () => {
  // --- STATE ---
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [jobs, setJobs] = useState<Job[]>([]); 
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>(ViewState.LIST);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  
  // Auth & Onboarding State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // USER PROFILE STATE
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_USER_PROFILE);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // --- EFFECTS ---

  const handleSessionRestoration = async (userId: string) => {
      try {
          const profile = await getUserProfile(userId);
          if (profile) {
              setUserProfile(prev => ({
                  ...prev,
                  ...profile,
                  isLoggedIn: true
              }));
          }
      } catch (error) {
          console.error("Session restoration failed:", error);
      }
  };

  const loadRealJobs = async () => {
      setIsLoadingJobs(true);
      try {
          console.log("Fetching jobs...");
          const realJobs = await fetchRealJobs();
          console.log(`Fetched ${realJobs.length} jobs.`);
          setJobs(realJobs);
      } catch (e) {
          console.error("Failed to load jobs", e);
      } finally {
          setIsLoadingJobs(false);
      }
  };

  useEffect(() => {
    // Initial Theme Setup
    let initialTheme = 'light';
    try {
        if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            initialTheme = 'dark';
        }
    } catch (e) {}

    if (initialTheme === 'dark') {
      setTheme('dark');
      document.documentElement.classList.add('dark');
    } else {
      setTheme('light');
      document.documentElement.classList.remove('dark');
    }
    
    // Session restoration logic with userId from localStorage
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
        handleSessionRestoration(storedUserId);
    } else {
        loadRealJobs();
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    
    localStorage.theme = newTheme;
  };

  const handleSignOut = async () => {
    await signOut();
    setUserProfile(DEFAULT_USER_PROFILE);
    setJobs([]);
    setViewState(ViewState.LIST);
    localStorage.removeItem('userId');
  };

  // --- RENDERERS ---

  const renderJobSearch = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {jobs.length === 0 && !isLoadingJobs ? (
        <div className="md:col-span-2 lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Nepodařilo se načíst nabídky práce</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Zkuste obnovit stránku nebo kontaktujte podporu.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-slate-900 dark:bg-slate-800 text-white px-6 py-2 rounded-lg font-medium hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
            >
              Obnovit stránku
            </button>
          </div>
        </div>
      ) : (
        jobs.map(job => (
          <JobCard 
            key={job.id}
            job={job} 
            userProfile={userProfile}
            onClick={() => setSelectedJobId(job.id)}
          />
        ))
      )}
    </div>
  );

  const renderJobDetail = () => {
    if (!selectedJob) {
      return (
        <div className="md:col-span-2 lg:col-span-3 bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700 text-center">
          <div className="mb-4">
            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Vyberte si nabídku práce</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              Klikněte na jakoukoliv nabídku pro zobrazení detailů.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="md:col-span-2 lg:col-span-3">
        <JobCard 
          job={selectedJob} 
          userProfile={userProfile}
          isExpanded={true}
        />
        {userProfile.isLoggedIn && (
          <ApplicationModal 
            isOpen={false}
            onClose={() => {}}
            job={selectedJob}
            userProfile={userProfile}
            aiAnalysis={null}
          />
        )}
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                    JobShaman
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Chytré nabídky práce
                  </p>
                </div>
              </div>

              {/* View Toggle Button */}
              <button 
                onClick={() => setViewState(viewState === ViewState.LIST ? ViewState.DETAIL : ViewState.LIST)}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Filter className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                {viewState === ViewState.LIST ? 'Detail' : 'Seznam'}
              </button>
                
              {userProfile.isLoggedIn && (
                <button 
                  onClick={() => setViewState(ViewState.PROFILE_EDITOR)}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <UserCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-4">
              {/* Theme Toggle */}
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5 text-slate-600 dark:text-slate-400" /> : <Moon className="w-5 h-5 text-slate-600 dark:text-slate-400" />}
              </button>

              {/* Auth/Profile */}
              {userProfile.isLoggedIn ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Vítejte, {userProfile.full_name}
                  </span>
                  <button 
                    onClick={handleSignOut}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
                >
                  <UserCircle className="w-5 h-5" />
                  <span>Přihlásit se</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoadingJobs ? (
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="w-8 h-8 text-slate-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-4">
                Načítání nabídek práce...
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Hledat nabídku podle názvu, firmy, nebo dovedností..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            {/* Job Listings vs Detail View */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {viewState === ViewState.LIST ? renderJobSearch() : renderJobDetail()}
            </div>
          </div>
        )}
      </main>

      {/* Auth Modal */}
      {isAuthModalOpen && (
        <div>Auth modal would go here</div>
      )}
    </div>
  );
};

export default App;