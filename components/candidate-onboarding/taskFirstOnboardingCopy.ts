import type {
  CandidateOnboardingIntent,
  CandidateOnboardingScenarioId,
} from '../../types';

type ScenarioCopy = {
  id: CandidateOnboardingScenarioId;
  title: string;
  context: string;
  problem: string;
};

type EntryOptionCopy = {
  title: string;
  body: string;
  hint: string;
};

export type TaskFirstOnboardingCopy = {
  entryEyebrow: string;
  entryHeadline: string;
  entryBody: string;
  entryOptions: Record<CandidateOnboardingIntent, EntryOptionCopy>;
  scenarioTitle: string;
  scenarioBody: string;
  scenarioSkip: string;
  scenarioContinue: string;
  timerLabel: string;
  timerSoft: string;
  answerPlaceholder: string;
  answerHint: string;
  answerTooShort: string;
  submit: string;
  processing: string;
  processingBody: string;
  processingBack: string;
  reflectionTitle: string;
  reflectionIntro: string;
  strengthsTitle: string;
  missesTitle: string;
  rolesTitle: string;
  reflectionCta: string;
  realityTitle: string;
  realityBody: string;
  realityCta: string;
  interestTitle: string;
  interestBody: string;
  interestPrompt: string;
  interestPlaceholder: string;
  interestHint: string;
  interestSkip: string;
  interestCta: string;
  intentTitle: string;
  intentBody: string;
  intentOptions: Record<CandidateOnboardingIntent, string>;
  intentCta: string;
  tasksTitle: string;
  tasksBody: string;
  tasksContinueTitle: string;
  tasksContinueBody: string;
  tasksContinueCta: string;
  tasksOptionalTitle: string;
  tasksEmptyTitle: string;
  tasksEmptyBody: string;
  tasksEmptyCta: string;
  taskCta: string;
  slotTitle: string;
  slotBody: string;
  slotCta: string;
  slotChange: string;
  slotsLabel: string;
  trialTitle: string;
  trialBody: string;
  decisionTitle: string;
  workedTitle: string;
  missedTitle: string;
  tradeoffsTitle: string;
  continueCompany: string;
  tryAnother: string;
  profileTitle: string;
  profileBody: string;
  skipForNow: string;
  saveAndContinue: string;
  finishTitle: string;
  finishBody: string;
  finishCta: string;
  locationTitle: string;
  locationBody: string;
  addressPlaceholder: string;
  verifyAddress: string;
  verifiedAddress: string;
  addressError: string;
  skillsTitle: string;
  skillsBody: string;
  skillsPlaceholder: string;
  preferencesTitle: string;
  preferencesBody: string;
  domainPlaceholder: string;
  desiredRolePlaceholder: string;
  seniorityLabel: string;
  salaryMinPlaceholder: string;
  salaryMaxPlaceholder: string;
  workArrangementLabel: string;
  workArrangementBody: string;
  workArrangementOptions: {
    remote: string;
    hybrid: string;
    onsite: string;
  };
  languagesLabel: string;
  languagesBody: string;
  preferencesError: string;
  supportingTitle: string;
  supportingBody: string;
  supportingPlaceholder: string;
  summaryTitle: string;
  summaryDomain: string;
  summaryRole: string;
  summarySeniority: string;
  summaryLocation: string;
  summarySetup: string;
  summarySalary: string;
  summaryLanguages: string;
  summarySkills: string;
  summaryMissingPrefix: string;
  profileDone: string;
  openProfile: string;
  back: string;
  scenarios: ScenarioCopy[];
};

