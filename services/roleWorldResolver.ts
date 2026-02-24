export type GuidedSkin = 'cosmos' | 'garden' | 'inner' | 'skycity';

export const resolveGuidedSkin = (
  role?: string,
  assessmentId?: string,
  industry?: string,
  seniority?: string
): GuidedSkin => {
  const normalizedId = (assessmentId || '').toLowerCase();
  if (normalizedId.startsWith('demo-nurse')) return 'inner';
  if (normalizedId.startsWith('demo-cs-support')) return 'garden';
  if (normalizedId.startsWith('demo-b2b-sales')) return 'skycity';
  if (normalizedId.startsWith('demo-backend-senior')) return 'cosmos';
  if (normalizedId.startsWith('demo-cnc-operator')) return 'cosmos';

  const normalized = `${role || ''} ${industry || ''} ${seniority || ''}`.toLowerCase();
  if (/(programmer|programátor|programator|backend|devops|infrastructure|infra|sre|platform|security)/.test(normalized)) return 'cosmos';
  if (/(social|soci|hr|people|community|care|support|customer|podpora|obchodn|sales|account)/.test(normalized)) return 'garden';
  if (/(nurse|doctor|med|clinic|health|bio|life\s*science|lab|pharma|sestra|zdravot)/.test(normalized)) return 'inner';
  if (/(developer|frontend|fullstack|software|manager|management|strategy|director|head|lead|ceo|cfo|coo|cto|engineer|analyst)/.test(normalized)) return 'skycity';
  return 'cosmos';
};

