import React, { useMemo, useState } from 'react';
import { BrainCircuit, Briefcase, CheckCircle2, Clock3, CreditCard, Lock, MessageSquareText, Shield, Sparkles, Users } from 'lucide-react';

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
  companyGoal: string;
  challenge: string;
  firstStep: string;
  collaborationMode: string;
  compensation: string;
  timeToSignal: string;
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
              {text({ cs: 'Read-only preview', sk: 'Read-only preview', en: 'Read-only preview', de: 'Read-only preview', pl: 'Read-only preview' })}
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {text({
                cs: 'Human detail ukazuje skutečný rytmus rozhodování, ne jen kartu kandidáta.',
                sk: 'Human detail ukazuje skutočný rytmus rozhodovania, nie len kartu kandidáta.',
                en: 'Human detail shows the real rhythm of decision-making, not just a candidate card.',
                de: 'Human detail zeigt den echten Entscheidungsrhythmus, nicht nur eine Kandidatenkarte.',
                pl: 'Human detail pokazuje prawdziwy rytm decyzji, a nie tylko kartę kandydata.',
              })}
            </div>
          </div>
          <div className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-cyan-900">
            <Lock size={12} className="mr-2 inline-flex" />
            {text({ cs: 'Demo vlákno', sk: 'Demo vlákno', en: 'Demo thread', de: 'Demo-Thread', pl: 'Demo wątek' })}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
            {text({ cs: 'Preview komunikace', sk: 'Preview komunikácie', en: 'Conversation preview', de: 'Gesprächsvorschau', pl: 'Podgląd rozmowy' })}
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {text({ cs: 'Bez odeslání', sk: 'Bez odoslania', en: 'No sending in demo', de: 'Kein Senden im Demo', pl: 'Bez wysyłania w demo' })}
          </div>
        </div>

        <div className="space-y-3">
          {messages.map((message) => {
            const isCompany = message.role === 'company';
            const isSystem = message.role === 'system';

            return (
              <div
                key={message.id}
                className={`rounded-[22px] border px-4 py-4 ${
                  isSystem
                    ? 'border-amber-200 bg-amber-50/75'
                    : isCompany
                      ? 'border-cyan-200 bg-cyan-50/80'
                      : 'border-slate-200 bg-slate-50/80'
                }`}
              >
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
            {text({ cs: 'Otevřít vlastní hiring flow', sk: 'Otvoriť vlastný hiring flow', en: 'Open your own hiring flow', de: 'Eigenen Hiring-Flow öffnen', pl: 'Otwórz własny hiring flow' })}
          </button>
          <button type="button" onClick={onRequestDemo} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
            {text({ cs: 'Projít demo s námi', sk: 'Prejsť demo s nami', en: 'Walk through the demo', de: 'Demo gemeinsam durchgehen', pl: 'Przejść demo razem z nami' })}
          </button>
          <button type="button" onClick={onLogin} className="rounded-full border border-transparent px-5 py-2.5 text-sm font-semibold text-slate-500">
            {text({ cs: 'Už mám účet', sk: 'Už mám účet', en: 'I already have an account', de: 'Ich habe schon ein Konto', pl: 'Mam już konto' })}
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

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-4">
          <div className="rounded-[26px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
              {text({ cs: 'Open challenge preview', sk: 'Open challenge preview', en: 'Open challenge preview', de: 'Open challenge preview', pl: 'Open challenge preview' })}
            </div>
            <div className="mt-3 text-lg font-semibold text-slate-950">{brief.title}</div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{brief.challenge}</div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <CompanyMapStatCard label={text({ cs: 'Formát', sk: 'Formát', en: 'Format', de: 'Format', pl: 'Format' })} value={brief.collaborationMode} icon={<Briefcase size={12} />} />
            <CompanyMapStatCard label={text({ cs: 'Kompenzace', sk: 'Kompenzácia', en: 'Compensation', de: 'Vergütung', pl: 'Wynagrodzenie' })} value={brief.compensation} icon={<CreditCard size={12} />} />
            <CompanyMapStatCard label={text({ cs: 'Time-to-signal', sk: 'Time-to-signal', en: 'Time-to-signal', de: 'Time-to-signal', pl: 'Time-to-signal' })} value={brief.timeToSignal} icon={<Clock3 size={12} />} />
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'První krok pro kandidáta', sk: 'Prvý krok pre kandidáta', en: 'First step for the candidate', de: 'Erster Schritt für Kandidaten', pl: 'Pierwszy krok dla kandydata' })}
            </div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{brief.firstStep}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Hiring goal', sk: 'Hiring goal', en: 'Hiring goal', de: 'Hiring-Ziel', pl: 'Cel hiringu' })}
            </div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{brief.companyGoal}</div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Co sledujeme v odpovědi', sk: 'Čo sledujeme v odpovedi', en: 'What we look for in the response', de: 'Worauf wir in der Antwort achten', pl: 'Na co patrzymy w odpowiedzi' })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {brief.successSignals.map((signal) => <CompanyMapTag key={signal}>{signal}</CompanyMapTag>)}
            </div>
          </div>

          <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
            <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
              {text({ cs: 'Read-only poznámky pro tým', sk: 'Read-only poznámky pre tím', en: 'Read-only team notes', de: 'Read-only Team-Notizen', pl: 'Read-only notatki dla zespołu' })}
            </div>
            <div className="mt-4 grid gap-3">
              {brief.operatingNotes.map((note) => (
                <div key={note} className="rounded-[18px] border border-slate-200/70 bg-slate-50/75 px-4 py-3 text-sm text-slate-700">
                  {note}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={onRegister} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
              {text({ cs: 'Založit firemní účet', sk: 'Založiť firemný účet', en: 'Create company account', de: 'Firmenkonto erstellen', pl: 'Utwórz konto firmowe' })}
            </button>
            <button type="button" onClick={onRequestDemo} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
              {text({ cs: 'Chci guided demo', sk: 'Chcem guided demo', en: 'I want a guided demo', de: 'Ich möchte eine geführte Demo', pl: 'Chcę guided demo' })}
            </button>
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
  const defaultPlanId = useMemo(
    () => plans.find((plan) => plan.highlighted)?.id || plans[0]?.id || '',
    [plans],
  );
  const [selectedPlanId, setSelectedPlanId] = useState(defaultPlanId);
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) || plans[0],
    [plans, selectedPlanId],
  );

  if (!selectedPlan) {
    return null;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-[26px] border border-cyan-200/80 bg-cyan-50/80 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-cyan-700">
              {text({ cs: 'Pricing cluster', sk: 'Pricing cluster', en: 'Pricing cluster', de: 'Pricing-Cluster', pl: 'Pricing cluster' })}
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {text({
                cs: 'Kapacita je součást mapy, ne oddělený modal mimo produkt.',
                sk: 'Kapacita je súčasť mapy, nie oddelený modal mimo produkt.',
                en: 'Capacity lives inside the map, not in a detached modal outside the product.',
                de: 'Kapazität gehört in die Karte, nicht in ein losgelöstes Modal außerhalb des Produkts.',
                pl: 'Pojemność żyje w mapie, a nie w oderwanym modalu poza produktem.',
              })}
            </div>
            <div className="mt-3 text-sm leading-7 text-slate-700">
              {text({
                cs: 'Tady firma hned vidí, kolik rolí, dialogů a screening kapacity odpovídá jejímu hiring tempu.',
                sk: 'Tu firma hneď vidí, koľko rolí, dialógov a screening kapacity zodpovedá jej hiring tempu.',
                en: 'This is where a company immediately sees how many roles, dialogues, and screening capacity fit its hiring pace.',
                de: 'Hier sieht ein Unternehmen sofort, wie viele Rollen, Dialoge und Screening-Kapazität zum Hiring-Tempo passen.',
                pl: 'Tutaj firma od razu widzi, ile ról, dialogów i pojemności screeningowej pasuje do jej tempa hiringu.',
              })}
            </div>
          </div>
          <div className="rounded-full border border-cyan-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-cyan-900">
            <Sparkles size={12} className="mr-2 inline-flex" />
            {text({ cs: 'Inline pricing', sk: 'Inline pricing', en: 'Inline pricing', de: 'Inline pricing', pl: 'Inline pricing' })}
          </div>
        </div>
      </div>

      <div className="rounded-[26px] border border-slate-200/90 bg-white/95 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedPlanId(plan.id)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                plan.id === selectedPlan.id
                  ? 'border-cyan-300 bg-cyan-50 text-cyan-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-cyan-200 hover:text-cyan-800'
              }`}
            >
              {plan.name}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
          <div className={`rounded-[24px] border px-5 py-5 ${selectedPlan.highlighted ? 'border-cyan-300/50 bg-cyan-50/70' : 'border-slate-200/90 bg-slate-50/80'}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  {text({ cs: 'Vybraný plán', sk: 'Vybraný plán', en: 'Selected plan', de: 'Ausgewählter Tarif', pl: 'Wybrany plan' })}
                </div>
                <div className="mt-2 text-2xl font-semibold text-slate-950">{selectedPlan.name}</div>
              </div>
              {selectedPlan.highlighted ? (
                <div className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-[11px] font-semibold text-cyan-800">
                  {text({ cs: 'Doporučeno', sk: 'Odporúčané', en: 'Recommended', de: 'Empfohlen', pl: 'Polecane' })}
                </div>
              ) : null}
            </div>

            <div className="mt-3 text-3xl font-black text-slate-950">{selectedPlan.price}</div>
            <div className="mt-3 text-sm leading-7 text-slate-700">{selectedPlan.note}</div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <CompanyMapStatCard label={text({ cs: 'Role opens', sk: 'Role opens', en: 'Role opens', de: 'Role opens', pl: 'Role opens' })} value={selectedPlan.roleOpens} icon={<Briefcase size={12} />} />
              <CompanyMapStatCard label={text({ cs: 'Dialogue slots', sk: 'Dialogue slots', en: 'Dialogue slots', de: 'Dialogue slots', pl: 'Dialogue slots' })} value={selectedPlan.dialogueSlots} icon={<MessageSquareText size={12} />} />
              <CompanyMapStatCard label={text({ cs: 'AI screeningy', sk: 'AI screeningy', en: 'AI screenings', de: 'KI-Screenings', pl: 'Screeningi AI' })} value={selectedPlan.aiAssessments} icon={<BrainCircuit size={12} />} />
              <CompanyMapStatCard label={text({ cs: 'Recruiter seats', sk: 'Recruiter seats', en: 'Recruiter seats', de: 'Recruiter seats', pl: 'Recruiter seats' })} value={selectedPlan.recruiterSeats} icon={<Users size={12} />} />
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => onRegister(selectedPlan.id)} className="rounded-full bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">
                {text({ cs: 'Začít s tímto plánem', sk: 'Začať s týmto plánom', en: 'Start with this plan', de: 'Mit diesem Tarif starten', pl: 'Zacznij z tym planem' })}
              </button>
              <button type="button" onClick={onRequestDemo} className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700">
                {text({ cs: 'Chci pricing walkthrough', sk: 'Chcem pricing walkthrough', en: 'I want a pricing walkthrough', de: 'Ich möchte einen Pricing-Walkthrough', pl: 'Chcę walkthrough cenowy' })}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200/90 bg-white/90 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {text({ cs: 'Co je uvnitř kapacity', sk: 'Čo je vo vnútri kapacity', en: 'What capacity includes', de: 'Was in der Kapazität steckt', pl: 'Co zawiera pojemność' })}
              </div>
              <div className="mt-4 space-y-3">
                {selectedPlan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-700">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/90 bg-slate-50/80 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                {text({ cs: 'Pro koho to sedí', sk: 'Pre koho to sedí', en: 'Who this fits', de: 'Für wen das passt', pl: 'Dla kogo to pasuje' })}
              </div>
              <div className="mt-3 text-sm leading-7 text-slate-700">
                {selectedPlan.note}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <CompanyMapTag>{selectedPlan.roleOpens}</CompanyMapTag>
                <CompanyMapTag>{selectedPlan.dialogueSlots}</CompanyMapTag>
                <CompanyMapTag>{selectedPlan.aiAssessments}</CompanyMapTag>
                <CompanyMapTag>{selectedPlan.recruiterSeats}</CompanyMapTag>
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200/90 bg-white/90 px-5 py-5">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={onLogin} className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                  {text({ cs: 'Už mám firmu v systému', sk: 'Už mám firmu v systéme', en: 'My company is already inside', de: 'Meine Firma ist schon drin', pl: 'Moja firma już jest w środku' })}
                </button>
                <div className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
                  <Shield size={12} className="mr-2 inline-flex" />
                  {text({ cs: 'Bez závazku v demo režimu', sk: 'Bez záväzku v demo režime', en: 'No commitment in demo mode', de: 'Keine Verpflichtung im Demo-Modus', pl: 'Bez zobowiązania w trybie demo' })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
