import React from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  BrainCircuit,
  Briefcase,
  Clock3,
  Eye,
  MessageSquareText,
  UserRoundSearch,
  Users,
} from 'lucide-react';

import type { Assessment, Candidate, CompanyApplicationRow, Job } from '../../../types';
import type { CompanyActivityLogEntry } from '../../../services/companyActivityService';
import { companyMapIntlLocale, companyMapText, resolveCompanyMapLocale } from '../companyMapLocale';
import { CompanyMapEmptyState, CompanyMapStatCard, CompanyMapTag } from './CompanyMapPrimitives';

type BenchmarkCard = {
  metric: string;
  value: number | null;
  peer_value: number | null;
};

const initialsFromName = (value: string | null | undefined): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'C';
};

const CandidateAvatar: React.FC<{
  name?: string | null;
  avatarUrl?: string | null;
  sizeClass?: string;
}> = ({ name, avatarUrl, sizeClass = 'h-11 w-11' }) => (
  avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name || 'Candidate'}
      className={`${sizeClass} rounded-full border border-slate-200/80 object-cover shadow-sm`}
    />
  ) : (
    <div className={`${sizeClass} flex items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 text-xs font-semibold text-slate-700 shadow-sm`}>
      {initialsFromName(name)}
    </div>
  )
);

interface OverviewPanelProps {
  locale?: string;
  metrics: { roles: number; activeDialogues: number; candidates: number; assessments: number };
  jobs: Job[];
  dialogues: CompanyApplicationRow[];
  activityLog: CompanyActivityLogEntry[];
  formatDate: (value: string | null | undefined) => string;
  labelStatus: (status: string) => string;
  onOpenWave: (waveId: string) => void;
  onOpenDialogue: (dialogueId: string, waveId?: string | null) => void | Promise<void>;
  onOpenCandidates: () => void;
  onOpenAssessments: () => void;
}

