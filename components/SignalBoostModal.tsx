import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Copy, ExternalLink, Loader2, Mic, Sparkles, TimerReset, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { Job, JobSignalBoostBrief, JobSignalBoostOutput, UserProfile } from '../types';
import { fetchLatestSignalBoostOutputForJob, fetchSignalBoostBrief, generateSignalBoostStarter, publishSignalBoostOutput, recordSignalBoostEvent, updateSignalBoostOutput } from '../services/jobSignalBoostService';
import { trackAnalyticsEvent } from '../services/supabaseService';

interface SignalBoostModalProps {
  isOpen: boolean;
  job: Job;
  userProfile: UserProfile;
  onClose: () => void;
}

const getDraftKey = (jobId: string | number, userId: string | null | undefined) =>
  `jobshaman_signal_boost_draft:${String(jobId)}:${userId || 'guest'}`;

const normalizeLocale = (value: string): 'cs' | 'sk' | 'de' | 'pl' | 'en' => {
  const base = String(value || 'en').split('-')[0].toLowerCase();
  if (base === 'at') return 'de';
  return ['cs', 'sk', 'de', 'pl', 'en'].includes(base) ? (base as 'cs' | 'sk' | 'de' | 'pl' | 'en') : 'en';
};

const SPEECH_LANG_BY_LOCALE: Record<'cs' | 'sk' | 'de' | 'pl' | 'en', string> = {
  cs: 'cs-CZ',
  sk: 'sk-SK',
  de: 'de-DE',
  pl: 'pl-PL',
  en: 'en-US',
};

