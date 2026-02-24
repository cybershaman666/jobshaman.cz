import {
  AssessmentJourneyBehavioralConsistency,
  AssessmentJourneyCulturalOrientation,
  AssessmentJourneyDecisionPattern,
  AssessmentJourneyEnergyBalance,
  AssessmentJourneyFinalProfile,
} from '../types';
import { BACKEND_URL } from '../constants';
import { authenticatedFetch, isBackendNetworkCooldownActive } from './csrfService';

const CERTAINTY_MARKERS = ['definitely', 'certainly', 'always', 'jasne', 'urcite', 'presne'];
const UNCERTAINTY_MARKERS = ['maybe', 'perhaps', 'idk', 'asi', 'mozna', 'nevim'];
const PRIORITY_MARKERS = ['first', 'priority', 'priorita', 'nejdriv', 'urgent'];
const METRIC_MARKERS = ['kpi', 'metric', 'measure', 'sla', 'impact', 'dopad'];
const MUST_MARKERS = ['musim', 'musíme', 'must', 'have to'];
const WANT_MARKERS = ['chci', 'chceme', 'want', 'prefer'];
const INTERNAL_MARKERS = ['decide', 'plan', 'choose', 'rozhodnu', 'zvladnu'];
const EXTERNAL_MARKERS = ['manager said', 'they told', 'musel jsem', 'nemuzu ovlivnit'];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

const countMarkers = (text: string, markers: string[]): number => {
  const lower = text.toLowerCase();
  return markers.reduce((acc, marker) => acc + (lower.includes(marker) ? 1 : 0), 0);
};

const splitSentences = (text: string): string[] =>
  text
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean);

export const analyzeDecisionPattern = (answers: string[]): AssessmentJourneyDecisionPattern => {
  const joined = answers.join(' ').toLowerCase();
  const sentenceCount = Math.max(1, splitSentences(joined).length);
  const avgSentenceLen = joined.split(/\s+/).filter(Boolean).length / sentenceCount;
  const certaintyHits = countMarkers(joined, CERTAINTY_MARKERS);
  const uncertaintyHits = countMarkers(joined, UNCERTAINTY_MARKERS);
  const priorityHits = countMarkers(joined, PRIORITY_MARKERS);
  const metricHits = countMarkers(joined, METRIC_MARKERS);
  const stakeholderHits = countMarkers(joined, ['stakeholder', 'team', 'tym', 'lead', 'customer', 'klient']);

  return {
    structured_vs_improv: clamp(45 + priorityHits * 12 + metricHits * 6 + (avgSentenceLen > 15 ? 8 : -5)),
    risk_tolerance: clamp(50 + countMarkers(joined, ['risk', 'trade-off', 'experiment']) * 10 - uncertaintyHits * 5),
    sequential_vs_parallel: clamp(55 + countMarkers(joined, ['then', 'next', 'potom', 'krok']) * 8 - countMarkers(joined, ['parallel', 'soubez']) * 5 + certaintyHits * 3),
    stakeholder_orientation: clamp(35 + stakeholderHits * 12),
    uncertainty_markers: Array.from(new Set(UNCERTAINTY_MARKERS.filter((marker) => joined.includes(marker)))),
  };
};

export const analyzeConsistency = (answers: string[]): AssessmentJourneyBehavioralConsistency => {
  const joined = answers.join(' ').toLowerCase();
  const motifsMap: Array<[string, string[]]> = [
    ['structure', ['plan', 'step', 'krok', 'framework']],
    ['risk-awareness', ['risk', 'fallback', 'trade-off']],
    ['transparency', ['transparent', 'open', 'sdilet', 'feedback']],
    ['execution', ['deliver', 'deadline', 'dopad', 'result']],
  ];
  const motifs = motifsMap
    .filter(([, markers]) => markers.some((marker: string) => joined.includes(marker)))
    .map(([name]) => `V odpovědích se opakuje motiv: ${name}.`);

  return {
    recurring_motifs: motifs.slice(0, 3),
    consistency_pairs: [
      'Deklarovaná preference pro strukturu se objevuje i ve scénářových odpovědích.',
      'Prioritizace je konzistentní napříč prvními odpověďmi.',
    ].slice(0, motifs.length > 0 ? 2 : 1),
    preference_scenario_tensions: joined.includes('autonomy') && joined.includes('strict process')
      ? ['Objevuje se napětí mezi autonomií a potřebu pevného procesu.']
      : [],
  };
};

export const analyzeEnergyBalance = (answers: string[]): AssessmentJourneyEnergyBalance => {
  const joined = answers.join(' ').toLowerCase();
  const mustHits = countMarkers(joined, MUST_MARKERS);
  const wantHits = Math.max(1, countMarkers(joined, WANT_MARKERS));
  const enthusiasm = ['energize', 'growth', 'learn', 'impact', 'chci rust', 'tesi me'].filter((m) => joined.includes(m));
  const exhaustion = ['burnout', 'exhaust', 'vycerp', 'pretlak', 'chaos'].filter((m) => joined.includes(m));
  const internal = countMarkers(joined, INTERNAL_MARKERS);
  const external = countMarkers(joined, EXTERNAL_MARKERS);

  const ratio = Number((mustHits / wantHits).toFixed(2));
  const locus = internal > external ? 'internal' : external > internal ? 'external' : 'mixed';
  const monthlyEnergyHoursLeft = Math.max(18, 110 - mustHits * 8 + wantHits * 5 - exhaustion.length * 6);

  return {
    enthusiasm_markers: enthusiasm.slice(0, 6),
    exhaustion_markers: exhaustion.slice(0, 6),
    must_vs_want_ratio: ratio,
    locus_of_control: locus,
    monthly_energy_hours_left: monthlyEnergyHoursLeft,
  };
};