export const CompanyMapOverviewPanel: React.FC<OverviewPanelProps> = ({
  locale: localeInput,
  metrics,
  jobs,
  dialogues,
  activityLog,
  formatDate,
  labelStatus,
  onOpenWave,
  onOpenDialogue,
  onOpenCandidates,
  onOpenAssessments,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <CompanyMapStatCard label={text({ cs: 'Aktivní výzvy', sk: 'Aktívne výzvy', en: 'Active challenges', de: 'Aktive Challenges', pl: 'Aktywne wyzwania' })} value={metrics.roles} />
        <CompanyMapStatCard label={text({ cs: 'Aktivní dialogy', sk: 'Aktívne dialógy', en: 'Active dialogues', de: 'Aktive Dialoge', pl: 'Aktywne dialogi' })} value={metrics.activeDialogues} />
        <CompanyMapStatCard label={text({ cs: 'Kandidáti v poolu', sk: 'Kandidáti v poole', en: 'Talent pool', de: 'Talentpool', pl: 'Pula talentów' })} value={metrics.candidates} />
        <CompanyMapStatCard label={text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' })} value={metrics.assessments} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-4">
          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {text({ cs: 'Aktivní výzvy', sk: 'Aktívne výzvy', en: 'Active challenges', de: 'Aktive Challenges', pl: 'Aktywne wyzwania' })}
              </div>
              <button type="button" onClick={onOpenCandidates} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                {text({ cs: 'Talent pool', sk: 'Talent pool', en: 'Talent pool', de: 'Talentpool', pl: 'Pula talentów' })}
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {jobs.length ? jobs.slice(0, 4).map((job) => (
                <button key={job.id} type="button" onClick={() => onOpenWave(String(job.id))} className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50/80">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{job.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {job.location || text({ cs: 'Lokalita není uvedena', sk: 'Lokalita nie je uvedená', en: 'Location not specified', de: 'Standort nicht angegeben', pl: 'Brak lokalizacji' })}
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                      {labelStatus(String((job as any).status || 'active'))}
                    </div>
                  </div>
                  <div className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                    {(job.challenge || job.description || '').trim() || text({
                      cs: 'Tahle výzva zatím čeká na konkrétnější zadání a další operační krok.',
                      sk: 'Táto výzva zatiaľ čaká na konkrétnejšie zadanie a ďalší operačný krok.',
                      en: 'This challenge is still waiting for a more specific brief and next operational step.',
                      de: 'Diese Challenge wartet noch auf ein konkreteres Briefing und den nächsten operativen Schritt.',
                      pl: 'To wyzwanie nadal czeka na bardziej konkretne zadanie i kolejny krok operacyjny.',
                    })}
                  </div>
                </button>
              )) : (
                <CompanyMapEmptyState message={text({
                  cs: 'Dashboard ožije ve chvíli, kdy založíš první výzvu.',
                  sk: 'Dashboard ožije vo chvíli, keď založíš prvú výzvu.',
                  en: 'The dashboard comes alive once you open the first challenge.',
                  de: 'Das Dashboard оживt, sobald Sie die erste Challenge eröffnen.',
                  pl: 'Dashboard ożyje, gdy utworzysz pierwsze wyzwanie.',
                })} />
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {text({
                  cs: 'Dialogy čekající na další krok',
                  sk: 'Dialógy čakajúce na ďalší krok',
                  en: 'Dialogues waiting for the next step',
                  de: 'Dialoge, die auf den nächsten Schritt warten',
                  pl: 'Dialogi czekające na kolejny krok',
                })}
              </div>
              <button type="button" onClick={onOpenAssessments} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                {text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' })}
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {dialogues.length ? dialogues.slice(0, 4).map((dialogue) => (
                <button key={dialogue.id} type="button" onClick={() => void onOpenDialogue(dialogue.id, dialogue.job_id ? String(dialogue.job_id) : null)} className="rounded-[22px] border border-slate-200/80 bg-slate-50/85 px-4 py-4 text-left transition hover:border-cyan-300 hover:bg-cyan-50/80">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CandidateAvatar
                        name={dialogue.candidate_name}
                        avatarUrl={dialogue.candidate_avatar_url || dialogue.candidateAvatarUrl || null}
                      />
                      <div>
                        <div className="text-sm font-semibold text-slate-950">
                          {dialogue.candidate_name || text({ cs: 'Kandidát', sk: 'Kandidát', en: 'Candidate', de: 'Kandidat', pl: 'Kandydat' })}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {dialogue.job_title || text({ cs: 'Bez role', sk: 'Bez roly', en: 'No role', de: 'Keine Rolle', pl: 'Bez roli' })}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-700">
                      {labelStatus(dialogue.status)}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-cyan-800">
                    <ArrowRight size={14} />
                    {text({ cs: 'Otevřít detail člověka', sk: 'Otvoriť detail človeka', en: 'Open human detail', de: 'Human Detail öffnen', pl: 'Otwórz human detail' })}
                  </div>
                </button>
              )) : (
                <CompanyMapEmptyState message={text({
                  cs: 'Jakmile kandidáti vstoupí do dialogu, objeví se tady operační fronta.',
                  sk: 'Keď kandidáti vstúpia do dialógu, objaví sa tu operačná fronta.',
                  en: 'Once candidates enter dialogues, the operations queue will appear here.',
                  de: 'Sobald Kandidaten in Dialoge eintreten, erscheint hier die operative Warteschlange.',
                  pl: 'Gdy kandydaci wejdą do dialogów, pojawi się tutaj kolejka operacyjna.',
                })} />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[26px] border border-cyan-100/90 bg-cyan-50/80 px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
              {text({ cs: 'Další krok', sk: 'Ďalší krok', en: 'Next step', de: 'Nächster Schritt', pl: 'Następny krok' })}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">
              {metrics.roles > 0
                ? text({
                    cs: 'Projdi aktivní výzvy a rozhodni další pohyb v hiringu.',
                    sk: 'Prejdi aktívne výzvy a rozhodni ďalší pohyb v hiringu.',
                    en: 'Review active challenges and decide the next hiring move.',
                    de: 'Prüfen Sie aktive Challenges und entscheiden Sie den nächsten Hiring-Schritt.',
                    pl: 'Przejrzyj aktywne wyzwania i zdecyduj o kolejnym ruchu w hiringu.',
                  })
                : text({
                    cs: 'Založ první výzvu a rozběhni firemní flow.',
                    sk: 'Založ prvú výzvu a rozbehni firemné flow.',
                    en: 'Open the first challenge and start the company flow.',
                    de: 'Eröffnen Sie die erste Challenge und starten Sie den Company-Flow.',
                    pl: 'Utwórz pierwsze wyzwanie i uruchom firmowy flow.',
                  })}
            </div>
            <div className="mt-3 text-sm leading-7 text-slate-600">
              {metrics.activeDialogues > 0
                ? text({
                    cs: 'Máš už aktivní dialogy, takže dashboard může sloužit jako operační cockpit.',
                    sk: 'Už máš aktívne dialógy, takže dashboard môže slúžiť ako operačný cockpit.',
                    en: 'You already have active dialogues, so the dashboard can act as an operations cockpit.',
                    de: 'Sie haben bereits aktive Dialoge, daher kann das Dashboard als Operations-Cockpit dienen.',
                    pl: 'Masz już aktywne dialogi, więc dashboard może działać jak kokpit operacyjny.',
                  })
                : text({
                    cs: 'Jakmile dorazí první lidé do dialogu, objeví se tady timeline a další rozhodovací signál.',
                    sk: 'Keď dorazia prví ľudia do dialógu, objaví sa tu timeline a ďalší rozhodovací signál.',
                    en: 'Once the first people enter dialogues, this area will show timeline and next-step signal.',
                    de: 'Sobald die ersten lidé vstoupí do dialogů, zobrazí se zde timeline a další rozhodovací signál.',
                    pl: 'Gdy pierwsze osoby wejdą do dialogów, ten obszar pokaże timeline i kolejny sygnał decyzyjny.',
                  })}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Rychlý přehled', sk: 'Rýchly prehľad', en: 'Quick overview', de: 'Schnellüberblick', pl: 'Szybki przegląd' })}
            </div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3 text-sm text-slate-700">
                {text({ cs: `Výzvy připravené k řízení: ${metrics.roles}`, sk: `Výzvy pripravené na riadenie: ${metrics.roles}`, en: `Challenges ready to manage: ${metrics.roles}`, de: `Challenges zur Steuerung: ${metrics.roles}`, pl: `Wyzwania gotowe do prowadzenia: ${metrics.roles}` })}
              </div>
              <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3 text-sm text-slate-700">
                {text({ cs: `Dialogy čekající na další krok: ${metrics.activeDialogues}`, sk: `Dialógy čakajúce na ďalší krok: ${metrics.activeDialogues}`, en: `Dialogues waiting for next step: ${metrics.activeDialogues}`, de: `Dialoge mit offeným dalším krokem: ${metrics.activeDialogues}`, pl: `Dialogi czekające na kolejny krok: ${metrics.activeDialogues}` })}
              </div>
              <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3 text-sm text-slate-700">
                {text({ cs: `Kandidáti v dosahu firmy: ${metrics.candidates}`, sk: `Kandidáti v dosahu firmy: ${metrics.candidates}`, en: `Candidates currently within reach: ${metrics.candidates}`, de: `Kandidaten in Reichweite: ${metrics.candidates}`, pl: `Kandydaci w zasięgu firmy: ${metrics.candidates}` })}
              </div>
              <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3 text-sm text-slate-700">
                {text({ cs: `Assessment knihovna a pozvánky: ${metrics.assessments}`, sk: `Assessment knižnica a pozvánky: ${metrics.assessments}`, en: `Assessment library and invitations: ${metrics.assessments}`, de: `Assessment-Bibliothek und Einladungen: ${metrics.assessments}`, pl: `Biblioteka assessmentów i zaproszenia: ${metrics.assessments}` })}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Poslední aktivita', sk: 'Posledná aktivita', en: 'Recent activity', de: 'Letzte Aktivität', pl: 'Ostatnia aktywność' })}
            </div>
            <div className="mt-4 grid gap-3">
              {activityLog.length ? activityLog.slice(0, 4).map((item) => (
                <div key={item.id} className="rounded-[20px] border border-slate-200/70 bg-slate-50/75 px-4 py-4">
                  <div className="text-sm font-semibold text-slate-950">{String(item.payload?.action_label || item.event_type)}</div>
                  <div className="mt-2 text-xs leading-5 text-slate-500">{String(item.payload?.job_title || item.payload?.candidate_name || '')}</div>
                  <div className="mt-3 text-[11px] text-slate-400">{formatDate(item.created_at)}</div>
                </div>
              )) : (
                <CompanyMapEmptyState message={text({ cs: 'Zatím tu není žádná nová operační aktivita.', sk: 'Zatiaľ tu nie je žiadna nová operačná aktivita.', en: 'No recent operational activity yet.', de: 'Noch keine neue operative Aktivität.', pl: 'Brak nowych aktywności operacyjnych.' })} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface WaveClusterPanelProps {
  locale?: string;
  jobs: Job[];
  selectedJobId?: string | null;
  jobStats: Record<string, { views: number; applicants: number }>;
  assessmentCount: number;
  dialoguesLoading: boolean;
  dialogues: CompanyApplicationRow[];
  dialoguesUpdating: Record<string, boolean>;
  selectedDialogueId?: string | null;
  labelStatus: (status: string) => string;
  onCreateNewChallenge: () => void;
  onCreateMiniChallenge: () => void;
  onOpenWave: (waveId: string) => void;
  onOpenEditor: (waveId: string) => void;
  onCloseWave: (waveId: string) => void | Promise<void>;
  onReopenWave: (waveId: string) => void | Promise<void>;
  onArchiveWave: (waveId: string) => void | Promise<void>;
  onCreateAssessment: (waveId: string) => void;
  onOpenDialogue: (dialogueId: string, waveId?: string | null) => void | Promise<void>;
  onDialogueStatusChange: (dialogueId: string, status: CompanyApplicationRow['status']) => void | Promise<void>;
}

export const CompanyWaveClusterPanel: React.FC<WaveClusterPanelProps> = ({
  locale: localeInput,
  jobs,
  selectedJobId,
  jobStats,
  assessmentCount,
  dialoguesLoading,
  dialogues,
  dialoguesUpdating,
  selectedDialogueId,
  labelStatus,
  onCreateNewChallenge,
  onCreateMiniChallenge,
  onOpenWave,
  onOpenEditor,
  onCloseWave,
  onReopenWave,
  onArchiveWave,
  onCreateAssessment,
  onOpenDialogue,
  onDialogueStatusChange,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  return (
    <div className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
      <div className="space-y-3">
        <div className="rounded-[24px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
                {text({ cs: 'Hiring modul', sk: 'Hiring modul', en: 'Hiring module', de: 'Hiring-Modul', pl: 'Moduł hiringowy' })}
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-950">
                {text({
                  cs: 'Výzvy a navázané dialogy v jednom prostoru',
                  sk: 'Výzvy a naviazané dialógy v jednom priestore',
                  en: 'Challenges and linked dialogues in one space',
                  de: 'Challenges und verknüpfte Dialoge in einem Raum',
                  pl: 'Wyzwania i powiązane dialogi w jednej przestrzeni',
                })}
              </div>
            </div>
            <button type="button" onClick={onCreateNewChallenge} className="rounded-full border border-cyan-200 bg-white px-4 py-2 text-xs font-semibold text-cyan-900">
              {text({ cs: 'Založit novou výzvu', sk: 'Založiť novú výzvu', en: 'Create new challenge', de: 'Neue Challenge erstellen', pl: 'Utwórz nowe wyzwanie' })}
            </button>
            <button type="button" onClick={onCreateMiniChallenge} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900">
              {text({ cs: 'Založit mini výzvu', sk: 'Založiť mini výzvu', en: 'Create mini challenge', de: 'Mini-Challenge erstellen', pl: 'Utwórz mini wyzwanie' })}
            </button>
          </div>
        </div>

        {jobs.map((job) => {
          const jobStatus = String((job as any).status || 'active');
          return (
            <div key={job.id} className={`rounded-[24px] border px-4 py-4 shadow-sm ${String(job.id) === String(selectedJobId) ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200/90 bg-white/95'}`}>
              <button type="button" onClick={() => onOpenWave(String(job.id))} className="w-full text-left">
                <div className="text-sm font-semibold text-slate-950">{job.title}</div>
                <div className="mt-1 text-xs text-slate-500">{job.location}</div>
                <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{labelStatus(jobStatus)}</div>
              </button>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpenEditor(String(job.id))} className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                  {text({ cs: 'Upravit', sk: 'Upraviť', en: 'Edit', de: 'Bearbeiten', pl: 'Edytuj' })}
                </button>
                {jobStatus === 'active' ? (
                  <button type="button" onClick={() => void onCloseWave(String(job.id))} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800">
                    {text({ cs: 'Uzavřít', sk: 'Uzavrieť', en: 'Close', de: 'Schließen', pl: 'Zamknij' })}
                  </button>
                ) : (
                  <button type="button" onClick={() => void onReopenWave(String(job.id))} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800">
                    {text({ cs: 'Znovu otevřít', sk: 'Znovu otvoriť', en: 'Reopen', de: 'Wieder öffnen', pl: 'Otwórz ponownie' })}
                  </button>
                )}
                <button type="button" onClick={() => onCreateAssessment(String(job.id))} className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[11px] font-semibold text-cyan-900">
                  {text({ cs: 'Assessment', sk: 'Assessment', en: 'Assessment', de: 'Assessment', pl: 'Assessment' })}
                </button>
                <button type="button" onClick={() => void onArchiveWave(String(job.id))} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700">
                  {text({ cs: 'Archivovat', sk: 'Archivovať', en: 'Archive', de: 'Archivieren', pl: 'Archiwizuj' })}
                </button>
              </div>
            </div>
          );
        })}

        {!jobs.length ? (
          <div className="space-y-3">
            <CompanyMapEmptyState message={text({ cs: 'Zatím nemáte žádnou aktivní výzvu.', sk: 'Zatiaľ nemáte žiadnu aktívnu výzvu.', en: 'No active challenge yet.', de: 'Noch keine aktive Challenge.', pl: 'Brak aktywnego wyzwania.' })} />
            <button type="button" onClick={onCreateNewChallenge} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-900">
              {text({ cs: 'Založit první výzvu', sk: 'Založiť prvú výzvu', en: 'Create first challenge', de: 'Erste Challenge erstellen', pl: 'Utwórz pierwsze wyzwanie' })}
            </button>
            <button type="button" onClick={onCreateMiniChallenge} className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-900">
              {text({ cs: 'Založit mini výzvu', sk: 'Založiť mini výzvu', en: 'Create mini challenge', de: 'Mini-Challenge erstellen', pl: 'Utwórz mini wyzwanie' })}
            </button>
          </div>
        ) : null}
      </div>

      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          {[
            { label: text({ cs: 'Dialogy', sk: 'Dialógy', en: 'Dialogues', de: 'Dialoge', pl: 'Dialogi' }), value: dialogues.length, icon: MessageSquareText },
            { label: text({ cs: 'Zobrazení', sk: 'Zobrazenia', en: 'Views', de: 'Aufrufe', pl: 'Wyświetlenia' }), value: selectedJobId ? (jobStats[selectedJobId]?.views || 0) : 0, icon: Clock3 },
            { label: text({ cs: 'Uchazeči', sk: 'Uchádzači', en: 'Applicants', de: 'Bewerber', pl: 'Aplikujący' }), value: selectedJobId ? (jobStats[selectedJobId]?.applicants || 0) : 0, icon: Users },
            { label: text({ cs: 'Assessmenty', sk: 'Assessmenty', en: 'Assessments', de: 'Assessments', pl: 'Assessmenty' }), value: assessmentCount, icon: BrainCircuit },
          ].map((item) => (
            <CompanyMapStatCard key={item.label} label={item.label} value={item.value} icon={<item.icon size={12} />} />
          ))}
        </div>

        {dialoguesLoading ? <CompanyMapEmptyState message={text({ cs: 'Načítám dialogy v této výzvě...', sk: 'Načítavam dialógy v tejto výzve...', en: 'Loading dialogues for this challenge...', de: 'Dialoge für diese Challenge werden geladen...', pl: 'Ładuję dialogi dla tego wyzwania...' })} /> : null}

        {dialogues.length ? (
          <div className="grid gap-3">
            {dialogues.map((dialogue) => (
              <div key={dialogue.id} className={`rounded-[24px] border px-4 py-4 shadow-sm ${selectedDialogueId === dialogue.id ? 'border-cyan-300 bg-cyan-50/70' : 'border-slate-200/90 bg-white/95'}`}>
                <button type="button" onClick={() => void onOpenDialogue(dialogue.id, dialogue.job_id ? String(dialogue.job_id) : selectedJobId || null)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <CandidateAvatar name={dialogue.candidate_name} avatarUrl={dialogue.candidate_avatar_url || dialogue.candidateAvatarUrl || null} />
                      <div>
                        <div className="text-sm font-semibold text-slate-950">{dialogue.candidate_name || text({ cs: 'Kandidát', sk: 'Kandidát', en: 'Candidate', de: 'Kandidat', pl: 'Kandydat' })}</div>
                        <div className="mt-1 text-xs text-slate-500">{dialogue.job_title}</div>
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-slate-500">{labelStatus(dialogue.status)}</div>
                  </div>
                </button>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={Boolean(dialoguesUpdating[dialogue.id])} onClick={() => void onDialogueStatusChange(dialogue.id, 'shortlisted')} className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 disabled:opacity-60">
                    {text({ cs: 'Shortlist', sk: 'Shortlist', en: 'Shortlist', de: 'Shortlist', pl: 'Shortlista' })}
                  </button>
                  <button type="button" disabled={Boolean(dialoguesUpdating[dialogue.id])} onClick={() => void onDialogueStatusChange(dialogue.id, 'reviewed')} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-60">
                    {text({ cs: 'Prohlédnuto', sk: 'Prezreté', en: 'Reviewed', de: 'Geprüft', pl: 'Przejrzane' })}
                  </button>
                  <button type="button" disabled={Boolean(dialoguesUpdating[dialogue.id])} onClick={() => void onDialogueStatusChange(dialogue.id, 'rejected')} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700 disabled:opacity-60">
                    {text({ cs: 'Zamítnout', sk: 'Zamietnuť', en: 'Reject', de: 'Ablehnen', pl: 'Odrzuć' })}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !dialoguesLoading ? (
          <CompanyMapEmptyState message={text({ cs: 'V téhle výzvě zatím nikdo není. Otevři zadání nebo založ novou výzvu.', sk: 'V tejto výzve zatiaľ nikto nie je. Otvor zadanie alebo založ novú výzvu.', en: 'No one is in this challenge yet. Edit the brief or open a new challenge.', de: 'In dieser Challenge ist noch niemand. Bearbeiten Sie das Briefing oder eröffnen Sie eine neue Challenge.', pl: 'W tym wyzwaniu nie ma jeszcze nikogo. Edytuj brief albo utwórz nowe wyzwanie.' })} />
        ) : null}
      </div>
    </div>
  );
};

interface CandidatesPanelProps {
  locale?: string;
  benchmarkCards: BenchmarkCard[];
  benchmarkLabel: (metric: string) => string;
  isLoading: boolean;
  candidates: Candidate[];
  dialogues: CompanyApplicationRow[];
  onOpenHumanDetail: (dialogueId: string, waveId?: string | null) => void | Promise<void>;
  onOpenChallenges: () => void;
}

const riskBadgeClass = (risk: Candidate['flightRisk'] | undefined) => {
  if (risk === 'High') return 'border-rose-200 bg-rose-50 text-rose-700';
  if (risk === 'Medium') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
};

export const CompanyCandidatesSignalPanel: React.FC<CandidatesPanelProps> = ({
  locale: localeInput,
  benchmarkCards,
  benchmarkLabel,
  isLoading,
  candidates,
  dialogues,
  onOpenHumanDetail,
  onOpenChallenges,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        {benchmarkCards.map((item) => (
          <CompanyMapStatCard
            key={item.metric}
            label={benchmarkLabel(item.metric)}
            value={item.value ?? '-'}
            hint={`${text({ cs: 'Medián peerů', sk: 'Medián peerov', en: 'Peer median', de: 'Peer-Median', pl: 'Mediana peerów' })}: ${item.peer_value ?? '-'}`}
          />
        ))}
        {isLoading ? <CompanyMapEmptyState message={text({ cs: 'Načítám benchmarky...', sk: 'Načítavam benchmarky...', en: 'Loading benchmarks...', de: 'Benchmarks werden geladen...', pl: 'Ładuję benchmarki...' })} /> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Signál kandidátů', sk: 'Signál kandidátov', en: 'Candidate signal', de: 'Kandidatensignal', pl: 'Sygnał kandydatów' })}</div>
          <div className="mt-3 text-lg font-semibold text-slate-950">
            {text({ cs: 'Koho stojí za to otevřít hned teď', sk: 'Koho sa oplatí otvoriť práve teraz', en: 'Who is worth opening right now', de: 'Wen lohnt es sich jetzt zu öffnen', pl: 'Kogo warto otworzyć właśnie teraz' })}
          </div>
          <div className="mt-3 grid gap-3">
            <div className="rounded-[20px] border border-slate-200/70 bg-slate-50/75 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Users size={16} />
                {text({ cs: 'Kandidáti v dosahu firmy', sk: 'Kandidáti v dosahu firmy', en: 'Candidates currently in reach', de: 'Kandidaten in Reichweite', pl: 'Kandydaci w zasięgu firmy' })}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {text({
                  cs: 'Tohle má být rychlý operační pohled na talent pool, benchmarky a vstupy do detailu člověka.',
                  sk: 'Toto má byť rýchly operačný pohľad na talent pool, benchmarky a vstupy do detailu človeka.',
                  en: 'This is the quick operational view of the talent pool, benchmarks, and entry points into human detail.',
                  de: 'Dies ist der schnelle operative Blick auf Talentpool, Benchmarks und Einstiege do Human Detail.',
                  pl: 'To ma być szybki operacyjny widok na pulę talentów, benchmarki i wejścia do human detail.',
                })}
              </div>
            </div>
            <div className="rounded-[20px] border border-slate-200/70 bg-slate-50/75 px-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <MessageSquareText size={16} />
                {text({ cs: 'Dialogy napojené na kandidáty', sk: 'Dialógy napojené na kandidátov', en: 'Dialogues connected to candidates', de: 'Mit Kandidaten verknüpfte Dialoge', pl: 'Dialogi powiązane z kandydatami' })}
              </div>
              <div className="mt-2 text-sm leading-6 text-slate-600">
                {text({
                  cs: `${dialogues.length} dialogů je připravených otevřít detail člověka nebo navázat další krok.`,
                  sk: `${dialogues.length} dialógov je pripravených otvoriť detail človeka alebo nadviazať ďalší krok.`,
                  en: `${dialogues.length} dialogues are ready to open human detail or continue the next step.`,
                  de: `${dialogues.length} Dialoge sind bereit, Human Detail zu öffnen oder den nächsten Schritt fortzusetzen.`,
                  pl: `${dialogues.length} dialogów jest gotowych, aby otworzyć human detail lub navázat kolejny krok.`,
                })}
              </div>
            </div>
            <button type="button" onClick={onOpenChallenges} className="rounded-[20px] border border-cyan-200 bg-cyan-50/80 px-4 py-4 text-left transition hover:border-cyan-300">
              <div className="flex items-center gap-2 text-sm font-semibold text-cyan-900">
                <Briefcase size={16} />
                {text({ cs: 'Přejít do přehledu výzev', sk: 'Prejsť do prehľadu výziev', en: 'Open challenge overview', de: 'Challenge-Übersicht öffnen', pl: 'Otwórz przegląd wyzwań' })}
              </div>
              <div className="mt-2 text-sm leading-6 text-cyan-900/80">
                {text({
                  cs: 'Když kandidát ještě nemá otevřený detail, přehled výzev ukáže navázané dialogy a další operační kroky.',
                  sk: 'Keď kandidát ešte nemá otvorený detail, prehľad výziev ukáže nadväzné dialógy a ďalšie operačné kroky.',
                  en: 'If a candidate has no open detail yet, the challenge layer shows related dialogues and next operational steps.',
                  de: 'Wenn ein Kandidat noch kein offenes Detail hat, zeigt die Challenge-Ebene verknüpfte Dialoge und nächste operative kroky.',
                  pl: 'Jeśli kandydat nie ma jeszcze otwartego detailu, warstwa wyzwań pokaże powiązane dialogi i kolejne kroki operacyjne.',
                })}
              </div>
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {candidates.map((candidate) => {
            const linkedDialogue = dialogues.find((dialogue) => (
              String(dialogue.candidate_id) === String(candidate.id)
              || (dialogue.candidate_name && dialogue.candidate_name.trim().toLowerCase() === candidate.name.trim().toLowerCase())
            ));
            const candidateAvatar = linkedDialogue?.candidate_avatar_url || linkedDialogue?.candidateAvatarUrl || null;

            return (
              <div key={candidate.id} className="rounded-[24px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <CandidateAvatar name={candidate.name} avatarUrl={candidateAvatar} sizeClass="h-12 w-12" />
                    <div>
                      <div className="text-sm font-semibold text-slate-950">{candidate.name}</div>
                      <div className="mt-1 text-xs text-slate-500">{candidate.role || text({ cs: 'Bez role', sk: 'Bez roly', en: 'No role', de: 'Keine Rolle', pl: 'Bez roli' })}</div>
                    </div>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${riskBadgeClass(candidate.flightRisk)}`}>
                    {text({ cs: 'Riziko', sk: 'Riziko', en: 'Risk', de: 'Risiko', pl: 'Ryzyko' })}: {candidate.flightRisk}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      <UserRoundSearch size={12} />
                      {text({ cs: 'Seniorita', sk: 'Seniorita', en: 'Seniority', de: 'Seniorität', pl: 'Seniority' })}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {candidate.experienceYears
                        ? `${candidate.experienceYears} ${text({ cs: 'let praxe', sk: 'rokov praxe', en: 'years experience', de: 'Jahre Erfahrung', pl: 'lat doświadczenia' })}`
                        : text({ cs: 'Neuvedeno', sk: 'Neuvedené', en: 'Not specified', de: 'Nicht angegeben', pl: 'Nie podano' })}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                      <BadgeDollarSign size={12} />
                      {text({ cs: 'Mzda', sk: 'Mzda', en: 'Salary', de: 'Gehalt', pl: 'Pensja' })}
                    </div>
                    <div className="mt-2 text-sm font-semibold text-slate-950">
                      {candidate.salaryExpectation
                        ? `${candidate.salaryExpectation.toLocaleString(companyMapIntlLocale(locale))} CZK`
                        : text({ cs: 'Neuvedeno', sk: 'Neuvedené', en: 'Not specified', de: 'Nicht angegeben', pl: 'Nie podano' })}
                    </div>
                  </div>
                </div>

                {candidate.bio ? <div className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{candidate.bio}</div> : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {candidate.skills.slice(0, 5).map((skill) => <CompanyMapTag key={skill}>{skill}</CompanyMapTag>)}
                  {!candidate.skills.length ? <CompanyMapTag>{text({ cs: 'Bez skillů', sk: 'Bez skillov', en: 'No skills yet', de: 'Noch keine Skills', pl: 'Brak skilli' })}</CompanyMapTag> : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {candidate.values.slice(0, 3).map((value) => <CompanyMapTag key={value}>{value}</CompanyMapTag>)}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {linkedDialogue ? (
                    <button type="button" onClick={() => void onOpenHumanDetail(linkedDialogue.id, linkedDialogue.job_id ? String(linkedDialogue.job_id) : null)} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-900">
                      <Eye size={14} className="mr-2 inline-flex" />
                      {text({ cs: 'Otevřít detail člověka', sk: 'Otvoriť detail človeka', en: 'Open human detail', de: 'Human Detail öffnen', pl: 'Otwórz human detail' })}
                    </button>
                  ) : (
                    <button type="button" onClick={onOpenChallenges} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                      <ArrowRight size={14} className="mr-2 inline-flex" />
                      {text({ cs: 'Najít ve výzvách', sk: 'Nájsť vo výzvach', en: 'Find in challenges', de: 'In Challenges finden', pl: 'Znajdź w wyzwaniach' })}
                    </button>
                  )}
                  {linkedDialogue ? (
                    <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">
                      {linkedDialogue.job_title || text({ cs: 'Navázaný dialog', sk: 'Nadviazaný dialóg', en: 'Linked dialogue', de: 'Verknüpfter Dialog', pl: 'Powiązany dialog' })}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {!candidates.length ? <CompanyMapEmptyState message={text({ cs: 'Zatím tu nejsou žádní kandidáti.', sk: 'Zatiaľ tu nie sú žiadni kandidáti.', en: 'No candidates available yet.', de: 'Noch keine Kandidaten verfügbar.', pl: 'Brak kandydatów.' })} /> : null}
    </div>
  );
};

interface AssessmentsPanelProps {
  locale?: string;
  companyId: string;
  invitationsCount: number;
  auditCount: number;
  assessments: Assessment[];
  loading: boolean;
  busyId: string | null;
  showInvitationsList: boolean;
  showCreator: boolean;
  creator?: React.ReactNode;
  resultsList?: React.ReactNode;
  onToggleCreator: () => void;
  onSendInvitation: () => void;
  onDuplicateAssessment: (assessmentId: string) => void | Promise<void>;
  onArchiveAssessment: (assessmentId: string) => void | Promise<void>;
}

export const CompanyAssessmentOrbitPanel: React.FC<AssessmentsPanelProps> = ({
  locale: localeInput,
  companyId,
  invitationsCount,
  auditCount,
  assessments,
  loading,
  busyId,
  showInvitationsList,
  showCreator,
  creator,
  resultsList,
  onToggleCreator,
  onSendInvitation,
  onDuplicateAssessment,
  onArchiveAssessment,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onToggleCreator} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-900">
          {showCreator
            ? text({ cs: 'Skrýt creator', sk: 'Skryť creator', en: 'Hide creator', de: 'Creator ausblenden', pl: 'Ukryj creator' })
            : text({ cs: 'Otevřít creator', sk: 'Otvoriť creator', en: 'Open creator', de: 'Creator öffnen', pl: 'Otwórz creator' })}
        </button>
        <button type="button" onClick={onSendInvitation} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
          {text({ cs: 'Poslat pozvánku', sk: 'Poslať pozvánku', en: 'Send invitation', de: 'Einladung senden', pl: 'Wyślij zaproszenie' })}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <CompanyMapStatCard label={text({ cs: 'Knihovna', sk: 'Knižnica', en: 'Library', de: 'Bibliothek', pl: 'Biblioteka' })} value={assessments.length} />
        <CompanyMapStatCard label={text({ cs: 'Pozvánky', sk: 'Pozvánky', en: 'Invitations', de: 'Einladungen', pl: 'Zaproszenia' })} value={invitationsCount} />
        <CompanyMapStatCard label={text({ cs: 'Audit', sk: 'Audit', en: 'Audit', de: 'Audit', pl: 'Audyt' })} value={auditCount} />
      </div>

      {showInvitationsList ? (
        <div className="rounded-[20px] border border-emerald-200 bg-emerald-50/80 px-4 py-4 text-sm text-emerald-900">
          {text({ cs: 'Poslední pozvánka byla úspěšně odeslána.', sk: 'Posledná pozvánka bola úspešne odoslaná.', en: 'The latest invitation was sent successfully.', de: 'Die letzte Einladung wurde erfolgreich gesendet.', pl: 'Ostatnie zaproszenie zostało wysłane pomyślnie.' })}
        </div>
      ) : null}
      {creator}
      {loading ? <CompanyMapEmptyState message={text({ cs: 'Načítám assessment knihovnu...', sk: 'Načítavam assessment knižnicu...', en: 'Loading assessment library...', de: 'Assessment-Bibliothek wird geladen...', pl: 'Ładuję bibliotekę assessmentów...' })} /> : null}

      {companyId && resultsList ? (
        <div className="rounded-[24px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
          <div className="mb-4 text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {text({ cs: 'Výsledky a odevzdané screeningy', sk: 'Výsledky a odovzdané screeningy', en: 'Results and completed screenings', de: 'Ergebnisse und abgeschlossene Screenings', pl: 'Wyniki i ukończone screeningi' })}
          </div>
          {resultsList}
        </div>
      ) : null}

      {assessments.length ? (
        <div className="grid gap-4 lg:grid-cols-3">
          {assessments.map((assessment) => (
            <div key={assessment.id} className="rounded-[24px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
              <div className="text-sm font-semibold text-slate-950">{assessment.title}</div>
              <div className="mt-1 text-xs text-slate-500">{assessment.role} / {(assessment.questions || []).length}</div>
              <div className="mt-4 flex gap-2">
                <button type="button" disabled={busyId === assessment.id} onClick={() => void onDuplicateAssessment(assessment.id)} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60">
                  {text({ cs: 'Duplikovat', sk: 'Duplikovať', en: 'Duplicate', de: 'Duplizieren', pl: 'Duplikuj' })}
                </button>
                <button type="button" disabled={busyId === assessment.id} onClick={() => void onArchiveAssessment(assessment.id)} className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60">
                  {text({ cs: 'Archivovat', sk: 'Archivovať', en: 'Archive', de: 'Archivieren', pl: 'Archiwizuj' })}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : !loading ? (
        <CompanyMapEmptyState message={text({ cs: 'Assessment knihovna je zatím prázdná. Otevři creator a založ první screening.', sk: 'Assessment knižnica je zatiaľ prázdna. Otvor creator a založ prvý screening.', en: 'The assessment library is empty for now. Open the creator and build the first screening.', de: 'Die Assessment-Bibliothek ist aktuell leer. Öffnen Sie den Creator und erstellen Sie das erste Screening.', pl: 'Biblioteka assessmentów jest na razie pusta. Otwórz creator i zbuduj pierwszy screening.' })} />
      ) : null}
    </div>
  );
};

interface LearningPanelProps {
  locale?: string;
}

export const CompanyLearningPanel: React.FC<LearningPanelProps> = ({ locale: localeInput }) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {[
        text({ cs: 'Popis role má být konkrétní, lidský a pravdivý.', sk: 'Popis roly má byť konkrétny, ľudský a pravdivý.', en: 'Role copy should be concrete, human, and honest.', de: 'Der Rollentext sollte konkret, menschlich und ehrlich sein.', pl: 'Opis roli powinien być konkretny, ludzki i prawdziwy.' }),
        text({ cs: 'Každá výzva potřebuje jasný první krok a skutečný truth signal.', sk: 'Každá výzva potrebuje jasný prvý krok a skutočný truth signal.', en: 'Every challenge needs a clear first step and a real truth signal.', de: 'Jede Challenge braucht einen klaren ersten Schritt und ein echtes Truth Signal.', pl: 'Każde wyzwanie potrzebuje jasnego pierwszego kroku i prawdziwego truth signal.' }),
        text({ cs: 'Assessment používej tam, kde opravdu zkracuje rozhodování.', sk: 'Assessment používaj tam, kde naozaj skracuje rozhodovanie.', en: 'Use assessment where it truly shortens decision-making.', de: 'Nutzen Sie Assessments dort, wo sie Entscheidungen wirklich verkürzen.', pl: 'Używaj assessmentu tam, gdzie naprawdę skraca podejmowanie decyzji.' }),
      ].map((item) => (
        <div key={item} className="rounded-[24px] border border-slate-200/90 bg-white/95 px-5 py-5 text-sm leading-7 text-slate-700 shadow-sm">{item}</div>
      ))}
    </div>
  );
};