const copyByLocale = {
  cs: {
    title: 'Signal Boost',
    subtitle: 'Za 15 až 20 minut sepíšeš krátkou odpověď na reálnou situaci z role. Výsledkem je link, který ukáže recruiterovi tvůj první krok, priority a otázky.',
    loading: 'Připravuju konkrétní scénář…',
    loadError: 'Signal Boost se nepodařilo načíst.',
    publish: 'Vytvořit veřejný link',
    publishing: 'Vytvářím veřejný link',
    publishError: 'Signal Boost se nepodařilo publikovat.',
    close: 'Zavřít',
    sharpen: 'Ještě to zkonkretni',
    shareReady: 'Veřejný link je hotový',
    shareHint: 'Pošli ho spolu s klasickou přihláškou nebo krátkou zprávou náboráři.',
    shareRevoked: 'Veřejný link je vypnutý',
    shareRevokedHint: 'Odpověď zůstala uložená, ale veřejná stránka už není dostupná. Kdykoli ji můžeš znovu zveřejnit.',
    republish: 'Znovu zveřejnit link',
    copyLink: 'Kopírovat link',
    copied: 'Link zkopírován',
    openPublic: 'Otevřít veřejnou stránku',
    copyMessage: 'Kopírovat krátkou zprávu',
    messageCopied: 'Zpráva zkopírována',
    sendAlongTitle: 'Pošli to spolu s přihláškou',
    sendAlongBody: 'Normálně se přihlas a tenhle link přidej do krátké zprávy náboráři. Tím se dostaneš z CV šumu do konkrétního signálu.',
    importedHint: 'U převzaté role si otevři původní nabídku, odešli standardní přihlášku a přidej k ní tento link.',
    nativeHint: 'U role přímo na JobShamanu můžeš tenhle link poslat i samostatně jako rychlý první signál.',
    openOriginal: 'Otevřít původní nabídku',
    trackerTitle: 'Co se děje po odeslání',
    trackerBody: 'Tady uvidíš, jestli se na tvůj link někdo podíval a jestli udělal další krok.',
    trackerNotifyHint: 'Když náborář klikne dál, dáme ti vědět i tady a podle nastavení případně i push nebo e-mailem.',
    trackerShared: 'Link připravený a sdílitelný',
    trackerViewedWaiting: 'Čeká na první otevření',
    trackerViewedDone: 'Link už někdo otevřel',
    trackerActionWaiting: 'Zatím bez další akce',
    trackerActionDone: 'Náborář klikl dál',
    trackerViews: 'Otevření',
    trackerActions: 'Další kroky',
    trackerCopies: 'Kopírování',
    notesOptional: 'Volitelné',
    qualityTitle: 'Co ještě doostřit',
    empty: 'Zkus odpovědět konkrétně a po svém.',
    howToFallback: 'Jak na to',
    problemTitle: 'Tvoje zadání',
    excerptFallback: 'Z čeho vycházíme',
    aiAssistTitle: 'Nevíš, jak začít?',
    aiAssistBody: 'AI ti vyplní první verzi odpovědi do polí níže. Ty ji pak jen upravíš po svém.',
    aiAssistAction: 'AI pomoz mi začít',
    aiAssistLoading: 'AI připravuje první draft…',
    aiAssistDone: 'První draft je připravený níže.',
    taskOneLine: 'Jedna otázka, jeden první krok, jedna priorita.',
    starterExamples: 'Můžeš začít třeba takto:',
    starterUse: 'Vložit',
    progressLabel: 'Vyplněno',
    speak: 'Namluvit odpověď',
    speaking: 'Naslouchám…',
    speechUnavailable: 'Diktování není v tomto prohlížeči dostupné.',
    deliverableFallback: 'Ve své odpovědi ukaž',
    taskGuideTitle: 'Na co odpovídáš',
    taskGuideBody: 'Představ si, že jsi první týden v roli. Napiš, co je tady hlavní problém, co uděláš jako první a co si ještě potřebuješ ověřit.',
  },
  sk: {
    title: 'Signal Boost',
    subtitle: 'Za 15 až 20 minút spíšeš krátku odpoveď na reálnu situáciu z role. Výsledkom je link, ktorý ukáže náborárovi tvoj prvý krok, priority a otázky.',
    loading: 'Pripravujem konkrétny scenár…',
    loadError: 'Signal Boost sa nepodarilo načítať.',
    publish: 'Vytvoriť verejný link',
    publishing: 'Vytváram verejný link',
    publishError: 'Signal Boost sa nepodarilo publikovať.',
    close: 'Zavrieť',
    sharpen: 'Ešte to spresni',
    shareReady: 'Verejný link je hotový',
    shareHint: 'Pošli ho spolu s klasickou prihláškou alebo krátkou správou náborárovi.',
    shareRevoked: 'Verejný link je vypnutý',
    shareRevokedHint: 'Odpoveď zostala uložená, ale verejná stránka už nie je dostupná. Kedykoľvek ju môžeš znovu zverejniť.',
    republish: 'Znovu zverejniť link',
    copyLink: 'Kopírovať link',
    copied: 'Link skopírovaný',
    openPublic: 'Otvoriť verejnú stránku',
    copyMessage: 'Kopírovať krátku správu',
    messageCopied: 'Správa skopírovaná',
    sendAlongTitle: 'Pošli to spolu s prihláškou',
    sendAlongBody: 'Normálne sa prihlás a tento link pridaj do krátkej správy náborárovi. Tak sa dostaneš z CV šumu ku konkrétnemu signálu.',
    importedHint: 'Pri prevzatej role si otvor pôvodnú ponuku, pošli štandardnú prihlášku a pridaj k nej tento link.',
    nativeHint: 'Pri role priamo na JobShamane môžeš tento link poslať aj samostatne ako rýchly prvý signál.',
    openOriginal: 'Otvoriť pôvodnú ponuku',
    trackerTitle: 'Čo sa deje po odoslaní',
    trackerBody: 'Tu uvidíš, či si niekto tvoj link otvoril a či urobil ďalší krok.',
    trackerNotifyHint: 'Keď náborár klikne ďalej, dáme ti vedieť aj tu a podľa nastavení prípadne aj pushom alebo e-mailom.',
    trackerShared: 'Link pripravený a zdieľateľný',
    trackerViewedWaiting: 'Čaká na prvé otvorenie',
    trackerViewedDone: 'Link už niekto otvoril',
    trackerActionWaiting: 'Zatiaľ bez ďalšej akcie',
    trackerActionDone: 'Náborár klikol ďalej',
    trackerViews: 'Otvorenia',
    trackerActions: 'Ďalšie kroky',
    trackerCopies: 'Kopírovania',
    notesOptional: 'Voliteľné',
    qualityTitle: 'Čo ešte doostriť',
    empty: 'Skús odpovedať konkrétne a po svojom.',
    howToFallback: 'Ako na to',
    problemTitle: 'Tvoje zadanie',
    excerptFallback: 'Z čoho vychádzame',
    aiAssistTitle: 'Nevieš, ako začať?',
    aiAssistBody: 'AI ti vyplní prvú verziu odpovede do polí nižšie. Potom si ju upravíš po svojom.',
    aiAssistAction: 'AI pomôž mi začať',
    aiAssistLoading: 'AI pripravuje prvý draft…',
    aiAssistDone: 'Prvý draft je pripravený nižšie.',
    taskOneLine: 'Jedna otázka, jeden prvý krok, jedna priorita.',
    starterExamples: 'Začať môžeš napríklad takto:',
    starterUse: 'Vložiť',
    progressLabel: 'Vyplnené',
    speak: 'Nadiktovať odpoveď',
    speaking: 'Počúvam…',
    speechUnavailable: 'Diktovanie v tomto prehliadači nie je dostupné.',
    deliverableFallback: 'Vo svojej odpovedi ukáž',
    taskGuideTitle: 'Na čo odpovedáš',
    taskGuideBody: 'Predstav si, že si prvý týždeň v role. Napíš, čo je tu hlavný problém, čo urobíš ako prvé a čo si ešte potrebuješ overiť.',
  },
  de: {
    title: 'Signal Boost',
    subtitle: 'In 15 bis 20 Minuten formulieren Sie eine kurze Antwort auf eine reale Situation aus der Rolle. Das Ergebnis ist ein Link, der Recruiting Ihren ersten Schritt, Ihre Prioritäten und Fragen zeigt.',
    loading: 'Ein konkretes Szenario wird vorbereitet…',
    loadError: 'Signal Boost konnte nicht geladen werden.',
    publish: 'Öffentlichen Link erstellen',
    publishing: 'Öffentlicher Link wird erstellt',
    publishError: 'Signal Boost konnte nicht veröffentlicht werden.',
    close: 'Schließen',
    sharpen: 'Noch konkreter machen',
    shareReady: 'Der öffentliche Link ist fertig',
    shareHint: 'Senden Sie ihn zusammen mit Ihrer normalen Bewerbung oder einer kurzen Nachricht an das Recruiting-Team.',
    shareRevoked: 'Der öffentliche Link ist deaktiviert',
    shareRevokedHint: 'Die Antwort bleibt gespeichert, aber die öffentliche Seite ist nicht mehr erreichbar. Sie können sie jederzeit erneut veröffentlichen.',
    republish: 'Link erneut veröffentlichen',
    copyLink: 'Link kopieren',
    copied: 'Link kopiert',
    openPublic: 'Öffentliche Seite öffnen',
    copyMessage: 'Kurze Nachricht kopieren',
    messageCopied: 'Nachricht kopiert',
    sendAlongTitle: 'Mit der Bewerbung mitsenden',
    sendAlongBody: 'Bewerben Sie sich ganz normal und ergänzen Sie diesen Link in einer kurzen Nachricht an das Recruiting-Team. So wird aus CV-Rauschen ein konkretes Signal.',
    importedHint: 'Bei einer übernommenen Rolle öffnen Sie die Originalanzeige, senden die Standardbewerbung und fügen diesen Link hinzu.',
    nativeHint: 'Bei einer Rolle direkt auf JobShaman kann dieser Link auch allein als schneller erster Arbeitsimpuls gesendet werden.',
    openOriginal: 'Originalanzeige öffnen',
    trackerTitle: 'Was nach dem Senden passiert',
    trackerBody: 'Hier sehen Sie, ob jemand den Link geöffnet hat und ob danach noch ein weiterer Schritt passiert ist.',
    trackerNotifyHint: 'Wenn das Recruiting-Team weiterklickt, geben wir hier Bescheid und je nach Einstellung auch per Push oder E-Mail.',
    trackerShared: 'Link ist bereit und teilbar',
    trackerViewedWaiting: 'Wartet auf die erste Öffnung',
    trackerViewedDone: 'Link wurde bereits geöffnet',
    trackerActionWaiting: 'Noch keine weitere Aktion',
    trackerActionDone: 'Recruiting hat weitergeklickt',
    trackerViews: 'Öffnungen',
    trackerActions: 'Weitere Schritte',
    trackerCopies: 'Kopiervorgänge',
    notesOptional: 'Optional',
    qualityTitle: 'Was noch schärfer werden sollte',
    empty: 'Antworten Sie konkret und aus Ihrer eigenen Perspektive.',
    howToFallback: 'So gehen Sie vor',
    problemTitle: 'Ihre Aufgabe',
    excerptFallback: 'Wovon wir ausgehen',
    aiAssistTitle: 'Unsicher, wie Sie anfangen sollen?',
    aiAssistBody: 'Die KI füllt unten eine erste Entwurfsantwort aus. Danach passen Sie sie in Ihrer eigenen Sprache an.',
    aiAssistAction: 'KI hilft mir beim Start',
    aiAssistLoading: 'Die KI erstellt einen ersten Entwurf…',
    aiAssistDone: 'Ein erster Entwurf steht unten bereit.',
    taskOneLine: 'Eine Frage, ein erster Schritt, eine Priorität.',
    starterExamples: 'Sie könnten zum Beispiel so beginnen:',
    starterUse: 'Einfügen',
    progressLabel: 'Ausgefüllt',
    speak: 'Antwort diktieren',
    speaking: 'Ich höre zu…',
    speechUnavailable: 'Diktieren ist in diesem Browser nicht verfügbar.',
    deliverableFallback: 'In Ihrer Antwort sollte sichtbar werden',
    taskGuideTitle: 'Worauf Sie antworten',
    taskGuideBody: 'Stellen Sie sich vor, Sie sind in Ihrer ersten Woche in dieser Rolle. Schreiben Sie, was hier das Hauptproblem ist, was Sie zuerst tun würden und was Sie noch klären müssten.',
  },
  pl: {
    title: 'Signal Boost',
    subtitle: 'W 15 do 20 minut przygotujesz krótką odpowiedź na realną sytuację z tej roli. Efektem będzie link pokazujący rekruterowi Twój pierwszy krok, priorytety i pytania.',
    loading: 'Przygotowuję konkretny scenariusz…',
    loadError: 'Nie udało się załadować Signal Boost.',
    publish: 'Utwórz publiczny link',
    publishing: 'Tworzę publiczny link',
    publishError: 'Nie udało się opublikować Signal Boost.',
    close: 'Zamknij',
    sharpen: 'Doprecyzuj to jeszcze',
    shareReady: 'Publiczny link jest gotowy',
    shareHint: 'Wyślij go razem ze zwykłym zgłoszeniem albo krótką wiadomością do rekrutera.',
    shareRevoked: 'Publiczny link jest wyłączony',
    shareRevokedHint: 'Odpowiedź nadal jest zapisana, ale publiczna strona nie jest już dostępna. W każdej chwili możesz ją ponownie opublikować.',
    republish: 'Opublikuj link ponownie',
    copyLink: 'Skopiuj link',
    copied: 'Link skopiowany',
    openPublic: 'Otwórz stronę publiczną',
    copyMessage: 'Skopiuj krótką wiadomość',
    messageCopied: 'Wiadomość skopiowana',
    sendAlongTitle: 'Wyślij to razem ze zgłoszeniem',
    sendAlongBody: 'Zgłoś się normalnie i dodaj ten link w krótkiej wiadomości do rekrutera. Dzięki temu wychodzisz poza szum samych CV.',
    importedHint: 'Przy przejętej roli otwórz oryginalne ogłoszenie, wyślij standardowe zgłoszenie i dołącz ten link.',
    nativeHint: 'Przy roli bezpośrednio w JobShaman możesz wysłać ten link także samodzielnie jako szybki pierwszy sygnał.',
    openOriginal: 'Otwórz oryginalne ogłoszenie',
    trackerTitle: 'Co dzieje się po wysłaniu',
    trackerBody: 'Tutaj zobaczysz, czy ktoś otworzył Twój link i czy wykonał kolejny krok.',
    trackerNotifyHint: 'Gdy rekruter kliknie dalej, damy Ci znać tutaj, a w zależności od ustawień także przez push lub e-mail.',
    trackerShared: 'Link gotowy do udostępnienia',
    trackerViewedWaiting: 'Czeka na pierwsze otwarcie',
    trackerViewedDone: 'Link został już otwarty',
    trackerActionWaiting: 'Na razie bez dalszej akcji',
    trackerActionDone: 'Rekruter kliknął dalej',
    trackerViews: 'Otwarcia',
    trackerActions: 'Dalsze kroki',
    trackerCopies: 'Kopiowania',
    notesOptional: 'Opcjonalne',
    qualityTitle: 'Co jeszcze warto wyostrzyć',
    empty: 'Odpowiedz konkretnie i po swojemu.',
    howToFallback: 'Jak do tego podejść',
    problemTitle: 'Twoje zadanie',
    excerptFallback: 'Punkt wyjścia',
    aiAssistTitle: 'Nie wiesz, jak zacząć?',
    aiAssistBody: 'AI wypełni poniżej pierwszą wersję odpowiedzi. Potem dopracujesz ją po swojemu.',
    aiAssistAction: 'AI pomóż mi zacząć',
    aiAssistLoading: 'AI przygotowuje pierwszy szkic…',
    aiAssistDone: 'Pierwszy szkic jest już poniżej.',
    taskOneLine: 'Jedno pytanie, jeden pierwszy krok, jeden priorytet.',
    starterExamples: 'Możesz zacząć na przykład tak:',
    starterUse: 'Wstaw',
    progressLabel: 'Uzupełnione',
    speak: 'Nagraj odpowiedź',
    speaking: 'Słucham…',
    speechUnavailable: 'Dyktowanie nie jest dostępne w tej przeglądarce.',
    deliverableFallback: 'W odpowiedzi pokaż',
    taskGuideTitle: 'Na co odpowiadasz',
    taskGuideBody: 'Wyobraź sobie, że jesteś w pierwszym tygodniu tej roli. Napisz, jaki jest tu główny problem, co zrobisz najpierw i co trzeba jeszcze sprawdzić.',
  },
  en: {
    title: 'Signal Boost',
    subtitle: 'In 15 to 20 minutes, you write a short response to a real situation from the role. The result is a link that shows the hiring team your first move, priorities, and questions.',
    loading: 'Preparing a concrete scenario…',
    loadError: 'Failed to load Signal Boost.',
    publish: 'Create public link',
    publishing: 'Creating public link',
    publishError: 'Failed to publish Signal Boost.',
    close: 'Close',
    sharpen: 'Make it more concrete',
    shareReady: 'Your public link is ready',
    shareHint: 'Send it with your normal application or a short note to the hiring team.',
    shareRevoked: 'Your public link is disabled',
    shareRevokedHint: 'Your response is still saved, but the public page is no longer available. You can republish it anytime.',
    republish: 'Republish link',
    copyLink: 'Copy link',
    copied: 'Link copied',
    openPublic: 'Open public page',
    copyMessage: 'Copy short note',
    messageCopied: 'Note copied',
    sendAlongTitle: 'Send this with your application',
    sendAlongBody: 'Apply normally and add this link to a short note for the hiring team. That moves you out of CV noise and into a concrete work signal.',
    importedHint: 'For a syndicated role, open the original listing, submit the standard application, and include this link with it.',
    nativeHint: 'For a role directly on JobShaman, you can also send this link on its own as a quick first signal.',
    openOriginal: 'Open original listing',
    trackerTitle: 'What happens after you send it',
    trackerBody: 'You will see here whether someone opened your link and whether they took a next step.',
    trackerNotifyHint: 'If the hiring team clicks further, we will surface it here and, depending on your settings, also via push or email.',
    trackerShared: 'Link ready and shareable',
    trackerViewedWaiting: 'Waiting for the first open',
    trackerViewedDone: 'Your link has already been opened',
    trackerActionWaiting: 'No follow-up action yet',
    trackerActionDone: 'Hiring team clicked further',
    trackerViews: 'Opens',
    trackerActions: 'Next steps',
    trackerCopies: 'Copies',
    notesOptional: 'Optional',
    qualityTitle: 'What to sharpen',
    empty: 'Try answering concretely and from your own perspective.',
    howToFallback: 'How to approach it',
    problemTitle: 'Your task',
    excerptFallback: 'What we are basing this on',
    aiAssistTitle: 'Not sure how to start?',
    aiAssistBody: 'AI will fill a first draft into the fields below. Then you can make it yours.',
    aiAssistAction: 'AI help me start',
    aiAssistLoading: 'AI is preparing a first draft…',
    aiAssistDone: 'A first draft is ready below.',
    taskOneLine: 'One question, one first move, one priority.',
    starterExamples: 'You could start with something like:',
    starterUse: 'Insert',
    progressLabel: 'Completed',
    speak: 'Dictate answer',
    speaking: 'Listening…',
    speechUnavailable: 'Voice dictation is not available in this browser.',
    deliverableFallback: 'In your answer, show',
    taskGuideTitle: 'What you are responding to',
    taskGuideBody: 'Imagine you are in your first week in the role. Write what the main problem is here, what you would do first, and what you would still need to clarify.',
  },
} as const;

