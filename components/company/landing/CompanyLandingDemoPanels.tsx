import React, { useMemo, useState } from 'react';
import { BrainCircuit, Briefcase, CheckCircle2, Handshake, Lock, MessageSquareText, Shield, Sparkles, Target, Users } from 'lucide-react';

import { companyMapText, resolveCompanyMapLocale } from '../companyMapLocale';
import { CompanyMapStatCard, CompanyMapTag } from '../map/CompanyMapPrimitives';

type LocaleTextInput = Parameters<typeof companyMapText>[1];

export interface LandingDemoConversationMessage {
  id: string;
  author: string;
  role: 'company' | 'candidate' | 'system';
  timestamp: string;
  body: string;
}

export interface LandingDemoBrief {
  title: string;
  roleTitle?: string;
  companyGoal: string;
  challenge: string;
  firstStep: string;
  collaborationMode: string;
  compensation: string;
  timeToSignal: string;
  responseWindow?: string;
  teamSummary?: string;
  whyThisRoleMatters?: string;
  thirtyDayOutcome?: string;
  hiringLeadName?: string;
  hiringLeadRole?: string;
  hiringLeadNote?: string;
  handshakeIntro?: string;
  handshakePrompts?: string[];
  handshakePrinciples?: string[];
  successSignals: string[];
  operatingNotes: string[];
}

export interface LandingDemoPricingPlan {
  id: string;
  name: string;
  price: string;
  note: string;
  roleOpens: string;
  dialogueSlots: string;
  aiAssessments: string;
  recruiterSeats: string;
  features: string[];
  highlighted?: boolean;
}

const textFor = (localeInput?: string) => {
  const locale = resolveCompanyMapLocale(localeInput);
  return (variants: LocaleTextInput) => companyMapText(locale, variants);
};

