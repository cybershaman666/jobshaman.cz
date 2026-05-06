import React from 'react';

export type RecruiterTab = 'dashboard' | 'roles' | 'talent-pool' | 'integrations' | 'settings';
export type PublicPage = 'home' | 'companies' | 'terms' | 'privacy' | 'contact';

export type AppRoute =
  | { kind: 'marketplace' }
  | { kind: 'admin' }
  | { kind: 'public'; page: PublicPage }
  | { kind: 'candidate-role'; roleId: string }
  | { kind: 'candidate-imported'; roleId: string }
  | { kind: 'candidate-journey'; roleId: string; stepId?: string }
  | { kind: 'candidate-insights' }
  | { kind: 'candidate-applications' }
  | { kind: 'candidate-jcfpm' }
  | { kind: 'candidate-learning' }
  | { kind: 'recruiter'; tab: RecruiterTab };

export const routeFromPath = (pathname: string): AppRoute => {
  const cleanPath = pathname.split('#')[0]?.split('?')[0] || '/';
  const parts = cleanPath.split('/').filter(Boolean);
  if (parts.length === 0) return { kind: 'public', page: 'home' };
  if (parts[0] === 'admin') return { kind: 'admin' };
  if (parts[0] === 'firmy' || parts[0] === 'companies') return { kind: 'public', page: 'companies' };
  if (parts[0] === 'obchodni-podminky' || parts[0] === 'terms' || parts[0] === 'podminky-uziti') return { kind: 'public', page: 'terms' };
  if (parts[0] === 'ochrana-osobnich-udaju' || parts[0] === 'privacy' || parts[0] === 'privacy-policy') return { kind: 'public', page: 'privacy' };
  if (parts[0] === 'kontakt' || parts[0] === 'contact') return { kind: 'public', page: 'contact' };
  if (parts[0] === 'candidate' && parts[1] === 'role' && parts[2]) return { kind: 'candidate-role', roleId: parts[2] };
  if (parts[0] === 'candidate' && parts[1] === 'imported' && parts[2]) return { kind: 'candidate-imported', roleId: parts[2] };
  if (parts[0] === 'candidate' && parts[1] === 'journey' && parts[2]) return { kind: 'candidate-journey', roleId: parts[2], stepId: parts[3] };
  if ((parts[0] === 'candidate' && parts[1] === 'marketplace') || parts[0] === 'marketplace') return { kind: 'marketplace' };
  if (parts[0] === 'candidate' && parts[1] === 'profile') return { kind: 'candidate-insights' };
  if (parts[0] === 'candidate' && (parts[1] === 'learning' || parts[1] === 'kurzy' || parts[1] === 'uceni')) return { kind: 'candidate-learning' };
  if (parts[0] === 'candidate' && parts[1] === 'insights') return { kind: 'candidate-insights' };
  if (parts[0] === 'candidate' && (parts[1] === 'applications' || parts[1] === 'zadosti')) return { kind: 'candidate-applications' };
  if (parts[0] === 'candidate' && parts[1] === 'jcfpm') return { kind: 'candidate-jcfpm' };
  if (parts[0] === 'recruiter') {
    const rawTab = parts[1];
    if (!rawTab) return { kind: 'recruiter', tab: 'dashboard' };
    if (rawTab === 'roles') return { kind: 'recruiter', tab: 'roles' };
    if (rawTab === 'talent-pool') return { kind: 'recruiter', tab: 'talent-pool' };
    if (rawTab === 'integrations') return { kind: 'recruiter', tab: 'integrations' };
    if (rawTab === 'settings') return { kind: 'recruiter', tab: 'settings' };
    return { kind: 'recruiter', tab: 'dashboard' };
  }
  return { kind: 'public', page: 'home' };
};

export const usePathname = () => {
  const [pathname, setPathname] = React.useState(() => window.location.pathname || '/');

  React.useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname || '/');
    const handleHashChange = () => setPathname(window.location.pathname || '/');
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return [pathname, setPathname] as const;
};

export const navigateTo = (path: string, setPathname: (value: string) => void) => {
  const target = new URL(path, window.location.origin);
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const next = `${target.pathname}${target.search}${target.hash}`;
  if (current === next) return;
  window.history.pushState({}, '', path);
  window.scrollTo(0, 0);
  setPathname(target.pathname || '/');
  window.dispatchEvent(new HashChangeEvent('hashchange'));
};