const extraCopyByLocale = {
  cs: {
    roleContext: 'Role context',
    roleEvidence: 'Signály z inzerátu',
    focusAreas: 'Na co je role citlivá',
    questionPack: '3 konkrétní otázky pro tuhle roli',
    fitContext: 'Co si u téhle role upřímně hlídat',
    transferableStrengths: 'Co se do role dobře přenáší',
    stretchAreas: 'Kde to může být stretch',
    framingHint: 'Jak to chytře rámovat',
    whyItMatters: 'Proč je to důležité',
    recruiterSignal: 'Co z toho recruiter čte',
    readingGuide: 'Jak to bude recruiter číst',
  },
  sk: {
    roleContext: 'Role context',
    roleEvidence: 'Signály z inzerátu',
    focusAreas: 'Na čo je rola citlivá',
    questionPack: '3 konkrétne otázky pre túto rolu',
    fitContext: 'Čo si pri tejto role úprimne strážiť',
    transferableStrengths: 'Čo sa do role dobre prenáša',
    stretchAreas: 'Kde to môže byť stretch',
    framingHint: 'Ako to dobre zarámovať',
    whyItMatters: 'Prečo je to dôležité',
    recruiterSignal: 'Čo z toho recruiter číta',
    readingGuide: 'Ako to bude recruiter čítať',
  },
  de: {
    roleContext: 'Rollenkontext',
    roleEvidence: 'Signale aus dem Inserat',
    focusAreas: 'Worauf die Rolle sensibel reagiert',
    questionPack: '3 konkrete Fragen für diese Rolle',
    fitContext: 'Worauf Sie bei dieser Rolle ehrlich achten sollten',
    transferableStrengths: 'Was sich gut übertragen lässt',
    stretchAreas: 'Wo es ein Stretch sein könnte',
    framingHint: 'Wie man es gut rahmt',
    whyItMatters: 'Warum das wichtig ist',
    recruiterSignal: 'Was das Recruiting daraus liest',
    readingGuide: 'So wird das gelesen',
  },
  pl: {
    roleContext: 'Kontekst roli',
    roleEvidence: 'Sygnały z ogłoszenia',
    focusAreas: 'Na co ta rola jest wrażliwa',
    questionPack: '3 konkretne pytania dla tej roli',
    fitContext: 'Na co warto tu uczciwie uważać',
    transferableStrengths: 'Co dobrze przenosi się do tej roli',
    stretchAreas: 'Gdzie to może być stretch',
    framingHint: 'Jak to dobrze opowiedzieć',
    whyItMatters: 'Dlaczego to jest ważne',
    recruiterSignal: 'Co rekruter z tego czyta',
    readingGuide: 'Jak będzie to czytane',
  },
  en: {
    roleContext: 'Role Context',
    roleEvidence: 'Signals From The Listing',
    focusAreas: 'What The Role Is Sensitive To',
    questionPack: '3 Specific Questions For This Role',
    fitContext: 'What To Be Honest About In This Role',
    transferableStrengths: 'What Transfers Well',
    stretchAreas: 'Where It May Be A Stretch',
    framingHint: 'How To Frame It',
    whyItMatters: 'Why This Matters',
    recruiterSignal: 'What The Recruiter Reads From It',
    readingGuide: 'How Recruiters Will Read It',
  },
} as const;

