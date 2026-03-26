import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Building,
  CheckCircle,
  ChevronDown,
  Clock3,
  Crown,
  Layers3,
  LogIn,
  MessageSquare,
  Shield,
  Sparkles,
  Target
} from 'lucide-react';
import AnalyticsService from '../services/analyticsService';
import AppShellAtmosphere from './ui/AppShellAtmosphere';

interface CompanyLandingPageProps {
  onRegister?: () => void;
  onRequestDemo?: () => void;
  onLogin?: () => void;
}

interface PlanCard {
  name: string;
  price: string;
  note: string;
  features: string[];
  highlighted?: boolean;
  ctaLabel?: string;
  ctaMode?: 'register' | 'demo';
}

const CompanyLandingPage: React.FC<CompanyLandingPageProps> = ({ onRegister, onRequestDemo, onLogin }) => {
  const { i18n } = useTranslation();
  const locale = (i18n.language || 'en').split('-')[0].toLowerCase();
  const language = locale === 'at' ? 'de' : locale;
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const hasTrackedView = useRef(false);

  const trackEvent = (eventName: string, metadata?: Record<string, unknown>) => {
    AnalyticsService.trackEvent(eventName, {
      locale: i18n.language,
      ...metadata
    });
  };

  useEffect(() => {
    if (hasTrackedView.current) return;
    hasTrackedView.current = true;
    trackEvent('company_landing_view', { section: 'handshake_landing' });
  }, []);

  const copy = useMemo(() => {
    if (language === 'cs') {
      return {
    badge: 'Nový systém hiringu pro firmy',
    title: 'Začněte hiring tam, kde se ukáže skutečná spolupráce.',
    subtitle: 'JobShaman pomáhá firmám otevřít hiring přes reálné úkoly, krátkou pracovní interakci a silnější signály o tom, jak kandidát přemýšlí, komunikuje a reaguje v praxi. AI vás celým procesem provede, zjednoduší přípravu i vyhodnocení, ale rozhodnutí zůstává vždy na lidech.',
    primaryCta: 'Otevřít firemní workspace',
    secondaryCta: 'Vyzkoušet demo',
    login: 'Přihlásit se',
    recommended: 'Doporučeno',
    roleTruth: 'Zadání a kontext role',
    asyncFirst: 'AI jako průvodce',
    valuePills: ['Reálný úkol místo generického inzerátu', 'Krátká pracovní interakce místo slepého screeningu', 'AI podpora bez automatického rozhodování'],
    rolePreviewLabel: 'Ukázka zadání role',
    rolePreviewTitle: 'Firma nejdřív pojmenuje, co se v práci opravdu bude dít.',
    rolePreviewItems: [
      'Jaký problém má tahle role pomoci vyřešit?',
      'Co bude člověk řešit v prvních týdnech?',
      'Podle čeho poznáme dobrý začátek po 3 až 6 měsících?',
      'Jaké situace chceme otevřít v první pracovní interakci?'
    ],
    comparisonTitle: 'Jak se hiring mění v praxi',
    comparisonOld: 'Běžně dnes',
    comparisonNew: 'V JobShamanu',
    comparisonRows: [
      ['Inzerát a screening profilů', 'Reálný úkol a krátká pracovní interakce'],
      ['První dojem z CV a sebeprezentace', 'Konkrétní signály z přemýšlení, priorit a reakcí'],
      ['Přehlcený funnel bez kapacity', 'Řízený počet aktivních kandidátů a jasný další krok'],
      ['Ruční příprava každé role od nuly', 'AI asistence při tvorbě zadání, otázek i shrnutí']
    ],
    systemTitle: 'Co firmám platforma usnadní',
    systemCards: [
      {
        title: 'Přípravu role',
        body: 'Role nevzniká jako generický inzerát. AI pomůže se zadáním, kontextem týmu, realistickými situacemi i definicí toho, co má člověk opravdu zvládnout.'
      },
      {
        title: 'První interakci',
        body: 'Místo mrtvého formuláře otevřete krátkou pracovní výměnu, ve které rychle uvidíte styl myšlení, komunikaci a reakci na feedback.'
      },
      {
        title: 'Práci recruiterů',
        body: 'AI shrnuje odpovědi, vytahuje hlavní signály a drží pořádek v procesu, aby tým nestrácel čas ručním přepisováním a přepínáním mezi nástroji.'
      },
      {
        title: 'Rozhodování bez black boxu',
        body: 'AI doporučuje a připravuje podklady. O tom, koho posunout dál a proč, ale vždy rozhoduje člověk.'
      }
    ],
    pricingTitle: 'Monetizace je v souladu s chováním',
    pricingLead: 'Začít můžete zdarma. Neplatíte za CV databázi ani za počet zobrazení. Platíte až za kapacitu, kterou opravdu používáte.',
    pricingPlans: [
      {
        name: 'Free',
        price: 'Zdarma',
        note: 'Na první vyzkoušení bez rizika',
        features: ['1 otevření role', '3 aktivní dialogové sloty', 'Bez AI funkcí'],
        ctaLabel: 'Vyzkoušet zdarma'
      },
      {
        name: 'Starter',
        price: '249 EUR / měsíc',
        note: 'Pro první hiring procesy',
        features: ['3 otevření rolí měsíčně', '12 aktivních dialogue slotů', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / měsíc',
        note: 'Pro aktivní hiring tým',
        features: ['10 otevření rolí měsíčně', '40 aktivních dialogue slotů', 'Prioritní SLA a workflow přehled'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / měsíc',
        note: 'Pro více recruiterů a vyšší throughput',
        features: ['25 otevření rolí měsíčně', '100 aktivních dialogue slotů', 'Rozšířené decision signály a billing kontrola']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'Pro komplexní hiring provoz',
        features: ['Custom limity', 'Success fee volitelně', 'Integrace a custom rollout'],
        ctaMode: 'demo'
      }
    ] as PlanCard[],
    faqTitle: 'Co firmy řeší nejčastěji',
    faqItems: [
      {
        q: 'Co když nechceme měnit celý hiring proces naráz?',
        a: 'Nemusíte. JobShaman může fungovat jako nová první vrstva hiringu před dalšími interview nebo assessmenty. Začít můžete na jedné roli a postupně rozšiřovat to, co vám dává smysl.'
      },
      {
        q: 'Jak AI pomáhá firmě v praxi?',
        a: 'AI pomáhá připravit zadání role, navrhnout pracovní situace, shrnout odpovědi kandidátů a zvýraznit důležité signály. Urychluje přípravu i orientaci v procesu, ale nerozhoduje za hiring tým.'
      },
      {
        q: 'Dělá AI rozhodnutí o kandidátech?',
        a: 'Ne. AI připraví doporučení, scorecard a shrnutí. Stav kandidáta, další krok i finální rozhodnutí vždy potvrzuje člověk.'
      },
      {
        q: 'Co zůstává z CV a dalších materiálů?',
        a: 'CV může zůstat jako doplňkový kontext. Hlavní rozdíl je v tom, že první rozhodnutí nestojí jen na profilu, ale i na reálné pracovní interakci a signálech z ní.'
      }
    ],
    finalTitle: 'Otevřete hiring, který firmě šetří čas a dává jasnější signály.',
    finalBody: 'JobShaman vás provede od zadání role přes první pracovní interakci až po doporučení dalších kroků. AI pomáhá všude, kde to dává smysl. Finální rozhodnutí zůstává vždy na vašem týmu.',
    finalPrimary: 'Začít s pracovním zadáním',
    finalSecondary: 'Přihlásit se do firmy'
      };
    }

    if (language === 'sk') {
      return {
        badge: 'Nový systém hiringu pre firmy',
        title: 'Začnite hiring tam, kde sa ukáže skutočná spolupráca.',
        subtitle: 'JobShaman pomáha firmám otvoriť hiring cez reálne úlohy, krátku pracovnú interakciu a silnejšie signály o tom, ako kandidát premýšľa, komunikuje a reaguje v praxi. AI vás celým procesom prevedie, zjednoduší prípravu aj vyhodnotenie, no rozhodnutie zostáva vždy na ľuďoch.',
        primaryCta: 'Otvoriť firemný workspace',
        secondaryCta: 'Vyskúšať demo',
        login: 'Prihlásiť sa',
        recommended: 'Odporúčané',
        roleTruth: 'Zadanie a kontext roly',
        asyncFirst: 'AI ako sprievodca',
        valuePills: ['Reálna úloha namiesto generického inzerátu', 'Krátka pracovná interakcia namiesto slepého screeningu', 'AI podpora bez automatického rozhodovania'],
        rolePreviewLabel: 'Ukážka zadania roly',
        rolePreviewTitle: 'Firma najprv pomenuje, čo sa v práci naozaj bude diať.',
        rolePreviewItems: [
          'Aký problém má táto rola pomôcť vyriešiť?',
          'Čo bude človek riešiť v prvých týždňoch?',
          'Podľa čoho spoznáme dobrý začiatok po 3 až 6 mesiacoch?',
          'Aké situácie chceme otvoriť v prvej pracovnej interakcii?'
        ],
        comparisonTitle: 'Ako sa hiring mení v praxi',
        comparisonOld: 'Bežne dnes',
        comparisonNew: 'V JobShamane',
        comparisonRows: [
          ['Inzerát a screening profilov', 'Reálna úloha a krátka pracovná interakcia'],
          ['Prvý dojem z CV a sebaprezentácie', 'Konkrétne signály z premýšľania, priorít a reakcií'],
          ['Preťažený funnel bez kapacity', 'Riadený počet aktívnych kandidátov a jasný ďalší krok'],
          ['Ručná príprava každej roly od nuly', 'AI asistencia pri tvorbe zadania, otázok aj zhrnutia']
        ],
        systemTitle: 'Čo platforma firmám uľahčí',
        systemCards: [
          {
            title: 'Prípravu roly',
            body: 'Rola nevzniká ako generický inzerát. AI pomôže so zadaním, kontextom tímu, realistickými situáciami aj definíciou toho, čo má človek naozaj zvládnuť.'
          },
          {
            title: 'Prvú interakciu',
            body: 'Namiesto mŕtveho formulára otvoríte krátku pracovnú výmenu, v ktorej rýchlo uvidíte štýl myslenia, komunikáciu a reakciu na feedback.'
          },
          {
            title: 'Prácu recruiterov',
            body: 'AI sumarizuje odpovede, vyťahuje hlavné signály a drží poriadok v procese, aby tím nestrácal čas ručným prepisovaním a prepínaním medzi nástrojmi.'
          },
          {
            title: 'Rozhodovanie bez black boxu',
            body: 'AI odporúča a pripravuje podklady. O tom, koho posunúť ďalej a prečo, však vždy rozhoduje človek.'
          }
        ],
        pricingTitle: 'Monetizácia v súlade so správaním',
        pricingLead: 'Začať môžete zadarmo. Neplatíte za CV databázu ani za počet zobrazení. Platíte až za kapacitu, ktorú naozaj používate.',
        pricingPlans: [
          {
            name: 'Free',
            price: 'Zdarma',
            note: 'Na prvé vyskúšanie bez rizika',
            features: ['1 otvorenie roly', '3 aktívne dialógové sloty', 'Bez AI funkcií'],
            ctaLabel: 'Vyskúšať zadarmo'
          },
          {
            name: 'Starter',
            price: '249 EUR / mesiac',
            note: 'Pre prvé hiring procesy',
            features: ['3 otvorenia rolí mesačne', '12 aktívnych dialogue slotov', 'Role Canvas + Dialogue Inbox']
          },
          {
            name: 'Growth',
            price: '599 EUR / mesiac',
            note: 'Pre aktívny hiring tím',
            features: ['10 otvorení rolí mesačne', '40 aktívnych dialogue slotov', 'Prioritné SLA a workflow prehľad'],
            highlighted: true
          },
          {
            name: 'Professional',
            price: '899 EUR / mesiac',
            note: 'Pre viac recruiterov a vyšší throughput',
            features: ['25 otvorení rolí mesačne', '100 aktívnych dialogue slotov', 'Rozšírené decision signály a billing kontrola']
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            note: 'Pre komplexný hiring workflow',
            features: ['Custom limity', 'Success fee voliteľne', 'Integrácie a custom rollout'],
            ctaMode: 'demo'
          }
        ] as PlanCard[],
        faqTitle: 'Čo firmy riešia najčastejšie',
        faqItems: [
          {
            q: 'Čo ak nechceme meniť celý hiring proces naraz?',
            a: 'Nemusíte. JobShaman môže fungovať ako nová prvá vrstva hiringu pred ďalšími interview alebo assessmentmi. Začať môžete na jednej role a postupne rozširovať to, čo vám dáva zmysel.'
          },
          {
            q: 'Ako AI pomáha firme v praxi?',
            a: 'AI pomáha pripraviť zadanie roly, navrhnúť pracovné situácie, zhrnúť odpovede kandidátov a zvýrazniť dôležité signály. Urýchľuje prípravu aj orientáciu v procese, ale nerozhoduje za hiring tím.'
          },
          {
            q: 'Robí AI rozhodnutia o kandidátoch?',
            a: 'Nie. AI pripraví odporúčanie, scorecard a zhrnutie. Stav kandidáta, ďalší krok aj finálne rozhodnutie vždy potvrdzuje človek.'
          },
          {
            q: 'Čo zostáva z CV a ďalších materiálov?',
            a: 'CV môže zostať ako doplnkový kontext. Hlavný rozdiel je v tom, že prvé rozhodnutie nestojí len na profile, ale aj na reálnej pracovnej interakcii a signáloch z nej.'
          }
        ],
        finalTitle: 'Otvorte hiring, ktorý firme šetrí čas a dáva jasnejšie signály.',
        finalBody: 'JobShaman vás prevedie od zadania roly cez prvú pracovnú interakciu až po odporúčanie ďalších krokov. AI pomáha všade, kde to dáva zmysel. Finálne rozhodnutie zostáva vždy na vašom tíme.',
        finalPrimary: 'Začať s pracovným zadaním',
        finalSecondary: 'Prihlásiť sa do firmy'
      };
    }

    if (language === 'de') {
      return {
        badge: 'Ein neues Hiring-System für Unternehmen',
        title: 'Starten Sie Hiring dort, wo echte Zusammenarbeit sichtbar wird.',
        subtitle: 'JobShaman hilft Unternehmen, Hiring über reale Aufgaben, kurze Arbeitsinteraktion und stärkere Signale darüber zu öffnen, wie Kandidaten in der Praxis denken, kommunizieren und reagieren. AI führt durch den Prozess, vereinfacht Vorbereitung und Auswertung, doch die Entscheidung bleibt immer beim Menschen.',
        primaryCta: 'Unternehmens-Workspace öffnen',
        secondaryCta: 'Demo testen',
        login: 'Anmelden',
        recommended: 'Empfohlen',
        roleTruth: 'Aufgabe und Rollenkontext',
        asyncFirst: 'AI als Begleiter',
        valuePills: ['Reale Aufgabe statt generischer Anzeige', 'Kurze Arbeitsinteraktion statt blindem Screening', 'AI-Unterstützung ohne automatische Entscheidung'],
        rolePreviewLabel: 'Beispiel für das Rollensetup',
        rolePreviewTitle: 'Das Unternehmen benennt zuerst, was in der Arbeit wirklich passieren wird.',
        rolePreviewItems: [
          'Welches Problem soll diese Rolle lösen helfen?',
          'Womit wird die Person in den ersten Wochen arbeiten?',
          'Woran erkennen wir einen guten Start nach 3 bis 6 Monaten?',
          'Welche Situationen wollen wir in der ersten Arbeitsinteraktion öffnen?'
        ],
        comparisonTitle: 'Wie sich Hiring in der Praxis verändert',
        comparisonOld: 'Heute üblich',
        comparisonNew: 'In JobShaman',
        comparisonRows: [
          ['Anzeige und Profilscreening', 'Reale Aufgabe und kurze Arbeitsinteraktion'],
          ['Erster Eindruck aus CV und Selbstdarstellung', 'Konkrete Signale aus Denken, Prioritäten und Reaktionen'],
          ['Überladener Funnel ohne Kapazität', 'Gesteuerte Zahl aktiver Kandidaten mit klarem nächsten Schritt'],
          ['Manuelle Vorbereitung jeder Rolle von null', 'AI-Unterstützung bei Aufgaben, Fragen und Zusammenfassungen']
        ],
        systemTitle: 'Was die Plattform für Unternehmen einfacher macht',
        systemCards: [
          {
            title: 'Rollenvorbereitung',
            body: 'Eine Rolle entsteht nicht als generische Anzeige. AI hilft bei Aufgabe, Teamkontext, realistischen Situationen und einer klareren Definition dessen, was die Person wirklich leisten soll.'
          },
          {
            title: 'Erste Interaktion',
            body: 'Statt eines toten Formulars öffnen Sie einen kurzen Arbeitsaustausch, in dem Denkstil, Kommunikation und Reaktion auf Feedback schnell sichtbar werden.'
          },
          {
            title: 'Recruiter-Arbeit',
            body: 'AI fasst Antworten zusammen, hebt zentrale Signale hervor und hält den Prozess geordnet, damit das Team weniger Zeit mit manuellem Umschreiben und Kontextwechsel verliert.'
          },
          {
            title: 'Entscheidung ohne Black Box',
            body: 'AI empfiehlt und bereitet Unterlagen vor. Wer weitergeht und warum, entscheidet jedoch immer ein Mensch.'
          }
        ],
        pricingTitle: 'Monetarisierung im Einklang mit dem Verhalten',
        pricingLead: 'Sie können kostenlos starten. Sie zahlen weder für CV-Inventar noch für Impressionen. Bezahlt wird nur die Kapazität, die Sie wirklich nutzen.',
        pricingPlans: [
          {
            name: 'Free',
            price: 'Kostenlos',
            note: 'Zum risikofreien ersten Test',
            features: ['1 Rollenöffnung', '3 aktive Dialog-Slots', 'Keine AI-Funktionen'],
            ctaLabel: 'Kostenlos testen'
          },
          {
            name: 'Starter',
            price: '249 EUR / Monat',
            note: 'Für erste strukturierte Hiring-Loops',
            features: ['3 Rollenöffnungen pro Monat', '12 aktive Dialogue-Slots', 'Role Canvas + Dialogue Inbox']
          },
          {
            name: 'Growth',
            price: '599 EUR / Monat',
            note: 'Für aktive Hiring-Teams',
            features: ['10 Rollenöffnungen pro Monat', '40 aktive Dialogue-Slots', 'Priorisierte SLA und Workflow-Überblick'],
            highlighted: true
          },
          {
            name: 'Professional',
            price: '899 EUR / Monat',
            note: 'Für mehrere Recruiter und höheren Throughput',
            features: ['25 Rollenöffnungen pro Monat', '100 aktive Dialogue-Slots', 'Erweiterte Decision-Signale und Billing-Kontrolle']
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            note: 'Für komplexe Hiring-Operationen',
            features: ['Custom-Limits', 'Optionales Success Fee', 'Integrationen und individuelles Rollout'],
            ctaMode: 'demo'
          }
        ] as PlanCard[],
        faqTitle: 'Was Unternehmen am häufigsten fragen',
        faqItems: [
          {
            q: 'Was, wenn wir nicht den ganzen Hiring-Prozess auf einmal ändern wollen?',
            a: 'Das müssen Sie nicht. JobShaman kann als neue erste Schicht vor weiteren Interviews oder Assessments funktionieren. Sie können mit einer Rolle starten und nur das ausbauen, was für Ihr Team sinnvoll ist.'
          },
          {
            q: 'Wie hilft AI dem Unternehmen konkret?',
            a: 'AI hilft beim Vorbereiten der Rolle, schlägt Arbeitssituationen vor, fasst Kandidatenantworten zusammen und hebt wichtige Signale hervor. Sie beschleunigt Vorbereitung und Orientierung im Prozess, entscheidet aber nicht für das Hiring-Team.'
          },
          {
            q: 'Trifft AI Entscheidungen über Kandidaten?',
            a: 'Nein. AI erstellt Empfehlungen, Scorecards und Zusammenfassungen. Kandidatenstatus, nächster Schritt und finale Entscheidung werden immer vom Menschen bestätigt.'
          },
          {
            q: 'Welche Rolle spielen CV und weitere Unterlagen noch?',
            a: 'Das CV kann als zusätzlicher Kontext bestehen bleiben. Der Unterschied ist, dass die erste Entscheidung nicht nur auf dem Profil basiert, sondern auch auf realer Arbeitsinteraktion und den Signalen daraus.'
          }
        ],
        finalTitle: 'Öffnen Sie Hiring, das Zeit spart und klarere Signale liefert.',
        finalBody: 'JobShaman begleitet Sie vom Rollensetup über die erste Arbeitsinteraktion bis zu Empfehlungen für die nächsten Schritte. AI hilft überall dort, wo sie sinnvoll ist. Die finale Entscheidung bleibt immer bei Ihrem Team.',
        finalPrimary: 'Mit der Arbeitsaufgabe starten',
        finalSecondary: 'Als Unternehmen anmelden'
      };
    }

    if (language === 'pl') {
      return {
        badge: 'Nowy system hiringu dla firm',
        title: 'Zacznij hiring tam, gdzie widać prawdziwą współpracę.',
        subtitle: 'JobShaman pomaga firmom otworzyć hiring przez realne zadania, krótką interakcję roboczą i mocniejsze sygnały pokazujące, jak kandydat myśli, komunikuje się i reaguje w praktyce. AI prowadzi przez cały proces, upraszcza przygotowanie i ocenę, ale decyzja zawsze zostaje po stronie ludzi.',
        primaryCta: 'Otwórz firmowy workspace',
        secondaryCta: 'Wypróbuj demo',
        login: 'Zaloguj się',
        recommended: 'Polecane',
        roleTruth: 'Zadanie i kontekst roli',
        asyncFirst: 'AI jako przewodnik',
        valuePills: ['Realne zadanie zamiast generycznego ogłoszenia', 'Krótka interakcja robocza zamiast ślepego screeningu', 'Wsparcie AI bez automatycznej decyzji'],
        rolePreviewLabel: 'Przykład zadania roli',
        rolePreviewTitle: 'Firma najpierw nazywa to, co naprawdę będzie działo się w pracy.',
        rolePreviewItems: [
          'Jaki problem ta rola ma pomóc rozwiązać?',
          'Czym dana osoba będzie zajmować się w pierwszych tygodniach?',
          'Po czym poznamy dobry start po 3 do 6 miesiącach?',
          'Jakie sytuacje chcemy otworzyć w pierwszej interakcji roboczej?'
        ],
        comparisonTitle: 'Jak hiring zmienia się w praktyce',
        comparisonOld: 'Najczęściej dziś',
        comparisonNew: 'W JobShaman',
        comparisonRows: [
          ['Ogłoszenie i screening profili', 'Realne zadanie i krótka interakcja robocza'],
          ['Pierwsze wrażenie z CV i autoprezentacji', 'Konkretne sygnały z myślenia, priorytetów i reakcji'],
          ['Przeciążony funnel bez pojemności', 'Kontrolowana liczba aktywnych kandydatów i jasny kolejny krok'],
          ['Ręczne przygotowywanie każdej roli od zera', 'Wsparcie AI przy zadaniu, pytaniach i podsumowaniu']
        ],
        systemTitle: 'Co platforma ułatwia firmom',
        systemCards: [
          {
            title: 'Przygotowanie roli',
            body: 'Rola nie powstaje jako generyczne ogłoszenie. AI pomaga z zadaniem, kontekstem zespołu, realistycznymi sytuacjami i definicją tego, co dana osoba ma naprawdę dowieźć.'
          },
          {
            title: 'Pierwszą interakcję',
            body: 'Zamiast martwego formularza otwierasz krótką wymianę roboczą, w której szybko widać styl myślenia, komunikację i reakcję na feedback.'
          },
          {
            title: 'Pracę recruiterów',
            body: 'AI podsumowuje odpowiedzi, wyciąga główne sygnały i porządkuje proces, żeby zespół nie tracił czasu na ręczne przepisywanie i przełączanie się między narzędziami.'
          },
          {
            title: 'Decyzję bez black boxa',
            body: 'AI rekomenduje i przygotowuje materiały. O tym, kogo przesunąć dalej i dlaczego, zawsze decyduje człowiek.'
          }
        ],
        pricingTitle: 'Monetyzacja zgodna z zachowaniem',
        pricingLead: 'Możesz zacząć za darmo. Nie płacisz za bazę CV ani za wyświetlenia. Płacisz dopiero za pojemność, której naprawdę używasz.',
        pricingPlans: [
          {
            name: 'Free',
            price: 'Za darmo',
            note: 'Bezpieczny pierwszy test bez ryzyka',
            features: ['1 otwarcie roli', '3 aktywne sloty dialogowe', 'Bez funkcji AI'],
            ctaLabel: 'Wypróbuj za darmo'
          },
          {
            name: 'Starter',
            price: '249 EUR / miesiąc',
            note: 'Dla pierwszych procesów hiringowych',
            features: ['3 otwarcia ról miesięcznie', '12 aktywnych dialogue slotów', 'Role Canvas + Dialogue Inbox']
          },
          {
            name: 'Growth',
            price: '599 EUR / miesiąc',
            note: 'Dla aktywnego zespołu hiringowego',
            features: ['10 otwarć ról miesięcznie', '40 aktywnych dialogue slotów', 'Priorytetowe SLA i przegląd workflow'],
            highlighted: true
          },
          {
            name: 'Professional',
            price: '899 EUR / miesiąc',
            note: 'Dla większej liczby recruiterów i większego throughputu',
            features: ['25 otwarć ról miesięcznie', '100 aktywnych dialogue slotów', 'Rozszerzone sygnały decyzyjne i kontrola billingowa']
          },
          {
            name: 'Enterprise',
            price: 'Custom',
            note: 'Dla złożonych operacji hiringowych',
            features: ['Custom limity', 'Opcjonalne success fee', 'Integracje i indywidualny rollout'],
            ctaMode: 'demo'
          }
        ] as PlanCard[],
        faqTitle: 'O co firmy pytają najczęściej',
        faqItems: [
          {
            q: 'Co jeśli nie chcemy zmieniać całego procesu hiringowego naraz?',
            a: 'Nie musicie. JobShaman może działać jako nowa pierwsza warstwa hiringu przed kolejnymi interview lub assessmentami. Możecie zacząć od jednej roli i rozszerzać tylko to, co ma sens dla waszego zespołu.'
          },
          {
            q: 'Jak AI pomaga firmie w praktyce?',
            a: 'AI pomaga przygotować zadanie roli, zaproponować sytuacje robocze, podsumować odpowiedzi kandydatów i podświetlić ważne sygnały. Przyspiesza przygotowanie i orientację w procesie, ale nie decyduje za hiring team.'
          },
          {
            q: 'Czy AI podejmuje decyzje o kandydatach?',
            a: 'Nie. AI przygotowuje rekomendacje, scorecard i podsumowanie. Status kandydata, kolejny krok i finalną decyzję zawsze potwierdza człowiek.'
          },
          {
            q: 'Co zostaje z CV i innych materiałów?',
            a: 'CV może pozostać dodatkowym kontekstem. Najważniejsza różnica polega na tym, że pierwsza decyzja nie opiera się już tylko na profilu, ale także na realnej interakcji roboczej i sygnałach z niej.'
          }
        ],
        finalTitle: 'Otwórz hiring, który oszczędza czas firmy i daje wyraźniejsze sygnały.',
        finalBody: 'JobShaman prowadzi od zadania roli przez pierwszą interakcję roboczą aż po rekomendację kolejnych kroków. AI pomaga wszędzie tam, gdzie ma to sens. Finalna decyzja zawsze zostaje po stronie waszego zespołu.',
        finalPrimary: 'Zacznij od zadania roboczego',
        finalSecondary: 'Zaloguj się jako firma'
      };
    }

    return {
    badge: 'A new hiring system for companies',
    title: 'Start hiring where real collaboration becomes visible.',
    subtitle: 'JobShaman helps companies open hiring through real tasks, short working interaction, and stronger signals about how a candidate thinks, communicates, and reacts in practice. AI guides the whole process, simplifies preparation and review, but the decision always stays with people.',
    primaryCta: 'Open company workspace',
    secondaryCta: 'Try demo',
    login: 'Log in',
    recommended: 'Recommended',
    roleTruth: 'Role brief and context',
    asyncFirst: 'AI as a guide',
    valuePills: ['A real task instead of a generic job post', 'Short working interaction instead of blind screening', 'AI support without automatic decisions'],
    rolePreviewLabel: 'Role brief preview',
    rolePreviewTitle: 'The company starts by naming what the work will actually look like.',
    rolePreviewItems: [
      'What problem is this role supposed to help solve?',
      'What will the person work on in the first weeks?',
      'What would a strong start look like after 3 to 6 months?',
      'Which situations should open the first working interaction?'
    ],
    comparisonTitle: 'How hiring changes in practice',
    comparisonOld: 'Common today',
    comparisonNew: 'In JobShaman',
    comparisonRows: [
      ['Job post and profile screening', 'Real task and short working interaction'],
      ['First impression from CV and self-presentation', 'Concrete signals from thinking, priorities, and reactions'],
      ['An overloaded funnel with no real capacity', 'A managed number of active candidates and a clear next step'],
      ['Manual role setup from scratch every time', 'AI assistance with briefs, questions, and summaries']
    ],
    systemTitle: 'What the platform makes easier',
    systemCards: [
      {
        title: 'Role preparation',
        body: 'A role does not start as a generic ad. AI helps shape the task, team context, realistic situations, and a clearer definition of what the person actually needs to deliver.'
      },
      {
        title: 'First interaction',
        body: 'Instead of a dead form, you open a short working exchange where thinking style, communication, and response to feedback become visible fast.'
      },
      {
        title: 'Recruiter workflow',
        body: 'AI summarizes answers, surfaces key signals, and keeps the process organized so the team spends less time rewriting notes and switching tools.'
      },
      {
        title: 'Decisions without a black box',
        body: 'AI recommends and prepares the materials. The hiring team still decides who moves forward and why.'
      }
    ],
    pricingTitle: 'Monetization aligned with behavior',
    pricingLead: 'You can start for free. You do not pay for CV inventory or impressions. You pay only for the capacity you actually use.',
    pricingPlans: [
      {
        name: 'Free',
        price: 'Free',
        note: 'A safe way to try the workflow first',
        features: ['1 role open', '3 active dialogue slots', 'No AI features'],
        ctaLabel: 'Try for free'
      },
      {
        name: 'Starter',
        price: '249 EUR / month',
        note: 'For your first structured hiring loops',
        features: ['3 role opens per month', '12 active dialogue slots', 'Role Canvas + Dialogue Inbox']
      },
      {
        name: 'Growth',
        price: '599 EUR / month',
        note: 'For active hiring teams',
        features: ['10 role opens per month', '40 active dialogue slots', 'Priority SLA and workflow visibility'],
        highlighted: true
      },
      {
        name: 'Professional',
        price: '899 EUR / month',
        note: 'For larger recruiter throughput',
        features: ['25 role opens per month', '100 active dialogue slots', 'Extended decision signals and billing controls']
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        note: 'For complex hiring operations',
        features: ['Custom limits', 'Optional success fee', 'Integrations and tailored rollout'],
        ctaMode: 'demo'
      }
    ] as PlanCard[],
    faqTitle: 'What companies ask most often',
    faqItems: [
      {
        q: 'What if we do not want to replace the whole hiring process at once?',
        a: 'You do not have to. JobShaman can work as a new first layer before interviews or deeper assessments. You can start with one role and expand only what makes sense for your team.'
      },
      {
        q: 'How does AI help the company in practice?',
        a: 'AI helps prepare the role brief, propose working situations, summarize candidate responses, and highlight important signals. It speeds up preparation and orientation in the process, but it does not decide for the hiring team.'
      },
      {
        q: 'Does AI make decisions about candidates?',
        a: 'No. AI prepares recommendations, scorecards, and summaries. Candidate status, next step, and the final decision are always confirmed by a human.'
      },
      {
        q: 'What remains from CVs and other materials?',
        a: 'A CV can remain as supporting context. The key difference is that the first decision no longer stands only on the profile, but also on real working interaction and the signals that come from it.'
      }
    ],
    finalTitle: 'Open hiring that saves time and gives clearer signals.',
    finalBody: 'JobShaman guides the team from the role brief through the first working interaction to recommendations for the next step. AI helps wherever it makes sense. The final decision always stays with your team.',
    finalPrimary: 'Start with the work brief',
    finalSecondary: 'Log in as company'
    };
  }, [language]);

  const aiGuideCopy = language === 'cs'
    ? {
        title: 'AI vás procesem provede, ale nerozhoduje za vás.',
        lead:
          'JobShaman používá AI jako praktického asistenta pro hiring tým. Pomůže připravit roli, navrhnout pracovní situace, shrnout odpovědi kandidátů a zvýraznit důležité signály. Každé doporučení je podpůrné, ne automatické.',
        cards: [
          {
            title: 'AI pomůže připravit zadání',
            body: 'Z role a kontextu firmy pomůže vytvořit srozumitelný úkol, první situace k otevření i jasnější definici úspěchu.'
          },
          {
            title: 'AI zjednoduší orientaci v odpovědích',
            body: 'Shrne vlákna, vytáhne hlavní signály a pomůže recruiterům rychle pochopit, co je v odpovědích skutečně důležité.'
          },
          {
            title: 'Člověk dělá finální rozhodnutí',
            body: 'AI doporučí další krok a připraví podklady. O tom, koho posunout dál, koho pozvat a proč, vždy rozhoduje hiring tým.'
          }
        ]
      }
    : language === 'sk'
      ? {
          title: 'AI vás procesom prevedie, ale nerozhoduje za vás.',
          lead:
            'JobShaman používa AI ako praktického asistenta pre hiring tím. Pomôže pripraviť rolu, navrhnúť pracovné situácie, zhrnúť odpovede kandidátov a zvýrazniť dôležité signály. Každé odporúčanie je podporné, nie automatické.',
          cards: [
            {
              title: 'AI pomôže pripraviť zadanie',
              body: 'Z roly a kontextu firmy pomôže vytvoriť zrozumiteľnú úlohu, prvé situácie na otvorenie aj jasnejšiu definíciu úspechu.'
            },
            {
              title: 'AI uľahčí orientáciu v odpovediach',
              body: 'Zhrnie vlákna, vytiahne hlavné signály a pomôže recruiterom rýchlo pochopiť, čo je v odpovediach skutočne dôležité.'
            },
            {
              title: 'Človek robí finálne rozhodnutie',
              body: 'AI odporučí ďalší krok a pripraví podklady. O tom, koho posunúť ďalej, koho pozvať a prečo, vždy rozhoduje hiring tím.'
            }
          ]
        }
      : language === 'de'
        ? {
            title: 'AI führt durch den Prozess, entscheidet aber nicht an Ihrer Stelle.',
            lead:
              'JobShaman nutzt AI als praktischen Assistenten für das Hiring-Team. Sie hilft bei der Vorbereitung der Rolle, schlägt Arbeitssituationen vor, fasst Kandidatenantworten zusammen und hebt wichtige Signale hervor. Jede Empfehlung ist unterstützend, nicht automatisch.',
            cards: [
              {
                title: 'AI hilft beim Rollensetup',
                body: 'Aus Rolle und Unternehmenskontext entsteht eine klarere Aufgabe, bessere Einstiegssituationen und eine nutzbarere Definition von Erfolg.'
              },
              {
                title: 'AI macht Antworten schneller lesbar',
                body: 'Sie fasst Threads zusammen, zeigt zentrale Signale und hilft Recruitern schnell zu verstehen, was in einer Antwort wirklich wichtig ist.'
              },
              {
                title: 'Menschen treffen die finale Entscheidung',
                body: 'AI kann den nächsten Schritt empfehlen und die Scorecard vorbereiten. Das Hiring-Team entscheidet weiterhin, wer weitergeht und warum.'
              }
            ]
          }
        : language === 'pl'
          ? {
              title: 'AI prowadzi przez proces, ale nie podejmuje decyzji za was.',
              lead:
                'JobShaman używa AI jako praktycznego asystenta dla hiring teamu. Pomaga przygotować rolę, zaproponować sytuacje robocze, podsumować odpowiedzi kandydatów i wyróżnić ważne sygnały. Każda rekomendacja ma charakter wspierający, a nie automatyczny.',
              cards: [
                {
                  title: 'AI pomaga przygotować zadanie',
                  body: 'Na bazie roli i kontekstu firmy pomaga stworzyć czytelne zadanie, sytuacje otwierające i jaśniejszą definicję sukcesu.'
                },
                {
                  title: 'AI ułatwia czytanie odpowiedzi',
                  body: 'Podsumowuje wątki, wyciąga główne sygnały i pomaga recruiterom szybko zrozumieć, co w odpowiedziach naprawdę ma znaczenie.'
                },
                {
                  title: 'Człowiek podejmuje finalną decyzję',
                  body: 'AI może zasugerować kolejny krok i przygotować scorecard. To hiring team nadal decyduje, kto idzie dalej i dlaczego.'
                }
              ]
            }
    : {
        title: 'AI guides the process, but it never makes the hiring decision.',
        lead:
          'JobShaman uses AI as a practical assistant for the hiring team. It helps prepare the role, propose working situations, summarize candidate responses, and highlight important signals. Every recommendation is supportive, not automatic.',
        cards: [
          {
            title: 'AI helps prepare the role',
            body: 'It turns the role and company context into a clearer task, better opening situations, and a more usable definition of success.'
          },
          {
            title: 'AI makes responses easier to read',
            body: 'It summarizes threads, surfaces key signals, and helps recruiters quickly understand what matters in a candidate response.'
          },
          {
            title: 'Humans make the final decision',
            body: 'AI can recommend a next step and prepare the scorecard. The hiring team still decides who moves forward and why.'
          }
        ]
      };

  const handleRegister = (section: string) => {
    trackEvent('company_landing_cta_register_click', { section });
    onRegister?.();
  };

  const handleDemo = (section: string) => {
    trackEvent('company_landing_cta_demo_click', { section });
    if (onRequestDemo) {
      onRequestDemo();
      return;
    }
    onLogin?.();
  };

  const handleLogin = (section: string) => {
    trackEvent('company_landing_cta_login_click', { section });
    onLogin?.();
  };

  const landingSectionClass =
    'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none lg:p-8';
  const landingHeroSectionClass =
    'rounded-[var(--radius-2xl)] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none lg:p-8';
  const landingCardClass =
    'rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] dark:border-slate-800 dark:bg-slate-900 dark:shadow-none';
  const landingSoftCardClass =
    'rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 dark:border-slate-800 dark:bg-slate-900';
  const landingEyebrowClass =
    'inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)] dark:border-[rgba(var(--accent-rgb),0.16)] dark:bg-[rgba(var(--accent-rgb),0.08)]';
  const landingChipClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text-muted)] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300';
  const landingPrimaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-cyan-400 bg-cyan-500 px-6 py-3.5 text-sm font-semibold text-slate-950 shadow-[0_18px_34px_-22px_rgba(6,182,212,0.38)] transition hover:-translate-y-[1px] hover:bg-cyan-400 dark:border-cyan-300 dark:bg-cyan-300 dark:text-slate-950 dark:hover:bg-cyan-200';
  const landingSecondaryButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-slate-300 bg-white px-6 py-3.5 text-sm font-semibold text-slate-900 shadow-none transition hover:-translate-y-[1px] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900';
  const landingTopbarButtonClass =
    'inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-none transition hover:-translate-y-[1px] hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900';

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100">
      <AppShellAtmosphere />
      <div className="relative mx-auto w-full max-w-[1680px] px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
      <div className="app-aurora-shell mx-auto flex w-full max-w-[1480px] flex-col gap-6 lg:gap-7">
        <div className="flex justify-end">
          <button onClick={() => handleLogin('topbar')} className={landingTopbarButtonClass}>
            <LogIn size={16} />
            {copy.login}
          </button>
        </div>

        <section className={landingHeroSectionClass}>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div>
              <div className={landingEyebrowClass}>
                <Sparkles size={14} />
                {copy.badge}
              </div>
              <h1 className="mt-4 max-w-4xl text-4xl font-semibold tracking-[-0.05em] text-[var(--text-strong)] md:text-[3.7rem] md:leading-[1.02]">
                {copy.title}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-8 text-[var(--text-muted)]">
                {copy.subtitle}
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button onClick={() => handleRegister('hero')} className={landingPrimaryButtonClass}>
                  <Building size={18} />
                  {copy.primaryCta}
                </button>
                <button onClick={() => handleDemo('hero')} className={landingSecondaryButtonClass}>
                  {copy.secondaryCta}
                  <ArrowRight size={18} />
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {copy.valuePills.map((pill) => (
                  <div key={pill} className={landingChipClass}>
                    {pill}
                  </div>
                ))}
              </div>
            </div>

            <div className={landingCardClass}>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-faint)]">
                {copy.rolePreviewLabel}
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">
                {copy.rolePreviewTitle}
              </h2>
              <div className="mt-5 rounded-[var(--radius-lg)] border border-[rgba(var(--accent-rgb),0.16)] bg-[var(--accent-soft)] p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[var(--accent)]">
                  <Shield size={16} />
                  {copy.roleTruth}
                </div>
                <div className="mt-4 space-y-3">
                  {copy.rolePreviewItems.map((item) => (
                    <div key={item} className={`${landingSoftCardClass} text-sm leading-6 text-[var(--text)] shadow-none`}>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={landingSectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <Target className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.comparisonTitle}</h2>
          </div>
          <div className="grid grid-cols-[1fr,1fr] gap-3 text-sm">
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 font-semibold text-[var(--text-muted)]">
              {copy.comparisonOld}
            </div>
            <div className="rounded-[var(--radius-md)] border border-[rgba(var(--accent-rgb),0.18)] bg-[var(--accent-soft)] px-4 py-3 font-semibold text-[var(--accent)]">
              {copy.comparisonNew}
            </div>
            {copy.comparisonRows.map(([legacy, next]) => (
              <React.Fragment key={`${legacy}-${next}`}>
                <div className={`${landingSoftCardClass} text-[var(--text-muted)]`}>
                  {legacy}
                </div>
                <div className={`${landingSoftCardClass} font-medium text-[var(--text-strong)] dark:bg-slate-950`}>
                  {next}
                </div>
              </React.Fragment>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {copy.systemCards.map((card, index) => {
            const Icon = [Layers3, MessageSquare, Clock3, CheckCircle][index] || Layers3;
            return (
              <div key={card.title} className={landingCardClass}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Icon size={20} />
                </div>
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{card.title}</h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.body}</p>
              </div>
            );
          })}
        </section>

        <section className={landingSectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <Sparkles className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{aiGuideCopy.title}</h2>
          </div>
          <p className="max-w-3xl text-sm leading-7 text-[var(--text-muted)]">
            {aiGuideCopy.lead}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {aiGuideCopy.cards.map((card, index) => {
              const Icon = [Target, Sparkles, Shield][index] || Sparkles;
              return (
                <div key={card.title} className={landingCardClass}>
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon size={20} />
                  </div>
                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-[var(--text-strong)]">{card.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{card.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="relative overflow-hidden rounded-[var(--radius-2xl)] border border-[rgba(var(--accent-rgb),0.18)] bg-[linear-gradient(145deg,#09131f,#0f172a_52%,#102235)] p-6 shadow-[0_30px_72px_-54px_rgba(8,23,37,0.62)] dark:bg-[linear-gradient(145deg,rgba(8,12,20,0.98),rgba(15,23,42,0.96)_56%,rgba(12,22,34,0.98))] dark:shadow-[0_24px_56px_-44px_rgba(2,6,23,0.72)] lg:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(var(--accent-rgb),0.16),transparent_26%),radial-gradient(circle_at_85%_10%,rgba(var(--accent-sky-rgb),0.1),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_20%)] dark:bg-[radial-gradient(circle_at_16%_18%,rgba(var(--accent-rgb),0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_18%)]"
          />
          <div className="relative z-10">
            <div className="mb-3 flex items-center gap-3">
              <Crown className="text-[var(--accent)]" size={20} />
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-50">{copy.pricingTitle}</h2>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-300">{copy.pricingLead}</p>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {copy.pricingPlans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-[var(--radius-xl)] border p-5 backdrop-blur-md ${
                    plan.highlighted
                      ? 'relative -translate-y-1 border-[rgba(var(--accent-rgb),0.32)] bg-[rgba(8,18,30,0.96)] shadow-[0_22px_44px_-28px_rgba(2,6,23,0.74)]'
                      : 'border-white/10 bg-white/5 shadow-[0_16px_32px_-26px_rgba(2,6,23,0.62)]'
                  }`}
                >
                  {plan.highlighted && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-x-5 top-0 h-[2px] rounded-full bg-[linear-gradient(90deg,rgba(var(--accent-rgb),0.12),rgba(var(--accent-rgb),0.9),rgba(var(--accent-rgb),0.12))]"
                    />
                  )}
                  {plan.highlighted && (
                    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--accent-rgb),0.22)] bg-[rgba(var(--accent-rgb),0.08)] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)] shadow-none">
                      <Sparkles size={12} />
                      {copy.recommended}
                    </div>
                  )}
                  <div className="mt-3 text-lg font-semibold text-white">{plan.name}</div>
                  <div className={`mt-2 text-2xl font-black ${plan.highlighted ? 'text-white' : 'text-slate-50'}`}>{plan.price}</div>
                  <p className={`mt-2 text-xs leading-5 ${plan.highlighted ? 'text-slate-200' : 'text-slate-300'}`}>{plan.note}</p>
                  <div className="mt-4 space-y-2">
                    {plan.features.map((feature) => (
                      <div key={feature} className={`flex items-start gap-2 text-sm ${plan.highlighted ? 'text-white' : 'text-slate-100'}`}>
                        <CheckCircle size={16} className={`mt-0.5 shrink-0 ${plan.highlighted ? 'text-[var(--accent)]' : 'text-slate-300'}`} />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => (plan.ctaMode === 'demo' ? handleDemo('pricing') : handleRegister('pricing'))}
                    className={
                      plan.highlighted
                        ? 'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-3 text-sm font-bold text-slate-950 shadow-none transition hover:-translate-y-[1px] hover:brightness-110'
                        : 'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-white/12 bg-white/8 px-4 py-3 text-sm font-semibold text-slate-100 transition hover:bg-white/10'
                    }
                  >
                    {plan.ctaLabel || (plan.ctaMode === 'demo' ? copy.secondaryCta : copy.primaryCta)}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={landingSectionClass}>
          <div className="mb-5 flex items-center gap-3">
            <MessageSquare className="text-[var(--accent)]" size={20} />
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{copy.faqTitle}</h2>
          </div>
          <div className="space-y-3">
            {copy.faqItems.map((item, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div key={item.q} className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-muted)] dark:border-slate-800 dark:bg-slate-900">
                  <button
                    onClick={() => {
                      const nextIndex = isOpen ? null : index;
                      setOpenFaqIndex(nextIndex);
                      if (!isOpen) {
                        trackEvent('company_landing_faq_expand', { faq_index: index });
                      }
                    }}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                  >
                    <span className="text-sm font-semibold text-[var(--text-strong)]">{item.q}</span>
                    <ChevronDown className={`h-4 w-4 text-[var(--text-faint)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm leading-7 text-[var(--text-muted)]">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className={landingSectionClass}>
          <div className="grid items-center gap-6 lg:grid-cols-2">
            <div>
              <div className={landingEyebrowClass}>
                <Shield size={14} />
                {copy.asyncFirst}
              </div>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-[var(--text-strong)]">
                {copy.finalTitle}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--text-muted)]">
                {copy.finalBody}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
              <button onClick={() => handleRegister('final_cta')} className={landingPrimaryButtonClass}>
                {copy.finalPrimary}
                <ArrowRight size={18} />
              </button>
              <button onClick={() => handleLogin('final_cta')} className={landingSecondaryButtonClass}>
                <LogIn size={18} />
                {copy.finalSecondary}
              </button>
            </div>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
};

export default CompanyLandingPage;
