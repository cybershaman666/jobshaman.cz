import { useMemo, lazy, Suspense } from 'react';
import { ViewState } from '../../../types';

const PodminkyUziti = lazy(() => import('../../../pages/PodminkyUziti'));
const OchranaSoukromi = lazy(() => import('../../../pages/OchranaSoukromi'));
const AboutUsPage = lazy(() => import('../../../pages/AboutUsPage'));
const SignalBoostPublicPage = lazy(() => import('../../../pages/SignalBoostPublicPage'));

export interface AppRouteResult {
    normalizedPath: string;
    isStandaloneRoute: boolean;
    standalonePageNode: React.ReactNode | null;
    isImmersiveAssessmentRoute: boolean;
    isPrimaryCareerOSHome: boolean;
    isPrimaryCompanyWorkspace: boolean;
    showAdminDashboard: boolean;
    showAssessmentPreview: boolean;
    showDemoHandshake: boolean;
    showDemoCompanyHandshake: boolean;
    showDemoSolarpunkPark: boolean;
}

export function useAppRoutes(
    pathname: string,
    viewState: ViewState,
    selectedJobId: string | null,
    selectedCompanyId: string | null,
    isBlogOpen: boolean,
    showCompanyLanding: boolean,
    userProfileRole: string | undefined,
    companyProfileExists: boolean
): AppRouteResult {
    const normalizedPath = useMemo(() => {
        const supportedLocales = ['cs', 'en', 'de', 'pl', 'sk', 'at'];
        const pathParts = pathname.split('/').filter(Boolean);
        if (pathParts.length > 0 && supportedLocales.includes(pathParts[0])) {
            pathParts.shift();
        }
        return `/${pathParts.join('/')}`;
    }, [pathname]);

    const standalonePageNode = useMemo(() => {
        if (normalizedPath === '/terms' || normalizedPath === '/podminky-uziti') {
            return <Suspense fallback={null}><PodminkyUziti /></Suspense>;
        }
        if (normalizedPath === '/privacy-policy' || normalizedPath === '/ochrana-osobnich-udaju') {
            return <Suspense fallback={null}><OchranaSoukromi /></Suspense>;
        }
        if (normalizedPath === '/about' || normalizedPath === '/about-us') {
            return <Suspense fallback={null}><AboutUsPage /></Suspense>;
        }
        if (normalizedPath.startsWith('/signal/')) {
            return <Suspense fallback={null}><SignalBoostPublicPage /></Suspense>;
        }
        return null;
    }, [normalizedPath]);

    const isStandaloneRoute = standalonePageNode !== null;

    // Special route detection
    const showAdminDashboard = normalizedPath === '/admin';
    const showAssessmentPreview = normalizedPath.startsWith('/assessment-preview');
    const showDemoHandshake = normalizedPath === '/demo-handshake';
    const showDemoCompanyHandshake = normalizedPath === '/demo-company-handshake';
    const showDemoSolarpunkPark = normalizedPath === '/demo-solarpunk-park';
    const isImmersiveAssessmentRoute = normalizedPath.startsWith('/assessment/') || normalizedPath.startsWith('/jcfpm');

    const isPrimaryCareerOSHome =
        !isImmersiveAssessmentRoute
        && !isStandaloneRoute
        && !showAdminDashboard
        && !showAssessmentPreview
        && !showDemoHandshake
        && !showDemoCompanyHandshake
        && !showDemoSolarpunkPark
        && viewState === ViewState.LIST
        && !selectedJobId
        && !selectedCompanyId
        && !isBlogOpen
        && !showCompanyLanding;

    const isPrimaryCompanyWorkspace =
        !isImmersiveAssessmentRoute
        && !isStandaloneRoute
        && !showAdminDashboard
        && !showAssessmentPreview
        && (
            viewState === ViewState.COMPANY_DASHBOARD
            || (showCompanyLanding && userProfileRole === 'recruiter' && companyProfileExists)
        );

    return {
        normalizedPath,
        isStandaloneRoute,
        standalonePageNode,
        isImmersiveAssessmentRoute,
        isPrimaryCareerOSHome,
        isPrimaryCompanyWorkspace,
        showAdminDashboard,
        showAssessmentPreview,
        showDemoHandshake,
        showDemoCompanyHandshake,
        showDemoSolarpunkPark,
    };
}