const SignalBoostModal: React.FC<SignalBoostModalProps> = ({
  isOpen,
  job,
  userProfile,
  onClose,
}) => {
  const { i18n } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage || i18n.language || userProfile.preferredLocale || 'en');
  const copy = copyByLocale[locale] || copyByLocale.en;
  const extraCopy = extraCopyByLocale[locale] || extraCopyByLocale.en;
  const draftKey = useMemo(() => getDraftKey(job.id, userProfile.id || null), [job.id, userProfile.id]);
  const guestDraftKey = useMemo(() => getDraftKey(job.id, null), [job.id]);

  const [brief, setBrief] = useState<JobSignalBoostBrief | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedOutput, setPublishedOutput] = useState<JobSignalBoostOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nudges, setNudges] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [messageCopied, setMessageCopied] = useState(false);
  const [aiHelping, setAiHelping] = useState(false);
  const [aiStarterApplied, setAiStarterApplied] = useState(false);
  const [listeningSectionId, setListeningSectionId] = useState<string | null>(null);
  const recognitionRef = React.useRef<any>(null);
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;
  const speechAvailable = !!SpeechRecognition;
  const speechLanguage = SPEECH_LANG_BY_LOCALE[locale] || 'en-US';

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      setPublishedOutput(null);
      setNudges([]);
      setAiStarterApplied(false);
      try {
        const guestDraft = typeof window !== 'undefined' ? window.localStorage.getItem(guestDraftKey) : null;
        const ownDraft = typeof window !== 'undefined' ? window.localStorage.getItem(draftKey) : null;
        const sourceDraft = ownDraft || guestDraft;
        if (sourceDraft) {
          try {
            const parsed = JSON.parse(sourceDraft);
            if (parsed && typeof parsed === 'object') {
              setValues(parsed as Record<string, string>);
            }
          } catch {
            setValues({});
          }
        } else {
          setValues({});
        }

        const [nextBrief, existingOutput] = await Promise.all([
          fetchSignalBoostBrief(job.id, locale),
          fetchLatestSignalBoostOutputForJob(job.id).catch(() => null),
        ]);
        if (!cancelled) {
          setBrief(nextBrief);
          if (existingOutput) {
            setPublishedOutput(existingOutput);
            if (!sourceDraft) {
              setValues(existingOutput.response_payload || {});
            }
          }
          void trackAnalyticsEvent({
            event_type: 'signal_boost_brief_generated',
            feature: 'signal_boost_v1',
            metadata: { job_id: job.id, locale },
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError((loadError as Error)?.message || copy.loadError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [draftKey, guestDraftKey, isOpen, job.id, locale]);

  useEffect(() => () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !publishedOutput?.id) return;
    let cancelled = false;
    const interval = window.setInterval(() => {
      void fetchLatestSignalBoostOutputForJob(job.id)
        .then((nextOutput) => {
          if (!cancelled && nextOutput?.id === publishedOutput.id) {
            setPublishedOutput(nextOutput);
          }
        })
        .catch(() => undefined);
    }, 15000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [isOpen, job.id, publishedOutput?.id]);

  useEffect(() => {
    if (!isOpen) return;
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(values));
    } catch {
      // ignore persistence issues
    }
  }, [draftKey, isOpen, values]);

  const handleChange = (sectionId: string, nextValue: string) => {
    setValues((current) => ({ ...current, [sectionId]: nextValue }));
  };

  const handleUseStarterPrompt = (sectionId: string, starter: string) => {
    if (!starter.trim()) return;
    setValues((current) => {
      const existing = String(current[sectionId] || '').trim();
      return {
        ...current,
        [sectionId]: existing ? `${existing}\n\n${starter}` : starter,
      };
    });
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListeningSectionId(null);
  };

  const handleCloseModal = () => {
    stopListening();
    onClose();
  };

  const handleStartListening = (sectionId: string) => {
    if (!speechAvailable) {
      setError(copy.speechUnavailable);
      return;
    }
    if (listeningSectionId === sectionId) {
      stopListening();
      return;
    }
    stopListening();
    setError(null);
    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += ` ${String(result[0]?.transcript || '').trim()}`;
        }
      }
      if (finalText.trim()) {
        setValues((current) => {
          const existing = String(current[sectionId] || '').trim();
          return {
            ...current,
            [sectionId]: `${existing}${existing ? ' ' : ''}${finalText.trim()}`.trim(),
          };
        });
      }
    };
    recognition.onerror = () => {
      setListeningSectionId(null);
    };
    recognition.onend = () => {
      setListeningSectionId(null);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    setListeningSectionId(sectionId);
    recognition.start();
  };

  const handleGenerateStarter = async () => {
    if (!brief || aiHelping) return;
    setAiHelping(true);
    setError(null);
    setAiStarterApplied(false);
    try {
      const starter = await generateSignalBoostStarter(job.id, {
        locale: brief.locale,
        responsePayload: values,
      });
      setValues((current) => {
        const nextValues = { ...current };
        Object.entries(starter.responsePayload || {}).forEach(([sectionId, starterText]) => {
          const existing = String(current[sectionId] || '').trim();
          if (!existing || existing.length < 40) {
            nextValues[sectionId] = String(starterText || '');
          }
        });
        return nextValues;
      });
      setAiStarterApplied(true);
      void trackAnalyticsEvent({
        event_type: 'signal_boost_ai_starter_used',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, locale: brief.locale, used_ai: Boolean(starter.meta?.used_ai) },
      });
    } catch (starterError) {
      setError((starterError as Error)?.message || copy.loadError);
    } finally {
      setAiHelping(false);
    }
  };

  const handlePublish = async () => {
    if (!brief) return;
    setPublishing(true);
    setError(null);
    setNudges([]);
    setCopied(false);
    setMessageCopied(false);
    try {
      const response = publishedOutput
        ? await updateSignalBoostOutput(publishedOutput.id, {
            locale: brief.locale,
            responsePayload: values,
            scenarioPayload: brief,
            status: 'published',
          })
        : await publishSignalBoostOutput(job.id, {
            locale: brief.locale,
            responsePayload: values,
            scenarioPayload: brief,
            status: 'published',
          });
      setPublishedOutput(response.output);
      setNudges(response.qualityFlags?.nudges || []);
      window.localStorage.removeItem(draftKey);
      window.localStorage.removeItem(guestDraftKey);
      void trackAnalyticsEvent({
        event_type: 'signal_boost_output_published',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, output_id: response.output.id, locale: brief.locale },
      });
    } catch (publishError) {
      const maybeQuality = (publishError as Error & { qualityFlags?: { nudges?: string[] } }).qualityFlags;
      if (maybeQuality?.nudges?.length) {
        setNudges(maybeQuality.nudges);
        void trackAnalyticsEvent({
          event_type: 'signal_boost_genericity_nudge_shown',
          feature: 'signal_boost_v1',
          metadata: { job_id: job.id, locale: brief.locale },
        });
      }
      setError((publishError as Error)?.message || copy.publishError);
    } finally {
      setPublishing(false);
    }
  };

  const handleCopy = async () => {
    if (!publishedOutput?.share_url) return;
    try {
      await navigator.clipboard.writeText(publishedOutput.share_url);
      setCopied(true);
      void recordSignalBoostEvent(publishedOutput.id, 'share_copy');
      void trackAnalyticsEvent({
        event_type: 'signal_boost_share_link_copied',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, output_id: publishedOutput.id },
      });
    } catch {
      setCopied(false);
    }
  };

  const shareNote = useMemo(() => {
    if (!publishedOutput?.share_url) return '';
    if (locale === 'cs') return `Dobrý den, kromě klasické přihlášky posílám i krátký pracovní výstup k této roli: ${publishedOutput.share_url}`;
    if (locale === 'sk') return `Dobrý deň, okrem klasickej prihlášky posielam aj krátky pracovný výstup k tejto role: ${publishedOutput.share_url}`;
    if (locale === 'de') return `Guten Tag, zusätzlich zur normalen Bewerbung sende ich einen kurzen Arbeitsbeitrag zu dieser Rolle: ${publishedOutput.share_url}`;
    if (locale === 'pl') return `Dzień dobry, oprócz zwykłego zgłoszenia wysyłam też krótki materiał roboczy do tej roli: ${publishedOutput.share_url}`;
    return `Hi, alongside my normal application I am also sending a short 20-minute work signal for this role: ${publishedOutput.share_url}`;
  }, [locale, publishedOutput?.share_url]);

  const handleCopyMessage = async () => {
    if (!shareNote) return;
    try {
      await navigator.clipboard.writeText(shareNote);
      setMessageCopied(true);
      void trackAnalyticsEvent({
        event_type: 'signal_boost_apply_combo_used',
        feature: 'signal_boost_v1',
        metadata: { job_id: job.id, output_id: publishedOutput?.id, locale },
      });
    } catch {
      setMessageCopied(false);
    }
  };

  const handleOpenOriginalListing = () => {
    const targetUrl = String(job.url || publishedOutput?.job_snapshot?.url || '').trim();
    if (!targetUrl) return;
    if (publishedOutput?.id) {
      void recordSignalBoostEvent(publishedOutput.id, 'open_original_listing');
    }
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const trackerStats = useMemo(() => {
    const analytics = publishedOutput?.analytics || {};
    const views = Number(analytics.view || 0);
    const actions = Number(analytics.recruiter_cta_click || 0) + Number(analytics.open_original_listing || 0);
    const copies = Number(analytics.share_copy || 0);
    return { views, actions, copies };
  }, [publishedOutput?.analytics]);
  const isArchivedOutput = String(publishedOutput?.status || '').trim() === 'archived';

  const completedSectionCount = useMemo(
    () => brief?.structured_sections.filter((section) => String(values[section.id] || '').trim().length > 0).length || 0,
    [brief?.structured_sections, values],
  );
  const requiredSections = useMemo(
    () => brief?.structured_sections.filter((section) => !section.optional) || [],
    [brief?.structured_sections],
  );
  const optionalSections = useMemo(
    () => brief?.structured_sections.filter((section) => section.optional) || [],
    [brief?.structured_sections],
  );

  if (!isOpen) return null;

  return (
    <div className="app-modal-backdrop">
      <div className="absolute inset-0" onClick={handleCloseModal} />
      <div className="app-modal-panel mx-2 my-2 h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-4xl overflow-hidden animate-in zoom-in-95 duration-300 sm:mx-auto sm:my-0 sm:h-auto sm:max-h-[min(90vh,960px)] sm:w-full">
        <div className="app-modal-topline" />
        <div className="h-full overflow-y-auto p-4 sm:max-h-[min(90vh,960px)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="app-modal-kicker mb-2 inline-flex items-center gap-2">
                <Sparkles size={14} />
                {copy.title}
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[var(--text-strong)] sm:text-3xl">{job.title}</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 sm:leading-7 text-[var(--text-muted)]">{copy.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-full p-2 text-[var(--text-faint)] transition hover:bg-black/5 hover:text-[var(--text-strong)] dark:hover:bg-white/5"
            >
              <X size={20} />
            </button>
          </div>

          {loading ? (
            <div className="mt-8 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-6 text-sm text-[var(--text-muted)]">
              <div className="inline-flex items-center gap-3">
                <Loader2 size={18} className="animate-spin" />
                {copy.loading}
              </div>
            </div>
          ) : error && !brief ? (
            <div className="mt-8 rounded-[24px] border border-rose-200 bg-rose-50/80 px-5 py-4 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
              {error}
            </div>
          ) : brief ? (
            <div className="mt-8 space-y-6">
              {(() => {
                const roleContext = brief.role_context;
                const fitContext = brief.fit_context;
                const questionPack = brief.question_pack || [];
                return (
              <div className="rounded-[26px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-5 dark:bg-[rgba(var(--accent-rgb),0.12)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{brief.kicker}</div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] dark:bg-slate-950/70">
                    <TimerReset size={14} />
                    {brief.timebox}
                  </div>
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-[var(--text-strong)]">{brief.scenario_title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--text-muted)]">{brief.scenario_context}</p>
                <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-[rgba(var(--accent-rgb),0.14)] bg-white/85 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] dark:bg-slate-950/60">
                  {copy.taskOneLine}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(300px,0.8fr)]">
                  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/60">
                    <div className="rounded-[16px] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] p-4 dark:bg-[rgba(var(--accent-rgb),0.1)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                        {copy.taskGuideTitle}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-[var(--text)]">{copy.taskGuideBody}</p>
                    </div>
                    <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                      {brief.deliverable_title || copy.deliverableFallback}
                    </div>
                    <div className="mt-3 space-y-2">
                      {(brief.constraints || []).map((step) => (
                        <div key={step} className="flex gap-3 text-sm leading-6 text-[var(--text)]">
                          <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                    {questionPack.length ? (
                      <div className="mt-5">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                          {extraCopy.questionPack}
                        </div>
                        <div className="mt-3 space-y-3">
                          {questionPack.map((item) => (
                            <div key={item.id} className="rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                              <div className="text-sm font-semibold leading-6 text-[var(--text-strong)]">{item.question}</div>
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div className="rounded-[14px] border border-[var(--border-subtle)] bg-white/85 p-3 dark:bg-slate-950/40">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{extraCopy.whyItMatters}</div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{item.why_this_matters}</div>
                                </div>
                                <div className="rounded-[14px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-3 dark:bg-[rgba(var(--accent-rgb),0.1)]">
                                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--accent)]">{extraCopy.recruiterSignal}</div>
                                  <div className="mt-2 text-sm leading-6 text-[var(--text)]">{item.recruiter_signal}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="mt-4 text-sm font-semibold text-[var(--text-strong)]">{copy.aiAssistTitle}</div>
                    <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                      <button
                        type="button"
                        onClick={() => void handleGenerateStarter()}
                        disabled={aiHelping}
                        className="app-button-primary min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto"
                      >
                        {aiHelping ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {aiHelping ? copy.aiAssistLoading : copy.aiAssistAction}
                      </button>
                      <div className="min-w-0 text-xs leading-6 text-[var(--text-faint)]">
                        {aiStarterApplied ? copy.aiAssistDone : copy.aiAssistBody}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/60">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        {copy.progressLabel}
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-strong)]">
                        {completedSectionCount} / {brief.structured_sections.length}
                      </div>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                        style={{ width: `${Math.max((completedSectionCount / Math.max(brief.structured_sections.length, 1)) * 100, completedSectionCount > 0 ? 8 : 0)}%` }}
                      />
                    </div>
                    <div className="mt-4 rounded-[16px] border border-[rgba(var(--accent-rgb),0.18)] bg-[rgba(var(--accent-rgb),0.06)] p-4 dark:bg-[rgba(var(--accent-rgb),0.1)]">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                        {copy.taskGuideTitle}
                      </div>
                      <p className="mt-2 text-sm font-semibold leading-6 sm:text-base sm:leading-7 text-[var(--text-strong)]">{brief.core_problem}</p>
                    </div>
                    {(roleContext?.focus_areas?.length || roleContext?.job_evidence?.length) ? (
                      <div className="mt-4 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                          {extraCopy.roleContext}
                        </div>
                        {roleContext?.focus_areas?.length ? (
                          <div className="mt-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{extraCopy.focusAreas}</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {roleContext.focus_areas.map((item) => (
                                <span key={item} className="rounded-full border border-[var(--border-subtle)] bg-white/90 px-3 py-1.5 text-xs text-[var(--text)] dark:bg-slate-950/40">
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {roleContext?.job_evidence?.length ? (
                          <div className="mt-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{extraCopy.roleEvidence}</div>
                            <div className="mt-2 space-y-2">
                              {roleContext.job_evidence.map((item) => (
                                <div key={item} className="rounded-[14px] border border-[var(--border-subtle)] bg-white/85 px-3 py-2 text-sm leading-6 text-[var(--text)] dark:bg-slate-950/40">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {fitContext ? (
                      <div className="mt-4 rounded-[16px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-4 dark:bg-[rgba(var(--accent-rgb),0.1)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                          {extraCopy.fitContext}
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--text)]">{fitContext.headline}</p>
                        {fitContext.transferable_strengths?.length ? (
                          <div className="mt-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{extraCopy.transferableStrengths}</div>
                            <div className="mt-2 space-y-2">
                              {fitContext.transferable_strengths.map((item) => (
                                <div key={item} className="rounded-[14px] border border-[var(--border-subtle)] bg-white/85 px-3 py-2 text-sm leading-6 text-[var(--text)] dark:bg-slate-950/40">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {fitContext.stretch_areas?.length ? (
                          <div className="mt-4">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{extraCopy.stretchAreas}</div>
                            <div className="mt-2 space-y-2">
                              {fitContext.stretch_areas.map((item) => (
                                <div key={item} className="rounded-[14px] border border-[var(--border-subtle)] bg-white/85 px-3 py-2 text-sm leading-6 text-[var(--text)] dark:bg-slate-950/40">
                                  {item}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {fitContext.framing_hint ? (
                          <div className="mt-4 rounded-[14px] border border-[var(--border-subtle)] bg-white/85 p-3 dark:bg-slate-950/40">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{extraCopy.framingHint}</div>
                            <div className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{fitContext.framing_hint}</div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {brief.job_excerpt ? (
                      <details className="mt-4 rounded-[16px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4">
                        <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-faint)]">
                          {brief.job_excerpt_title || copy.excerptFallback}
                        </summary>
                        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{brief.job_excerpt}</p>
                      </details>
                    ) : null}
                    {brief.recruiter_reading_guide ? (
                      <div className="mt-4 rounded-[16px] border border-[rgba(var(--accent-rgb),0.16)] bg-[rgba(var(--accent-rgb),0.06)] p-4 dark:bg-[rgba(var(--accent-rgb),0.1)]">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent)]">
                          {extraCopy.readingGuide}
                        </div>
                        <p className="mt-2 text-sm leading-7 text-[var(--text)]">{brief.recruiter_reading_guide}</p>
                      </div>
                    ) : null}
                    <p className="mt-4 text-sm leading-7 text-[var(--text-muted)]">{brief.anti_generic_hint}</p>
                  </div>
                </div>
              </div>
                );
              })()}

              <div className="grid gap-4">
                {requiredSections.map((section, index) => {
                  const isOptional = Boolean(section.optional);
                  return (
                    <div key={section.id} className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.2)] bg-white/90 text-xs font-semibold text-[var(--accent)] dark:bg-slate-950/60">
                            {index + 1}
                          </div>
                          <div className="text-sm font-semibold text-[var(--text-strong)]">{section.title}</div>
                        </div>
                        {isOptional ? (
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                            {copy.notesOptional}
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm leading-6 text-[var(--text-muted)]">{section.hint}</p>
                        <button
                          type="button"
                          onClick={() => handleStartListening(section.id)}
                          className="inline-flex shrink-0 items-center gap-2 self-start rounded-full border border-[var(--border-subtle)] bg-white/90 px-3 py-1.5 text-xs font-semibold text-[var(--text-strong)] transition hover:border-[rgba(var(--accent-rgb),0.35)] dark:bg-slate-950/60"
                        >
                          <Mic size={14} className={listeningSectionId === section.id ? 'text-[var(--accent)]' : ''} />
                          {listeningSectionId === section.id ? copy.speaking : copy.speak}
                        </button>
                      </div>
                      {section.starter_prompts?.length ? (
                        <div className="mt-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">
                            {copy.starterExamples}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {section.starter_prompts.map((starter) => (
                              <button
                                key={`${section.id}-${starter}`}
                                type="button"
                                onClick={() => handleUseStarterPrompt(section.id, starter)}
                                className="rounded-full border border-[var(--border-subtle)] bg-white/90 px-3 py-1.5 text-left text-xs leading-5 text-[var(--text-muted)] transition hover:border-[rgba(var(--accent-rgb),0.35)] hover:text-[var(--text-strong)] dark:bg-slate-950/60"
                              >
                                <span className="font-semibold text-[var(--accent)]">{copy.starterUse}</span>{' '}
                                {starter}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      <textarea
                        value={values[section.id] || ''}
                        onChange={(event) => handleChange(section.id, event.target.value)}
                        rows={section.optional ? 4 : 5}
                        className="app-modal-input mt-4 min-h-[120px] resize-y sm:min-h-[132px]"
                        placeholder={section.placeholder || copy.empty}
                      />
                      <div className="mt-2 text-xs text-[var(--text-faint)]">
                        {(values[section.id] || '').trim().length} / {section.soft_max_chars || 720}
                      </div>
                    </div>
                  );
                })}
                {optionalSections.length ? (
                  <details className="rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-5">
                    <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text-strong)]">
                      {optionalSections[0]?.title}
                    </summary>
                    <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{optionalSections[0]?.hint}</p>
                    <textarea
                      value={values[optionalSections[0].id] || ''}
                      onChange={(event) => handleChange(optionalSections[0].id, event.target.value)}
                      rows={4}
                      className="app-modal-input mt-4 min-h-[112px] resize-y"
                      placeholder={optionalSections[0]?.placeholder || copy.empty}
                    />
                    <div className="mt-2 text-xs text-[var(--text-faint)]">
                      {(values[optionalSections[0].id] || '').trim().length} / {optionalSections[0]?.soft_max_chars || 420}
                    </div>
                  </details>
                ) : null}
              </div>

              {(nudges.length > 0 || error) ? (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/30 dark:bg-amber-950/20">
                  <div className="inline-flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                    <AlertCircle size={16} />
                    {copy.qualityTitle}
                  </div>
                  {error ? (
                    <p className="mt-3 text-sm leading-7 text-amber-900/80 dark:text-amber-100/80">{error}</p>
                  ) : null}
                  <div className="mt-3 space-y-2">
                    {nudges.map((item) => (
                      <div key={item} className="text-sm leading-7 text-amber-900/80 dark:text-amber-100/80">{item}</div>
                    ))}
                  </div>
                </div>
              ) : null}

              {publishedOutput ? (
                <div className={`rounded-[24px] p-5 ${isArchivedOutput ? 'border border-slate-300 bg-slate-50/90 dark:border-slate-700 dark:bg-slate-900/70' : 'border border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/30 dark:bg-emerald-950/20'}`}>
                  <div className={`text-sm font-semibold ${isArchivedOutput ? 'text-slate-900 dark:text-slate-100' : 'text-emerald-900 dark:text-emerald-100'}`}>
                    {isArchivedOutput ? copy.shareRevoked : copy.shareReady}
                  </div>
                  <p className={`mt-2 text-sm leading-7 ${isArchivedOutput ? 'text-slate-700 dark:text-slate-300' : 'text-emerald-900/80 dark:text-emerald-100/80'}`}>
                    {isArchivedOutput ? copy.shareRevokedHint : copy.shareHint}
                  </p>

                  {!isArchivedOutput ? (
                    <>
                      <div className="mt-4 rounded-[18px] border border-emerald-200/70 bg-white/90 px-4 py-3 text-sm text-slate-700 dark:border-emerald-900/30 dark:bg-slate-950/60 dark:text-slate-200">
                        <div className="break-all">
                          {publishedOutput.share_url}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                        <button type="button" onClick={handleCopy} className="app-button-primary min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto">
                          <Copy size={16} />
                          {copied ? copy.copied : copy.copyLink}
                        </button>
                        <a
                          href={publishedOutput.share_url}
                          target="_blank"
                          rel="noreferrer"
                          className="app-button-dock min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto"
                        >
                          <ExternalLink size={16} />
                          {copy.openPublic}
                        </a>
                      </div>
                      <div className="mt-5 rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/50">
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.sendAlongTitle}</div>
                        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{copy.sendAlongBody}</p>
                        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">
                          {job.listingKind === 'imported' ? copy.importedHint : copy.nativeHint}
                        </p>
                        <div className="mt-4 rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--text)]">
                          {shareNote}
                        </div>
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                          <button type="button" onClick={() => void handleCopyMessage()} className="app-button-secondary min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto">
                            <Copy size={16} />
                            {messageCopied ? copy.messageCopied : copy.copyMessage}
                          </button>
                          {job.listingKind === 'imported' && String(job.url || publishedOutput.job_snapshot?.url || '').trim() ? (
                            <button type="button" onClick={handleOpenOriginalListing} className="app-button-dock min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto">
                              <ExternalLink size={16} />
                              {copy.openOriginal}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-5 rounded-[20px] border border-[var(--border-subtle)] bg-white/85 p-4 dark:bg-slate-950/50">
                        <div className="text-sm font-semibold text-[var(--text-strong)]">{copy.trackerTitle}</div>
                        <p className="mt-2 text-sm leading-7 text-[var(--text-muted)]">{copy.trackerBody}</p>
                        <p className="mt-2 text-xs leading-6 text-[var(--text-faint)]">{copy.trackerNotifyHint}</p>
                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{copy.trackerShared}</div>
                            <div className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">{copy.shareReady}</div>
                          </div>
                          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{copy.trackerViews}</div>
                            <div className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                              {trackerStats.views > 0 ? copy.trackerViewedDone : copy.trackerViewedWaiting}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{trackerStats.views}</div>
                          </div>
                          <div className="rounded-[18px] border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{copy.trackerActions}</div>
                            <div className="mt-2 text-sm font-semibold text-[var(--text-strong)]">
                              {trackerStats.actions > 0 ? copy.trackerActionDone : copy.trackerActionWaiting}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-muted)]">{trackerStats.actions}</div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-[var(--text-faint)]">
                          {copy.trackerCopies}: {trackerStats.copies}
                        </div>
                      </div>
                    </>
                  ) : null}
                </div>
              ) : null}

              <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex flex-col gap-3 border-t border-[var(--border-subtle)] bg-[var(--surface-elevated)] px-4 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-4 sm:static sm:mx-0 sm:border-t-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <button type="button" onClick={handleCloseModal} className="app-button-secondary min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto">
                  {copy.close}
                </button>
                <button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={publishing || loading || !brief}
                  className="app-button-primary min-w-0 justify-center whitespace-normal px-4 py-3 text-center sm:w-auto"
                >
                  {publishing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {publishing ? copy.publishing : publishedOutput ? (isArchivedOutput ? copy.republish : copy.sharpen) : copy.publish}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SignalBoostModal;
