import React from 'react';
import {
    BarChart2,
    Building2,
    Home,
    Settings,
    SlidersHorizontal,
    Sparkles,
    Star
} from 'lucide-react';
import { UserProfile, ViewState } from '../types';
import { cn } from './ui/primitives';

interface SidebarNavProps {
    viewState: ViewState;
    isMapMode?: boolean;
    setViewState: (view: ViewState) => void;
    discoveryMode?: 'all' | 'micro_jobs';
    setDiscoveryMode?: (mode: 'all' | 'micro_jobs') => void;
    setDiscoveryLane?: (lane: 'challenges' | 'imports') => void;
    setDiscoverySearchMode?: (active: boolean) => void;
    userProfile: UserProfile;
    onOpenCompanies: () => void;
    className?: string;
}

const SidebarNav: React.FC<SidebarNavProps> = ({
    viewState,
    setViewState,
    discoveryMode = 'all',
    setDiscoveryMode,
    setDiscoveryLane,
    setDiscoverySearchMode,
    userProfile,
    onOpenCompanies,
    className
}) => {
    const navItems: Array<{ id: ViewState | 'micro' | 'companies' | 'jhi'; icon: any; label: string }> = [
        { id: ViewState.LIST, icon: Home, label: 'Feed' },
        { id: 'micro', icon: Sparkles, label: 'Mini' },
        { id: ViewState.SAVED, icon: Star, label: 'Saved' },
        { id: 'companies', icon: Building2, label: 'Firmy' },
        { id: 'jhi', icon: BarChart2, label: 'JHI' },
        { id: ViewState.PROFILE, icon: Settings, label: 'Profile' },
    ];

    return (
        <aside className={cn(
            "fixed left-4 top-1/2 z-[90] hidden -translate-y-1/2 flex-col rounded-[1.6rem] border border-transparent bg-gradient-to-b from-cyan-600 to-cyan-700 p-2 shadow-xl shadow-cyan-900/20 backdrop-blur-xl lg:flex dark:from-cyan-700 dark:to-cyan-800",
            className
        )}>
            <nav className="flex flex-1 flex-col items-center justify-center gap-3 py-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => {
                            if (item.id === 'micro') {
                                setDiscoveryLane?.('challenges');
                                setDiscoverySearchMode?.(false);
                                setDiscoveryMode?.('micro_jobs');
                                setViewState(ViewState.LIST);
                                return;
                            }
                            if (item.id === 'companies') {
                                setDiscoverySearchMode?.(false);
                                if (userProfile.role === 'recruiter') {
                                    setViewState(ViewState.COMPANY_DASHBOARD);
                                } else {
                                    onOpenCompanies();
                                }
                                return;
                            }
                            if (item.id === 'jhi') {
                                setDiscoverySearchMode?.(false);
                                setViewState(ViewState.PROFILE);
                                try {
                                    window.location.hash = 'jhi';
                                } catch {
                                    // ignore
                                }
                                return;
                            }
                            setViewState(item.id as ViewState);
                        }}
                        className={cn(
                            "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                            (item.id === 'micro'
                                    ? (viewState === ViewState.LIST && discoveryMode === 'micro_jobs')
                                    : viewState === item.id)
                                ? "bg-white/25 text-white shadow-lg shadow-cyan-300/30"
                                : "text-cyan-100 hover:bg-white/15 hover:text-white"
                        )}
                        title={item.label}
                    >
                        <item.icon size={22} className={cn(
                            "transition-transform group-hover:scale-110",
                            viewState === item.id ? "scale-110" : "scale-100"
                        )} />

                        {/* Tooltip-like label on hover */}
                        <span className="absolute left-14 hidden rounded-lg bg-cyan-950 px-2 py-1 text-xs font-medium text-white group-hover:block">
                            {item.label}
                        </span>

                        {/* Active indicator bar */}
                        {(item.id === 'micro'
                                ? (viewState === ViewState.LIST && discoveryMode === 'micro_jobs')
                                : viewState === item.id) && (
                            <div className="absolute -left-1 h-6 w-1 rounded-r-full bg-white" />
                        )}
                    </button>
                ))}
                <button
                    onClick={() => window.dispatchEvent(new CustomEvent('jobshaman:openDiscoveryFilters'))}
                    className="group relative mt-2 flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/15 text-white transition-all duration-200 hover:bg-white/25 dark:bg-white/10"
                    title="Filters"
                    type="button"
                >
                    <SlidersHorizontal size={20} className="transition-transform group-hover:scale-110" />
                    <span className="absolute left-14 hidden rounded-lg bg-cyan-950 px-2 py-1 text-xs font-medium text-white group-hover:block">
                        Filters
                    </span>
                </button>
            </nav>

            <div className="flex flex-col items-center gap-3 border-t border-white/10 py-3" />
        </aside>
    );
};

export default SidebarNav;
