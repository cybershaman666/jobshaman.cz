import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];

const addCheck = (label, ok, detail = '') => {
  checks.push({ label, ok, detail });
};

const removedLegacyRoots = [
  'src/cybershaman/CyberShamanApp.tsx',
  'src/cybershaman/dashboard/CyberDashboard.tsx',
  'src/cybershaman/handshake/HandshakeRitual.tsx',
  'src/cybershaman/company/CyberRecruiterDashboard.tsx',
  'src/cybershaman/company/CompanyHandshakeView.tsx',
];

for (const file of removedLegacyRoots) {
  addCheck(
    `${file} has been removed`,
    !fs.existsSync(path.join(root, file)),
    'Expected obsolete Cybershaman shell files to stay deleted so legacy routes cannot reappear.',
  );
}

const themeCss = read('src/rebuild/ui/rebuildTheme.css');
addCheck(
  'legacy Cybershaman light-theme overrides are removed',
  !themeCss.includes('cybershaman-legacy'),
  'Expected rebuild theme CSS to stop carrying legacy Cybershaman compatibility selectors.',
);

const themeProvider = read('src/rebuild/ui/rebuildTheme.tsx');
addCheck(
  'theme provider supports system mode',
  themeProvider.includes("type RebuildThemeMode = 'system' | 'light' | 'dark'") && themeProvider.includes('prefers-color-scheme: light'),
  'Expected system/light/dark theme support.',
);
addCheck(
  'theme provider exposes resolved theme class',
  themeProvider.includes('rebuild-theme-${resolvedMode}') && themeProvider.includes('data-theme-resolved={resolvedMode}'),
  'Expected stable light/dark resolved selectors for visual QA.',
);

const shellChrome = read('src/rebuild/ui/ShellChrome.tsx');
addCheck(
  'header brand uses theme-aware logo text assets',
  shellChrome.includes('/logotextdark.png') && shellChrome.includes('/logotext-transparent.png') && shellChrome.includes('resolvedMode'),
  'Expected BrandMark to switch between text logo assets based on the resolved theme.',
);

const sharedShell = read('src/rebuild/ui/DashboardLayoutV2.tsx');
addCheck(
  'shared app shell uses DashboardLayoutV2',
  sharedShell.includes('SidebarV2') && sharedShell.includes('TopBarV2') && sharedShell.includes("userRole === 'recruiter'"),
  'Expected a single shared shell to power candidate and recruiter product routes.',
);

const appShell = read('App.tsx');
addCheck(
  'app defaults to rebuild shell instead of legacy map',
  appShell.includes('<JobshamanRebuildApp />') && !appShell.includes('CyberShamanApp') && !appShell.includes('legacy-cybershaman'),
  'Expected the production app root to render only the rebuild shell.',
);

const ritual = read('src/cybershaman/ritual/TheRitual.tsx');
addCheck(
  'onboarding ritual uses brand-only logo asset',
  ritual.includes('src="/logo-transparent.png"') && ritual.includes('alt="Jobshaman"'),
  'Expected TheRitual to use the brand-only logo asset during onboarding.',
);
addCheck(
  'onboarding ritual is not marked as legacy shell',
  ritual.includes('cybershaman-ritual') && !ritual.includes('cybershaman-legacy'),
  'Expected onboarding to be a product ritual surface, not part of the removed legacy shell.',
);

const aiProfileService = read('services/aiProfileService.ts');
addCheck(
  'onboarding fallback is not premium-gated',
  aiProfileService.includes('deterministic-onboarding-fallback-v1') && aiProfileService.includes('premium subscription required'),
  'Expected narrative onboarding to complete with a deterministic fallback when an old backend still returns the legacy Premium AI error.',
);

for (const asset of ['public/logo-transparent.png', 'public/logotext-transparent.png']) {
  addCheck(
    `${asset} exists`,
    fs.existsSync(path.join(root, asset)),
    'Expected transparent derived logo asset to exist.',
  );
}

for (const asset of [
  'public/cybershaman-archetype-orbit.svg',
  'public/cybershaman-brain-growth.svg',
  'public/cybershaman-oracle-avatar.svg',
  'public/cybershaman-portal-card.svg',
  'public/cybershaman-recruiter-radar.svg',
  'public/cybershaman-recruiter-mentor.svg',
]) {
  addCheck(
    `${asset} exists`,
    fs.existsSync(path.join(root, asset)),
    'Expected dashboard visual asset to exist.',
  );
}