const EN_COPY: TaskFirstOnboardingCopy = {
  entryEyebrow: 'First signal',
  entryHeadline: 'Where is your energy pulling you right now?',
  entryBody: 'Pick the doorway that matches your energy. No CV. No pressure. Just the first direction.',
  entryOptions: {
    explore_options: {
      title: "I'm looking for direction",
      body: 'I want to sense what kind of work could fit before I decide anything.',
      hint: 'We will start with signals and possible paths.',
    },
    compare_offers: {
      title: "I'm just looking around",
      body: 'I want a calm overview and a few relevant directions without getting pushed.',
      hint: 'You will get a light comparison, not a noisy dashboard.',
    },
    try_real_work: {
      title: "I'm ready for a change",
      body: 'I want to move, test myself, and see what opens when things get real.',
      hint: 'If it fits, we can connect you to a live task.',
    },
  },
  scenarioTitle: 'Pick a scenario or let us choose one',
  scenarioBody: 'One small situation. One real move.',
  scenarioSkip: 'Skip choice',
  scenarioContinue: 'Use this scenario',
  timerLabel: 'You have 5 minutes',
  timerSoft: 'Soft timer. No rush.',
  answerPlaceholder: 'What would you do first?',
  answerHint: 'Keep it concrete. First move, first check, first signal.',
  answerTooShort: 'Add a bit more so we can reflect your thinking, not just your tone.',
  submit: 'Submit',
  processing: 'Thinking with you…',
  processingBody: 'If this takes longer, we will move you forward automatically. You can also go back without losing your answer.',
  processingBack: 'Back to my answer',
  reflectionTitle: 'Here is how you approached it',
  reflectionIntro: 'No score. Just a clearer signal.',
  strengthsTitle: 'What showed up',
  missesTitle: 'What stayed quieter',
  rolesTitle: 'Where this energy could fit',
  reflectionCta: 'Show me more',
  realityTitle: 'Reality check',
  realityBody: 'This is not about putting you in a box. It is about noticing the pattern underneath the answer.',
  realityCta: 'Interesting, show me more',
  interestTitle: 'What pulls you in naturally?',
  interestBody: 'Not the title on your CV. The work that gives you energy, curiosity, or that feeling of “I want more of this.”',
  interestPrompt: 'What do you actually enjoy doing, even if it is not your current job?',
  interestPlaceholder: 'For example: building prototypes, fixing what feels off, making chaotic things clearer, understanding how systems work…',
  interestHint: 'A few honest lines are enough.',
  interestSkip: 'Skip this for now',
  interestCta: 'Continue with this',
  intentTitle: 'What feels right as the next move?',
  intentBody: 'Choose the kind of next step that fits your energy right now.',
  intentOptions: {
    explore_options: 'Explore what could fit',
    compare_offers: 'See a few directions',
    try_real_work: 'Try a light real interaction',
  },
  intentCta: 'Continue',
  tasksTitle: 'Choose the next step',
  tasksBody: 'A real task is optional. Your signal matters even without it.',
  tasksContinueTitle: 'Keep the signal, skip the pressure',
  tasksContinueBody: 'You do not need to answer a job right now. Save how you think, what pulls you in, and what you want next.',
  tasksContinueCta: 'Continue without a task',
  tasksOptionalTitle: 'If you want, try a real task next',
  tasksEmptyTitle: 'We are lining up the next real task',
  tasksEmptyBody: 'Nothing live is ready here yet. You can still finish onboarding and we will bring you to the best next step.',
  tasksEmptyCta: 'Keep going',
  taskCta: 'Take this task',
  slotTitle: 'Reserve your spot',
  slotBody: 'A small number of live slots keeps this human and moving.',
  slotCta: 'Reserve your spot',
  slotChange: 'Choose another task',
  slotsLabel: 'slots',
  trialTitle: 'Real work, light version',
  trialBody: 'Respond to the situation directly. That is the signal.',
  decisionTitle: 'Does this make sense for you?',
  workedTitle: 'What worked',
  missedTitle: 'What did not',
  tradeoffsTitle: 'Trade-offs',
  continueCompany: 'Continue with this company',
  tryAnother: 'Try another',
  profileTitle: 'Strengthen your signal',
  profileBody: 'A few small details make the next dialogue sharper.',
  skipForNow: 'Skip for now',
  saveAndContinue: 'Save and continue',
  finishTitle: 'You are in',
  finishBody: 'The first signal is done. The next steps can stay light.',
  finishCta: 'Continue',
  locationTitle: 'Add your location',
  locationBody: 'So the next tasks respect your real radius.',
  addressPlaceholder: 'City or address',
  verifyAddress: 'Verify address',
  verifiedAddress: 'Address verified',
  addressError: 'We could not verify that address yet.',
  skillsTitle: 'Name your strongest skills',
  skillsBody: 'Three is enough for a much better next match.',
  skillsPlaceholder: 'For example: SQL, customer interviews, Python',
  preferencesTitle: 'Set your direction',
  preferencesBody: 'A few practical signals help us recommend challenges that match your real setup.',
  domainPlaceholder: 'Primary domain',
  desiredRolePlaceholder: 'Desired role',
  seniorityLabel: 'Seniority',
  salaryMinPlaceholder: 'Min salary',
  salaryMaxPlaceholder: 'Max salary',
  workArrangementLabel: 'How do you want to work?',
  workArrangementBody: 'This helps us prioritize remote, hybrid, or on-site challenges with less guesswork.',
  workArrangementOptions: {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'On-site',
  },
  languagesLabel: 'Which languages can you work in?',
  languagesBody: 'We use this mainly for challenge and role language, not to box you in.',
  preferencesError: 'Add a role, salary range, at least one language, and your preferred work setup.',
  supportingTitle: 'Add supporting context',
  supportingBody: 'Optional, but helpful when a team wants more signal.',
  supportingPlaceholder: 'A few lines about your context, projects, or what you want next.',
  summaryTitle: 'Profile snapshot',
  summaryDomain: 'Domain',
  summaryRole: 'Role',
  summarySeniority: 'Seniority',
  summaryLocation: 'Location',
  summarySetup: 'Setup',
  summarySalary: 'Salary',
  summaryLanguages: 'Languages',
  summarySkills: 'Strong skills',
  summaryMissingPrefix: 'To sharpen the next recommendations, still add',
  profileDone: 'Signal strengthened',
  openProfile: 'Open profile',
  back: 'Back',
  scenarios: [
    {
      id: 'product_dropoff',
      title: 'Notice what feels off',
      context: 'You walk into a place and something feels slightly off.',
      problem: 'What do you notice first?',
    },
    {
      id: 'broken_process',
      title: 'Untangle the mess',
      context: 'People are trying, but things keep slipping between them.',
      problem: 'What would you try to change first?',
    },
    {
      id: 'signal_analysis',
      title: 'Read the room',
      context: 'Nothing is openly broken, but something is not working.',
      problem: 'What signal would you trust first?',
    },
    {
      id: 'team_handoff',
      title: 'Make the first move',
      context: 'Different people see the same situation differently.',
      problem: 'How would you create movement without forcing it?',
    },
  ],
};

