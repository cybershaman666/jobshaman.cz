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
  commuteFilterEnabled: false,
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
  if (role.handshakeBlueprint && Array.isArray((role.handshakeBlueprint as HandshakeBlueprint).steps)) {
    return role.handshakeBlueprint as HandshakeBlueprint;
  }
  const assigned = roleAssignments[role.id] || role.blueprintId;
  const libraryBlueprint = blueprintLibrary.find((item) => item.id === assigned) || blueprintLibrary[0];
  if (libraryBlueprint) return libraryBlueprint;
  return {
    id: `bp-fallback-${role.id}`,
    name: `${role.title} handshake`,
    roleFamily: role.roleFamily,
    tone: 'precision',
    overview: 'Praktický handshake navázaný na reálnou výzvu firmy.',
    benchmarkLabels: ['Porozumění', 'Úsudek', 'Praktičnost'],
    aiGeneratorNote: 'Fallback handshake blueprint.',
    scheduleEnabled: true,
    steps: [
      {
        id: 'problem_frame',
        type: 'scenario_response',
        title: 'Porozumění zadání',
        prompt: role.firstStep || role.challenge || 'Jak rozumíš prvnímu reálnému kroku v této roli?',
        helper: role.summary || 'Odpověz konkrétně, s předpoklady a riziky.',
        required: true,
        uiVariant: 'story_field',
      },
      {
        id: 'work_sample',
        type: 'task_workspace',
        title: 'Praktický postup',
        prompt: role.challenge || 'Navrhni praktické řešení nebo postup.',
        helper: role.description || role.mission || 'Popiš kroky, důkazy a rozhodovací kritéria.',
        required: true,
        uiVariant: 'workspace',
      },
      {
        id: 'risk_and_unknowns',
        type: 'reflection',
        title: 'Rizika a neznámé',
        prompt: 'Co by se mohlo pokazit a co bys potřeboval/a ověřit?',
        helper: 'Dobrá odpověď umí říct i co ještě neví.',
        required: true,
        uiVariant: 'story_field',
      },
      {
        id: 'schedule',
        type: 'schedule_request',
        title: 'Navázání dialogu',
        prompt: 'Vyber preferovaný čas pro další lidský krok.',
        helper: 'Termín je žádost, firma jej potvrdí po review.',
        required: false,
        uiVariant: 'scheduler',
      },
    ],
  } satisfies HandshakeBlueprint;
};
