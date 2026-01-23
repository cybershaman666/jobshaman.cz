import React from 'react';
import { 
  BrainCircuit, 
  ShoppingBag, 
  Briefcase, 
  Sun, 
  Moon, 
  LogOut, 
  UserCircle 
} from 'lucide-react';
import { ViewState, UserProfile } from '../types';

interface AppHeaderProps {
  viewState: ViewState;
  setViewState: (view: ViewState) => void;
  setSelectedJobId: (id: string | null) => void;
  showCompanyLanding: boolean;
  setShowCompanyLanding: (show: boolean) => void;
  savedJobIds: string[];
  userProfile: UserProfile;
  handleAuthAction: () => void;
  toggleTheme: () => void;
  theme: 'light' | 'dark';
}

const AppHeader: React.FC<AppHeaderProps> = ({
  viewState,
  setViewState,
  setSelectedJobId,
  showCompanyLanding,
  setShowCompanyLanding,
  savedJobIds,
  userProfile,
  handleAuthAction,
  toggleTheme,
  theme
}) => (
  <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md">
    <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8 max-w-[1920px] mx-auto">
      {/* Logo */}
      <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => { setViewState(ViewState.LIST); setSelectedJobId(null); }}
      >
          <div className="p-1.5 bg-cyan-600 rounded-lg text-white group-hover:bg-cyan-500 transition-colors">
              <BrainCircuit size={24} />
          </div>
          <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight hidden sm:block">Job<span className="text-cyan-600 dark:text-cyan-400">Shaman</span></span>
      </div>

      {/* Navigation */}
      <nav className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 p-1 rounded-lg border border-slate-200 dark:border-slate-700/50 overflow-x-auto">
          {!showCompanyLanding && (
              <>
                  <button 
                      onClick={() => { setViewState(ViewState.LIST); setSelectedJobId(null); }}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.LIST ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                  >
                      Nabídky
                  </button>
                  <button 
                      onClick={() => setViewState(ViewState.SAVED)}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.SAVED ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                  >
                      Uložené 
                      <span className={`text-[10px] px-1.5 rounded-full ${savedJobIds.length > 0 ? 'bg-slate-200 dark:bg-slate-900 text-slate-700 dark:text-slate-300' : 'bg-slate-200/50 dark:bg-slate-800/50'}`}>{savedJobIds.length}</span>
                  </button>
                  <button 
                      onClick={() => userProfile.isLoggedIn ? setViewState(ViewState.PROFILE) : handleAuthAction()}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${viewState === ViewState.PROFILE ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                  >
                      Profil
                  </button>
                  <button 
                      onClick={() => setViewState(ViewState.MARKETPLACE)}
                      className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${viewState === ViewState.MARKETPLACE ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
                  >
                      <ShoppingBag className="w-4 h-4" />
                      Kurzy & Rekvalifikace
                  </button>
              </>
          )}
          <button 
              onClick={() => {
                  if (showCompanyLanding) {
                      setShowCompanyLanding(false);
                      setViewState(ViewState.LIST);
                  } else if (userProfile.isLoggedIn) {
                      if (userProfile.role === 'recruiter') {
                          setViewState(ViewState.COMPANY_DASHBOARD);
                      } else {
                          setShowCompanyLanding(true);
                      }
                  } else {
                      setShowCompanyLanding(true);
                  }
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${showCompanyLanding || viewState === ViewState.COMPANY_DASHBOARD ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}`}
          >
              <Briefcase size={14} /> {showCompanyLanding ? 'Zpět' : 'Pro Firmy'}
          </button>
      </nav>

      {/* Right Actions */}
      {!showCompanyLanding && (
          <div className="flex items-center gap-3">
              <button 
                  onClick={toggleTheme}
                  className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
                  title="Změnit režim"
              >
                  {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

              {userProfile.isLoggedIn ? (
                  <div className="flex items-center gap-3 pl-2">
                      <div className="text-right hidden md:block">
                          <div className="text-sm font-bold text-slate-900 dark:text-white leading-none mb-1">{userProfile.name}</div>
                          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded uppercase tracking-wider inline-block">JHI Aktivní</div>
                      </div>
                      <button 
                          onClick={handleAuthAction}
                          className="text-slate-400 hover:text-rose-500 transition-colors"
                          title="Odhlásit se"
                      >
                          <LogOut size={20} />
                      </button>
                  </div>
              ) : (
                  <button 
                      onClick={handleAuthAction}
                      className="flex items-center gap-2 text-sm font-bold text-white bg-slate-900 dark:bg-white dark:text-slate-900 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
                  >
                      <UserCircle size={18} />
                      Přihlásit
                  </button>
              )}
          </div>
      )}
     </div>
  </header>
);

export default AppHeader;