const CS_COPY: TaskFirstOnboardingCopy = {
  entryEyebrow: 'První signál',
  entryHeadline: 'Kam tě to teď táhne?',
  entryBody: 'Vyber vstup, který sedí tvé energii. Bez CV. Bez tlaku. Jen první směr.',
  entryOptions: {
    explore_options: {
      title: 'Hledám směr',
      body: 'Chci si nejdřív ujasnit, jaká práce by mi mohla opravdu sedět.',
      hint: 'Začneme signály a možnými cestami.',
    },
    compare_offers: {
      title: 'Jen se rozhlížím',
      body: 'Chci klidný přehled a pár relevantních směrů bez tlaku na rychlé rozhodnutí.',
      hint: 'Dostaneš lehké srovnání, ne hlučný dashboard.',
    },
    try_real_work: {
      title: 'Chci změnu',
      body: 'Jsem připravený(á) se pohnout a zjistit, co se otevře, když to bude trochu reálnější.',
      hint: 'Když to sedne, navážeme i na živý task.',
    },
  },
  scenarioTitle: 'Vyber situaci nebo ji nech na nás',
  scenarioBody: 'Jedna malá situace. Jeden reálný tah.',
  scenarioSkip: 'Přeskočit výběr',
  scenarioContinue: 'Vzít tuto situaci',
  timerLabel: 'Máš 5 minut',
  timerSoft: 'Jemný timer. Bez tlaku.',
  answerPlaceholder: 'Co bys udělal(a) jako první?',
  answerHint: 'Buď konkrétní. První tah, první check, první signál.',
  answerTooShort: 'Přidej ještě trochu kontextu, ať čteme přemýšlení, ne jen tón.',
  submit: 'Odeslat',
  processing: 'Přemýšlíme s tebou…',
  processingBody: 'Když se to zdrží, posuneme tě dál automaticky. Můžeš se taky vrátit bez ztráty odpovědi.',
  processingBack: 'Zpět k odpovědi',
  reflectionTitle: 'Takhle jsi k tomu přistoupil(a)',
  reflectionIntro: 'Bez skóre. Jen čistší signál.',
  strengthsTitle: 'Co se ukázalo',
  missesTitle: 'Co zůstalo tišší',
  rolesTitle: 'Kde by tahle energie mohla sedět',
  reflectionCta: 'Ukaž mi víc',
  realityTitle: 'Reality check',
  realityBody: 'Nejde o to zařadit tě do škatulky. Jde o to všimnout si vzorce pod odpovědí.',
  realityCta: 'Zajímavé, ukaž víc',
  interestTitle: 'Co tě přirozeně táhne?',
  interestBody: 'Ne název role v CV. Spíš práce, která ti dává energii, zvědavost nebo ten pocit „tohle chci dělat víc“.',
  interestPrompt: 'Co tě opravdu baví dělat, i když to není tvoje současná práce?',
  interestPlaceholder: 'Např. stavět prototypy, opravovat co je mimo, vnášet řád do chaosu, chápat jak věci fungují…',
  interestHint: 'Stačí pár upřímných vět.',
  interestSkip: 'Teď to přeskočit',
  interestCta: 'Pokračovat s tímhle',
  intentTitle: 'Jaký další krok ti teď sedí?',
  intentBody: 'Vyber si další krok podle své energie, ne podle tlaku.',
  intentOptions: {
    explore_options: 'Prozkoumat, co by sedělo',
    compare_offers: 'Podívat se na pár směrů',
    try_real_work: 'Zkusit lehkou reálnou interakci',
  },
  intentCta: 'Pokračovat',
  tasksTitle: 'Vyber další krok',
  tasksBody: 'Reálný task je volitelný. Tvůj signál má hodnotu i bez něj.',
  tasksContinueTitle: 'Ulož svůj signál bez tlaku',
  tasksContinueBody: 'Nemusíš teď odpovídat na nabídku. Stačí uložit, jak přemýšlíš, co tě táhne a co chceš dál.',
  tasksContinueCta: 'Pokračovat bez tasku',
  tasksOptionalTitle: 'Jestli chceš, zkus pak i reálný task',
  tasksEmptyTitle: 'Řadíme pro tebe další reálný task',
  tasksEmptyBody: 'Teď tu ještě není nic živého k otevření. Onboarding ale můžeš normálně dokončit a navážeme tě na další nejlepší krok.',
  tasksEmptyCta: 'Pokračovat dál',
  taskCta: 'Vzít tenhle task',
  slotTitle: 'Rezervuj si místo',
  slotBody: 'Malý počet aktivních slotů drží celý flow lidský a svižný.',
  slotCta: 'Rezervovat místo',
  slotChange: 'Vybrat jiný task',
  slotsLabel: 'slotů',
  trialTitle: 'Reálná práce, lehká verze',
  trialBody: 'Reaguj přímo na situaci. To je hlavní signál.',
  decisionTitle: 'Dává ti to smysl?',
  workedTitle: 'Co fungovalo',
  missedTitle: 'Co nefungovalo',
  tradeoffsTitle: 'Trade-offy',
  continueCompany: 'Pokračovat s tou firmou',
  tryAnother: 'Zkusit jiný',
  profileTitle: 'Zesil svůj signál',
  profileBody: 'Pár malých detailů zpřesní další dialog.',
  skipForNow: 'Teď přeskočit',
  saveAndContinue: 'Uložit a pokračovat',
  finishTitle: 'Jsi uvnitř',
  finishBody: 'První signál je hotový. Další kroky můžou zůstat lehké.',
  finishCta: 'Pokračovat',
  locationTitle: 'Doplň lokaci',
  locationBody: 'Ať další tasky respektují tvůj reálný okruh.',
  addressPlaceholder: 'Město nebo adresa',
  verifyAddress: 'Ověřit adresu',
  verifiedAddress: 'Adresa ověřena',
  addressError: 'Tuhle adresu se zatím nepodařilo ověřit.',
  skillsTitle: 'Pojmenuj své nejsilnější skills',
  skillsBody: 'Tři stačí pro výrazně lepší další match.',
  skillsPlaceholder: 'Např. SQL, rozhovory se zákazníky, Python',
  preferencesTitle: 'Nastav směr',
  preferencesBody: 'Pár praktických signálů nám pomůže doporučovat challenge podle tvé reálné situace.',
  domainPlaceholder: 'Hlavní obor',
  desiredRolePlaceholder: 'Cílová role',
  seniorityLabel: 'Seniorita',
  salaryMinPlaceholder: 'Min mzda',
  salaryMaxPlaceholder: 'Max mzda',
  workArrangementLabel: 'Jak chceš pracovat?',
  workArrangementBody: 'Podle toho pak líp upřednostníme remote, hybrid nebo nabídky na místě.',
  workArrangementOptions: {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Na místě',
  },
  languagesLabel: 'V jakých jazycích můžeš pracovat?',
  languagesBody: 'Použijeme to hlavně pro jazyk challenge a nabídek, ne jako škatulku.',
  preferencesError: 'Doplň roli, mzdové rozpětí, aspoň jeden jazyk a režim práce, který ti sedí.',
  supportingTitle: 'Přidej podpůrný kontext',
  supportingBody: 'Volitelné, ale užitečné, když tým chce víc signálu.',
  supportingPlaceholder: 'Pár vět o kontextu, projektech nebo tom, co chceš dál.',
  summaryTitle: 'Profilový snapshot',
  summaryDomain: 'Obor',
  summaryRole: 'Role',
  summarySeniority: 'Seniorita',
  summaryLocation: 'Lokalita',
  summarySetup: 'Režim',
  summarySalary: 'Mzda',
  summaryLanguages: 'Jazyky',
  summarySkills: 'Silné skills',
  summaryMissingPrefix: 'Aby další doporučení dávala větší smysl, ještě doplň',
  profileDone: 'Signál zesílen',
  openProfile: 'Otevřít profil',
  back: 'Zpět',
  scenarios: [
    {
      id: 'product_dropoff',
      title: 'Všimni si, co je mimo',
      context: 'Vejdeš do prostoru a něco působí lehce mimo.',
      problem: 'Čeho si všimneš jako první?',
    },
    {
      id: 'broken_process',
      title: 'Rozpleť zmatek',
      context: 'Lidé se snaží, ale věci mezi nimi pořád propadávají.',
      problem: 'Co bys zkusil(a) změnit jako první?',
    },
    {
      id: 'signal_analysis',
      title: 'Přečti situaci',
      context: 'Nic není otevřeně rozbité, ale něco nefunguje.',
      problem: 'Jakému signálu bys věřil(a) jako prvnímu?',
    },
    {
      id: 'team_handoff',
      title: 'Udělej první tah',
      context: 'Různí lidé vidí stejnou situaci různě.',
      problem: 'Jak bys rozhýbal(a) věci bez tlačení?',
    },
  ],
};

