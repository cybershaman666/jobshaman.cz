import React, { useEffect, useMemo, useState } from 'react';
import { Handshake, Loader2, Orbit, Paperclip, Send, ShieldCheck, Sparkles } from 'lucide-react';
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

const getSnapshotAvatarUrl = (value?: string | null): string | undefined => {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:')) return undefined;
  return raw.length <= 500 ? raw : undefined;
};

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
  const copy = locale === 'cs'
    ? {
        loading: 'Načítám challenge diskusi…',
        discussion: 'Challenge diskuse',
        empty: 'Zatím ticho. Jakmile se firma ozve, spadne to sem.',
        replyPlaceholder: 'Napiš odpověď…',
        reply: 'Odpovědět',
        firstResponse: 'První odpověď',
        intro: 'Bez omáčky. Řekni první krok, co si ověříš a jak poznáš, že nejdeš mimo.',
        draftPlaceholder: 'Napiš, jak bys do toho říznul(a)…',
        supportTitle: 'Když chceš přidat kontext navíc',
        supportBody: 'CV, profil a delší poznámka jsou jen bonus. Hlavní signál je to, jak přemýšlíš nahoře.',
        addContext: 'Přihodit kontext',
        supportPlaceholder: 'Volitelná doplňující poznámka',
        footer: 'Méně řečí. První krok.',
        openDialogue: 'Otevřít dialog',
        createAccount: 'Vytvořit účet a odpovědět',
        slotsTitle: 'Aktivní dialogové sloty',
        slotsHint: 'Neotevíráme deset vláken naráz. Jen tolik, kolik má šanci držet tempo a smysl.',
        slotsValue: 'Zbývá {{remaining}} z {{limit}}',
        slotsLoading: 'Zjišťuju, kolik dialogů ještě utáhneš',
        starterTitle: 'Když se nechceš zaseknout na první větě',
        starterOne: 'Krátce se představím a rovnou pojmenuju první check, kterým bych si ověřil zadání.',
        starterTwo: 'Začal(a) bych tím, že vytáhnu hlavní riziko a navrhnu první rychlý test.',
        starterThree: 'Šel(a) bych na to prakticky: kontext, první mini návrh, rychlá zpětná vazba.',
        laneTitle: 'Digitální handshake',
        laneBody: 'Nejde o perfektní dopis. Jde o to, jestli umíš přemýšlet, mluvit k věci a udělat první chytrý tah.',
        missionTitle: 'Co sem poslat',
        missionBody: 'Kdo jsi, co bys řešil(a) jako první a jak bys to rozjel(a) bez keců okolo.',
        submitLabel: 'Poslat handshake',
      }
    : locale === 'sk'
      ? {
        loading: 'Načítavam challenge diskusiu…',
        discussion: 'Challenge diskusia',
        empty: 'Zatiaľ ticho. Keď sa firma ozve, padne to sem.',
        replyPlaceholder: 'Napíš odpoveď…',
        reply: 'Odpovedať',
        firstResponse: 'Prvá odpoveď',
        intro: 'Bez omáčky. Povedz prvý krok, čo si overíš a ako zistíš, že nejdeš mimo.',
        draftPlaceholder: 'Napíš, ako by si do toho rezol(a)…',
        supportTitle: 'Keď chceš pridať kontext navyše',
        supportBody: 'CV, profil a dlhšia poznámka sú len bonus. Hlavný signál je to, ako premýšľaš vyššie.',
        addContext: 'Prihodiť kontext',
        supportPlaceholder: 'Voliteľná doplňujúca poznámka',
        footer: 'Menej rečí. Prvý krok.',
        openDialogue: 'Otvoriť dialóg',
        createAccount: 'Vytvoriť účet a odpovedať',
        slotsTitle: 'Aktívne dialógové sloty',
        slotsHint: 'Neotvárame desať vlákien naraz. Len toľko, koľko má šancu držať tempo a zmysel.',
        slotsValue: 'Zostáva {{remaining}} z {{limit}}',
        slotsLoading: 'Pozerám, koľko dialógov ešte utiahneš',
        starterTitle: 'Keď sa nechceš zaseknúť na prvej vete',
        starterOne: 'Stručne sa predstavím a rovno pomenujem prvý check, ktorým by som si overil zadanie.',
        starterTwo: 'Začal(a) by som tým, že vytiahnem hlavné riziko a navrhnem prvý rýchly test.',
        starterThree: 'Šiel(a) by som na to prakticky: kontext, prvý mini návrh, rýchla spätná väzba.',
        laneTitle: 'Digitálny handshake',
        laneBody: 'Nejde o perfektný list. Ide o to, či vieš premýšľať, hovoriť k veci a spraviť prvý chytrý ťah.',
        missionTitle: 'Čo sem poslať',
        missionBody: 'Kto si, čo by si riešil(a) ako prvé a ako by si to rozbehol(a) bez kecov okolo.',
        submitLabel: 'Poslať handshake',
      }
    : locale === 'de'
      ? {
        loading: 'Challenge-Diskussion wird geladen…',
        discussion: 'Challenge-Diskussion',
        empty: 'Noch keine Antwort. Die erste Reaktion des Teams erscheint hier.',
        replyPlaceholder: 'Antwort schreiben…',
        reply: 'Antworten',
        firstResponse: 'Erste Antwort',
        intro: 'Sei konkret. Zeig den ersten Schritt, was du prüfen würdest und wie du deine Hypothese testen würdest.',
        draftPlaceholder: 'Schreibe deinen Ansatz…',
        supportTitle: 'Zusätzlicher Kontext',
        supportBody: 'CV, Profil und längere Notiz sind optional. Das Hauptsignal ist deine Antwort oben.',
        addContext: 'Kontext hinzufügen',
        supportPlaceholder: 'Optionale ergänzende Notiz',
        footer: 'Text-first, privat, ohne unnötigen Druck',
        openDialogue: 'Dialog öffnen',
        createAccount: 'Konto erstellen und antworten',
        slotsTitle: 'Aktive Dialog-Slots',
        slotsHint: 'Jede Antwort öffnet nur eine begrenzte Zahl aktiver Dialoge, damit beide Seiten Tempo und Fokus halten.',
        slotsValue: '{{remaining}} von {{limit}} übrig',
        slotsLoading: 'Kapazität wird geladen',
        starterTitle: 'Hilfe für den ersten Schritt',
        starterOne: 'Ich stelle mich kurz vor und benenne den ersten Check, mit dem ich das Briefing validieren würde.',
        starterTwo: 'Mein erster Schritt wäre, das Hauptrisiko zu klären und einen schnellen Praxistest vorzuschlagen.',
        starterThree: 'Ich würde praktisch starten: erst Kontext verifizieren, dann einen kleinen ersten Vorschlag machen.',
        laneTitle: 'Digitaler Handshake',
        laneBody: 'Es geht nicht um einen perfekten Brief. Es geht darum, deine Denkweise, deinen Ton und deinen ersten professionellen Schritt zu zeigen.',
        missionTitle: 'Handshake-Mission',
        missionBody: 'Sag, wer du bist, was du zuerst prüfen würdest und wie du anfangen würdest.',
        submitLabel: 'Digitalen Handshake öffnen',
      }
    : locale === 'pl'
      ? {
        loading: 'Ładowanie dyskusji challenge…',
        discussion: 'Dyskusja challenge',
        empty: 'Na razie bez odpowiedzi. Pierwsza reakcja firmy pojawi się tutaj.',
        replyPlaceholder: 'Napisz odpowiedź…',
        reply: 'Odpowiedz',
        firstResponse: 'Pierwsza odpowiedź',
        intro: 'Bądź konkretny. Pokaż pierwszy krok, co sprawdzisz i jak przetestujesz swoją hipotezę.',
        draftPlaceholder: 'Opisz swoje podejście…',
        supportTitle: 'Dodatkowy kontekst',
        supportBody: 'CV, profil i dłuższa notatka są opcjonalne. Główny sygnał to Twoja odpowiedź powyżej.',
        addContext: 'Dodaj kontekst',
        supportPlaceholder: 'Opcjonalna dodatkowa notatka',
        footer: 'Text-first, prywatnie, bez zbędnej presji',
        openDialogue: 'Otwórz dialog',
        createAccount: 'Załóż konto i odpowiedz',
        slotsTitle: 'Aktywne sloty dialogowe',
        slotsHint: 'Każda odpowiedź otwiera ograniczoną liczbę aktywnych dialogów, żeby obie strony trzymały tempo i uwagę.',
        slotsValue: 'Zostało {{remaining}} z {{limit}}',
        slotsLoading: 'Ładowanie Twojej pojemności',
        starterTitle: 'Pomoc z pierwszym ruchem',
        starterOne: 'Krótko się przedstawię i nazwę pierwszy krok, którym zweryfikuję zadanie.',
        starterTwo: 'Zacząłbym od doprecyzowania głównego ryzyka i zaproponowania szybkiego testu.',
        starterThree: 'Podszedłbym do tego praktycznie: najpierw kontekst, potem pierwszy mały szkic.',
        laneTitle: 'Cyfrowy handshake',
        laneBody: 'Celem nie jest perfekcyjny list. Chodzi o pokazanie sposobu myślenia, tonu i pierwszego profesjonalnego ruchu.',
        missionTitle: 'Misja handshake',
        missionBody: 'Powiedz kim jesteś, co sprawdziłbyś najpierw i jak byś zaczął.',
        submitLabel: 'Otwórz cyfrowy handshake',
      }
    : {
        loading: 'Loading challenge discussion…',
        discussion: 'Challenge discussion',
        empty: 'Still quiet. When the company answers, it lands here.',
        replyPlaceholder: 'Write reply…',
        reply: 'Reply',
        firstResponse: 'First response',
        intro: 'Skip the fluff. Show the first move, what you would check, and how you would know you are not guessing.',
        draftPlaceholder: 'Write how you would actually attack this…',
        supportTitle: 'If you want to add more context',
        supportBody: 'CV, profile details, and a longer note are optional. The main signal is how you think up there.',
        addContext: 'Add context',
        supportPlaceholder: 'Optional note for additional context',
        footer: 'Less talk. First move.',
        openDialogue: 'Open dialogue',
        createAccount: 'Create account to respond',
        slotsTitle: 'Active dialogue slots',
        slotsHint: 'We do not open ten threads at once. Only as many as still have a shot at real momentum.',
        slotsValue: '{{remaining}} left out of {{limit}}',
        slotsLoading: 'Checking how many live dialogues you can still carry',
        starterTitle: 'If the first line gets stuck',
        starterOne: 'I would introduce myself fast and name the first check I would make to pressure-test the brief.',
        starterTwo: 'My first move would be to surface the biggest risk and propose one fast practical test.',
        starterThree: 'I would keep it practical: get context, make a small first proposal, then tighten it with feedback.',
        laneTitle: 'Digital handshake',
        laneBody: 'This is not about a perfect letter. It is about whether you can think clearly, talk straight, and make one smart first move.',
        missionTitle: 'What to send here',
        missionBody: 'Who you are, what you would tackle first, and how you would kick it off without filler.',
        submitLabel: 'Send handshake',
      };

  const starters = [copy.starterOne, copy.starterTwo, copy.starterThree];

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
            avatar_url: getSnapshotAvatarUrl(userProfile.photo),
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

  const applyStarter = (starter: string) => {
    setDraft((current) => {
      const trimmed = current.trim();
      if (!trimmed) return starter;
      if (trimmed.includes(starter)) return current;
      return `${current.trim()}\n\n${starter}`;
    });
  };

  if (threadLoading) {
    return (
      <div className="rounded-[6px] border border-slate-200 bg-white p-5 text-slate-900 shadow-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
          {copy.loading}
        </div>
      </div>
    );
  }

  if (dialogue) {
    return (
      <div className="rounded-[6px] border border-slate-200 bg-white p-5 text-slate-900 shadow-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{copy.discussion}</div>
            <div className="mt-2 text-xl font-semibold text-slate-950 dark:text-white">{job.title}</div>
            <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">{job.company}</div>
          </div>
          <span className="rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
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
    <div className="rounded-[6px] border border-slate-200 bg-white p-5 text-slate-900 shadow-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <div className="grid gap-5 xl:grid-cols-1">
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
            <Handshake size={14} className="text-[var(--accent)]" />
            {copy.laneTitle}
          </div>
          <div className="rounded-[6px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <h3 className="text-lg font-semibold text-slate-950 dark:text-white">
              {job.firstStepPrompt || copy.missionBody}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              {copy.laneBody}
            </p>
          </div>

          <div className="rounded-[6px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
              <Sparkles size={13} className="text-[var(--accent)]" />
              {copy.starterTitle}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {starters.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => applyStarter(starter)}
                  className="rounded-[999px] border border-slate-200 bg-white px-3 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>

          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={copy.draftPlaceholder}
            className="min-h-[240px] w-full rounded-[6px] border border-slate-200 bg-white p-4 text-sm leading-7 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[rgba(var(--accent-rgb),0.28)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
          />

          <div className="rounded-[6px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
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
                className="inline-flex items-center gap-2 rounded-[999px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:text-white"
              >
                <Paperclip size={12} />
                {copy.addContext}
              </button>
            </div>

            <textarea
              value={supportingNote}
              onChange={(event) => setSupportingNote(event.target.value)}
              placeholder={copy.supportPlaceholder}
              className="mt-4 min-h-[96px] w-full rounded-[6px] border border-slate-200 bg-white p-3 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 focus:border-[rgba(var(--accent-rgb),0.28)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[6px] border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-600 dark:text-slate-300">
              <Orbit size={14} />
              {copy.missionTitle}
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{copy.missionBody}</p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-[999px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
            <ShieldCheck size={12} />
            {copy.footer}
          </div>

          {userProfile.isLoggedIn ? (
            <div className="rounded-[6px] border border-slate-200 bg-white px-3.5 py-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <div className="font-semibold text-slate-900 dark:text-white">{copy.slotsTitle}</div>
              <div className="mt-1">{copy.slotsHint}</div>
              <div className="mt-2 font-semibold text-slate-900 dark:text-white">
                {dialogueCapacity
                  ? copy.slotsValue
                    .replace('{{remaining}}', String(dialogueCapacity.remaining))
                    .replace('{{limit}}', String(dialogueCapacity.limit))
                  : copy.slotsLoading}
              </div>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!draft.trim() || submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-[6px] bg-[var(--text-strong)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-92 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {userProfile.isLoggedIn ? copy.submitLabel : copy.createAccount}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChallengeComposer;