export const LandingDemoConversationPanel: React.FC<{
  locale?: string;
  messages: LandingDemoConversationMessage[];
  onRegister: () => void;
  onRequestDemo: () => void;
  onLogin: () => void;
}> = ({ locale: localeInput, messages, onRegister, onRequestDemo, onLogin }) => {
  const text = textFor(localeInput);

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
              {text({ cs: 'Jak vypadá dobré rozhodnutí', sk: 'Ako vyzerá dobré rozhodnutie', en: 'What strong hiring decisions look like', de: 'Wie gute Hiring-Entscheidungen aussehen', pl: 'Jak wygląda dobra decyzja hiringowa' })}
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {text({
                cs: 'Tým vidí člověka, jeho signály i další krok na jednom místě, takže se rozhoduje rychleji a s větší jistotou.',
                sk: 'Tím vidí človeka, jeho signály aj ďalší krok na jednom mieste, takže sa rozhoduje rýchlejšie a s väčšou istotou.',
                en: 'The team sees the person, their signal, and the next step in one place, so decisions happen faster and with more confidence.',
                de: 'Das Team sieht Person, Signal und nächsten Schritt an einem Ort und entscheidet dadurch schneller und sicherer.',
                pl: 'Zespół widzi człowieka, jego sygnał i kolejny krok w jednym miejscu, więc decyzje zapadają szybciej i pewniej.',
              })}
            </div>
          </div>
          <div className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-cyan-900">
            <Lock size={12} className="mr-2 inline-flex" />
            {text({ cs: 'Ukázka konverzace', sk: 'Ukážka konverzácie', en: 'Conversation preview', de: 'Gesprächsvorschau', pl: 'Podgląd rozmowy' })}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {text({ cs: 'Co tým opravdu potřebuje vidět', sk: 'Čo tím naozaj potrebuje vidieť', en: 'What the team actually needs to see', de: 'Was das Team wirklich sehen muss', pl: 'Co zespół naprawdę musi zobaczyć' })}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {text({ cs: 'Rychlý kontext', sk: 'Rýchly kontext', en: 'Fast context', de: 'Schneller Kontext', pl: 'Szybki kontekst' })}
          </div>
        </div>

        <div className="space-y-3">
          {messages.map((message) => {
            const toneClass = message.role === 'system'
              ? 'border-amber-200 bg-amber-50/75'
              : message.role === 'company'
                ? 'border-cyan-200 bg-cyan-50/80'
                : 'border-slate-200 bg-slate-50/80';
            return (
              <div key={message.id} className={`rounded-[22px] border px-4 py-4 ${toneClass}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-950">{message.author}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{message.timestamp}</div>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{message.body}</div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={onRegister} className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white">
            {text({ cs: 'Chci vlastní hiring mapu', sk: 'Chcem vlastnú hiring mapu', en: 'I want my own hiring map', de: 'Ich möchte meine eigene Hiring-Map', pl: 'Chcę własną mapę hiringu' })}
          </button>
          <button type="button" onClick={onRequestDemo} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
            {text({ cs: 'Ukázat to našemu týmu', sk: 'Ukázať to nášmu tímu', en: 'Show this to my team', de: 'Meinem Team zeigen', pl: 'Pokaż to mojemu zespołowi' })}
          </button>
          <button type="button" onClick={onLogin} className="rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-slate-500">
            {text({ cs: 'Vstoupit do účtu', sk: 'Vstúpiť do účtu', en: 'Enter my workspace', de: 'Meinen Workspace öffnen', pl: 'Wejdź do mojego workspace' })}
          </button>
        </div>
      </div>
    </div>
  );
};

export const LandingDemoOpenChallengePanel: React.FC<{
  locale?: string;
  brief: LandingDemoBrief;
  onRegister: () => void;
  onRequestDemo: () => void;
}> = ({ locale: localeInput, brief, onRegister, onRequestDemo }) => {
  const text = textFor(localeInput);
  const roleTitle = brief.roleTitle || brief.title;
  const responseWindow = brief.responseWindow || text({ cs: 'Do 48 hodin', sk: 'Do 48 hodín', en: 'Within 48 hours', de: 'Innerhalb von 48 Stunden', pl: 'Do 48 godzin' });
  const teamSummary = brief.teamSummary || text({ cs: 'Hiring owner + recruiter + tým', sk: 'Hiring owner + recruiter + tím', en: 'Hiring owner + recruiter + team', de: 'Hiring Owner + Recruiter + Team', pl: 'Hiring owner + recruiter + zespół' });
  const whyThisRoleMatters = brief.whyThisRoleMatters || brief.companyGoal;
  const thirtyDayOutcome = brief.thirtyDayOutcome || brief.firstStep;
  const hiringLeadName = brief.hiringLeadName || 'Ivana Horakova';
  const hiringLeadRole = brief.hiringLeadRole || text({ cs: 'Hiring owner', sk: 'Hiring owner', en: 'Hiring owner', de: 'Hiring Owner', pl: 'Hiring owner' });
  const hiringLeadNote = brief.hiringLeadNote || text({
    cs: 'Právě tady firma ukazuje, že za zadáním stojí konkrétní člověk, ne anonymní proces.',
    sk: 'Práve tu firma ukazuje, že za zadaním stojí konkrétny človek, nie anonymný proces.',
    en: 'This is where the company shows there is a real person behind the brief, not an anonymous process.',
    de: 'Hier zeigt das Unternehmen, dass hinter dem Briefing ein echter Mensch steht und kein anonymer Prozess.',
    pl: 'Właśnie tutaj firma pokazuje, że za briefem stoi konkretna osoba, a nie anonimowy proces.',
  });
  const handshakeIntro = brief.handshakeIntro || text({
    cs: 'Kandidát tu neodpovídá na fráze, ale na reálný problém týmu a na konkrétní první krok.',
    sk: 'Kandidát tu neodpovedá na frázy, ale na reálny problém tímu a na konkrétny prvý krok.',
    en: 'The candidate is not responding to vague phrases here but to a real team problem and a concrete first move.',
    de: 'Kandidaten reagieren hier nicht auf Floskeln, sondern auf ein echtes Teamproblem und einen konkreten ersten Schritt.',
    pl: 'Kandydat nie odpowiada tu na puste frazy, ale na realny problem zespołu i konkretny pierwszy krok.',
  });
  const handshakePrompts = brief.handshakePrompts?.length ? brief.handshakePrompts : [
    text({
      cs: 'Jaký by byl váš první krok v prvních 7 dnech, kdybyste měl(a) zklidnit největší provozní napětí a neztratit důvěru týmu?',
      sk: 'Aký by bol váš prvý krok v prvých 7 dňoch, keby ste mal(a) upokojiť najväčšie prevádzkové napätie a nestratiť dôveru tímu?',
      en: 'What would be your first move in the first 7 days if you had to calm the biggest operational tension without losing the team’s trust?',
      de: 'Was wäre Ihr erster Schritt in den ersten 7 Tagen, wenn Sie die größte operative Spannung beruhigen müssten, ohne das Vertrauen des Teams zu verlieren?',
      pl: 'Jaki byłby Twój pierwszy krok w pierwszych 7 dniach, gdyby trzeba było uspokoić największe napięcie operacyjne i nie stracić zaufania zespołu?',
    }),
    text({
      cs: 'Co byste si potřeboval(a) ověřit u lidí a v datech, abyste věděl(a), že řešíte skutečný problém?',
      sk: 'Čo by ste si potreboval(a) overiť u ľudí a v dátach, aby ste vedel(a), že riešite skutočný problém?',
      en: 'What would you need to verify with people and data to know you are solving the real problem?',
      de: 'Was müssten Sie mit Menschen und Daten prüfen, um sicher zu sein, dass Sie das eigentliche Problem lösen?',
      pl: 'Co trzeba byłoby sprawdzić u ludzi i w danych, aby mieć pewność, że rozwiązujesz prawdziwy problem?',
    }),
  ];
  const valuePoints = [
    text({ cs: 'Kandidát reaguje na realitu týmu, ne na obecný inzerát.', sk: 'Kandidát reaguje na realitu tímu, nie na všeobecný inzerát.', en: 'The candidate responds to a real team problem, not to a generic listing.', de: 'Kandidaten reagieren auf ein echtes Teamproblem und nicht auf eine generische Anzeige.', pl: 'Kandydat odpowiada na realny problem zespołu, a nie na ogólne ogłoszenie.' }),
    text({ cs: 'Dřív uvidíte způsob myšlení, prioritu a první krok místo hezkých frází.', sk: 'Skôr uvidíte spôsob myslenia, prioritu a prvý krok namiesto pekných fráz.', en: 'You see thinking, priorities, and the first move earlier instead of polished phrases.', de: 'Sie sehen Denken, Prioritäten und den ersten Schritt früher statt polierter Floskeln.', pl: 'Wcześniej zobaczysz sposób myślenia, priorytet i pierwszy ruch zamiast ładnych fraz.' }),
    text({ cs: 'První dialog začíná lidsky a konkrétně, takže se lépe rozhoduje, koho pustit dál.', sk: 'Prvý dialóg začína ľudsky a konkrétne, takže sa lepšie rozhoduje, koho pustiť ďalej.', en: 'The first dialogue starts in a human and concrete way, making it easier to decide who moves forward.', de: 'Der erste Dialog beginnt menschlich und konkret, sodass sich leichter entscheidet, wer weiterkommt.', pl: 'Pierwszy dialog zaczyna się po ludzku i konkretnie, więc łatwiej zdecydować, kogo puścić dalej.' }),
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">{text({ cs: 'Ukázka reálného challenge editoru', sk: 'Ukážka reálneho challenge editora', en: 'Preview of the real challenge editor', de: 'Vorschau auf den echten Challenge-Editor', pl: 'Podgląd prawdziwego edytora challenge' })}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{brief.title}</div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{text({ cs: 'Tohle už není hezký inzerát. Tohle je první kvalitní filtr, který ukáže, jak člověk přemýšlí nad vaší realitou.', sk: 'Toto už nie je pekný inzerát. Toto je prvý kvalitný filter, ktorý ukáže, ako človek premýšľa nad vašou realitou.', en: 'This is no longer a pretty listing. It is the first meaningful filter that shows how a person thinks about your reality.', de: 'Das ist keine hübsche Anzeige mehr. Es ist der erste sinnvolle Filter, der zeigt, wie jemand über Ihre Realität nachdenkt.', pl: 'To nie jest już ładne ogłoszenie. To pierwszy sensowny filtr, który pokazuje, jak człowiek myśli o waszej rzeczywistości.' })}</div>
          </div>
          <div className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-cyan-900">
            <Sparkles size={12} className="mr-2 inline-flex" />
            {text({ cs: 'Méně UI, víc hodnoty', sk: 'Menej UI, viac hodnoty', en: 'Less UI, more value', de: 'Weniger UI, mehr Wert', pl: 'Mniej UI, więcej wartości' })}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Preview editoru role', sk: 'Preview editora roly', en: 'Role editor preview', de: 'Vorschau des Rollen-Editors', pl: 'Podgląd edytora roli' })}</div>
              <div className="mt-2 text-lg font-semibold text-slate-950">{roleTitle}</div>
            </div>
            <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600">{text({ cs: 'Demo draft', sk: 'Demo draft', en: 'Demo draft', de: 'Demo-Entwurf', pl: 'Demo draft' })}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <CompanyMapTag>{brief.collaborationMode}</CompanyMapTag>
            <CompanyMapTag>{brief.compensation}</CompanyMapTag>
            <CompanyMapTag>{responseWindow}</CompanyMapTag>
            <CompanyMapTag>{teamSummary}</CompanyMapTag>
          </div>

          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-slate-200/90 bg-slate-50/70 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Co se musí ve firmě změnit', sk: 'Čo sa musí vo firme zmeniť', en: 'What needs to change in the company', de: 'Was sich im Unternehmen ändern muss', pl: 'Co musi zmienić się w firmie' })}</div>
              <div className="mt-3 text-sm leading-7 text-slate-800">{brief.companyGoal}</div>
            </div>
            <div className="rounded-[22px] border border-slate-200/90 bg-slate-50/70 px-4 py-4">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Jaký problém má člověk převzít', sk: 'Aký problém má človek prevziať', en: 'What problem this person takes on', de: 'Welches Problem diese Person übernimmt', pl: 'Jaki problem ma przejąć ta osoba' })}</div>
              <div className="mt-3 text-sm leading-7 text-slate-800">{brief.challenge}</div>
            </div>
            <div className="rounded-[22px] border border-orange-200/90 bg-orange-50/80 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-orange-700">
                <Handshake size={12} />
                {text({ cs: 'Digitální handshake', sk: 'Digitálny handshake', en: 'Digital handshake', de: 'Digitaler Handshake', pl: 'Cyfrowy handshake' })}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-800">{handshakeIntro}</div>
              <div className="mt-4 space-y-3">
                {handshakePrompts.slice(0, 2).map((prompt, index) => (
                  <div key={prompt} className="rounded-[18px] border border-orange-200/80 bg-white px-4 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-orange-700">{text({ cs: `Prompt ${index + 1}`, sk: `Prompt ${index + 1}`, en: `Prompt ${index + 1}`, de: `Prompt ${index + 1}`, pl: `Prompt ${index + 1}` })}</div>
                    <div className="mt-2 text-sm leading-7 text-slate-800">{prompt}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[26px] border border-cyan-200/90 bg-cyan-50/70 px-5 py-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-cyan-200 bg-white text-sm font-semibold text-cyan-900">{hiringLeadName.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">{text({ cs: 'Lidský kontext zadání', sk: 'Ľudský kontext zadania', en: 'Human context behind the brief', de: 'Menschlicher Kontext hinter dem Briefing', pl: 'Ludzki kontekst briefu' })}</div>
                <div className="mt-2 text-base font-semibold text-slate-950">{hiringLeadName}</div>
                <div className="mt-1 text-sm text-slate-600">{hiringLeadRole}</div>
                <div className="mt-3 text-sm leading-7 text-slate-700">{hiringLeadNote}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Proč je to lepší než běžný inzerát', sk: 'Prečo je to lepšie než bežný inzerát', en: 'Why this is better than a standard listing', de: 'Warum das besser ist als eine Standardanzeige', pl: 'Dlaczego to jest lepsze niż zwykłe ogłoszenie' })}</div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{whyThisRoleMatters}</div>
            <div className="mt-4 space-y-3">
              {valuePoints.map((point) => (
                <div key={point} className="rounded-[18px] border border-slate-200/80 bg-slate-50/75 px-4 py-3 text-sm leading-7 text-slate-700">{point}</div>
              ))}
            </div>
            <div className="mt-4 rounded-[18px] border border-cyan-200/70 bg-cyan-50/70 px-4 py-4">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-cyan-700">
                <Target size={12} />
                {text({ cs: 'Co má přinést prvních 30 dní', sk: 'Čo má priniesť prvých 30 dní', en: 'What the first 30 days should deliver', de: 'Was die ersten 30 Tage liefern sollen', pl: 'Co mają dać pierwsze 30 dni' })}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">{thirtyDayOutcome}</div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {brief.successSignals.map((signal) => <CompanyMapTag key={signal}>{signal}</CompanyMapTag>)}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onRegister} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">{text({ cs: 'Chci podobné zadání pro naši firmu', sk: 'Chcem podobné zadanie pre našu firmu', en: 'I want this for my company', de: 'Ich möchte das für meine Firma', pl: 'Chcę tego dla mojej firmy' })}</button>
            <button type="button" onClick={onRequestDemo} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">{text({ cs: 'Projít to s námi krok za krokem', sk: 'Prejsť si to s nami krok za krokom', en: 'Walk through it with us', de: 'Gemeinsam durchgehen', pl: 'Przejść to razem z nami' })}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const LandingDemoPricingPanel: React.FC<{
  locale?: string;
  plans: LandingDemoPricingPlan[];
  onRegister: (planId?: string) => void;
  onRequestDemo: () => void;
  onLogin: () => void;
}> = ({ locale: localeInput, plans, onRegister, onRequestDemo, onLogin }) => {
  const text = textFor(localeInput);
  const defaultPlanId = useMemo(() => plans.find((plan) => plan.highlighted)?.id || plans[0]?.id || '', [plans]);
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId);
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === selectedPlanId) || plans[0], [plans, selectedPlanId]);

  if (!selectedPlan) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">{text({ cs: 'Plány pro nábor', sk: 'Plány pre nábor', en: 'Hiring plans', de: 'Hiring-Pläne', pl: 'Plany rekrutacyjne' })}</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{text({ cs: 'Vyberete si plán podle toho, kolik pozic chcete obsazovat, kolik kandidátů chcete držet v pohybu a kolik lidí z týmu bude v hiringu aktivně pracovat.', sk: 'Vyberiete si plán podľa toho, koľko pozícií chcete obsadzovať, koľko kandidátov chcete držať v pohybe a koľko ľudí z tímu bude v hiringu aktívne pracovať.', en: 'Choose a plan based on how many roles you want to fill, how many candidates you want moving, and how many teammates will be active in hiring.', de: 'Wählen Sie einen Plan danach, wie viele Rollen Sie besetzen, wie viele Kandidaten gleichzeitig im Prozess sein sollen und wie viele Teammitglieder aktiv mitarbeiten.', pl: 'Wybierz plan według tego, ile ról chcesz prowadzić, ilu kandydatów chcesz utrzymać w procesie i ile osób z zespołu będzie aktywnie rekrutować.' })}</div>
          </div>
          <div className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-cyan-900"><Sparkles size={12} className="mr-2 inline-flex" />{text({ cs: 'Jasno v tom, co kupujete', sk: 'Jasno v tom, čo kupujete', en: 'Clear on what you buy', de: 'Klarheit über den Umfang', pl: 'Jasno, co kupujesz' })}</div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => (
            <button key={plan.id} type="button" onClick={() => setSelectedPlanId(plan.id)} className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${plan.id === selectedPlan.id ? 'border-cyan-300 bg-cyan-50 text-cyan-900' : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-800'}`}>{plan.name}</button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className={`rounded-[24px] border px-5 py-5 ${selectedPlan.highlighted ? 'border-cyan-300/50 bg-cyan-50/70' : 'border-slate-200/90 bg-slate-50/80'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Doporučený plán', sk: 'Odporúčaný plán', en: 'Recommended plan', de: 'Empfohlener Plan', pl: 'Rekomendowany plan' })}</div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{selectedPlan.name}</div>
              </div>
              {selectedPlan.highlighted ? <div className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-semibold text-cyan-800">{text({ cs: 'Nejčastější volba', sk: 'Najčastejšia voľba', en: 'Most popular', de: 'Am häufigsten gewählt', pl: 'Najczęstszy wybór' })}</div> : null}
            </div>
            <div className="mt-3 text-3xl font-black text-slate-950">{selectedPlan.price}</div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{selectedPlan.note}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <CompanyMapStatCard label={text({ cs: 'Otevřené pozice', sk: 'Otvorené pozície', en: 'Open roles', de: 'Offene Rollen', pl: 'Otwarte role' })} value={selectedPlan.roleOpens} icon={<Briefcase size={12} />} />
              <CompanyMapStatCard label={text({ cs: 'Kandidáti v pohybu', sk: 'Kandidáti v procese', en: 'Active candidates', de: 'Aktive Kandidaten', pl: 'Kandydaci w procesie' })} value={selectedPlan.dialogueSlots} icon={<MessageSquareText size={12} />} />
              <CompanyMapStatCard label={text({ cs: 'AI screeningy / měsíc', sk: 'AI screeningy / mesiac', en: 'AI screenings / month', de: 'KI-Screenings / Monat', pl: 'Screeningi AI / miesiąc' })} value={selectedPlan.aiAssessments} icon={<BrainCircuit size={12} />} />
              <CompanyMapStatCard label={text({ cs: 'Členové týmu', sk: 'Členovia tímu', en: 'Team members', de: 'Teammitglieder', pl: 'Członkowie zespołu' })} value={selectedPlan.recruiterSeats} icon={<Users size={12} />} />
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => onRegister(selectedPlan.id)} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">{text({ cs: 'Chci tento plán pro náš tým', sk: 'Chcem tento plán pre náš tím', en: 'I want this plan for my team', de: 'Ich möchte diesen Plan für mein Team', pl: 'Chcę ten plan dla mojego zespołu' })}</button>
              <button type="button" onClick={onRequestDemo} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">{text({ cs: 'Pomozte nám vybrat správný plán', sk: 'Pomôžte nám vybrať správny plán', en: 'Help us choose the right plan', de: 'Helfen Sie uns beim passenden Plan', pl: 'Pomóżcie nam wybrać właściwy plan' })}</button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200/90 bg-white/90 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Co tým získá navíc', sk: 'Čo tím získa navyše', en: 'What the team gains', de: 'Was das Team zusätzlich bekommt', pl: 'Co zespół zyskuje' })}</div>
              <div className="mt-4 space-y-3">
                {selectedPlan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-700"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" /><span>{feature}</span></div>
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200/90 bg-slate-50/80 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{text({ cs: 'Co přesně znamenají limity', sk: 'Čo presne znamenajú limity', en: 'What the limits actually mean', de: 'Was die Limits genau bedeuten', pl: 'Co dokładnie oznaczają limity' })}</div>
              <div className="mt-4 space-y-4 text-sm leading-7 text-slate-700">
                <div><div className="font-semibold text-slate-900">{text({ cs: 'Otevřené pozice', sk: 'Otvorené pozície', en: 'Open roles', de: 'Offene Rollen', pl: 'Otwarte role' })}</div><div>{text({ cs: 'Kolik rolí můžete vést souběžně. Když nabíráte na více klíčových místech najednou, potřebujete právě tady rezervu.', sk: 'Koľko rolí môžete viesť súbežne. Keď naberáte na viac kľúčových miestach naraz, potrebujete práve tu rezervu.', en: 'How many roles you can run in parallel. If you hire for several key roles at once, this is where you need headroom.', de: 'Wie viele Rollen Sie parallel führen können. Wenn Sie mehrere Schlüsselpositionen gleichzeitig besetzen, brauchen Sie hier Reserve.', pl: 'Ile ról możesz prowadzić równolegle. Jeśli rekrutujesz na kilka kluczowych stanowisk naraz, tu potrzebujesz zapasu.' })}</div></div>
                <div><div className="font-semibold text-slate-900">{text({ cs: 'Kandidáti v pohybu', sk: 'Kandidáti v procese', en: 'Active candidates', de: 'Aktive Kandidaten', pl: 'Kandydaci w procesie' })}</div><div>{text({ cs: 'Kolik lidí můžete držet v aktivním procesu najednou. Nejde o databázi kontaktů, ale o kandidáty, kterým se tým skutečně věnuje.', sk: 'Koľko ľudí môžete držať v aktívnom procese naraz. Nejde o databázu kontaktov, ale o kandidátov, ktorým sa tím skutočne venuje.', en: 'How many people you can keep in active process at the same time. This is not a contact database, but candidates your team is actively working with.', de: 'Wie viele Personen Sie gleichzeitig aktiv im Prozess halten können. Es geht nicht um eine Kontaktdatenbank, sondern um Kandidaten, mit denen Ihr Team wirklich arbeitet.', pl: 'Ilu kandydatów możesz utrzymać aktywnie w procesie jednocześnie. To nie baza kontaktów, ale osoby, nad którymi zespół realnie pracuje.' })}</div></div>
                <div><div className="font-semibold text-slate-900">{text({ cs: 'AI screeningy / měsíc', sk: 'AI screeningy / mesiac', en: 'AI screenings / month', de: 'KI-Screenings / Monat', pl: 'Screeningi AI / miesiąc' })}</div><div>{text({ cs: 'Kolik rychlých signal-checků můžete za měsíc spustit. Hodí se tam, kde nechcete čekat týdny na první kvalitní vhled.', sk: 'Koľko rýchlych signal-checkov môžete za mesiac spustiť. Hodí sa tam, kde nechcete čakať týždne na prvý kvalitný vhľad.', en: 'How many fast signal checks you can run each month. Useful when you do not want to wait weeks for a first solid signal.', de: 'Wie viele schnelle Signal-Checks Sie pro Monat starten können. Hilfreich, wenn Sie nicht wochenlang auf das erste belastbare Signal warten wollen.', pl: 'Ile szybkich signal-checków możesz uruchomić w miesiącu. Przydaje się tam, gdzie nie chcesz czekać tygodniami na pierwszy mocny sygnał.' })}</div></div>
                <div><div className="font-semibold text-slate-900">{text({ cs: 'Členové týmu', sk: 'Členovia tímu', en: 'Team members', de: 'Teammitglieder', pl: 'Członkowie zespołu' })}</div><div>{text({ cs: 'Kolik lidí z firmy může ve workspace aktivně spolupracovat. Typicky recruiter, hiring manager a další klíčoví lidé v rozhodování.', sk: 'Koľko ľudí z firmy môže vo workspace aktívne spolupracovať. Typicky recruiter, hiring manager a ďalší kľúčoví ľudia v rozhodovaní.', en: 'How many people from your company can actively collaborate in the workspace. Typically recruiters, hiring managers, and key decision-makers.', de: 'Wie viele Personen aus Ihrem Unternehmen aktiv im Workspace zusammenarbeiten können. Typischerweise Recruiter, Hiring Manager und weitere Entscheider.', pl: 'Ile osób z firmy może aktywnie współpracować w workspace. Zwykle recruiter, hiring manager i inni kluczowi decydenci.' })}</div></div>
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200/90 bg-white/90 px-5 py-5">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onLogin} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">{text({ cs: 'Naše firma už JobShaman používá', sk: 'Naša firma už JobShaman používa', en: 'My company already uses JobShaman', de: 'Meine Firma nutzt JobShaman bereits', pl: 'Moja firma już używa JobShamana' })}</button>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800"><Shield size={12} className="mr-2 inline-flex" />{text({ cs: 'Nejdřív si ověříte přínos pro svůj tým', sk: 'Najprv si overíte prínos pre svoj tím', en: 'Validate the value for your team first', de: 'Prüfen Sie zuerst den Mehrwert für Ihr Team', pl: 'Najpierw sprawdzasz wartość dla swojego zespołu' })}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
