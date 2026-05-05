import React from 'react';

import type { CandidateJourneySession, CandidatePreferenceProfile, Company, HandshakeBlueprint, Role } from './models';
import { DEFAULT_JHI_PREFERENCES } from '../utils/jhiCalculator';
import { createDefaultTaxProfile } from '../services/taxEngine';

export const REBUILD_STORAGE_KEYS = {
  theme: 'jobshaman-rebuild:theme',
  companies: 'jobshaman-rebuild:companies',
  preferences: 'jobshaman-rebuild:candidate-preferences',
  blueprints: 'jobshaman-rebuild:blueprints',
  roleAssignments: 'jobshaman-rebuild:role-assignments',
  companyRoles: 'jobshaman-rebuild:company-roles',
  journeys: 'jobshaman-rebuild:journeys',
} as const;

const readStorageValue = <T,>(key: string, initialValue: T): T => {
  if (typeof window === 'undefined') return initialValue;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : initialValue;
  } catch {
    return initialValue;
  }
};

export const usePersistentState = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = React.useState<T>(() => readStorageValue(key, initialValue));

  React.useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore local storage failures
    }
  }, [key, value]);

  return [value, setValue] as const;
};

export const getDefaultRoleAssignments = () => ({});

export const buildInitialJourneySession = (roleId: string, blueprint: HandshakeBlueprint): CandidateJourneySession => ({
  roleId,
  currentStepId: blueprint.steps[0]?.id || 'identity',
  answers: {},
});

export const getDefaultCandidatePreferences = (): CandidatePreferenceProfile => ({
  name: '',
  legalName: '',
  preferredAlias: '',
  story: '',
  address: '',
  coordinates: { lat: 50.0755, lon: 14.4378 },
  transportMode: 'public',
  commuteFilterEnabled: true,
  commuteToleranceMinutes: 80,
  borderSearchEnabled: false,
  searchRadiusKm: 35,
  taxProfile: createDefaultTaxProfile('CZ'),
  jhiPreferences: DEFAULT_JHI_PREFERENCES,
  portfolioUrl: '',
  linkedInUrl: '',
});

export const getDefaultBlueprintLibrary = (): HandshakeBlueprint[] => [];
export const getDefaultCompanyLibrary = (): Company[] => [];

export const resolveBlueprintForRole = (
  role: Role,
  blueprintLibrary: HandshakeBlueprint[],
  roleAssignments: Record<string, string>,
) => {
  const assigned = roleAssignments[role.id] || role.blueprintId;
  return blueprintLibrary.find((item) => item.id === assigned) || blueprintLibrary[0] || null;
};