const SK_COPY: TaskFirstOnboardingCopy = {
  entryEyebrow: 'Prvý signál',
  entryHeadline: 'Kam ťa to teraz ťahá?',
  entryBody: 'Vyber vstup, ktorý sedí tvojej energii. Bez CV. Bez tlaku. Len prvý smer.',
  entryOptions: {
    explore_options: {
      title: 'Hľadám smer',
      body: 'Chcem si najprv ujasniť, aká práca by mi mohla naozaj sedieť.',
      hint: 'Začneme signálmi a možnými cestami.',
    },
    compare_offers: {
      title: 'Len sa rozhliadam',
      body: 'Chcem pokojný prehľad a pár relevantných smerov bez tlaku na rýchle rozhodnutie.',
      hint: 'Dostaneš ľahké porovnanie, nie hlučný dashboard.',
    },
    try_real_work: {
      title: 'Chcem zmenu',
      body: 'Som pripravený(á) pohnúť sa a zistiť, čo sa otvorí, keď to bude o niečo reálnejšie.',
      hint: 'Ak to sadne, nadviažeme aj na živý task.',
    },
  },
  scenarioTitle: 'Vyber situáciu alebo ju nechaj na nás',
  scenarioBody: 'Jedna malá situácia. Jeden reálny ťah.',
  scenarioSkip: 'Preskočiť výber',
  scenarioContinue: 'Vzít túto situáciu',
  timerLabel: 'Máš 5 minút',
  timerSoft: 'Jemný timer. Bez tlaku.',
  answerPlaceholder: 'Čo by si urobil(a) ako prvé?',
  answerHint: 'Buď konkrétny. Prvý ťah, prvý check, prvý signál.',
  answerTooShort: 'Pridaj ešte trochu kontextu, nech čítame premýšľanie, nielen tón.',
  submit: 'Odoslať',
  processing: 'Premýšľame s tebou…',
  processingBody: 'Ak sa to zdrží, posunieme ťa ďalej automaticky. Môžeš sa tiež vrátiť bez straty odpovede.',
  processingBack: 'Späť k odpovedi',
  reflectionTitle: 'Takto si k tomu pristúpil(a)',
  reflectionIntro: 'Bez skóre. Len čistejší signál.',
  strengthsTitle: 'Čo sa ukázalo',
  missesTitle: 'Čo zostalo tichšie',
  rolesTitle: 'Kde by táto energia mohla sedieť',
  reflectionCta: 'Ukáž mi viac',
  realityTitle: 'Reality check',
  realityBody: 'Nejde o to zaradiť ťa do škatuľky. Ide o to všimnúť si vzorec pod odpoveďou.',
  realityCta: 'Zaujímavé, ukáž viac',
  interestTitle: 'Čo ťa prirodzene ťahá?',
  interestBody: 'Nie názov role v CV. Skôr práca, ktorá ti dáva energiu, zvedavosť alebo ten pocit „tohto chcem viac“.',
  interestPrompt: 'Čo ťa naozaj baví robiť, aj keď to nie je tvoja súčasná práca?',
  interestPlaceholder: 'Napr. stavať prototypy, opravovať čo je mimo, vnášať poriadok do chaosu, chápať ako veci fungujú…',
  interestHint: 'Stačí pár úprimných viet.',
  interestSkip: 'Teraz to preskočiť',
  interestCta: 'Pokračovať s týmto',
  intentTitle: 'Aký ďalší krok ti teraz sedí?',
  intentBody: 'Vyber si ďalší krok podľa svojej energie, nie podľa tlaku.',
  intentOptions: {
    explore_options: 'Preskúmať, čo by sedelo',
    compare_offers: 'Pozrieť sa na pár smerov',
    try_real_work: 'Skúsiť ľahkú reálnu interakciu',
  },
  intentCta: 'Pokračovať',
  tasksTitle: 'Vyber ďalší krok',
  tasksBody: 'Reálny task je voliteľný. Tvoj signál má hodnotu aj bez neho.',
  tasksContinueTitle: 'Ulož svoj signál bez tlaku',
  tasksContinueBody: 'Nemusíš teraz odpovedať na ponuku. Stačí uložiť, ako premýšľaš, čo ťa ťahá a čo chceš ďalej.',
  tasksContinueCta: 'Pokračovať bez tasku',
  tasksOptionalTitle: 'Ak chceš, skús potom aj reálny task',
  tasksEmptyTitle: 'Pripravujeme pre teba ďalší reálny task',
  tasksEmptyBody: 'Teraz tu ešte nie je nič živé na otvorenie. Onboarding však môžeš normálne dokončiť a posunieme ťa na ďalší najlepší krok.',
  tasksEmptyCta: 'Pokračovať ďalej',
  taskCta: 'Vzít tento task',
  slotTitle: 'Rezervuj si miesto',
  slotBody: 'Malý počet aktívnych slotov drží celý flow ľudský a svižný.',
  slotCta: 'Rezervovať miesto',
  slotChange: 'Vybrať iný task',
  slotsLabel: 'slotov',
  trialTitle: 'Reálna práca, ľahká verzia',
  trialBody: 'Reaguj priamo na situáciu. To je hlavný signál.',
  decisionTitle: 'Dáva ti to zmysel?',
  workedTitle: 'Čo fungovalo',
  missedTitle: 'Čo nefungovalo',
  tradeoffsTitle: 'Trade-offy',
  continueCompany: 'Pokračovať s touto firmou',
  tryAnother: 'Skúsiť iný',
  profileTitle: 'Zosilni svoj signál',
  profileBody: 'Pár malých detailov spresní ďalší dialóg.',
  skipForNow: 'Teraz preskočiť',
  saveAndContinue: 'Uložiť a pokračovať',
  finishTitle: 'Si vo vnútri',
  finishBody: 'Prvý signál je hotový. Ďalšie kroky môžu zostať ľahké.',
  finishCta: 'Pokračovať',
  locationTitle: 'Doplň lokalitu',
  locationBody: 'Aby ďalšie tasky rešpektovali tvoj reálny okruh.',
  addressPlaceholder: 'Mesto alebo adresa',
  verifyAddress: 'Overiť adresu',
  verifiedAddress: 'Adresa overená',
  addressError: 'Túto adresu sa zatiaľ nepodarilo overiť.',
  skillsTitle: 'Pomenuj svoje najsilnejšie skills',
  skillsBody: 'Tri stačia na výrazne lepší ďalší match.',
  skillsPlaceholder: 'Napr. SQL, rozhovory so zákazníkmi, Python',
  preferencesTitle: 'Nastav smer',
  preferencesBody: 'Pár praktických signálov nám pomôže odporúčať challenge podľa tvojej reálnej situácie.',
  domainPlaceholder: 'Hlavný odbor',
  desiredRolePlaceholder: 'Cieľová rola',
  seniorityLabel: 'Seniorita',
  salaryMinPlaceholder: 'Min mzda',
  salaryMaxPlaceholder: 'Max mzda',
  workArrangementLabel: 'Ako chceš pracovať?',
  workArrangementBody: 'Podľa toho potom lepšie uprednostníme remote, hybrid alebo ponuky na mieste.',
  workArrangementOptions: {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Na mieste',
  },
  languagesLabel: 'V akých jazykoch môžeš pracovať?',
  languagesBody: 'Použijeme to hlavne pre jazyk challenge a ponúk, nie ako škatuľku.',
  preferencesError: 'Doplň rolu, mzdové rozpätie, aspoň jeden jazyk a režim práce, ktorý ti sedí.',
  supportingTitle: 'Pridaj podporný kontext',
  supportingBody: 'Voliteľné, ale užitočné, keď tím chce viac signálu.',
  supportingPlaceholder: 'Pár viet o kontexte, projektoch alebo tom, čo chceš ďalej.',
  summaryTitle: 'Profilový snapshot',
  summaryDomain: 'Odbor',
  summaryRole: 'Rola',
  summarySeniority: 'Seniorita',
  summaryLocation: 'Lokalita',
  summarySetup: 'Režim',
  summarySalary: 'Mzda',
  summaryLanguages: 'Jazyky',
  summarySkills: 'Silné skills',
  summaryMissingPrefix: 'Aby ďalšie odporúčania dávali väčší zmysel, ešte doplň',
  profileDone: 'Signál zosilnený',
  openProfile: 'Otvoriť profil',
  back: 'Späť',
  scenarios: [
    {
      id: 'product_dropoff',
      title: 'Všimni si, čo nesedí',
      context: 'Vojdeš do priestoru a niečo pôsobí jemne mimo.',
      problem: 'Čoho si všimneš ako prvého?',
    },
    {
      id: 'broken_process',
      title: 'Rozpleť zmätok',
      context: 'Ľudia sa snažia, ale veci medzi nimi stále prepadajú.',
      problem: 'Čo by si skúsil(a) zmeniť ako prvé?',
    },
    {
      id: 'signal_analysis',
      title: 'Prečítaj situáciu',
      context: 'Nič nie je otvorene pokazené, ale niečo nefunguje.',
      problem: 'Akému signálu by si veril(a) ako prvému?',
    },
    {
      id: 'team_handoff',
      title: 'Urob prvý ťah',
      context: 'Rôzni ľudia vidia tú istú situáciu rôzne.',
      problem: 'Ako by si rozhýbal(a) veci bez tlačenia?',
    },
  ],
};