export const analyzeCulture = (answers: string[]): AssessmentJourneyCulturalOrientation => {
  const joined = answers.join(' ').toLowerCase();
  const prefersOpen = joined.includes('feedback') || joined.includes('transparent') || joined.includes('otevren');
  const conflictDirect = joined.includes('confront') || joined.includes('naprimo') || joined.includes('otevrene');
  const autonomy = joined.includes('autonomy') || joined.includes('samostat');
  const process = joined.includes('process') || joined.includes('postup') || joined.includes('framework');
  const dynamic = joined.includes('change') || joined.includes('iter') || joined.includes('zmena');

  return {
    transparency: prefersOpen ? 'Vysoká preference otevřené zpětné vazby.' : 'Spíše opatrnější sdílení zpětné vazby.',
    conflict_response: conflictDirect ? 'Spíše přímá konfrontace problému.' : 'Spíše zprostředkované řešení konfliktu.',
    hierarchy_vs_autonomy: autonomy ? 'Vyšší orientace na autonomii.' : 'Vyšší orientace na jasnou hierarchii.',
    process_vs_outcome: process ? 'Důraz na procesní kvalitu i výsledek.' : 'Důraz primárně na výsledek.',
    stability_vs_dynamics: dynamic ? 'Směr k dynamickému prostředí a iteraci.' : 'Směr ke stabilnímu prostředí.',
  };
};

export const buildFinalProfile = (
  decision: AssessmentJourneyDecisionPattern,
  energy: AssessmentJourneyEnergyBalance,
  culture: AssessmentJourneyCulturalOrientation
): AssessmentJourneyFinalProfile => ({
  transferable_strengths: [
    decision.structured_vs_improv >= 55 ? 'Strukturované rozhodování v nejistotě' : 'Adaptivní improvizace v proměnlivém kontextu',
    decision.stakeholder_orientation >= 60 ? 'Stakeholder communication' : 'Samostatná exekuce',
    energy.locus_of_control === 'internal' ? 'Vysoká subjektivní kontrola nad výsledkem' : 'Silná reakce na externí signály',
  ],
  risk_zones: [
    energy.must_vs_want_ratio > 1.4 ? 'Dlouhodobý tlak povinností může snižovat energii.' : 'Riziko není dominantní v energetické rovině.',
  ],
  amplify_environments: [
    culture.transparency,
    culture.hierarchy_vs_autonomy,
  ],
  drain_environments: [
    'Nízká transparentnost rozhodování.',
    energy.monthly_energy_hours_left < 40 ? 'Dlouhodobě vysoký operativní tlak bez prostoru na obnovu.' : 'Nekonzistentní prioritizace bez jasného vlastnictví.',
  ],
});

export const fetchJourneyAnalyzeAnswer = async (payload: {
  phase: number;
  question_text: string;
  answer: string;
  answers_so_far: string[];
}): Promise<{ micro_insight: string; insight_type: string; decision_pattern: AssessmentJourneyDecisionPattern; behavioral_consistency: AssessmentJourneyBehavioralConsistency; energy_balance: AssessmentJourneyEnergyBalance; cultural_orientation: AssessmentJourneyCulturalOrientation; }> => {
  if (isBackendNetworkCooldownActive()) {
    const answers = [...payload.answers_so_far, payload.answer].filter(Boolean);
    const decision = analyzeDecisionPattern(answers);
    const consistency = analyzeConsistency(answers);
    const energy = analyzeEnergyBalance(answers);
    const culture = analyzeCulture(answers);
    return {
      micro_insight: consistency.recurring_motifs[0] || 'Začíná se rýsovat váš rozhodovací styl.',
      insight_type: 'local_pattern',
      decision_pattern: decision,
      behavioral_consistency: consistency,
      energy_balance: energy,
      cultural_orientation: culture,
    };
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/assessments/journey/analyze-answer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Journey analyze failed: ${response.status}`);
  }
  return response.json() as Promise<any>;
};

export const fetchJourneyFinalize = async (payload: {
  answers: string[];
}): Promise<{ decision_pattern: AssessmentJourneyDecisionPattern; behavioral_consistency: AssessmentJourneyBehavioralConsistency; energy_balance: AssessmentJourneyEnergyBalance; cultural_orientation: AssessmentJourneyCulturalOrientation; final_profile: AssessmentJourneyFinalProfile; }> => {
  if (isBackendNetworkCooldownActive()) {
    const decision = analyzeDecisionPattern(payload.answers);
    const consistency = analyzeConsistency(payload.answers);
    const energy = analyzeEnergyBalance(payload.answers);
    const culture = analyzeCulture(payload.answers);
    return {
      decision_pattern: decision,
      behavioral_consistency: consistency,
      energy_balance: energy,
      cultural_orientation: culture,
      final_profile: buildFinalProfile(decision, energy, culture),
    };
  }

  const response = await authenticatedFetch(`${BACKEND_URL}/assessments/journey/finalize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Journey finalize failed: ${response.status}`);
  }
  return response.json() as Promise<any>;
};
