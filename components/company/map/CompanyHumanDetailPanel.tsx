import React from 'react';

import type { DialogueDossier } from '../../../types';
import { companyMapText, resolveCompanyMapLocale } from '../companyMapLocale';
import { CompanyMapEmptyState, CompanyMapStatCard, CompanyMapTag } from './CompanyMapPrimitives';

interface CompanyHumanDetailPanelProps {
  dossier: DialogueDossier | null;
  dialogueOptions?: Array<{
    id: string;
    candidateName: string;
    jobTitle?: string | null;
    status: string;
    avatarUrl?: string | null;
  }>;
  locale?: string;
  formatDate: (value: string | null | undefined) => string;
  labelStatus: (status: string) => string;
  onCreateAssessment: () => void;
  onInviteAssessment: () => void;
  onOpenDialogue?: (dialogueId: string) => void;
}

const formatLayerValue = (value: unknown): string => {
  if (typeof value === 'number') return String(Math.round(value));
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const score = (value as any).score ?? (value as any).value ?? (value as any).percentile;
    if (typeof score === 'number') return String(Math.round(score));
  }
  return '-';
};

const initialsFromName = (value: string | null | undefined): string => {
  const parts = String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || 'C';
};

const CompanyHumanDetailPanel: React.FC<CompanyHumanDetailPanelProps> = ({
  dossier,
  dialogueOptions = [],
  locale: localeInput,
  formatDate,
  labelStatus,
  onCreateAssessment,
  onInviteAssessment,
  onOpenDialogue,
}) => {
  const locale = resolveCompanyMapLocale(localeInput);
  const text = (variants: Parameters<typeof companyMapText>[1]) => companyMapText(locale, variants);

  if (!dossier) {
    if (!dialogueOptions.length) {
      return (
        <CompanyMapEmptyState
          message={text({
            cs: 'Vyber dialog a otevři lidský detail.',
            sk: 'Vyber dialóg a otvor ľudský detail.',
            en: 'Select a dialogue to open human detail.',
            de: 'Wählen Sie einen Dialog, um den Human Detail zu öffnen.',
            pl: 'Wybierz dialog, aby otworzyć human detail.',
          })}
        />
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-[26px] border border-slate-200/80 bg-white/84 px-5 py-5">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {text({
              cs: 'Vrstva Human Detail',
              sk: 'Vrstva Human Detail',
              en: 'Human detail layer',
              de: 'Ebene Human Detail',
              pl: 'Warstwa Human Detail',
            })}
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-950">
            {text({
              cs: 'Vyber člověka pro detail',
              sk: 'Vyber človeka pre detail',
              en: 'Choose a person for detail',
              de: 'Person für den Detailblick auswählen',
              pl: 'Wybierz osobę do szczegółu',
            })}
          </div>
          <div className="mt-2 text-sm leading-7 text-slate-600">
            {text({
              cs: 'Tahle vrstva otevře plný dossier konkrétního člověka. Zatím zvol jednoho z aktivních dialogů.',
              sk: 'Táto vrstva otvorí plný dossier konkrétneho človeka. Zatiaľ vyber jedného z aktívnych dialógov.',
              en: 'This layer opens the full dossier for a specific person. Pick one of the active dialogues to continue.',
              de: 'Diese Ebene öffnet das vollständige Dossier einer konkreten Person. Wählen Sie zunächst einen der aktiven Dialoge.',
              pl: 'Ta warstwa otwiera pełne dossier konkretnej osoby. Najpierw wybierz jeden z aktywnych dialogów.',
            })}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {dialogueOptions.map((dialogue) => (
            <button
              key={dialogue.id}
              type="button"
              onClick={() => onOpenDialogue?.(dialogue.id)}
              className="rounded-[24px] border border-slate-200/80 bg-white/82 px-5 py-5 text-left transition hover:border-cyan-300 hover:bg-cyan-50/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {dialogue.avatarUrl ? (
                    <img
                      src={dialogue.avatarUrl}
                      alt={dialogue.candidateName}
                      className="h-11 w-11 rounded-full border border-slate-200/80 object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/80 bg-slate-100 text-xs font-semibold text-slate-700 shadow-sm">
                      {initialsFromName(dialogue.candidateName)}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-950">{dialogue.candidateName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {dialogue.jobTitle || text({
                        cs: 'Bez role',
                        sk: 'Bez roly',
                        en: 'No role',
                        de: 'Keine Rolle',
                        pl: 'Bez roli',
                      })}
                    </div>
                  </div>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-700">
                  {labelStatus(dialogue.status)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const candidateName = dossier.candidate_profile_snapshot?.name || dossier.candidate_name || text({
    cs: 'Kandidát',
    sk: 'Kandidát',
    en: 'Candidate',
    de: 'Kandidat',
    pl: 'Kandydat',
  });
  const candidateEmail = dossier.candidate_profile_snapshot?.email || dossier.candidate_email || '';
  const skills = dossier.candidate_profile_snapshot?.skills || [];
  const values = dossier.candidate_profile_snapshot?.values || [];
  const fitLayers = Object.entries(dossier.fit_evidence?.layers || {}).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[26px] border border-slate-200/80 bg-white/84 px-5 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {dossier.job_title || text({
                  cs: 'Dialog',
                  sk: 'Dialóg',
                  en: 'Dialogue',
                  de: 'Dialog',
                  pl: 'Dialog',
                })}
              </div>
              <div className="mt-2 text-2xl font-semibold text-slate-950">{candidateName}</div>
              <div className="mt-2 text-sm text-slate-600">
                {candidateEmail || text({
                  cs: 'Bez e-mailu',
                  sk: 'Bez e-mailu',
                  en: 'No email',
                  de: 'Keine E-Mail',
                  pl: 'Brak e-maila',
                })}
              </div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
              {labelStatus(dossier.status)}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <CompanyMapStatCard
              label={text({ cs: 'Otevřeno', sk: 'Otvorené', en: 'Opened', de: 'Geöffnet', pl: 'Otwarte' })}
              value={formatDate(dossier.submitted_at || dossier.updated_at)}
            />
            <CompanyMapStatCard
              label={text({ cs: 'Deadline', sk: 'Deadline', en: 'Deadline', de: 'Frist', pl: 'Termin' })}
              value={formatDate(dossier.dialogue_deadline_at)}
            />
            <CompanyMapStatCard
              label={text({ cs: 'Zdroj', sk: 'Zdroj', en: 'Source', de: 'Quelle', pl: 'Źródło' })}
              value={dossier.source || '-'}
            />
          </div>

          {dossier.cover_letter ? (
            <div className="mt-5 rounded-[22px] border border-slate-200/80 bg-slate-50/70 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {text({
                  cs: 'Motivační dopis',
                  sk: 'Motivačný list',
                  en: 'Cover letter',
                  de: 'Anschreiben',
                  pl: 'List motywacyjny',
                })}
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{dossier.cover_letter}</div>
            </div>
          ) : null}

          {dossier.ai_summary?.summary ? (
            <div className="mt-5 rounded-[22px] border border-cyan-100/90 bg-cyan-50/70 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
                {text({
                  cs: 'AI shrnutí',
                  sk: 'AI zhrnutie',
                  en: 'AI summary',
                  de: 'KI-Zusammenfassung',
                  pl: 'Podsumowanie AI',
                })}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">{dossier.ai_summary.summary}</div>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={onCreateAssessment} className="rounded-full border border-cyan-200 bg-cyan-50 px-4 py-2 text-xs font-semibold text-cyan-900">
              {text({
                cs: 'Vytvořit assessment',
                sk: 'Vytvoriť assessment',
                en: 'Create assessment',
                de: 'Assessment erstellen',
                pl: 'Utwórz assessment',
              })}
            </button>
            <button type="button" onClick={onInviteAssessment} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
              {text({
                cs: 'Poslat pozvánku',
                sk: 'Poslať pozvánku',
                en: 'Send invitation',
                de: 'Einladung senden',
                pl: 'Wyślij zaproszenie',
              })}
            </button>
            {dossier.cv_snapshot?.fileUrl ? (
              <a href={dossier.cv_snapshot.fileUrl} target="_blank" rel="noreferrer" className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                {text({
                  cs: 'Otevřít CV',
                  sk: 'Otvoriť CV',
                  en: 'Open CV',
                  de: 'CV öffnen',
                  pl: 'Otwórz CV',
                })}
              </a>
            ) : null}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[26px] border border-slate-200/80 bg-white/84 px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Dovednosti', sk: 'Zručnosti', en: 'Skills', de: 'Skills', pl: 'Umiejętności' })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.length ? skills.map((skill) => <CompanyMapTag key={skill}>{skill}</CompanyMapTag>) : (
                <span className="text-sm text-slate-500">
                  {text({ cs: 'Bez dovedností', sk: 'Bez zručností', en: 'No skills', de: 'Keine Skills', pl: 'Brak umiejętności' })}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/80 bg-white/84 px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Hodnoty', sk: 'Hodnoty', en: 'Values', de: 'Werte', pl: 'Wartości' })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {values.length ? values.map((value) => <CompanyMapTag key={value}>{value}</CompanyMapTag>) : (
                <span className="text-sm text-slate-500">
                  {text({ cs: 'Bez hodnot', sk: 'Bez hodnôt', en: 'No values', de: 'Keine Werte', pl: 'Brak wartości' })}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/80 bg-white/84 px-5 py-5">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({
                cs: 'Fit vrstvy',
                sk: 'Fit vrstvy',
                en: 'Fit layers',
                de: 'Fit-Ebenen',
                pl: 'Warstwy fitu',
              })}
            </div>
            <div className="mt-4 grid gap-2">
              {fitLayers.length ? fitLayers.map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-[16px] border border-slate-200/70 bg-slate-50/70 px-3 py-2 text-sm text-slate-700">
                  <span>{key.replaceAll('_', ' ')}</span>
                  <span className="font-semibold text-slate-950">{formatLayerValue(value)}</span>
                </div>
              )) : (
                <span className="text-sm text-slate-500">
                  {text({
                    cs: 'Fit evidence zatím chybí.',
                    sk: 'Fit evidence zatiaľ chýba.',
                    en: 'Fit evidence not available yet.',
                    de: 'Fit-Evidence ist noch nicht verfügbar.',
                    pl: 'Brakuje jeszcze fit evidence.',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyHumanDetailPanel;