const DE_COPY: TaskFirstOnboardingCopy = {
  entryEyebrow: 'Erstes Signal',
  entryHeadline: 'Wohin zieht es dich gerade?',
  entryBody: 'Wähle den Einstieg, der zu deiner Energie passt. Kein CV. Kein Druck. Nur die erste Richtung.',
  entryOptions: {
    explore_options: {
      title: 'Ich suche Richtung',
      body: 'Ich will zuerst spüren, welche Art von Arbeit wirklich zu mir passen könnte.',
      hint: 'Wir starten mit Signalen und möglichen Wegen.',
    },
    compare_offers: {
      title: 'Ich schaue mich nur um',
      body: 'Ich möchte einen ruhigen Überblick und ein paar relevante Richtungen ohne Entscheidungsdruck.',
      hint: 'Du bekommst einen leichten Vergleich, kein lautes Dashboard.',
    },
    try_real_work: {
      title: 'Ich will Veränderung',
      body: 'Ich bin bereit, mich zu bewegen und zu sehen, was sich öffnet, wenn es etwas realer wird.',
      hint: 'Wenn es passt, verbinden wir dich auch mit einer Live-Aufgabe.',
    },
  },
  scenarioTitle: 'Wähle eine Situation oder lass uns entscheiden',
  scenarioBody: 'Eine kleine Situation. Ein echter erster Zug.',
  scenarioSkip: 'Auswahl überspringen',
  scenarioContinue: 'Diese Situation nehmen',
  timerLabel: 'Du hast 5 Minuten',
  timerSoft: 'Sanfter Timer. Kein Stress.',
  answerPlaceholder: 'Was würdest du zuerst tun?',
  answerHint: 'Bleib konkret. Erster Schritt, erster Check, erstes Signal.',
  answerTooShort: 'Gib noch etwas mehr Kontext, damit wir dein Denken lesen können.',
  submit: 'Senden',
  processing: 'Wir denken mit dir…',
  processingBody: 'Wenn es länger dauert, bringen wir dich automatisch weiter. Du kannst auch ohne Verlust deiner Antwort zurückgehen.',
  processingBack: 'Zurück zu meiner Antwort',
  reflectionTitle: 'So bist du an die Sache herangegangen',
  reflectionIntro: 'Kein Score. Nur ein klareres Signal.',
  strengthsTitle: 'Was sichtbar wurde',
  missesTitle: 'Was leiser blieb',
  rolesTitle: 'Wo diese Energie gut landen könnte',
  reflectionCta: 'Zeig mir mehr',
  realityTitle: 'Reality Check',
  realityBody: 'Es geht nicht darum, dich in eine Schublade zu stecken. Es geht darum, das Muster unter deiner Antwort zu sehen.',
  realityCta: 'Interessant, zeig mehr',
  interestTitle: 'Was zieht dich ganz natürlich an?',
  interestBody: 'Nicht der Titel in deinem CV. Sondern die Art von Arbeit, die dir Energie, Neugier oder dieses Gefühl gibt: davon will ich mehr.',
  interestPrompt: 'Was machst du wirklich gern, auch wenn es nicht dein aktueller Job ist?',
  interestPlaceholder: 'Zum Beispiel: Prototypen bauen, merken was nicht stimmt, Chaos ordnen, verstehen wie Systeme funktionieren…',
  interestHint: 'Ein paar ehrliche Sätze reichen völlig.',
  interestSkip: 'Jetzt überspringen',
  interestCta: 'Damit weiter',
  intentTitle: 'Welcher nächste Schritt fühlt sich gerade richtig an?',
  intentBody: 'Wähle den nächsten Schritt nach deiner Energie, nicht nach Druck.',
  intentOptions: {
    explore_options: 'Erkunden, was passen könnte',
    compare_offers: 'Ein paar Richtungen ansehen',
    try_real_work: 'Eine leichte echte Interaktion testen',
  },
  intentCta: 'Weiter',
  tasksTitle: 'Wähle den nächsten Schritt',
  tasksBody: 'Eine echte Aufgabe ist optional. Dein Signal zählt auch ohne sie.',
  tasksContinueTitle: 'Behalte dein Signal, ohne Druck',
  tasksContinueBody: 'Du musst jetzt nicht auf einen Job antworten. Speichere einfach, wie du denkst, was dich wirklich zieht und was du als Nächstes suchst.',
  tasksContinueCta: 'Ohne Aufgabe weiter',
  tasksOptionalTitle: 'Wenn du willst, probiere danach eine echte Aufgabe',
  tasksEmptyTitle: 'Wir bereiten die nächste echte Aufgabe vor',
  tasksEmptyBody: 'Gerade ist hier noch nichts Livees zum Öffnen da. Du kannst das Onboarding trotzdem abschließen und wir bringen dich zum nächsten sinnvollen Schritt.',
  tasksEmptyCta: 'Weitergehen',
  taskCta: 'Diese Aufgabe nehmen',
  slotTitle: 'Reserviere deinen Platz',
  slotBody: 'Wenige aktive Slots halten den Flow menschlich und schnell.',
  slotCta: 'Platz reservieren',
  slotChange: 'Andere Aufgabe wählen',
  slotsLabel: 'Slots',
  trialTitle: 'Reale Arbeit, leichte Version',
  trialBody: 'Reagiere direkt auf die Situation. Das ist das eigentliche Signal.',
  decisionTitle: 'Ergibt das für dich Sinn?',
  workedTitle: 'Was funktioniert hat',
  missedTitle: 'Was nicht funktioniert hat',
  tradeoffsTitle: 'Trade-offs',
  continueCompany: 'Mit dieser Firma weitermachen',
  tryAnother: 'Eine andere probieren',
  profileTitle: 'Verstärke dein Signal',
  profileBody: 'Ein paar kleine Details machen den nächsten Dialog klarer.',
  skipForNow: 'Jetzt überspringen',
  saveAndContinue: 'Speichern und weiter',
  finishTitle: 'Du bist drin',
  finishBody: 'Das erste Signal ist gesetzt. Die nächsten Schritte können leicht bleiben.',
  finishCta: 'Weiter',
  locationTitle: 'Standort ergänzen',
  locationBody: 'Damit die nächsten Aufgaben deinen realen Radius respektieren.',
  addressPlaceholder: 'Stadt oder Adresse',
  verifyAddress: 'Adresse prüfen',
  verifiedAddress: 'Adresse bestätigt',
  addressError: 'Diese Adresse konnte noch nicht geprüft werden.',
  skillsTitle: 'Nenne deine stärksten Skills',
  skillsBody: 'Drei reichen schon für deutlich bessere nächste Treffer.',
  skillsPlaceholder: 'Zum Beispiel: SQL, Kundeninterviews, Python',
  preferencesTitle: 'Richtung setzen',
  preferencesBody: 'Ein paar praktische Signale helfen uns, Challenges passend zu Ihrer realen Situation zu empfehlen.',
  domainPlaceholder: 'Hauptbereich',
  desiredRolePlaceholder: 'Zielrolle',
  seniorityLabel: 'Seniorität',
  salaryMinPlaceholder: 'Min Gehalt',
  salaryMaxPlaceholder: 'Max Gehalt',
  workArrangementLabel: 'Wie möchten Sie arbeiten?',
  workArrangementBody: 'Damit priorisieren wir Remote-, Hybrid- oder Vor-Ort-Challenges deutlich genauer.',
  workArrangementOptions: {
    remote: 'Remote',
    hybrid: 'Hybrid',
    onsite: 'Vor Ort',
  },
  languagesLabel: 'In welchen Sprachen können Sie arbeiten?',
  languagesBody: 'Das nutzen wir vor allem für die Sprache von Challenges und Angeboten, nicht um Sie einzuengen.',
  preferencesError: 'Bitte Rolle, Gehaltsspanne, mindestens eine Sprache und Ihr bevorzugtes Arbeitsmodell ergänzen.',
  supportingTitle: 'Unterstützenden Kontext ergänzen',
  supportingBody: 'Optional, aber hilfreich, wenn ein Team mehr Signal sehen will.',
  supportingPlaceholder: 'Ein paar Zeilen zu deinem Kontext, Projekten oder dem, was du als Nächstes suchst.',
  summaryTitle: 'Profil-Snapshot',
  summaryDomain: 'Bereich',
  summaryRole: 'Rolle',
  summarySeniority: 'Seniorität',
  summaryLocation: 'Standort',
  summarySetup: 'Setup',
  summarySalary: 'Gehalt',
  summaryLanguages: 'Sprachen',
  summarySkills: 'Starke Skills',
  summaryMissingPrefix: 'Damit die nächsten Empfehlungen besser passen, ergänze noch',
  profileDone: 'Signal verstärkt',
  openProfile: 'Profil öffnen',
  back: 'Zurück',
  scenarios: [
    {
      id: 'product_dropoff',
      title: 'Merken, was nicht stimmt',
      context: 'Du kommst an einen Ort und irgendetwas fühlt sich leicht daneben an.',
      problem: 'Was fällt dir zuerst auf?',
    },
    {
      id: 'broken_process',
      title: 'Das Durcheinander entwirren',
      context: 'Die Menschen bemühen sich, aber Dinge rutschen immer wieder zwischen ihnen durch.',
      problem: 'Was würdest du als Erstes verändern?',
    },
    {
      id: 'signal_analysis',
      title: 'Den Raum lesen',
      context: 'Nichts ist offen kaputt, aber etwas funktioniert nicht.',
      problem: 'Welchem Signal würdest du zuerst vertrauen?',
    },
    {
      id: 'team_handoff',
      title: 'Den ersten Zug machen',
      context: 'Verschiedene Menschen sehen dieselbe Situation unterschiedlich.',
      problem: 'Wie würdest du Bewegung hineinbringen, ohne zu drücken?',
    },
  ],
};

