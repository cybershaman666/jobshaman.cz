import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquareText, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CandidateDialogueCapacity, DialogueDetail, Job, UserProfile } from '../../types';
import {
  fetchMyDialogueDetail,
  fetchMyDialogueCapacity,
  fetchMyDialogueMessages,
  fetchMyDialogues,
  openDialogue,
  sendMyDialogueMessage
} from '../../services/jobApplicationService';
import ApplicationMessageCenter from '../ApplicationMessageCenter';

interface ChallengeComposerProps {
  job: Job;
  userProfile: UserProfile;
  onRequireAuth: () => void;
  onOpenSupportingContext: () => void;
}

const normalizeJobId = (jobId: string | number): string => {
  const raw = String(jobId || '').trim();
  return raw.startsWith('db-') ? raw.slice(3) : raw;
};

const ChallengeComposer: React.FC<ChallengeComposerProps> = ({
  job,
  userProfile,
  onRequireAuth,
  onOpenSupportingContext
}) => {
  const { i18n } = useTranslation();
  const storageKey = useMemo(() => `jobshaman_challenge_draft:${normalizeJobId(job.id)}`, [job.id]);
  const [draft, setDraft] = useState('');
  const [supportingNote, setSupportingNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const [dialogue, setDialogue] = useState<DialogueDetail | null>(null);
  const [dialogueCapacity, setDialogueCapacity] = useState<CandidateDialogueCapacity | null>(null);
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const isCsLike = locale === 'cs' || locale === 'sk';
  const copy = isCsLike
    ? {
        loading: 'Načítám challenge diskusi…',
        discussion: 'Challenge diskuse',
        empty: 'Zatím bez odpovědi. První reakce firmy se objeví tady.',
        replyPlaceholder: 'Napiš odpověď…',
        reply: 'Odpovědět',
        firstResponse: 'První odpověď',
        intro: 'Buď konkrétní. Ukaž první krok, co bys ověřil(a) a jak bys testoval(a) svoji hypotézu.',
        draftPlaceholder: 'Napiš svůj přístup…',
        supportTitle: 'Podpůrný kontext',
        supportBody: 'CV, profil a delší poznámka jsou volitelné. Hlavní signál je tvoje odpověď výše.',
        addContext: 'Přidat kontext',
        supportPlaceholder: 'Volitelná doplňující poznámka',
        footer: 'Text-first, soukromé, bez zbytečného tlaku',
        openDialogue: 'Otevřít dialog',
        createAccount: 'Vytvořit účet a odpovědět',
        slotsTitle: 'Aktivní dialogové sloty',
        slotsHint: 'Každá odpověď otevírá omezený počet aktivních dialogů, aby obě strany držely tempo a pozornost.',
        slotsValue: 'Zbývá {{remaining}} z {{limit}}',
        slotsLoading: 'Načítám tvoji kapacitu'
      }
    : {
        loading: 'Loading challenge discussion…',
        discussion: 'Challenge discussion',
        empty: 'No replies yet. The first company response will appear here.',
        replyPlaceholder: 'Write reply…',
        reply: 'Reply',
        firstResponse: 'First response',
        intro: 'Keep it concise. Show the first step you would take, what you would check, and how you would test your assumption.',
        draftPlaceholder: 'Write your approach…',
        supportTitle: 'Supporting context',
        supportBody: 'CV, profile details, and a richer supporting note stay optional. Your main signal is the response above.',
        addContext: 'Add context',
        supportPlaceholder: 'Optional note for additional context',
        footer: 'Text-first, private, low-pressure',
        openDialogue: 'Open dialogue',
        createAccount: 'Create account to respond',
        slotsTitle: 'Active dialogue slots',
        slotsHint: 'Each reply opens a limited number of active dialogues so both sides keep pace and attention.',
        slotsValue: '{{remaining}} left out of {{limit}}',
        slotsLoading: 'Loading your capacity'
      };

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      setDraft(stored);
    } else {
      setDraft('');
    }
    setSupportingNote('');
    setDialogue(null);
  }, [storageKey]);

  useEffect(() => {
    let cancelled = false;

    const resolveExistingDialogue = async () => {
      if (!userProfile.isLoggedIn || !userProfile.id) return;
      setThreadLoading(true);
      try {
        const rows = await fetchMyDialogues(80);
        if (cancelled) return;
        const target = rows.find((row) => normalizeJobId(row.job_id || '') === normalizeJobId(job.id));
        if (!target?.id) return;
        const detail = await fetchMyDialogueDetail(target.id);
        if (!cancelled && detail) {
          setDialogue(detail);
        }
      } finally {
        if (!cancelled) {
          setThreadLoading(false);
        }
      }
    };

    void resolveExistingDialogue();
    return () => {
      cancelled = true;
    };
  }, [job.id, userProfile.id, userProfile.isLoggedIn]);

  useEffect(() => {
    let cancelled = false;

    const loadCapacity = async () => {
      if (!userProfile.isLoggedIn || !userProfile.id) {
        setDialogueCapacity(null);
        return;
      }
      const capacity = await fetchMyDialogueCapacity();
      if (!cancelled) {
        setDialogueCapacity(capacity);
      }
    };

    void loadCapacity();
    return () => {
      cancelled = true;
    };
  }, [userProfile.id, userProfile.isLoggedIn]);

  useEffect(() => {
    if (!draft.trim()) {
      window.localStorage.removeItem(storageKey);
      return;
    }
    window.localStorage.setItem(storageKey, draft);
  }, [draft, storageKey]);

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    if (!userProfile.isLoggedIn) {
      window.localStorage.setItem(storageKey, draft);
      onRequireAuth();
      return;
    }

    setSubmitting(true);
    try {
      const result = await openDialogue(
        job.id,
        'challenge_focus',
        {
          job_title: job.title,
          job_company: job.company,
          job_location: job.location,
          first_step_prompt: job.firstStepPrompt,
          challenge: job.challenge,
          risk: job.risk,
          supporting_note: supportingNote || null
        },
        {
          coverLetter: draft.trim(),
          candidateProfileSnapshot: {
            name: userProfile.name,
            email: userProfile.email,
            phone: userProfile.phone,
            jobTitle: userProfile.jobTitle,
            skills: Array.isArray(userProfile.skills) ? userProfile.skills.slice(0, 12) : [],
            values: Array.isArray(userProfile.values) ? userProfile.values.slice(0, 8) : [],
            preferredCountryCode: userProfile.preferredCountryCode
          }
        }
      );

      const dialogueId = result?.dialogue_id || result?.dialogue?.id;
      if (!dialogueId) {
        return;
      }

      const detail = await fetchMyDialogueDetail(dialogueId);
      if (detail) {
        setDialogue(detail);
        setDialogueCapacity(result?.candidate_capacity || dialogueCapacity);
        setDraft('');
        setSupportingNote('');
        window.localStorage.removeItem(storageKey);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (threadLoading) {
    return (
      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[#111827] dark:text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 size={18} className="animate-spin text-amber-300" />
          {copy.loading}
        </div>
      </div>
    );
  }

  if (dialogue) {
    return (
      <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[#111827] dark:text-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{copy.discussion}</div>
            <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{job.title}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{job.company}</div>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
            {dialogue.status}
          </span>
        </div>

        <div className="mt-5">
          <ApplicationMessageCenter
            dialogueId={dialogue.id}
            heading=""
            subtitle=""
            viewerRole="candidate"
            dialogueStatus={dialogue.status}
            dialogueDeadlineAt={dialogue.dialogue_deadline_at || null}
            dialogueTimeoutHours={dialogue.dialogue_timeout_hours ?? null}
            dialogueCurrentTurn={dialogue.dialogue_current_turn || null}
            dialogueClosedReason={dialogue.dialogue_closed_reason || null}
            dialogueIsOverdue={Boolean(dialogue.dialogue_is_overdue)}
            emptyText={copy.empty}
            composerPlaceholder={copy.replyPlaceholder}
            sendButtonLabel={copy.reply}
            fetchMessages={fetchMyDialogueMessages}
            sendMessage={sendMyDialogueMessage}
            visualVariant="immersive"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[1.6rem] border border-slate-200 bg-white p-5 text-slate-900 shadow-[0_20px_60px_-48px_rgba(15,23,42,0.45)] dark:border-slate-800 dark:bg-[#111827] dark:text-slate-100">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        <MessageSquareText size={14} className="text-amber-300" />
        {copy.firstResponse}
      </div>
      <h3 className="mt-3 text-2xl font-semibold text-slate-950 dark:text-white">{job.firstStepPrompt}</h3>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
        {copy.intro}
      </p>

      <div className="mt-5 space-y-4">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={copy.draftPlaceholder}
          className="min-h-[220px] w-full rounded-[1.35rem] border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400/40 dark:border-slate-700 dark:bg-slate-950/60 dark:text-slate-100 dark:placeholder:text-slate-500"
        />

        <div className="rounded-[1.2rem] border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-950 dark:text-white">{copy.supportTitle}</div>
              <div className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {copy.supportBody}
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenSupportingContext}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-amber-400/40 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white"
            >
              <Paperclip size={12} />
              {copy.addContext}
            </button>
          </div>

          <textarea
            value={supportingNote}
            onChange={(event) => setSupportingNote(event.target.value)}
            placeholder={copy.supportPlaceholder}
            className="mt-4 min-h-[96px] w-full rounded-[1rem] border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-amber-400/40 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-200">
              <ShieldCheck size={12} />
              {copy.footer}
            </div>
            {userProfile.isLoggedIn ? (
              <div className="rounded-[0.95rem] border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-300">
                <div className="font-semibold text-slate-900 dark:text-white">{copy.slotsTitle}</div>
                <div className="mt-1">{copy.slotsHint}</div>
                <div className="mt-1.5 font-semibold text-[var(--accent)]">
                  {dialogueCapacity
                    ? copy.slotsValue
                      .replace('{{remaining}}', String(dialogueCapacity.remaining))
                      .replace('{{limit}}', String(dialogueCapacity.limit))
                    : copy.slotsLoading}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
            className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {userProfile.isLoggedIn ? copy.openDialogue : copy.createAccount}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeComposer;