const dashboardShell = read('src/rebuild/dashboard/DashboardShell.tsx');
for (const token of ['dashboardSurfaceClass', 'dashboardCardClass', 'dashboardSoftCardClass']) {
  addCheck(
    `shared dashboard shell includes ${token}`,
    dashboardShell.includes(token),
    'Expected the screenshot-locked dashboard shell tokens to exist.',
  );
}

const candidateDashboard = read('src/rebuild/candidate/CandidateDashboardV2.tsx');
for (const token of [
  'dashboard-v2',
  'dashboard-archetype-card',
  'dashboard-growth-card',
  'dashboard-blindspots-card',
  'dashboard-challenges-card',
  'dashboard-handshakes-card',
  'dashboard-growth-map-card',
  'dashboard-mentor-card',
  'cybershaman-archetype-orbit.svg',
  'cybershaman-brain-growth.svg',
  'cybershaman-oracle-avatar.svg',
  'cybershaman-portal-card.svg',
]) {
  addCheck(
    `candidate dashboard v2 includes ${token}`,
    candidateDashboard.includes(token),
    'Expected /candidate/insights to keep the new dashboard layout invariant.',
  );
}

const candidateExperience = read('src/rebuild/candidate/CandidateExperience.tsx');
addCheck(
  'candidate insights uses CandidateDashboardV2',
  candidateExperience.includes('CandidateDashboardV2') && candidateExperience.includes("Boolean('dashboard-v2')"),
  'Expected candidate insights to mount the new screenshot-locked dashboard.',
);

const recruiterDashboard = read('src/rebuild/recruiter/RecruiterDashboardV2.tsx');
for (const token of ['cybershaman-recruiter-radar.svg', 'cybershaman-recruiter-mentor.svg', 'Týmová kognitivní mapa', 'Pipeline přehled', 'Týmové složení']) {
  addCheck(
    `recruiter dashboard v2 includes ${token}`,
    recruiterDashboard.includes(token),
    'Expected recruiter dashboard to match the screenshot-locked company layout system.',
  );
}

const recruiterShell = read('src/rebuild/recruiter/RecruiterShell.tsx');
addCheck(
  'recruiter workspace uses shared shell and dashboard',
  recruiterShell.includes('RecruiterDashboardV2') && recruiterShell.includes('DashboardLayoutV2') && recruiterShell.includes('shouldRenderDashboardV2'),
  'Expected /recruiter root and subroutes to use the new shared shell system.',
);

const rebuildApp = read('src/rebuild/JobshamanRebuildApp.tsx');
addCheck(
  'signed-in home route lands on product dashboard',
  rebuildApp.includes("pathname !== '/' || !userProfile.isLoggedIn") && rebuildApp.includes("navigate('/candidate/insights')"),
  'Expected signed-in candidates to land on the new dashboard instead of the marketplace shell.',
);
addCheck(
  'product routes bypass old rebuild backdrop and candidate top bar',
  rebuildApp.includes('isStandaloneDashboardRoute') && rebuildApp.includes('{!isStandaloneDashboardRoute ? <AppBackdrop /> : null}') && !rebuildApp.includes('<CandidateTopBar'),
  'Expected screenshot-locked product routes to render without the old rebuild backdrop layer or old candidate top bar.',
);
addCheck(
  'non-dashboard candidate routes mount shared workspace shell',
  rebuildApp.includes('renderCandidateWorkspace(') && rebuildApp.includes('DashboardLayoutV2'),
  'Expected marketplace, JCFPM, handshake and briefing routes to use the shared shell.',
);

const routing = read('src/rebuild/routing.ts');
for (const route of [
  "return { kind: 'marketplace' }",
  "return { kind: 'candidate-insights' }",
  "return { kind: 'candidate-jcfpm' }",
  "return { kind: 'recruiter', tab }",
]) {
  addCheck(
    `route contract includes ${route}`,
    routing.includes(route),
    'Expected focused QA surfaces to remain routable.',
  );
}

const todo = read('docs/cybershaman-production-todo.md');
addCheck(
  'production TODO keeps browser visual QA explicit',
  todo.includes('Run focused mobile/desktop visual QA'),
  'Expected the remaining manual browser QA item to stay visible.',
);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  const icon = check.ok ? 'PASS' : 'FAIL';
  console.log(`${icon} ${check.label}`);
  if (!check.ok && check.detail) console.log(`     ${check.detail}`);
}

if (failed.length > 0) {
  console.error(`\n${failed.length} Cybershaman visual audit check(s) failed.`);
  process.exit(1);
}

console.log(`\n${checks.length} Cybershaman visual audit checks passed.`);
