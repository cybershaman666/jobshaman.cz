import { useMemo } from 'react';
import { roles, companies, talentPool, blueprints, recruiterCalendar } from '../../rebuild/demoData';

export const useShamanData = () => {
  const shamanRoles = useMemo(() => roles.map(role => {
    const company = companies.find(c => c.id === role.companyId);
    return {
      ...role,
      companyName: company?.name || 'Unknown Tribe',
      companyLogo: company?.logo,
      companyTagline: company?.tagline
    };
  }), []);

  const shamanCompanies = useMemo(() => companies, []);
  const shamanTalentPool = useMemo(() => talentPool, []);
  const shamanBlueprints = useMemo(() => blueprints, []);
  const shamanCalendar = useMemo(() => recruiterCalendar, []);

  return {
    roles: shamanRoles,
    companies: shamanCompanies,
    talentPool: shamanTalentPool,
    blueprints: shamanBlueprints,
    calendar: shamanCalendar
  };
};
