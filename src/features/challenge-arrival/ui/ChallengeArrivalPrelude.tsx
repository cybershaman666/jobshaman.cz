import React from 'react';
import { Compass, DoorOpen, Handshake, Orbit, TimerReset } from 'lucide-react';

import { Badge, MetricTile } from '../../../../components/ui/primitives';
import type { ChallengeViewModel } from '../../../entities/challenge/model/challengeAdapter';

interface ChallengeArrivalPreludeProps {
  challenge: ChallengeViewModel;
  locale: string;
}

const ChallengeArrivalPrelude: React.FC<ChallengeArrivalPreludeProps> = ({ challenge, locale }) => {
  const language = locale.split('-')[0].toLowerCase();
  const isCsLike = language === 'cs' || language === 'sk';

  const sourceLabel = challenge.sourceType === 'micro'
    ? (isCsLike ? 'Mini výzva' : 'Mini challenge')
    : challenge.sourceType === 'imported'
      ? (isCsLike ? 'Importovaná role' : 'Imported role')
      : (isCsLike ? 'Nativní mise' : 'Native mission');

  const handshakeLabel = challenge.handshakeMode === 'rapid'
    ? (isCsLike ? 'Rychlý handshake' : 'Rapid handshake')
    : challenge.handshakeMode === 'prepare'
      ? (isCsLike ? 'Příprava před odchodem' : 'Preparation before outbound apply')
      : (isCsLike ? 'Přímý digitální handshake' : 'Direct digital handshake');

  const lead = challenge.handshakeMode === 'prepare'
    ? (isCsLike
      ? 'Nejdřív si ujasni, co tým opravdu řeší a jak bys k tomu přistoupil. Teprve potom má smysl odejít na původní listing.'
      : 'Clarify what the team is actually trying to solve and how you would approach it before you leave for the original listing.')
    : challenge.handshakeMode === 'rapid'
      ? (isCsLike
        ? 'Tady nejde o těžký proces. Jde o rychlý, srozumitelný první krok a lidský signál, že rozumíš zadání.'
        : 'This is not a heavy process. It is a quick, clear first step and a human signal that you understand the task.')
      : (isCsLike
        ? 'Na této scéně nezačínáš slepým CV. Začínáš prvním krokem, otázkou a způsobem přemýšlení.'
        : 'This scene does not start with a blind CV. It starts with a first step, a question, and the way you think.');

  const responseWindow = challenge.reactionWindowHours == null
    ? '—'
    : challenge.reactionWindowHours < 24
      ? `${challenge.reactionWindowHours} h`
      : `${Math.round(challenge.reactionWindowHours / 24)} d`;

  return (
    <section className="relative overflow-hidden rounded-[calc(var(--radius-2xl)+8px)] border border-[rgba(var(--accent-rgb),0.14)] bg-[linear-gradient(135deg,rgba(10,18,30,0.98),rgba(11,28,40,0.97)_48%,rgba(14,46,38,0.94)_100%)] p-5 text-white shadow-[0_25px_80px_-48px_rgba(10,18,30,0.9)] sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.18),transparent_26%),radial-gradient(circle_at_82%_18%,rgba(34,197,94,0.16),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent_40%)]" />

      <div className="relative grid gap-5 xl:grid-cols-[220px_minmax(0,1.1fr)_minmax(280px,0.8fr)]">
        <div className="hidden xl:flex">
          <div className="flex w-full flex-col justify-between rounded-[30px] border border-white/10 bg-white/6 p-5">
            <div className="space-y-3">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/82">
                <DoorOpen size={13} />
                {isCsLike ? 'Vstup do prostoru' : 'Enter the space'}
              </div>
              <p className="text-sm leading-7 text-slate-200/84">
                {isCsLike
                  ? 'Před tebou není jen role. Je to pracovní prostor, rytmus týmu a první situace, do které vstupuješ.'
                  : 'This is not only a role. It is a work space, a team rhythm, and the first situation you are entering.'}
              </p>
            </div>
            <div className="space-y-3">
              <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/78">{isCsLike ? 'Firma' : 'Company'}</div>
                <div className="mt-2 text-lg font-semibold text-white">{challenge.company}</div>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/18 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/78">{isCsLike ? 'Model práce' : 'Work model'}</div>
                <div className="mt-2 text-lg font-semibold text-white">{challenge.workModel}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="subtle">{sourceLabel}</Badge>
            <Badge variant="outline" className="border-white/15 bg-white/8 text-white">{handshakeLabel}</Badge>
          </div>

          <div className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/82">
              {isCsLike ? 'Arrival scene' : 'Arrival scene'}
            </div>
            <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.04em] text-white sm:text-[2rem]">
              {isCsLike ? 'Vstupuješ do pracovního prostoru, ne na formulář.' : 'You are entering a working space, not a form.'}
            </h2>
            <p className="max-w-3xl text-sm leading-7 text-slate-200/84">
              {lead}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[26px] border border-white/10 bg-white/7 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/82">
                <Handshake size={14} />
                {isCsLike ? 'Co je správná reakce' : 'What the right response looks like'}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-200/82">
                {isCsLike
                  ? 'Krátké představení, první hypotéza, první krok. Ne dlouhý motivační dopis.'
                  : 'A short introduction, a first hypothesis, and a first move. Not a long cover letter.'}
              </p>
            </div>
            <div className="rounded-[26px] border border-white/10 bg-white/7 p-4">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100/82">
                <Orbit size={14} />
                {isCsLike ? 'Co sleduješ' : 'What you are reading for'}
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-200/82">
                {isCsLike
                  ? 'Misi, riziko, tón firmy a to, kde můžeš být užitečný hned od prvního kontaktu.'
                  : 'The mission, the risk, the company tone, and where you can be useful from first contact.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3">
          <MetricTile label={isCsLike ? 'Firma / autor' : 'Company / author'} value={challenge.company} className="border-white/10 bg-white/8 [&_*]:text-white" />
          <MetricTile label={isCsLike ? 'Místo' : 'Location'} value={challenge.location} className="border-white/10 bg-white/8 [&_*]:text-white" />
          <MetricTile
            label={isCsLike ? 'Reakční okno' : 'Response window'}
            value={responseWindow}
            helper={isCsLike ? 'Jak rychle se to obvykle hýbe.' : 'How fast this usually moves.'}
            className="border-white/10 bg-white/8 [&_*]:text-white"
          />
        </div>
      </div>

      <div className="relative mt-5 grid gap-3 lg:grid-cols-3">
        <MetricTile
          label={isCsLike ? 'Mise' : 'Mission'}
          value={challenge.missionLine || '—'}
          className="border-white/10 bg-black/18 [&_*]:text-white"
        />
        <MetricTile
          label={isCsLike ? 'První krok' : 'First step'}
          value={challenge.firstStepPrompt || '—'}
          className="border-white/10 bg-black/18 [&_*]:text-white"
        />
        <MetricTile
          label={isCsLike ? 'Otevřené dialogy' : 'Open dialogues'}
          value={challenge.openDialoguesCount.toLocaleString(locale)}
          helper={challenge.handshakeMode === 'prepare' ? (isCsLike ? 'Tady je handshake příprava na další krok.' : 'Here the handshake is preparation for the next step.') : undefined}
          className="border-white/10 bg-black/18 [&_*]:text-white"
        />
      </div>

      <div className="relative mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-200/78">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-3 py-1.5">
          <Handshake size={13} />
          {handshakeLabel}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-3 py-1.5">
          <Compass size={13} />
          {challenge.workModel}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/7 px-3 py-1.5">
          <TimerReset size={13} />
          {isCsLike ? 'Nejdřív orientace, potom reakce.' : 'Orient first, respond second.'}
        </span>
      </div>
    </section>
  );
};

export default ChallengeArrivalPrelude;
