import type { Company, HandshakeBlueprint, Role } from './models';

const getCompanyTheme = (seed: string) => {
  let hash = 0;
  for (const char of seed) {
    hash = ((hash << 5) - hash) + char.charCodeAt(0);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return {
    primary: `hsl(${hue} 60% 42%)`,
    secondary: `hsl(${hue} 56% 94%)`,
    accent: `hsl(${(hue + 24) % 360} 70% 52%)`,
    surface: `hsl(${hue} 50% 98%)`,
    glow: '37,93,171',
  };
};

const buildFallbackCompany = (role: Role): Company => ({
  id: role.companyId,
  name: role.companyName || 'Company',
  tagline: role.companyNarrative || `${role.title} role in the new Jobshaman shell.`,
  domain: role.team || 'Hiring',
  headquarters: role.location,
  narrative: role.companyNarrative || 'This company has not published a custom brand surface yet.',
  coverImage: role.companyCoverImage || role.heroImage,
  logo: role.companyLogo || role.heroImage,
  gallery: [],
  handshakeMaterials: [],
  theme: getCompanyTheme(`${role.companyId}:${role.companyName || role.title}`),
  reviewer: {
    name: 'Hiring Team',
    role: 'Recruiter',
    avatarUrl: role.companyLogo || role.heroImage,
    intro: 'We want to understand your signal before we schedule the next human step.',
    meetingLabel: 'Intro Call',
    durationMinutes: 25,
    tool: 'Google Meet',
  },
});

export const resolveCompany = (role: Role, companyLibrary: Company[]) =>
  companyLibrary.find((company) => company.id === role.companyId) || buildFallbackCompany(role);

export const roleFamilyLabel: Record<Role['roleFamily'], string> = {
  engineering: 'Technologie a vývoj',
  design: 'Design a výzkum',
  product: 'Produkt a projekt',
  operations: 'Provoz a koordinace',
  sales: 'Obchod a partnerství',
  care: 'Zákaznická péče',
  frontline: 'Práce v provozu',
  marketing: 'Marketing a obsah',
  finance: 'Finance a administrativa',
  people: 'HR a lidé',
  education: 'Vzdělávání a trénink',
  health: 'Zdraví a sociální péče',
  construction: 'Řemesla a stavby',
  logistics: 'Logistika a doprava',
  legal: 'Právo a compliance',
};

export const generateAiBlueprint = (roleFamily: Role['roleFamily'], roleTitle: string): HandshakeBlueprint => {
  const baseSteps: HandshakeBlueprint['steps'] = [
    { id: 'identity', type: 'identity', title: 'Identity', prompt: 'Enter the space as a person, not a CV.', helper: 'Human context first.', required: true, uiVariant: 'split_form' },
    { id: 'motivation', type: 'motivation', title: 'Motivation', prompt: `Why does ${roleTitle} resonate with you now?`, helper: 'Specificity over polish.', required: true, uiVariant: 'story_field' },
  ];

  if (roleFamily === 'engineering') {
    baseSteps.push(
      { id: 'workspace', type: 'task_workspace', title: 'Task Workspace', prompt: 'Respond to a realistic technical scenario.', helper: 'Code, pseudo-code or system answer.', required: true, uiVariant: 'workspace' },
      { id: 'reflection', type: 'reflection', title: 'Reflection', prompt: 'Explain the tradeoff you chose.', helper: 'Judgment matters.', required: true, uiVariant: 'story_field' },
    );
  } else if (roleFamily === 'design' || roleFamily === 'product') {
    baseSteps.push(
      { id: 'alignment', type: 'skill_alignment', title: 'Skill Alignment', prompt: 'Show where your profile resonates and where you want to stretch.', helper: 'Growth and readiness.', required: true, uiVariant: 'signal_matrix' },
      { id: 'proof', type: 'portfolio_or_proof', title: 'Proof of Work', prompt: 'Share one artifact or decision trail.', helper: 'A thoughtful proof beats a long essay.', required: true, uiVariant: 'story_field' },
    );
  } else {
    baseSteps.push(
      { id: 'scenario', type: 'scenario_response', title: 'Scenario Response', prompt: 'Respond to a realistic operating scenario.', helper: 'Prioritize, sequence, decide.', required: true, uiVariant: 'story_field' },
      { id: 'reflection', type: 'reflection', title: 'Reflection', prompt: 'What tension would you watch first?', helper: 'Show your risk lens.', required: true, uiVariant: 'story_field' },
    );
  }

  baseSteps.push(
    { id: 'external_link', type: 'portfolio_or_proof', title: 'Externí výstup', prompt: 'Pokud pracujete v Notion, Canva, Figmě, Google Docs nebo jiném nástroji, vložte odkaz na výstup.', helper: 'Bez OAuth. Sdílejte přístupný link a krátce popište, co má reviewer otevřít.', required: false, uiVariant: 'story_field' },
    { id: 'results', type: 'results_summary', title: 'Results', prompt: 'Signal summary.', helper: 'Recruiter-grade interpretation.', required: true, uiVariant: 'result_panel' },
    { id: 'schedule', type: 'schedule_request', title: 'Schedule', prompt: 'Pick the next human step.', helper: 'Open a dialogue quickly.', required: true, uiVariant: 'scheduler' },
  );

  return {
    id: `bp-generated-${roleFamily}-${String(roleTitle || 'challenge').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'challenge'}`,
    name: `${roleTitle || roleFamilyLabel[roleFamily]} - postup výběru`,
    roleFamily,
    tone: roleFamily === 'engineering' ? 'technical' : roleFamily === 'design' ? 'human' : 'precision',
    overview: 'Krátký postup výběru navázaný na reálnou výzvu a první odpověď kandidáta.',
    benchmarkLabels: roleFamily === 'engineering' ? ['Architecture', 'Execution', 'Security'] : ['Signal clarity', 'Motivation', 'Decision quality'],
    aiGeneratorNote: 'Vytvořeno pro zadání výzvy. Kandidát uvidí konkrétní první krok, ne interní technický blueprint.',
    scheduleEnabled: true,
    steps: baseSteps,
  };
};