const PL_COPY: TaskFirstOnboardingCopy = {
  entryEyebrow: 'Pierwszy sygnał',
  entryHeadline: 'Dokąd ciągnie Cię teraz najbardziej?',
  entryBody: 'Wybierz wejście, które pasuje do Twojej energii. Bez CV. Bez presji. Tylko pierwszy kierunek.',
  entryOptions: {
    explore_options: {
      title: 'Szukam kierunku',
      body: 'Chcę najpierw poczuć, jaki rodzaj pracy mógłby naprawdę do mnie pasować.',
      hint: 'Zaczniemy od sygnałów i możliwych ścieżek.',
    },
    compare_offers: {
      title: 'Tylko się rozglądam',
      body: 'Chcę spokojnego przeglądu i kilku trafnych kierunków bez presji szybkiej decyzji.',
      hint: 'Dostaniesz lekkie porównanie, nie głośny dashboard.',
    },
    try_real_work: {
      title: 'Chcę zmiany',
      body: 'Jestem gotowy(-a) ruszyć się i zobaczyć, co otworzy się, gdy zrobi się trochę bardziej realnie.',
      hint: 'Jeśli to kliknie, połączymy Cię też z żywym zadaniem.',
    },
  },
  scenarioTitle: 'Wybierz sytuację albo zostaw wybór nam',
  scenarioBody: 'Jedna mała sytuacja. Jeden realny ruch.',
  scenarioSkip: 'Pomiń wybór',
  scenarioContinue: 'Weź tę sytuację',
  timerLabel: 'Masz 5 minut',
  timerSoft: 'Delikatny timer. Bez presji.',
  answerPlaceholder: 'Co zrobił(a)byś najpierw?',
  answerHint: 'Bądź konkretny(a). Pierwszy ruch, pierwszy check, pierwszy sygnał.',
  answerTooShort: 'Dodaj trochę więcej kontekstu, żeby było widać sposób myślenia.',
  submit: 'Wyślij',
  processing: 'Myślimy razem z Tobą…',
  processingBody: 'Jeśli to potrwa dłużej, przesuniemy Cię dalej automatycznie. Możesz też wrócić bez utraty odpowiedzi.',
  processingBack: 'Wróć do odpowiedzi',
  reflectionTitle: 'Tak do tego podszedłeś(-aś)',
  reflectionIntro: 'Bez wyniku. Tylko wyraźniejszy sygnał.',
  strengthsTitle: 'Co się pokazało',
  missesTitle: 'Co zostało cichsze',
  rolesTitle: 'Gdzie ta energia może pasować',
  reflectionCta: 'Pokaż więcej',
  realityTitle: 'Reality check',
  realityBody: 'Nie chodzi o włożenie Cię do szufladki. Chodzi o zauważenie wzorca pod odpowiedzią.',
  realityCta: 'Ciekawe, pokaż więcej',
  interestTitle: 'Co naturalnie Cię przyciąga?',
  interestBody: 'Nie tytuł z CV. Tylko taki rodzaj pracy, który daje Ci energię, ciekawość albo poczucie: tego chcę więcej.',
  interestPrompt: 'Co naprawdę lubisz robić, nawet jeśli to nie jest Twoja obecna praca?',
  interestPlaceholder: 'Na przykład: budowanie prototypów, wyłapywanie co nie gra, porządkowanie chaosu, rozumienie jak działają systemy…',
  interestHint: 'Wystarczy kilka szczerych zdań.',
  interestSkip: 'Pomiń na teraz',
  interestCta: 'Kontynuuj z tym',
  intentTitle: 'Jaki następny krok jest dla Ciebie teraz właściwy?',
  intentBody: 'Wybierz kolejny krok według swojej energii, nie presji.',
  intentOptions: {
    explore_options: 'Zobacz, co może pasować',
    compare_offers: 'Zobacz kilka kierunków',
    try_real_work: 'Spróbuj lekkiej realnej interakcji',
  },
  intentCta: 'Dalej',
  tasksTitle: 'Wybierz kolejny krok',
  tasksBody: 'Realne zadanie jest opcjonalne. Twój sygnał ma wartość także bez niego.',
  tasksContinueTitle: 'Zachowaj swój sygnał bez presji',
  tasksContinueBody: 'Nie musisz teraz odpowiadać na ofertę. Wystarczy zapisać, jak myślisz, co Cię naprawdę pociąga i czego szukasz dalej.',
  tasksContinueCta: 'Kontynuuj bez zadania',
  tasksOptionalTitle: 'Jeśli chcesz, potem spróbuj też realnego zadania',
  tasksEmptyTitle: 'Ustawiamy dla Ciebie kolejne realne zadanie',
  tasksEmptyBody: 'Na ten moment nie ma tu jeszcze aktywnego zadania do otwarcia. Nadal możesz normalnie dokończyć onboarding i przejść do najlepszego następnego kroku.',
  tasksEmptyCta: 'Idź dalej',
  taskCta: 'Weź to zadanie',
  slotTitle: 'Zarezerwuj miejsce',
  slotBody: 'Mała liczba aktywnych slotów utrzymuje ten flow ludzki i szybki.',
  slotCta: 'Zarezerwuj miejsce',
  slotChange: 'Wybierz inne zadanie',
  slotsLabel: 'slotów',
  trialTitle: 'Realna praca, lekka wersja',
  trialBody: 'Odpowiedz bezpośrednio na sytuację. To jest główny sygnał.',
  decisionTitle: 'Czy to ma dla Ciebie sens?',
  workedTitle: 'Co zadziałało',
  missedTitle: 'Co nie zadziałało',
  tradeoffsTitle: 'Trade-offy',
  continueCompany: 'Kontynuuj z tą firmą',
  tryAnother: 'Spróbuj innej',
  profileTitle: 'Wzmocnij swój sygnał',
  profileBody: 'Kilka małych detali wyostrzy kolejny dialog.',
  skipForNow: 'Pomiń na teraz',
  saveAndContinue: 'Zapisz i dalej',
  finishTitle: 'Jesteś w środku',
  finishBody: 'Pierwszy sygnał już jest. Kolejne kroki mogą pozostać lekkie.',
  finishCta: 'Dalej',
  locationTitle: 'Dodaj lokalizację',
  locationBody: 'Żeby kolejne zadania szanowały Twój realny zasięg.',
  addressPlaceholder: 'Miasto albo adres',
  verifyAddress: 'Zweryfikuj adres',
  verifiedAddress: 'Adres zweryfikowany',
  addressError: 'Nie udało się jeszcze zweryfikować tego adresu.',
  skillsTitle: 'Nazwij swoje najmocniejsze skills',
  skillsBody: 'Trzy wystarczą, żeby kolejne dopasowanie było dużo lepsze.',
  skillsPlaceholder: 'Na przykład: SQL, rozmowy z klientami, Python',
  preferencesTitle: 'Ustaw kierunek',
  preferencesBody: 'Kilka praktycznych sygnałów pomoże nam polecać challenge zgodnie z Twoją realną sytuacją.',
  domainPlaceholder: 'Główny obszar',
  desiredRolePlaceholder: 'Docelowa rola',
  seniorityLabel: 'Seniority',
  salaryMinPlaceholder: 'Min pensja',
  salaryMaxPlaceholder: 'Max pensja',
  workArrangementLabel: 'Jak chcesz pracować?',
  workArrangementBody: 'Dzięki temu lepiej priorytetyzujemy challenge remote, hybrydowe albo na miejscu.',
  workArrangementOptions: {
    remote: 'Remote',
    hybrid: 'Hybryda',
    onsite: 'Na miejscu',
  },
  languagesLabel: 'W jakich językach możesz pracować?',
  languagesBody: 'Użyjemy tego głównie do języka challenge i ofert, a nie do zamykania Cię w szufladce.',
  preferencesError: 'Dodaj rolę, widełki płacowe, przynajmniej jeden język i preferowany tryb pracy.',
  supportingTitle: 'Dodaj dodatkowy kontekst',
  supportingBody: 'Opcjonalne, ale pomocne, gdy zespół chce zobaczyć więcej sygnału.',
  supportingPlaceholder: 'Kilka zdań o Twoim kontekście, projektach albo tym, czego szukasz dalej.',
  summaryTitle: 'Snapshot profilu',
  summaryDomain: 'Obszar',
  summaryRole: 'Rola',
  summarySeniority: 'Seniority',
  summaryLocation: 'Lokalizacja',
  summarySetup: 'Tryb',
  summarySalary: 'Pensja',
  summaryLanguages: 'Języki',
  summarySkills: 'Mocne skills',
  summaryMissingPrefix: 'Żeby kolejne rekomendacje miały więcej sensu, dodaj jeszcze',
  profileDone: 'Sygnał wzmocniony',
  openProfile: 'Otwórz profil',
  back: 'Wstecz',
  scenarios: [
    {
      id: 'product_dropoff',
      title: 'Zauważ, co nie gra',
      context: 'Wchodzisz gdzieś i coś wydaje się lekko nie tak.',
      problem: 'Co zauważasz jako pierwsze?',
    },
    {
      id: 'broken_process',
      title: 'Rozplącz bałagan',
      context: 'Ludzie się starają, ale sprawy ciągle przepadają pomiędzy nimi.',
      problem: 'Co spróbował(a)byś zmienić najpierw?',
    },
    {
      id: 'signal_analysis',
      title: 'Przeczytaj sytuację',
      context: 'Nic nie jest otwarcie zepsute, ale coś nie działa.',
      problem: 'Któremu sygnałowi zaufał(a)byś najpierw?',
    },
    {
      id: 'team_handoff',
      title: 'Wykonaj pierwszy ruch',
      context: 'Różni ludzie widzą tę samą sytuację inaczej.',
      problem: 'Jak uruchomił(a)byś ruch bez nacisku?',
    },
  ],
};

const copyByLocale: Record<string, TaskFirstOnboardingCopy> = {
  cs: CS_COPY,
  sk: SK_COPY,
  en: EN_COPY,
  de: DE_COPY,
  at: DE_COPY,
  pl: PL_COPY,
};

export const getTaskFirstOnboardingCopy = (locale: string): TaskFirstOnboardingCopy =>
  copyByLocale[locale] || EN_COPY;
