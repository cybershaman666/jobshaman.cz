#!/usr/bin/env python3
"""
Safe profile localization script.
- Replacements are ordered so more-specific strings come first.
- No double {{}} brace wrapping.
- Each old/new pair is unique and non-overlapping.
"""
import os, json

BASE = "/home/misha/Projekty (2)/jobshaman-new/jobshaman"
FILEPATH = os.path.join(BASE, "frontend/src/rebuild/candidate/CandidateProfileV2.tsx")
LOCALES_DIR = os.path.join(BASE, "frontend/public/locales")

# All translations for all 10 locales
TRANSLATIONS = {
    # --- visibility ---
    "rebuild.profile.visibility_public": {
        "cs":"Veřejný profil","en":"Public profile","de":"Öffentliches Profil","pl":"Profil publiczny",
        "sk":"Verejný profil","at":"Öffentliches Profil","da":"Offentlig profil","fi":"Julkinen profiili",
        "no":"Offentlig profil","sv":"Offentlig profil"},
    "rebuild.profile.visibility_recruiter": {
        "cs":"Viditelný firmám","en":"Visible to recruiters","de":"Sichtbar für Unternehmen","pl":"Widoczny dla firm",
        "sk":"Viditeľný firmám","at":"Sichtbar für Unternehmen","da":"Synlig for virksomheder","fi":"Näkyvissä yrityksille",
        "no":"Synlig for bedrifter","sv":"Synlig för företag"},
    "rebuild.profile.visibility_private": {
        "cs":"Soukromý profil","en":"Private profile","de":"Privates Profil","pl":"Profil prywatny",
        "sk":"Súkromný profil","at":"Privates Profil","da":"Privat profil","fi":"Yksityinen profiili",
        "no":"Privat profil","sv":"Privat profil"},
    # --- transport ---
    "rebuild.profile.transport_car": {
        "cs":"Auto","en":"Car","de":"Auto","pl":"Samochód","sk":"Auto","at":"Auto","da":"Bil","fi":"Auto","no":"Bil","sv":"Bil"},
    "rebuild.profile.transport_public": {
        "cs":"MHD / vlak","en":"Public transport","de":"ÖPNV / Zug","pl":"Komunikacja miejska / pociąg",
        "sk":"MHD / vlak","at":"ÖPNV / Zug","da":"Offentlig transport / tog","fi":"Julkinen liikenne / juna",
        "no":"Kollektivtransport / tog","sv":"Kollektivtrafik / tåg"},
    "rebuild.profile.transport_bike": {
        "cs":"Kolo","en":"Bike","de":"Fahrrad","pl":"Rower","sk":"Bicykel","at":"Fahrrad","da":"Cykel","fi":"Polkupyörä","no":"Sykkel","sv":"Cykla"},
    "rebuild.profile.transport_walk": {
        "cs":"Pěšky","en":"Walking","de":"Zu Fuß","pl":"Pieszo","sk":"Pešo","at":"Zu Fuß","da":"Til fods","fi":"Kävellen","no":"Gå","sv":"Promenera"},
    "rebuild.profile.transport_flexible": {
        "cs":"Dle příležitosti","en":"As needed","de":"Je nach Anlass","pl":"Zależnie od okazji",
        "sk":"Podľa príležitosti","at":"Je nach Anlass","da":"Efter behov","fi":"Tarvittaessa","no":"Etter behov","sv":"Efter behov"},
    # --- employment ---
    "rebuild.profile.employment_full_time": {
        "cs":"Plný úvazek","en":"Full-time","de":"Vollzeit","pl":"Pełny etat","sk":"Plný úväzok","at":"Vollzeit","da":"Fuldtid","fi":"Kokoaikainen","no":"Heltid","sv":"Heltid"},
    "rebuild.profile.employment_part_time": {
        "cs":"Zkrácený úvazek","en":"Part-time","de":"Teilzeit","pl":"Część etatu","sk":"Skrátený úväzok","at":"Teilzeit","da":"Deltid","fi":"Osa-aikainen","no":"Deltid","sv":"Deltid"},
    "rebuild.profile.employment_contract": {
        "cs":"Kontrakt","en":"Contract","de":"Vertrag","pl":"Kontrakt","sk":"Kontrakt","at":"Vertrag","da":"Kontrakt","fi":"Sopimus","no":"Kontrakt","sv":"Kontrakt"},
    "rebuild.profile.employment_internship": {
        "cs":"Stáž","en":"Internship","de":"Praktikum","pl":"Staż","sk":"Stáž","at":"Praktikum","da":"Praktik","fi":"Harjoittelu","no":"Praksis","sv":"Praktik"},
    "rebuild.profile.employment_temporary": {
        "cs":"Dočasná spolupráce","en":"Temporary work","de":"Befristete Zusammenarbeit","pl":"Współpraca tymczasowa",
        "sk":"Dočasná spolupráca","at":"Befristete Zusammenarbeit","da":"Midlertidigt arbejde","fi":"Määräaikainen","no":"Midlertidig","sv":"Tidsbegränsad"},
    "rebuild.profile.employment_flexible": {
        "cs":"Flexibilní","en":"Flexible","de":"Flexibel","pl":"Elastyczny","sk":"Flexibilný","at":"Flexibel","da":"Fleksibel","fi":"Joustava","no":"Fleksibel","sv":"Flexibel"},
    # --- misc small labels ---
    "rebuild.profile.uploaded_just_now": {
        "cs":"Právě teď","en":"Just now","de":"Gerade eben","pl":"Przed chwilą","sk":"Práve teraz","at":"Gerade eben","da":"Lige nu","fi":"Juuri nyt","no":"Akkurat nå","sv":"Alldeles nyss"},
    # --- strength labels ---
    "rebuild.profile.strength_reliability": {
        "cs":"Spolehlivost","en":"Reliability","de":"Zuverlässigkeit","pl":"Niezawodność","sk":"Spoľahlivosť","at":"Zuverlässigkeit","da":"Pålidelighed","fi":"Luotettavuus","no":"Pålitelighet","sv":"Pålitlighet"},
    "rebuild.profile.strength_practical_thinking": {
        "cs":"Praktické myšlení","en":"Practical thinking","de":"Praktisches Denken","pl":"Praktyczne myślenie","sk":"Praktické myslenie","at":"Praktisches Denken","da":"Praktisk tænkning","fi":"Käytännön ajattelu","no":"Praktisk tenkning","sv":"Praktiskt tänkande"},
    "rebuild.profile.strength_teamwork": {
        "cs":"Týmovost","en":"Teamwork","de":"Teamfähigkeit","pl":"Praca zespołowa","sk":"Tímovosť","at":"Teamfähigkeit","da":"Samarbejde","fi":"Tiimityö","no":"Samarbeid","sv":"Samarbetsförmåga"},
    "rebuild.profile.strength_stress_resilience": {
        "cs":"Odolnost ve stresu","en":"Stress resilience","de":"Stressresistenz","pl":"Odporność na stres","sk":"Odolnosť v strese","at":"Stressresistenz","da":"Stressresistens","fi":"Stressinsietokyky","no":"Stressmotstand","sv":"Stresstålighet"},
    "rebuild.profile.strength_learning": {
        "cs":"Učení se","en":"Learning ability","de":"Lernfähigkeit","pl":"Zdolność uczenia się","sk":"Učenie sa","at":"Lernfähigkeit","da":"Læringsevne","fi":"Oppimiskyky","no":"Læringsevne","sv":"Lärandeförmåga"},
    # --- identity narratives ---
    "rebuild.profile.target_role_fallback": {
        "cs":"Systémový tvůrce","en":"System Creator","de":"Systemgestalter","pl":"Twórca systemowy","sk":"Systémový tvorca","at":"Systemgestalter","da":"Systemskaber","fi":"Järjestelmän luoja","no":"Systemskaper","sv":"Systemskapare"},
    "rebuild.profile.domain_fallback": {
        "cs":"Systémová tvorba","en":"System Creation","de":"Systemgestaltung","pl":"Tworzenie systemów","sk":"Systémová tvorba","at":"Systemgestaltung","da":"Systemskabelse","fi":"Järjestelmäsuunnittelu","no":"Systemskaping","sv":"Systemskapande"},
    "rebuild.profile.feed_priority_project": {
        "cs":"Projektová a návrhová práce","en":"Project & design work","de":"Projekt- & Designarbeit","pl":"Praca projektowa","sk":"Projektová a návrhová práca","at":"Projekt- & Designarbeit","da":"Projekt- & designarbejde","fi":"Projekti- ja suunnittelutyö","no":"Prosjekt- og designarbeid","sv":"Projekt- & designarbete"},
    "rebuild.profile.feed_priority_ai": {
        "cs":"AI workflow a platformy","en":"AI workflows & platforms","de":"KI-Workflows & -Plattformen","pl":"Przepływy pracy i platformy AI","sk":"AI workflow a platformy","at":"KI-Workflows & -Plattformen","da":"AI-workflows & -platforme","fi":"Tekoälytyönkulut ja -alustat","no":"AI-arbeidsflyter og -plattformer","sv":"AI-arbetsflöden & -plattformar"},
    "rebuild.profile.feed_priority_mobility": {
        "cs":"Mobilita a infrastruktura","en":"Mobility & infrastructure","de":"Mobilität & Infrastruktur","pl":"Mobilność i infrastruktura","sk":"Mobilita a infraštruktúra","at":"Mobilität & Infrastruktur","da":"Mobilitet & infrastruktur","fi":"Liikenne ja infrastruktuuri","no":"Mobilitet og infrastruktur","sv":"Mobilitet & infrastruktur"},
    "rebuild.profile.feed_priority_human": {
        "cs":"Human-centric technologie","en":"Human-centric tech","de":"Human-centric Technologie","pl":"Technologie zorientowane na człowieka","sk":"Human-centric technológie","at":"Human-centric Technologie","da":"Menneskecentreret teknologi","fi":"Ihmiskeskeinen teknologia","no":"Menneskesentrert teknologi","sv":"Människocentrerad teknologi"},
    "rebuild.profile.feed_priority_complex": {
        "cs":"Komplexní systémové role","en":"Complex system roles","de":"Komplexe Systemrollen","pl":"Złożone role systemowe","sk":"Komplexné systémové role","at":"Komplexe Systemrollen","da":"Komplekse systemroller","fi":"Monimutkaiset järjestelmäroolit","no":"Komplekse systemroller","sv":"Komplexa systemroller"},
    "rebuild.profile.feed_avoid_routine": {
        "cs":"Rutinní administrativa","en":"Routine admin work","de":"Routinemäßige Administration","pl":"Rutynowa administracja","sk":"Rutinná administratíva","at":"Routinemäßige Administration","da":"Rutinepræget administration","fi":"Rutiininomainen hallinto","no":"Rutinepreget administrasjon","sv":"Rutinarbete administration"},
    "rebuild.profile.feed_avoid_execution": {
        "cs":"Čistě exekuční role","en":"Pure execution roles","de":"Reine Ausführungsrollen","pl":"Role czysto wykonawcze","sk":"Čisto exekučné role","at":"Reine Ausführungsrollen","da":"Rene udførelsesroller","fi":"Puhtaasti suorittavat roolit","no":"Rene utførelsesroller","sv":"Renodlade utförarroller"},
    "rebuild.profile.feed_avoid_rigid": {
        "cs":"Rigidní operativa","en":"Rigid operations","de":"Rigide Operative","pl":"Sztywne operacje","sk":"Rigidná operatíva","at":"Rigide Operative","da":"Stive operationer","fi":"Joustamaton operointi","no":"Rigide operasjoner","sv":"Stela operationer"},
    "rebuild.profile.feed_avoid_no_autonomy": {
        "cs":"Práce bez autonomie","en":"Work without autonomy","de":"Arbeit ohne Autonomie","pl":"Praca bez autonomii","sk":"Práca bez autonómie","at":"Arbeit ohne Autonomie","da":"Arbejde uden selvstændighed","fi":"Työ ilman autonomiaa","no":"Arbeid uten autonomi","sv":"Arbete utan självständighet"},
    "rebuild.profile.feed_mode_sandbox": {
        "cs":"Micro-projects · challenge contracts · sandbox consulting","en":"Micro-projects · challenge contracts · sandbox consulting","de":"Mikroprojekte · Challenge Contracts · Sandbox Consulting","pl":"Mikroprojekty · challenge contracts · sandbox consulting","sk":"Micro-projects · challenge contracts · sandbox consulting","at":"Mikroprojekte · Challenge Contracts · Sandbox Consulting","da":"Mikroprojekter · challenge-kontrakter · sandbox-konsulentbistand","fi":"Mikroprojektit · haasteet · hiekkalaatikkokonsultointi","no":"Mikroprosjekter · utfordringskontrakter · sandkassekonsulentvirksomhet","sv":"Mikroprojekt · utmaningskontrakt · sandlådekonsultation"},
    "rebuild.profile.feed_mode_design": {
        "cs":"System design · innovation tracks · architecture challenges","en":"System design · innovation tracks · architecture challenges","de":"Systemdesign · Innovationspfade · Architektur-Challenges","pl":"Projektowanie systemów · ścieżki innowacji · wyzwania architektoniczne","sk":"System design · inovačné tracky · architektonické výzvy","at":"Systemdesign · Innovationspfade · Architektur-Challenges","da":"Systemdesign · innovationsspor · arkitekturudfordringer","fi":"Järjestelmäsuunnittelu · innovaatiopolut · arkkitehtuurijutut","no":"Systemdesign · innovasjonsspor · arkitekturutfordringer","sv":"Systemdesign · innovationsspår · arkitekturutmaningar"},
    "rebuild.profile.feed_mode_standard": {
        "cs":"Standardní matching","en":"Standard matching","de":"Standard-Matching","pl":"Dopasowanie standardowe","sk":"Štandardný matching","at":"Standard-Matching","da":"Standard matchning","fi":"Normaali mätsäys","no":"Standard matching","sv":"Standardmatchning"},
    "rebuild.profile.earthship_moment_title": {
        "cs":"Core Signal Event: Earthship moment","en":"Core Signal Event: Earthship moment","de":"Core Signal Event: Earthship-Moment","pl":"Core Signal Event: Earthship moment","sk":"Core Signal Event: Earthship moment","at":"Core Signal Event: Earthship-Moment","da":"Core Signal Event: Earthship moment","fi":"Core Signal Event: Earthship-hetki","no":"Core Signal Event: Earthship-øyeblikk","sv":"Core Signal Event: Earthship-ögonblick"},
    "rebuild.profile.earthship_moment_body": {
        "cs":"Došel jsi k řešení typu Earthship bez znalosti existujícího konceptu. To je silný marker nezávislé systémové představivosti a architektonického myšlení.",
        "en":"You arrived at an Earthship-type solution without knowing the existing concept. This is a strong marker of independent system imagination and architectural thinking.",
        "de":"Sie sind zu einer Earthship-artigen Lösung gelangt, ohne das bestehende Konzept zu kennen. Dies ist ein starkes Zeichen für eigenständiges Systemdenken.",
        "pl":"Doszedłeś do rozwiązania typu Earthship bez znajomości istniejącego konceptu. To silny marker niezależnej wyobraźni systemowej.",
        "sk":"Došiel si k riešeniu typu Earthship bez znalosti existujúceho konceptu. To je silný marker nezávislej systémovej predstavivosti.",
        "at":"Sie sind zu einer Earthship-artigen Lösung gelangt, ohne das bestehende Konzept zu kennen.",
        "da":"Du nåede frem til en Earthship-lignende løsning uden at kende det eksisterende koncept.",
        "fi":"Päädyit Earthship-tyyppiseen ratkaisuun tuntematta olemassa olevaa konseptia.",
        "no":"Du kom frem til en Earthship-lignende løsning uten å kjenne det eksisterende konseptet.",
        "sv":"Du nådde fram till en Earthship-liknande lösning utan att känna till det befintliga konceptet."},
    "rebuild.profile.core_signal_title": {
        "cs":"Core Signal Event","en":"Core Signal Event","de":"Core Signal Event","pl":"Core Signal Event","sk":"Core Signal Event","at":"Core Signal Event","da":"Core Signal Event","fi":"Core Signal Event","no":"Core Signal Event","sv":"Core Signal Event"},
    "rebuild.profile.core_signal_body": {
        "cs":"AI ve tvém příběhu hledá momenty, kdy ses samostatně dostal k neobvyklému, ale funkčnímu řešení. Tyhle momenty pak používá při matchingu rezonance.",
        "en":"AI searches your story for moments where you independently arrived at an unusual but functional solution. It uses these moments for resonance matching.",
        "de":"Die KI sucht in Ihrer Geschichte nach Momenten, in denen Sie selbstständig zu einer ungewöhnlichen, aber funktionellen Lösung gelangt sind.",
        "pl":"AI w twojej historii szuka momentów, kiedy samodzielnie doszedłeś do nieoczywistego, ale działającego rozwiązania.",
        "sk":"AI vo tvojom príbehu hľadá momenty, kedy ses samostatne dostal k neobvyklému, ale funkčnému riešeniu.",
        "at":"Die KI sucht in Ihrer Geschichte nach Momenten, in denen Sie selbstständig zu einer ungewöhnlichen Lösung gelangt sind.",
        "da":"AI søger i din historie efter øjeblikke, hvor du selvstændigt nåede frem til en usædvanlig, men funktionel løsning.",
        "fi":"Tekoäly etsii tarinastasi hetkiä, jolloin päädyit itsenäisesti epätavalliseen mutta toimivaan ratkaisuun.",
        "no":"AI søker i historien din etter øyeblikk der du selvstendig kom frem til en uvanlig, men funksjonell løsning.",
        "sv":"AI söker i din berättelse efter ögonblick där du självständigt nådde fram till en ovanlig men fungerande lösning."},
    "rebuild.profile.weight_autonomy": {
        "cs":"Autonomie","en":"Autonomy","de":"Autonomie","pl":"Autonomia","sk":"Autonómia","at":"Autonomie","da":"Selvstændighed","fi":"Autonomia","no":"Autonomi","sv":"Självständighet"},
    "rebuild.profile.weight_stability": {
        "cs":"Stabilita","en":"Stability","de":"Stabilität","pl":"Stabilizacja","sk":"Stabilita","at":"Stabilität","da":"Stabilitet","fi":"Vakaus","no":"Stabilitet","sv":"Stabilitet"},
    "rebuild.profile.profile_composing": {
        "cs":"Profil se skládá...","en":"Profile is being built...","de":"Profil wird erstellt...","pl":"Profil się tworzy...","sk":"Profil sa skladá...","at":"Profil wird erstellt...","da":"Profilen opbygges...","fi":"Profiilia luodaan...","no":"Profilen bygges...","sv":"Profilen skapas..."},
    "rebuild.profile.narrative_builder": {
        "cs":"Tvoje energie patří do tvorby systémů, které propojují lidi, technologie a prostředí. Rutina tě oslabuje, komplexita tě nabíjí.",
        "en":"Your energy belongs to building systems that connect people, technology, and environments. Routine weakens you, complexity charges you.",
        "de":"Ihre Energie gehört der Erstellung von Systemen, die Menschen, Technologie und Umwelt verbinden.",
        "pl":"Twoja energia należy do tworzenia systemów łączących ludzi, technologie i środowisko.",
        "sk":"Tvoja energia patrí do tvorby systémov, ktoré prepájajú ľudí, technológie a prostredie.",
        "at":"Ihre Energie gehört der Erstellung von Systemen, die Menschen, Technologie und Umwelt verbinden.",
        "da":"Din energi hører til opbygningen af systemer, der forbinder mennesker, teknologi og miljø.",
        "fi":"Energiasi kuuluu sellaisten järjestelmien luomiseen, jotka yhdistävät ihmiset, teknologian ja ympäristön.",
        "no":"Energien din hører hjemme i å bygge systemer som kobler mennesker, teknologi og miljøer.",
        "sv":"Din energi hör hemma i att skapa system som kopplar samman människor, teknologi och miljöer."},
    "rebuild.profile.narrative_human": {
        "cs":"Silný signál směřuje k rolím, kde se propojuje dopad na lidi, změna systému a práce s nejasností.",
        "en":"A strong signal points to roles combining human impact, system change, and navigating ambiguity.",
        "de":"Ein starkes Signal deutet auf Rollen hin, die menschliche Wirkung, Systemveränderung und das Navigieren im Unklaren verbinden.",
        "pl":"Silny sygnał kieruje do ról, gdzie łączy się wpływ na ludzi, zmiana systemów i praca w niejasności.",
        "sk":"Silný signál smeruje k rolám, kde sa prepojuje dopad na ľudí, zmena systému a práca s nejasnosťou.",
        "at":"Ein starkes Signal deutet auf Rollen hin, die menschliche Wirkung und Systemveränderung verbinden.",
        "da":"Et stærkt signal peger i retning af roller, der forbinder menneskelig indvirkning og systemændring.",
        "fi":"Vahva signaali osoittaa rooleihin, joissa yhdistyvät vaikutus ihmisiin ja järjestelmämuutos.",
        "no":"Et sterkt signal peker mot roller som kombinerer menneskelig innvirkning og systemendring.",
        "sv":"En stark signal pekar mot roller som kombinerer mänsklig påverkan och systemförändring."},
    "rebuild.profile.narrative_creator": {
        "cs":"AI z tvého onboardingu čte směr, ve kterém máš tvořit, né jen vykonávat.",
        "en":"AI reads from your onboarding a direction where you should create, not just execute.",
        "de":"Die KI liest aus Ihrem Onboarding eine Richtung heraus, in der Sie gestalten sollten, nicht nur ausführen.",
        "pl":"AI z twojego onboardingu czyta kierunek, w którym masz tworzyć, a nie tylko wykonywać.",
        "sk":"AI z tvojho onboarding číta smer, v ktorom máš tvoriť, nie len vykonávať.",
        "at":"Die KI liest aus Ihrem Onboarding eine Richtung, wo Sie gestalten sollen.",
        "da":"AI læser en retning fra din onboarding, hvor du skal skabe, ikke bare udføre.",
        "fi":"Tekoäly lukee perehdytyksestäsi suunnan, jossa sinun tulisi luoda, ei vain suorittaa.",
        "no":"AI leser en retning fra onboardingen din der du skal skape, ikke bare utføre.",
        "sv":"AI läser av en riktning från din onboarding där du ska skapa, inte bara utföra."},
    "rebuild.profile.complete_test_narrative": {
        "cs":"Dokonči JCFPM test a Cybershaman ti vytvoří přesnou pracovní identitu.",
        "en":"Complete the JCFPM test and Cybershaman will generate a precise work identity for you.",
        "de":"Schließen Sie den JCFPM-Test ab, und der Cyberschaman wird eine präzise Arbeitsidentität für Sie erstellen.",
        "pl":"Ukończ test JCFPM, a Cybershaman stworzy dla ciebie dokładną tożsamość zawodową.",
        "sk":"Dokonči JCFPM test a Cybershaman ti vytvorí presnú pracovnú identitu.",
        "at":"Schließen Sie den JCFPM-Test ab, und der Cyberschaman erstellt eine Arbeitsidentität für Sie.",
        "da":"Gennemfør JCFPM-testen, og Cybershaman vil skabe en præcis arbejdsidentitet til dig.",
        "fi":"Suorita JCFPM-testi ja Cybershaman luo sinulle tarkan työidentiteetin.",
        "no":"Fullfør JCFPM-testen og Cybershaman vil opprette en nøyaktig arbeidsidentitet for deg.",
        "sv":"Slutför JCFPM-testet så skapar Cybershaman en exakt arbetsidentitet för dig."},
    "rebuild.profile.burnout_risk_routine": {
        "cs":"Rutinní administrativní role","en":"Routine administrative roles","de":"Routinemäßige administrative Rollen","pl":"Rutynowe role administracyjne","sk":"Rutinné administratívne role","at":"Routinemäßige administrative Rollen","da":"Rutineprægede administrative roller","fi":"Rutiininomaiset hallinnolliset roolit","no":"Rutinepregede administrative roller","sv":"Rutinarbeten inom administration"},
    "rebuild.profile.burnout_risk_no_autonomy": {
        "cs":"Role bez autonomie a dlouhodobého smyslu","en":"Roles lacking autonomy & long-term meaning","de":"Rollen ohne Autonomie und langfristigen Sinn","pl":"Role bez autonomii i długoterminowego sensu","sk":"Role bez autonómie a dlhodobého zmyslu","at":"Rollen ohne Autonomie und langfristigen Sinn","da":"Roller uden selvstændighed og langsigtet mening","fi":"Roolit ilman autonomiaa ja pitkän aikavälin tarkoitusta","no":"Roller uten autonomi og langsiktig mening","sv":"Roller utan självständighet och långsiktig mening"},
    "rebuild.profile.to_be_refined_jcfpm": {
        "cs":"Bude upřesněno po JCFPM","en":"To be refined after JCFPM","de":"Wird nach JCFPM präzisiert","pl":"Zostanie doprecyzowane po JCFPM","sk":"Bude upresnené po JCFPM","at":"Wird nach JCFPM präzisiert","da":"Vil blive præciseret efter JCFPM","fi":"Tarkennetaan JCFPM:n jälkeen","no":"Vil bli spesifisert etter JCFPM","sv":"Kommer att preciseras efter JCFPM"},
    "rebuild.profile.strong_zone_builder": {
        "cs":"Komplexní návrh systémů bez existující šablony","en":"Complex system design without existing templates","de":"Komplexes Systemdesign ohne bestehende Vorlagen","pl":"Złożone projektowanie systemów bez istniejących szablonów","sk":"Komplexný návrh systémov bez existujúcej šablóny","at":"Komplexes Systemdesign ohne bestehende Vorlagen","da":"Komplekst systemdesign uden eksisterende skabeloner","fi":"Monimutkainen järjestelmäsuunnittelu ilman valmiita malleja","no":"Kompleks systemdesign uten eksisterende maler","sv":"Komplex systemdesign utan befintliga mallar"},
    "rebuild.profile.strong_zone_creator": {
        "cs":"Tvorba nových struktur a orientace v nejasnosti","en":"Creating new structures & navigating ambiguity","de":"Erstellung neuer Strukturen und Orientierung im Unklaren","pl":"Tworzenie nowych struktur i orientacja w niejasności","sk":"Tvorba nových štruktúr a orientácia v nejasnosti","at":"Erstellung neuer Strukturen und Orientierung im Unklaren","da":"Skabelse af nye strukturer og orientering i uklarhed","fi":"Uusien rakenteiden luominen ja epäselvyydessä suunnistaminen","no":"Skape nye strukturer og navigere i uklarhet","sv":"Skapa nya strukturer och navigera i oklarhet"},
    # --- UI strings ---
    "rebuild.profile.edit_profile": {
        "cs":"Upravit profil","en":"Edit profile","de":"Profil bearbeiten","pl":"Edytuj profil","sk":"Upraviť profil","at":"Profil bearbeiten","da":"Rediger profil","fi":"Muokkaa profiilia","no":"Rediger profil","sv":"Redigera profil"},
    "rebuild.profile.save_to_server": {
        "cs":"Uložit na server","en":"Save to server","de":"Auf Server speichern","pl":"Zapisz na serwerze","sk":"Uložiť na server","at":"Auf Server speichern","da":"Gem på server","fi":"Tallenna palvelimelle","no":"Lagre på server","sv":"Spara på server"},
    "rebuild.profile.saving": {
        "cs":"Ukládám…","en":"Saving...","de":"Wird gespeichert...","pl":"Zapisywanie...","sk":"Ukladám…","at":"Wird gespeichert...","da":"Gemmer...","fi":"Tallennetaan...","no":"Lagrer...","sv":"Sparar..."},
    "rebuild.profile.cancel": {
        "cs":"Zrušit","en":"Cancel","de":"Abbrechen","pl":"Anuluj","sk":"Zrušiť","at":"Abbrechen","da":"Annuller","fi":"Peruuta","no":"Avbryt","sv":"Avbryt"},
    "rebuild.profile.save": {
        "cs":"Uložit","en":"Save","de":"Speichern","pl":"Zapisz","sk":"Uložiť","at":"Speichern","da":"Gem","fi":"Tallenna","no":"Lagre","sv":"Spara"},
    "rebuild.profile.add_item": {
        "cs":"Přidat","en":"Add","de":"Hinzufügen","pl":"Dodaj","sk":"Pridať","at":"Hinzufügen","da":"Tilføj","fi":"Lisää","no":"Legg til","sv":"Lägg till"},
    "rebuild.profile.edit_item": {
        "cs":"Upravit","en":"Edit","de":"Bearbeiten","pl":"Edytuj","sk":"Upraviť","at":"Bearbeiten","da":"Rediger","fi":"Muokkaa","no":"Rediger","sv":"Redigera"},
    "rebuild.profile.select": {
        "cs":"Vybrat","en":"Select","de":"Auswählen","pl":"Wybierz","sk":"Vybrať","at":"Auswählen","da":"Vælg","fi":"Valitse","no":"Velg","sv":"Välj"},
    "rebuild.profile.remove": {
        "cs":"Odebrat","en":"Remove","de":"Entfernen","pl":"Usuń","sk":"Odobrať","at":"Entfernen","da":"Fjern","fi":"Poista","no":"Fjern","sv":"Ta bort"},
    "rebuild.profile.add_language": {
        "cs":"Přidat jazyk","en":"Add language","de":"Sprache hinzufügen","pl":"Dodaj język","sk":"Pridať jazyk","at":"Sprache hinzufügen","da":"Tilføj sprog","fi":"Lisää kieli","no":"Legg til sprog","sv":"Lägg till språk"},
    "rebuild.profile.remove_language": {
        "cs":"Odebrat jazyk","en":"Remove language","de":"Sprache entfernen","pl":"Usuń język","sk":"Odobrať jazyk","at":"Sprache entfernen","da":"Fjern sprog","fi":"Poista kieli","no":"Fjern sprog","sv":"Ta bort språk"},
    "rebuild.profile.change_photo": {
        "cs":"Změnit fotku","en":"Change photo","de":"Foto ändern","pl":"Zmień zdjęcie","sk":"Zmeniť fotku","at":"Foto ändern","da":"Skift foto","fi":"Vaihda kuva","no":"Bytt bilde","sv":"Byt foto"},
    "rebuild.profile.upload_document": {
        "cs":"Nahrát dokument","en":"Upload document","de":"Dokument hochladen","pl":"Prześlij dokument","sk":"Nahrať dokument","at":"Dokument hochladen","da":"Upload dokument","fi":"Lataa asiakirja","no":"Last opp dokument","sv":"Ladda upp dokument"},
    "rebuild.profile.uploading": {
        "cs":"Nahrávám…","en":"Uploading...","de":"Wird hochgeladen...","pl":"Przesyłanie...","sk":"Nahrávam…","at":"Wird hochgeladen...","da":"Uploader...","fi":"Ladataan...","no":"Laster opp...","sv":"Laddar upp..."},
    "rebuild.profile.uploaded": {
        "cs":"Nahráno","en":"Uploaded","de":"Hochgeladen","pl":"Przesłano","sk":"Nahrané","at":"Hochgeladen","da":"Uploadet","fi":"Ladattu","no":"Opplastet","sv":"Uppladdad"},
    "rebuild.profile.active": {
        "cs":"Aktivní","en":"Active","de":"Aktiv","pl":"Aktywny","sk":"Aktívny","at":"Aktiv","da":"Aktiv","fi":"Aktiivinen","no":"Aktiv","sv":"Aktiv"},
    # --- form labels ---
    "rebuild.profile.name_label": {
        "cs":"Jméno","en":"Name","de":"Name","pl":"Imię i nazwisko","sk":"Meno","at":"Name","da":"Navn","fi":"Nimi","no":"Navn","sv":"Namn"},
    "rebuild.profile.role_label": {
        "cs":"Pracovní role","en":"Work role","de":"Arbeitsrolle","pl":"Rola zawodowa","sk":"Pracovná rola","at":"Arbeitsrolle","da":"Arbejdsrolle","fi":"Työtehtävä","no":"Arbeidsrolle","sv":"Arbetsroll"},
    "rebuild.profile.phone_label": {
        "cs":"Telefon","en":"Phone","de":"Telefon","pl":"Telefon","sk":"Telefón","at":"Telefon","da":"Telefon","fi":"Puhelin","no":"Telefon","sv":"Telefon"},
    "rebuild.profile.address_label": {
        "cs":"Adresa / lokalita","en":"Address / Location","de":"Adresse / Standort","pl":"Adres / Lokalizacja","sk":"Adresa / lokalita","at":"Adresse / Standort","da":"Adresse / lokation","fi":"Osoite / sijainti","no":"Adresse / lokasjon","sv":"Adress / plats"},
    "rebuild.profile.story_label": {
        "cs":"Příběh / bio","en":"Story / Bio","de":"Geschichte / Bio","pl":"Historia / Bio","sk":"Príbeh / bio","at":"Geschichte / Bio","da":"Historie / bio","fi":"Tarina / bio","no":"Historie / bio","sv":"Berättelse / bio"},
    "rebuild.profile.skills_label": {
        "cs":"Dovednosti","en":"Skills","de":"Fähigkeiten","pl":"Umiejętności","sk":"Zručnosti","at":"Fähigkeiten","da":"Færdigheder","fi":"Taidot","no":"Ferdigheter","sv":"Kompetenser"},
    "rebuild.profile.skills_placeholder": {
        "cs":"Každou dovednost na nový řádek","en":"Each skill on a new line","de":"Jede Fähigkeit in eine neue Zeile","pl":"Każda umiejętność w nowej linii","sk":"Každú zručnosť na nový riadok","at":"Jede Fähigkeit in eine neue Zeile","da":"Hver færdighed på en ny linje","fi":"Jokainen taito omalle rivilleen","no":"Hver ferdighet på en ny linje","sv":"Varje kompetens på en ny rad"},
    "rebuild.profile.inferred_skills_label": {
        "cs":"Odvozené / doplňkové dovednosti","en":"Inferred / complementary skills","de":"Abgeleitete / komplementäre Fähigkeiten","pl":"Wnioskowane / uzupełniające umiejętności","sk":"Odvodené / doplnkové zručnosti","at":"Abgeleitete / komplementäre Fähigkeiten","da":"Udledte / supplerende færdigheder","fi":"Päätellyt / täydentävät taidot","no":"Avledede / utfyllende ferdigheter","sv":"Härledda / kompletterande färdigheter"},
    "rebuild.profile.inferred_skills_placeholder": {
        "cs":"Např. leadership, komunikace, analytika","en":"e.g. leadership, communication, analytics","de":"z.B. Führung, Kommunikation, Analytik","pl":"np. przywództwo, komunikacja, analityka","sk":"Napr. leadership, komunikácia, analytika","at":"z.B. Führung, Kommunikation, Analytik","da":"f.eks. lederskab, kommunikation, analytiske evner","fi":"esim. johtajuus, viestintä, analytiikka","no":"f.eks. lederskap, kommunikasjon, analytisk","sv":"t.ex. ledarskap, kommunikation, analytisk förmåga"},
    "rebuild.profile.languages_label": {
        "cs":"Jazykové znalosti","en":"Languages","de":"Sprachkenntnisse","pl":"Znajomość języków","sk":"Jazykové znalosti","at":"Sprachkenntnisse","da":"Sprogkundskaber","fi":"Kielitaito","no":"Språkkunnskaper","sv":"Språkkunskaper"},
    "rebuild.profile.language_name_label": {
        "cs":"Jazyk","en":"Language","de":"Sprache","pl":"Język","sk":"Jazyk","at":"Sprache","da":"Sprog","fi":"Kieli","no":"Språk","sv":"Språk"},
    "rebuild.profile.level_label": {
        "cs":"Úroveň 1-8","en":"Level 1-8","de":"Stufe 1-8","pl":"Poziom 1-8","sk":"Úroveň 1-8","at":"Stufe 1-8","da":"Niveau 1-8","fi":"Taso 1-8","no":"Nivå 1-8","sv":"Nivå 1-8"},
    "rebuild.profile.note_label": {
        "cs":"Poznámka","en":"Note","de":"Notiz","pl":"Uwagi","sk":"Poznámka","at":"Notiz","da":"Note","fi":"Huomautus","no":"Notat","sv":"Anteckning"},
    "rebuild.profile.preferences_label": {
        "cs":"Preferované podmínky","en":"Preferred conditions","de":"Bevorzugte Bedingungen","pl":"Preferowane warunki","sk":"Preferované podmienky","at":"Bevorzugte Bedingungen","da":"Foretrukne vilkår","fi":"Ensisijaiset ehdot","no":"Foretrukne betingelser","sv":"Föredragna villkor"},
    "rebuild.profile.preferences_placeholder": {
        "cs":"Hybrid, autonomie, žádné noční směny...","en":"Hybrid, autonomy, no night shifts...","de":"Hybrid, Autonomie, keine Nachtschichten...","pl":"Hybryda, autonomia, brak nocnych zmian...","sk":"Hybrid, autonómia, žiadne nočné zmeny...","at":"Hybrid, Autonomie, keine Nachtschichten...","da":"Hybrid, selvstændighed, ingen nattevagter...","fi":"Hybridi, autonomia, ei yövuoroja...","no":"Hybrid, autonomi, ingen nattevakter...","sv":"Hybrid, självständighet, inga nattskift..."},
    "rebuild.profile.employment_type_label": {
        "cs":"Typ úvazku","en":"Employment type","de":"Anstellungsart","pl":"Rodzaj zatrudnienia","sk":"Typ úväzku","at":"Anstellungsart","da":"Ansættelsesform","fi":"Työsuhteen tyyppi","no":"Ansettelsesform","sv":"Anställningsform"},
    "rebuild.profile.transport_label": {
        "cs":"Doprava","en":"Transport","de":"Transport","pl":"Transport","sk":"Doprava","at":"Transport","da":"Transport","fi":"Kulkuväline","no":"Transport","sv":"Transport"},
    "rebuild.profile.commute_radius_label": {
        "cs":"Dojíždění km","en":"Commute radius (km)","de":"Pendelradius (km)","pl":"Dojazd w km","sk":"Dojazd v km","at":"Pendelradius (km)","da":"Pendler-radius (km)","fi":"Työmatkan säde (km)","no":"Pendleradius (km)","sv":"Pendling (km)"},
    "rebuild.profile.salary_min_label": {
        "cs":"Mzda od","en":"Salary from","de":"Gehalt ab","pl":"Wynagrodzenie od","sk":"Mzda od","at":"Gehalt ab","da":"Løn fra","fi":"Palkka alkaen","no":"Lønn fra","sv":"Lön från"},
    "rebuild.profile.salary_max_label": {
        "cs":"Mzda do","en":"Salary to","de":"Gehalt bis","pl":"Wynagrodzenie do","sk":"Mzda do","at":"Gehalt bis","da":"Løn til","fi":"Palkka enintään","no":"Lønn til","sv":"Lön till"},
    "rebuild.profile.visibility_label": {
        "cs":"Viditelnost","en":"Visibility","de":"Sichtbarkeit","pl":"Widoczność","sk":"Viditeľnosť","at":"Sichtbarkeit","da":"Synlighed","fi":"Näkyvyys","no":"Synlighet","sv":"Synlighet"},
    # --- profile page UI ---
    "rebuild.profile.my_profile_title": {
        "cs":"Můj profil","en":"My Profile","de":"Mein Profil","pl":"Mój profil","sk":"Môj profil","at":"Mein Profil","da":"Min profil","fi":"Oma profiili","no":"Min profil","sv":"Min profil"},
    "rebuild.profile.my_profile_subtitle": {
        "cs":"Tvé dovednosti, zkušenosti a potenciál na jednom místě.","en":"Your skills, experience and potential in one place.","de":"Ihre Fähigkeiten, Erfahrungen und Ihr Potenzial an einem Ort.","pl":"Twoje umiejętności, doświadczenie i potencjał w jednym miejscu.","sk":"Tvoje zručnosti, skúsenosti a potenciál na jednom mieste.","at":"Ihre Fähigkeiten, Erfahrungen und Ihr Potenzial an einem Ort.","da":"Dine færdigheder, erfaringer og potentiale på ét sted.","fi":"Taitosi, kokemuksesi ja potentiaalisi yhdessä paikassa.","no":"Dine ferdigheter, erfaring og potensial på ett sted.","sv":"Dina färdigheter, erfarenheter och potential på ett ställe."},
    "rebuild.profile.completed_pct": {
        "cs":"profil kompletní","en":"profile complete","de":"Profil ausgefüllt","pl":"profil kompletny","sk":"profil kompletný","at":"Profil ausgefüllt","da":"profil udfyldt","fi":"profiili valmis","no":"profil fullført","sv":"profilen komplett"},
    "rebuild.profile.fill_main_role": {
        "cs":"Doplň svou hlavní roli","en":"Add your primary role","de":"Fügen Sie Ihre Hauptrolle hinzu","pl":"Uzupełnij swoją główną rolę","sk":"Doplň svoju hlavnú rolu","at":"Fügen Sie Ihre Hauptrolle hinzu","da":"Tilføj din primære rolle","fi":"Lisää pääroolisi","no":"Legg til din primære rolle","sv":"Lägg till din huvudsakliga roll"},
    "rebuild.profile.fill_location": {
        "cs":"Doplň lokalitu","en":"Add location","de":"Standort hinzufügen","pl":"Uzupełnij lokalizację","sk":"Doplň lokalitu","at":"Standort hinzufügen","da":"Tilføj lokation","fi":"Lisää sijainti","no":"Legg til lokasjon","sv":"Lägg till plats"},
    "rebuild.profile.phone_not_specified": {
        "cs":"Telefon neuveden","en":"Phone not specified","de":"Telefon nicht angegeben","pl":"Telefon niepodany","sk":"Telefón neuvedený","at":"Telefon nicht angegeben","da":"Telefon ikke angivet","fi":"Puhelinnumeroa ei ilmoitettu","no":"Telefon ikke oppgitt","sv":"Telefon har inte angetts"},
    "rebuild.profile.willing_to_commute": {
        "cs":"Ochoten dojíždět","en":"Willing to commute","de":"Bereit zu pendeln","pl":"Chętny do dojazdu","sk":"Ochotný dochádzať","at":"Bereit zu pendeln","da":"Villig til at pendle","fi":"Valmis matkustamaan","no":"Villig til å pendle","sv":"Kan tänka sig att pendla"},
    "rebuild.profile.work_identity_title": {
        "cs":"Tvoje pracovní identita","en":"Your work identity","de":"Ihre Arbeitsidentität","pl":"Twoja tożsamość zawodowa","sk":"Tvoja pracovná identita","at":"Ihre Arbeitsidentität","da":"Din arbejdsidentitet","fi":"Työidentiteettisi","no":"Din arbeidsidentitet","sv":"Din arbetsidentitet"},
    "rebuild.profile.work_direction_label": {
        "cs":"Pracovní směr:","en":"Work direction:","de":"Arbeitsrichtung:","pl":"Kierunek zawodowy:","sk":"Pracovný smer:","at":"Arbeitsrichtung:","da":"Arbejdsretning:","fi":"Työsuuntaus:","no":"Arbeidsretning:","sv":"Arbetsinriktning:"},
    "rebuild.profile.burnout_risk_label": {
        "cs":"Riziko vyhoření:","en":"Burnout risk:","de":"Burnout-Risiko:","pl":"Ryzyko wypalenia:","sk":"Riziko vyhorenia:","at":"Burnout-Risiko:","da":"Risiko for burnout:","fi":"Loppuunpalamisen riski:","no":"Risiko for utbrenthet:","sv":"Risk för utbrändhet:"},
    "rebuild.profile.strong_zone_label": {
        "cs":"Silná zóna:","en":"Strong zone:","de":"Starke Zone:","pl":"Mocna strefa:","sk":"Silná zóna:","at":"Starke Zone:","da":"Stærk zone:","fi":"Vahva alue:","no":"Sterk sone:","sv":"Stark zon:"},
    "rebuild.profile.empty_profile_title": {
        "cs":"Tvůj pracovní profil je zatím prázdný","en":"Your work profile is empty","de":"Ihr Arbeitsprofil ist noch leer","pl":"Twój profil zawodowy jest pusty","sk":"Tvoj pracovný profil je zatiaľ prázdny","at":"Ihr Arbeitsprofil ist noch leer","da":"Din arbejdsprofil er tom","fi":"Työprofiilisi on tyhjä","no":"Arbeidsprofilen din er tom","sv":"Din arbetsprofil är tom"},
    "rebuild.profile.empty_profile_desc": {
        "cs":"Pro aktivaci AI analýzy tvé identity a silných stránek je potřeba dokončit test.",
        "en":"Complete the assessment to activate the AI analysis of your identity and strengths.",
        "de":"Schließen Sie das Assessment ab, um die KI-Analyse Ihrer Identität und Stärken zu aktivieren.",
        "pl":"Ukończ test, aby aktywować analizę AI swojej tożsamości i mocnych stron.",
        "sk":"Pre aktiváciu AI analýzy tvojej identity a silných stránok je potrebné dokončiť test.",
        "at":"Schließen Sie das Assessment ab, um die KI-Analyse Ihrer Identität und Stärken zu aktivieren.",
        "da":"Gennemfør testen for at aktivere AI-analysen af din identitet og stærke sider.",
        "fi":"Suorita arviointi aktivoidaksesi tekoälyanalyysin identiteetistäsi ja vahvuuksistasi.",
        "no":"Fullfør vurderingen for å aktivere AI-analysen av din identitet og styrker.",
        "sv":"Slutför utvärderingen för att aktivera AI-analysen av din identitet och dina styrkor."},
    "rebuild.profile.start_jcfpm_test": {
        "cs":"Spustit JCFPM test","en":"Start JCFPM test","de":"JCFPM-Test starten","pl":"Uruchom test JCFPM","sk":"Spustiť JCFPM test","at":"JCFPM-Test starten","da":"Start JCFPM-test","fi":"Aloita JCFPM-testi","no":"Start JCFPM-test","sv":"Starta JCFPM-test"},
    "rebuild.profile.view_detail": {
        "cs":"Zobrazit detail","en":"View detail","de":"Details anzeigen","pl":"Pokaż szczegóły","sk":"Zobraziť detail","at":"Details anzeigen","da":"Vis detaljer","fi":"Näytä yksityiskohdat","no":"Vis detaljer","sv":"Visa detaljer"},
    "rebuild.profile.your_strengths_title": {
        "cs":"Tvoje silné stránky","en":"Your strengths","de":"Ihre Stärken","pl":"Twoje mocne strony","sk":"Tvoje silné stránky","at":"Ihre Stärken","da":"Dine stærke sider","fi":"Vahvuutesi","no":"Dine styrker","sv":"Dina styrkor"},
    "rebuild.profile.strengths_after_jcfpm": {
        "cs":"Dovednosti se zobrazí po JCFPM","en":"Skills will appear after JCFPM","de":"Fähigkeiten werden nach JCFPM angezeigt","pl":"Umiejętności pojawią się po JCFPM","sk":"Zručnosti sa zobrazia po JCFPM","at":"Fähigkeiten werden nach JCFPM angezeigt","da":"Færdigheder vises efter JCFPM","fi":"Taidot näkyvät JCFPM:n jälkeen","no":"Ferdigheter vises etter JCFPM","sv":"Kompetenser visas efter JCFPM"},
    "rebuild.profile.jhi_index_title": {
        "cs":"JHI Index","en":"JHI Index","de":"JHI-Index","pl":"Indeks JHI","sk":"JHI Index","at":"JHI-Index","da":"JHI-indeks","fi":"JHI-indeksi","no":"JHI-indeks","sv":"JHI-index"},
    "rebuild.profile.out_of_1000": {
        "cs":"z 1000","en":"out of 1000","de":"von 1000","pl":"z 1000","sk":"z 1000","at":"von 1000","da":"ud af 1000","fi":"maks. 1000","no":"av 1000","sv":"av 1000"},
    "rebuild.profile.jhi_active_desc": {
        "cs":"Tvůj Job Human Index ukazuje tvůj potenciál, adaptabilitu a připravenost na nové výzvy.",
        "en":"Your Job Human Index reflects your potential, adaptability, and readiness for new challenges.",
        "de":"Ihr Job Human Index spiegelt Ihr Potenzial, Ihre Anpassungsfähigkeit und Ihre Bereitschaft für neue Herausforderungen wider.",
        "pl":"Twój Job Human Index odzwierciedla twój potencjał, elastyczność i gotowość na nowe wyzwania.",
        "sk":"Tvoj Job Human Index ukazuje tvoj potenciál, adaptabilitu a pripravenosť na nové výzvy.",
        "at":"Ihr Job Human Index spiegelt Ihr Potenzial und Ihre Bereitschaft für neue Herausforderungen wider.",
        "da":"Dit Job Human Index afspejler dit potentiale, din tilpasningsevne og parathed til nye udfordringer.",
        "fi":"Job Human Index heijastaa potentiaaliasi, sopeutumiskykyäsi ja valmiuttasi uusiin haasteisiin.",
        "no":"Din Job Human Index gjenspeiler ditt potensial og beredskap for nye utfordringer.",
        "sv":"Ditt Job Human Index speglar din potential och beredskap för nya utmaningar."},
    "rebuild.profile.jhi_pending_desc": {
        "cs":"Tvůj JHI index se vypočítá na základě výsledků testu a tvého profilu.",
        "en":"Your JHI index will be calculated based on the assessment results and your profile.",
        "de":"Ihr JHI-Index wird basierend auf den Assessment-Ergebnissen und Ihrem Profil berechnet.",
        "pl":"Twój indeks JHI zostanie obliczony na podstawie wyników testu i twojego profilu.",
        "sk":"Tvoj JHI index sa vypočíta na základe výsledkov testu a tvojho profilu.",
        "at":"Ihr JHI-Index wird basierend auf den Assessment-Ergebnissen und Ihrem Profil berechnet.",
        "da":"Dit JHI-indeks vil blive beregnet på baggrund af testresultaterne og din profil.",
        "fi":"JHI-indeksisi lasketaan arviointitulosten ja profiilisi perusteella.",
        "no":"JHI-indeksen din vil bli beregnet basert på vurderingsresultatene og profilen din.",
        "sv":"Ditt JHI-index kommer att beräknas baserat på utvärderingsresultaten och din profil."},
    "rebuild.profile.how_jhi_works": {
        "cs":"Jak JHI funguje?","en":"How does JHI work?","de":"Wie funktioniert JHI?","pl":"Jak działa JHI?","sk":"Ako JHI funguje?","at":"Wie funktioniert JHI?","da":"Hvordan fungerer JHI?","fi":"Miten JHI toimii?","no":"Hvordan fungerer JHI?","sv":"Hur fungerar JHI?"},
    "rebuild.profile.start_calculation": {
        "cs":"Spustit výpočet","en":"Start calculation","de":"Berechnung starten","pl":"Rozpocznij obliczenia","sk":"Spustiť výpočet","at":"Berechnung starten","da":"Start beregning","fi":"Aloita laskenta","no":"Start beregning","sv":"Starta beräkning"},
    "rebuild.profile.primary_direction": {
        "cs":"Primární směr","en":"Primary direction","de":"Primäre Richtung","pl":"Główny kierunek","sk":"Primárny smer","at":"Primäre Richtung","da":"Primær retning","fi":"Ensisijainen suunta","no":"Primær retning","sv":"Primär inriktning"},
    "rebuild.profile.secondary_direction": {
        "cs":"Sekundární směr","en":"Secondary direction","de":"Sekundäre Richtung","pl":"Drugi kierunek","sk":"Sekundárny smer","at":"Sekundäre Richtung","da":"Sekundær retning","fi":"Toissijainen suunta","no":"Sekundær retning","sv":"Sekundär inriktning"},
    "rebuild.profile.third_direction": {
        "cs":"Třetí směr","en":"Third direction","de":"Dritte Richtung","pl":"Trzeci kierunek","sk":"Tretí smer","at":"Dritte Richtung","da":"Tredje retning","fi":"Kolmas suunta","no":"Tredje retning","sv":"Tredje inriktning"},
    "rebuild.profile.exploration_direction": {
        "cs":"Exploration směr","en":"Exploration direction","de":"Explorations-Richtung","pl":"Kierunek eksploracji","sk":"Exploration smer","at":"Explorations-Richtung","da":"Udforskende retning","fi":"Tutkimussuunta","no":"Utforskende retning","sv":"Utforskande inriktning"},
    "rebuild.profile.ai_target_role_label": {
        "cs":"AI odhad cílové role:","en":"AI target role estimate:","de":"KI-Zielrollenschätzung:","pl":"Szacowana rola docelowa przez AI:","sk":"AI odhad cieľovej roly:","at":"KI-Zielrollenschätzung:","da":"AI estimat for målrolle:","fi":"Tekoälyn arvioima tavoiterooli:","no":"AI-estimat for målrolle:","sv":"AI-uppskattning av målroll:"},
    "rebuild.profile.feed_prioritize": {
        "cs":"Upřednostnit","en":"Prioritize","de":"Priorisieren","pl":"Priorytetyzuj","sk":"Uprednostniť","at":"Priorisieren","da":"Prioriter","fi":"Priorisoi","no":"Prioriter","sv":"Prioritera"},
    "rebuild.profile.feed_restrict": {
        "cs":"Omezit","en":"Restrict","de":"Einschränken","pl":"Ogranicz","sk":"Obmedziť","at":"Einschränken","da":"Begræns","fi":"Rajoita","no":"Begrens","sv":"Begränsa"},
    "rebuild.profile.jhi_weights_desc": {
        "cs":"Po onboardingu se doporučení neřídí jen názvem role, ale i tím, kolik prostoru potřebuješ pro smysl, autonomii a tvorbu.",
        "en":"After onboarding, recommendations aren't just based on role titles, but also on how much space you need for meaning, autonomy, and creativity.",
        "de":"Nach dem Onboarding basieren die Empfehlungen nicht nur auf Rollentiteln, sondern auch auf Ihrem Bedarf an Autonomie und Kreativität.",
        "pl":"Po wdrożeniu rekomendacje opierają się nie tylko na nazwach ról, ale też na przestrzeni dla sensu i autonomii.",
        "sk":"Po onboarding sa odporúčania neriadia len názvom roly, ale aj priestorom pre zmysel a autonómiu.",
        "at":"Nach dem Onboarding basieren Empfehlungen auf Ihrer Autonomie und Ihrem Kreativitätsbedarf.",
        "da":"Efter onboarding baseres anbefalinger på hvor meget plads du har brug for til mening og selvstændighed.",
        "fi":"Perehdytyksen jälkeen suositukset perustuvat tilan tarpeeseen merkityksellisyydelle ja autonomialle.",
        "no":"Etter onboarding er anbefalinger basert på behov for mening og autonomi.",
        "sv":"Efter onboarding baseras rekommendationer på behovet av mening och självständighet."},
    "rebuild.profile.experience_title": {
        "cs":"Zkušenosti","en":"Work Experience","de":"Berufserfahrung","pl":"Doświadczenie zawodowe","sk":"Skúsenosti","at":"Berufserfahrung","da":"Erhvervserfaring","fi":"Työkokemus","no":"Arbeidserfaring","sv":"Arbetserfarenhet"},
    "rebuild.profile.no_experience_desc": {
        "cs":"Zatím tu nejsou zkušenosti. Nahráním CV je doplníš automaticky.",
        "en":"No experience added yet. Uploading a CV will populate this automatically.",
        "de":"Noch keine Berufserfahrung hinzugefügt. Das Hochladen eines Lebenslaufs füllt dies automatisch aus.",
        "pl":"Brak doświadczenia. Przesłanie CV uzupełni te dane automatycznie.",
        "sk":"Zatiaľ tu nie sú skúsenosti. Nahraním CV ich doplníš automaticky.",
        "at":"Noch keine Berufserfahrung. Das Hochladen eines Lebenslaufs füllt dies automatisch aus.",
        "da":"Ingen erfaring tilføjet endnu. Upload af et CV vil udfylde dette automatisk.",
        "fi":"Ei vielä työkokemusta. CV:n lataaminen täyttää tämän automaattisesti.",
        "no":"Ingen erfaring lagt til ennå. Opplasting av en CV vil fylle ut dette automatisk.",
        "sv":"Ingen erfarenhet har lagts till än. Uppladdning av CV fyller i detta automatiskt."},
    "rebuild.profile.education_title": {
        "cs":"Vzdělání a kurzy","en":"Education & Courses","de":"Ausbildung & Kurse","pl":"Wykształcenie i kursy","sk":"Vzdelanie a kurzy","at":"Ausbildung & Kurse","da":"Uddannelse & kurser","fi":"Koulutus ja kurssit","no":"Utdanning og kurs","sv":"Utbildning & kurser"},
    "rebuild.profile.no_year": {
        "cs":"Bez roku","en":"No year","de":"Ohne Jahr","pl":"Brak roku","sk":"Bez roku","at":"Ohne Jahr","da":"Intet år","fi":"Ei vuotta","no":"Ikke oppgitt år","sv":"Inget år"},
    "rebuild.profile.documents_title": {
        "cs":"Dokumenty a onboarding","en":"Documents & Onboarding","de":"Dokumente & Onboarding","pl":"Dokumenty i onboarding","sk":"Dokumenty a onboarding","at":"Dokumente & Onboarding","da":"Dokumenter & onboarding","fi":"Asiakirjat ja perehdytys","no":"Dokumenter og onboarding","sv":"Dokument & onboarding"},
    "rebuild.profile.profile_status": {
        "cs":"Stav profilu","en":"Profile status","de":"Profilstatus","pl":"Status profilu","sk":"Stav profilu","at":"Profilstatus","da":"Profilstatus","fi":"Profiilin tila","no":"Profilstatus","sv":"Profilstatus"},
    "rebuild.profile.onboarding_mostly_done": {
        "cs":"dokončen z větší části","en":"mostly complete","de":"größtenteils abgeschlossen","pl":"w większości ukończony","sk":"dokončený z väčšej časti","at":"größtenteils abgeschlossen","da":"for det meste færdig","fi":"suurimmaksi osaksi valmis","no":"stort sett fullført","sv":"för det mesta klar"},
    "rebuild.profile.onboarding_needs_steps": {
        "cs":"ještě potřebuje doplnit několik kroků","en":"still needs a few more steps","de":"benötigt noch einige Schritte","pl":"wymaga jeszcze kilku kroków","sk":"ešte potrebuje doplniť niekoľko krokov","at":"benötigt noch einige Schritte","da":"mangler stadig et par trin","fi":"vaatii vielä muutaman vaiheen","no":"mangler fortsatt noen trinn","sv":"behöver fortfarande kompletteras"},
    "rebuild.profile.loading_documents": {
        "cs":"Načítám dokumenty…","en":"Loading documents...","de":"Dokumente werden geladen...","pl":"Ładowanie dokumentów...","sk":"Načítavam dokumenty…","at":"Dokumente werden geladen...","da":"Indlæser dokumenter...","fi":"Ladataan asiakirjoja...","no":"Laster dokumenter...","sv":"Laddar dokument..."},
    "rebuild.profile.no_documents_desc": {
        "cs":"Zatím tu není žádný dokument.","en":"No documents uploaded yet.","de":"Noch keine Dokumente hochgeladen.","pl":"Nie przesłano jeszcze żadnych dokumentów.","sk":"Zatiaľ tu nie je žiadny dokument.","at":"Noch keine Dokumente hochgeladen.","da":"Ingen dokumenter uploadet endnu.","fi":"Ei vielä ladattuja asiakirjoja.","no":"Ingen dokumenter lastet opp ennå.","sv":"Inga dokument har laddats upp än."},
    "rebuild.profile.quick_tools_title": {
        "cs":"Rychlé nástroje","en":"Quick Tools","de":"Schnellzugriff","pl":"Szybkie narzędzia","sk":"Rýchle nástroje","at":"Schnellzugriff","da":"Hurtige værktøjer","fi":"Pikatyökalut","no":"Hurtigverktøy","sv":"Snabbverktyg"},
    "rebuild.profile.tax_calculator_title": {
        "cs":"Daňová kalkulačka","en":"Tax Calculator","de":"Steuerrechner","pl":"Kalkulator podatkowy","sk":"Daňová kalkulačka","at":"Steuerrechner","da":"Skatteberegner","fi":"Verolaskuri","no":"Skattekalkulator","sv":"Skattekalkylator"},
    "rebuild.profile.tax_calculator_desc": {
        "cs":"Spočítej si čistou mzdu","en":"Calculate your net salary","de":"Berechnen Sie Ihr Nettogehalt","pl":"Oblicz swoją płacę netto","sk":"Spočítaj si čistú mzdu","at":"Berechnen Sie Ihr Nettogehalt","da":"Beregn din nettoløn","fi":"Laske nettopalkkasi","no":"Beregn nettolønnen din","sv":"Räkna ut din nettolön"},
    "rebuild.profile.search_filters_title": {
        "cs":"Nastavení filtrů hledání","en":"Search Filter Settings","de":"Suchfilter-Einstellungen","pl":"Ustawienia filtrów wyszukiwania","sk":"Nastavenie filtrov hľadania","at":"Suchfilter-Einstellungen","da":"Indstillinger for søgefilter","fi":"Hakusuodattimen asetukset","no":"Søkefilterinnstillinger","sv":"Sökfilterinställningar"},
    "rebuild.profile.search_filters_desc": {
        "cs":"Uprav, co chceš ve výzvách vidět","en":"Adjust what challenges you want to see","de":"Passen Sie an, welche Challenges Sie sehen möchten","pl":"Dostosuj wyzwania, które chcesz widzieć","sk":"Uprav, čo chceš vo výzvach vidieť","at":"Passen Sie an, welche Challenges Sie sehen möchten","da":"Tilpas hvilke udfordringer du vil se","fi":"Säädä, mitä haasteita haluat nähdä","no":"Tilpass hvilke utfordringer du vil se","sv":"Justera vilka utmaningar du vill se"},
    "rebuild.profile.notifications_title": {
        "cs":"Email a notifikace","en":"Email & Notifications","de":"E-Mail & Benachrichtigungen","pl":"E-mail i powiadomienia","sk":"Email a notifikácie","at":"E-Mail & Benachrichtigungen","da":"E-mail & notifikationer","fi":"Sähköposti ja ilmoitukset","no":"E-post og varsler","sv":"E-post & aviseringar"},
    "rebuild.profile.notifications_desc": {
        "cs":"Spravuj upozornění a souhrny","en":"Manage alerts and summaries","de":"Benachrichtigungen und Zusammenfassungen verwalten","pl":"Zarządzaj powiadomieniami i podsumowaniami","sk":"Spravuj upozornenia a súhrny","at":"Benachrichtigungen und Zusammenfassungen verwalten","da":"Administrer beskeder og resuméer","fi":"Hallitse ilmoituksia ja yhteenvetoja","no":"Administrer varsler og sammendrag","sv":"Hantera aviseringar och sammanfattningar"},
    "rebuild.profile.my_skills_title": {
        "cs":"Moje dovednosti","en":"My Skills","de":"Meine Fähigkeiten","pl":"Moje umiejętności","sk":"Moje zručnosti","at":"Meine Fähigkeiten","da":"Mine færdigheder","fi":"Omat taitoni","no":"Mine ferdigheter","sv":"Mina kompetenser"},
    "rebuild.profile.no_skills_desc": {
        "cs":"Dovednosti se objeví po doplnění CV nebo profilu.","en":"Skills will appear after filling out your CV or profile.","de":"Fähigkeiten werden nach Ausfüllen Ihres Lebenslaufs oder Profils angezeigt.","pl":"Umiejętności pojawią się po uzupełnieniu CV lub profilu.","sk":"Zručnosti sa objavia po doplnení CV alebo profilu.","at":"Fähigkeiten werden nach Ausfüllen Ihres Lebenslaufs oder Profils angezeigt.","da":"Færdigheder vises, når du har udfyldt dit CV eller din profil.","fi":"Taidot näkyvät, kun olet täyttänyt CV:si tai profiilisi.","no":"Ferdigheter vil vises etter at du har fylt ut CV-en eller profilen din.","sv":"Kompetenser visas när du har fyllt i ditt CV eller din profil."},
    "rebuild.profile.languages_card_title": {
        "cs":"Jazykové znalosti","en":"Language Skills","de":"Sprachkenntnisse","pl":"Znajomość języków","sk":"Jazykové znalosti","at":"Sprachkenntnisse","da":"Sprogkundskaber","fi":"Kielitaito","no":"Språkkunnskaper","sv":"Språkkunskaper"},
    "rebuild.profile.no_languages_desc": {
        "cs":"Jazyky zatím nejsou doplněné.","en":"Languages not specified yet.","de":"Sprachen noch nicht angegeben.","pl":"Języki nie zostały jeszcze uzupełnione.","sk":"Jazyky zatiaľ nie sú doplnené.","at":"Sprachen noch nicht angegeben.","da":"Sprog ikke angivet endnu.","fi":"Kieliä ei ole vielä määritetty.","no":"Språk er ikke oppgitt ennå.","sv":"Språk har inte angetts än."},
    "rebuild.profile.location_row_label": {
        "cs":"Lokalita","en":"Location","de":"Standort","pl":"Lokalizacja","sk":"Lokalita","at":"Standort","da":"Lokation","fi":"Sijainti","no":"Lokasjon","sv":"Plats"},
    "rebuild.profile.commute_row_label": {
        "cs":"Dojíždění","en":"Commute","de":"Pendeln","pl":"Dojazd","sk":"Dochádzanie","at":"Pendeln","da":"Pendling","fi":"Työmatka","no":"Pendling","sv":"Pendling"},
    "rebuild.profile.salary_row_label": {
        "cs":"Mzda","en":"Salary","de":"Gehalt","pl":"Wynagrodzenie","sk":"Mzda","at":"Gehalt","da":"Løn","fi":"Palkka","no":"Lønn","sv":"Lön"},
    "rebuild.profile.other_row_label": {
        "cs":"Další","en":"Other","de":"Andere","pl":"Inne","sk":"Ďalšie","at":"Andere","da":"Andre","fi":"Muuta","no":"Annet","sv":"Övrigt"},
    "rebuild.profile.not_specified": {
        "cs":"Neuvedeno","en":"Not specified","de":"Nicht angegeben","pl":"Nie podano","sk":"Neuvedené","at":"Nicht angegeben","da":"Ikke angivet","fi":"Ei määritetty","no":"Ikke oppgitt","sv":"Inte angivet"},
    "rebuild.profile.personal_details_title": {
        "cs":"Osobní údaje a nastavení","en":"Personal Details & Settings","de":"Persönliche Daten & Einstellungen","pl":"Dane osobowe i ustawienia","sk":"Osobné údaje a nastavenia","at":"Persönliche Daten & Einstellungen","da":"Personlige oplysninger & indstillinger","fi":"Henkilötiedot ja asetukset","no":"Personopplysninger og innstillinger","sv":"Personuppgifter & inställningar"},
    "rebuild.profile.email_row_label": {
        "cs":"E-mail","en":"Email","de":"E-Mail","pl":"E-mail","sk":"E-mail","at":"E-Mail","da":"E-mail","fi":"Sähköposti","no":"E-post","sv":"E-post"},
    "rebuild.profile.open_profile_link": {
        "cs":"Otevřít profil","en":"Open profile","de":"Profil öffnen","pl":"Otwórz profil","sk":"Otvoriť profil","at":"Profil öffnen","da":"Åbn profil","fi":"Avaa profiili","no":"Åpne profil","sv":"Öppna profil"},
    "rebuild.profile.open_portfolio_link": {
        "cs":"Otevřít portfolio","en":"Open portfolio","de":"Portfolio öffnen","pl":"Otwórz portfolio","sk":"Otvoriť portfólio","at":"Portfolio öffnen","da":"Åbn portefølje","fi":"Avaa portfolio","no":"Åpne portefølje","sv":"Öppna portfölj"},
    "rebuild.profile.profile_growth_title": {
        "cs":"Profil roste s tebou","en":"Profile grows with you","de":"Profil wächst mit Ihnen","pl":"Profil rośnie wraz z tobą","sk":"Profil rastie s tebou","at":"Profil wächst mit Ihnen","da":"Profilen vokser med dig","fi":"Profiilisi kasvaa kanssasi","no":"Profilen vokser med deg","sv":"Profilen växer med dig"},
    "rebuild.profile.profile_growth_desc": {
        "cs":"Čím víc informací doplníš, tím lépe ti Cybershaman najde ty pravé příležitosti.",
        "en":"The more details you fill in, the better Cybershaman matches you with the right opportunities.",
        "de":"Je mehr Details Sie ausfüllen, desto besser kann der Cyberschaman Sie mit den passenden Gelegenheiten zusammenbringen.",
        "pl":"Im więcej szczegółów uzupełnisz, tym lepiej Cybershaman dopasuje cię do odpowiednich ofert.",
        "sk":"Čím viac informácií doplníš, tým lepšie ti Cybershaman nájde príležitosti.",
        "at":"Je mehr Details Sie ausfüllen, desto besser passt der Cyberschaman Sie mit Gelegenheiten zusammen.",
        "da":"Jo flere detaljer du udfylder, jo bedre vil Cybershaman matche dig med muligheder.",
        "fi":"Mitä enemmän tietoja täytät, sitä paremmin Cybershaman mätsää sinut sopiviin mahdollisuuksiin.",
        "no":"Jo flere detaljer du fyller ut, jo bedre vil Cybershaman matche deg med muligheter.",
        "sv":"Ju fler detaljer du fyller i, desto bättre matchar Cybershaman dig med rätt möjligheter."},
    "rebuild.profile.filled_pct": {
        "cs":"vyplněno","en":"filled","de":"ausgefüllt","pl":"uzupełniono","sk":"vyplnené","at":"ausgefüllt","da":"udfyldt","fi":"täytetty","no":"utfylt","sv":"ifyllt"},
    "rebuild.profile.add_experience_task": {
        "cs":"Přidej zkušenosti","en":"Add work experience","de":"Berufserfahrung hinzufügen","pl":"Dodaj doświadczenie zawodowe","sk":"Pridaj skúsenosti","at":"Berufserfahrung hinzufügen","da":"Tilføj erhvervserfaring","fi":"Lisää työkokemusta","no":"Legg til arbeidserfaring","sv":"Lägg till arbetserfarenhet"},
    "rebuild.profile.add_experience_task_desc": {
        "cs":"Doplň další pracovní zkušenosti","en":"Fill in more work experience details","de":"Weitere Details zur Berufserfahrung ausfüllen","pl":"Uzupełnij szczegóły doświadczenia","sk":"Doplň ďalšie pracovné skúsenosti","at":"Weitere Berufserfahrungsdetails ausfüllen","da":"Udfyld flere oplysninger om erhvervserfaring","fi":"Täytä tarkemmat tiedot työkokemuksesta","no":"Fyll ut flere detaljer om arbeidserfaringen","sv":"Fyll i fler uppgifter om arbetserfarenheten"},
    "rebuild.profile.verify_skills_task": {
        "cs":"Ověř své dovednosti","en":"Verify your skills","de":"Fähigkeiten verifizieren","pl":"Zweryfikuj swoje umiejętności","sk":"Over svoje zručnosti","at":"Fähigkeiten verifizieren","da":"Bekræft dine færdigheder","fi":"Vahvista taitosi","no":"Bekreft ferdighetene dine","sv":"Verifiera dina kompetenser"},
    "rebuild.profile.verify_skills_task_desc": {
        "cs":"Získej odznaky a zvyšte důvěryhodnost","en":"Get badges to boost credibility","de":"Abzeichen erhalten, um die Glaubwürdigkeit zu erhöhen","pl":"Zdobądź odznaki, aby zwiększyć wiarygodność","sk":"Získaj odznaky a zvýš dôveryhodnosť","at":"Abzeichen erhalten für mehr Glaubwürdigkeit","da":"Få badges for at øge din troværdighed","fi":"Hanki merkkejä lisätäksesi uskottavuuttasi","no":"Få merker for å øke troverdigheten din","sv":"Skaffa märken för att öka trovärdigheten"},
    "rebuild.profile.answer_questions_task": {
        "cs":"Odpověz na otázky","en":"Answer questions","de":"Fragen beantworten","pl":"Odpowiedz na pytania","sk":"Odpovedz na otázky","at":"Fragen beantworten","da":"Besvar spørgsmål","fi":"Vastaa kysymyksiin","no":"Svar på spørsmål","sv":"Svara på frågor"},
    "rebuild.profile.answer_questions_task_desc": {
        "cs":"Pomůže nám to lépe tě poznat","en":"This helps us understand you better","de":"Dies hilft uns, Sie besser zu verstehen","pl":"To pomoże nam lepiej cię poznać","sk":"Pomôže nám to lepšie ťa spoznať","at":"Dies hilft uns, Sie besser zu verstehen","da":"Dette hjælper os med at lære dig bedre at kende","fi":"Tämä auttaa meitä tuntemaan sinut paremmin","no":"Dette hjelper oss å bli bedre kjent med deg","sv":"Detta hjälper oss att lära känna dig bättre"},
    "rebuild.profile.not_sure_title": {
        "cs":"Nejsi si jistý?","en":"Not sure?","de":"Nicht sicher?","pl":"Nie jesteś pewien?","sk":"Nie si si istý?","at":"Nicht sicher?","da":"Ikke sikker?","fi":"Epävarma?","no":"Ikke helt sikker?","sv":"Är du osäker?"},
    "rebuild.profile.not_sure_desc": {
        "cs":"Cybershaman ti pomůže doplnit tvůj profil krok za krokem.",
        "en":"Cybershaman will guide you step by step to complete your profile.",
        "de":"Der Cyberschaman wird Sie Schritt für Schritt durch das Ausfüllen Ihres Profils führen.",
        "pl":"Cybershaman poprowadzi cię krok po kroku przez uzupełnianie profilu.",
        "sk":"Cybershaman ti pomôže doplniť tvoj profil krok za krokom.",
        "at":"Der Cyberschaman führt Sie Schritt für Schritt durch Ihr Profil.",
        "da":"Cybershaman vil guide dig trin for trin til at færdiggøre din profil.",
        "fi":"Cybershaman opastaa sinua vaihe vaiheelta profiilisi täyttämisessä.",
        "no":"Cybershaman vil veilede deg trinn for trinn for å fullføre profilen din.",
        "sv":"Cybershaman vägleder dig steg för steg för att fylla i din profil."},
    "rebuild.profile.talk_to_us": {
        "cs":"Promluvit si","en":"Talk to us","de":"Mit uns sprechen","pl":"Porozmawiaj z nami","sk":"Porozprávať sa","at":"Mit uns sprechen","da":"Tal med os","fi":"Juttele kanssamme","no":"Snakk med oss","sv":"Prata med oss"},
    "rebuild.profile.only_images_supported": {
        "cs":"Nahrávat lze pouze obrázky.","en":"Only images are supported.","de":"Nur Bilder werden unterstützt.","pl":"Obsługiwane są tylko obrazy.","sk":"Nahrávať je možné iba obrázky.","at":"Nur Bilder werden unterstützt.","da":"Kun billeder understøttes.","fi":"Vain kuvat ovat tuettuja.","no":"Bare bilder støttes.","sv":"Endast bilder stöds."},
    "rebuild.profile.photo_too_large": {
        "cs":"Fotka nesmí přesáhnout velikost 5 MB.","en":"Photo exceeds 5 MB limit.","de":"Foto überschreitet das Limit von 5 MB.","pl":"Zdjęcie przekracza limit 5 MB.","sk":"Fotka nesmie presiahnuť veľkosť 5 MB.","at":"Foto überschreitet das Limit von 5 MB.","da":"Billede overskrider grænsen på 5 MB.","fi":"Kuva ylittää 5 MB:n rajan.","no":"Bildet overskrider grensen på 5 MB.","sv":"Bilden överskrider gränsen på 5 MB."},
    "rebuild.profile.cv_too_large": {
        "cs":"Dokument nesmí přesáhnout velikost 10 MB.","en":"Document exceeds 10 MB limit.","de":"Dokument überschreitet das Limit von 10 MB.","pl":"Dokument przekracza limit 10 MB.","sk":"Dokument nesmie presiahnuť veľkosť 10 MB.","at":"Dokument überschreitet das Limit von 10 MB.","da":"Dokument overskrider grænsen på 10 MB.","fi":"Asiakirja ylittää 10 MB:n rajan.","no":"Dokumentet overskrider grensen på 10 MB.","sv":"Dokumentet överskrider gränsen på 10 MB."},
    "rebuild.profile.cv_format_unsupported": {
        "cs":"Podporovány jsou pouze dokumenty PDF nebo Word.","en":"Only PDF or Word documents are supported.","de":"Nur PDF- oder Word-Dokumente werden unterstützt.","pl":"Obsługiwane są tylko dokumenty PDF lub Word.","sk":"Podporované sú iba dokumenty PDF alebo Word.","at":"Nur PDF- oder Word-Dokumente werden unterstützt.","da":"Kun PDF- eller Word-dokumenter understøttes.","fi":"Vain PDF- tai Word-asiakirjat ovat tuettuja.","no":"Bare PDF- eller Word-dokumenter støttes.","sv":"Endast PDF- eller Word-dokument stöds."},
    "rebuild.profile.photo_upload_failed": {
        "cs":"Nahrání fotky se nepovedlo.","en":"Photo upload failed.","de":"Foto-Upload fehlgeschlagen.","pl":"Przesyłanie zdjęcia nie powiodło się.","sk":"Nahranie fotky sa nepodarilo.","at":"Foto-Upload fehlgeschlagen.","da":"Upload af billede mislykkedes.","fi":"Kuvan lataus epäonnistui.","no":"Bildeoppasting mislyktes.","sv":"Bilden kunde inte laddas upp."},
    "rebuild.profile.cv_upload_failed": {
        "cs":"Nahrání dokumentu se nepovedlo.","en":"Document upload failed.","de":"Dokument-Upload fehlgeschlagen.","pl":"Przesyłanie dokumentu nie powiodło się.","sk":"Nahranie dokumentu sa nepodarilo.","at":"Dokument-Upload fehlgeschlagen.","da":"Upload af dokument mislykkedes.","fi":"Asiakirjan lataus epäonnistui.","no":"Dokumentoppasting mislyktes.","sv":"Dokumentet kunde inte laddas upp."},
    "rebuild.profile.feed_mode_label": {
        "cs":"Feed mode","en":"Feed mode","de":"Feed-Modus","pl":"Tryb feedu","sk":"Feed mode","at":"Feed-Modus","da":"Feed-tilstand","fi":"Syötetila","no":"Feed-modus","sv":"Feed-läge"},
    "rebuild.profile.jhi_weights_title": {
        "cs":"JHI Priority Weights","en":"JHI Priority Weights","de":"JHI-Prioritätsgewichte","pl":"Wagi priorytetów JHI","sk":"JHI Priority Weights","at":"JHI-Prioritätsgewichte","da":"JHI-prioritetsvægte","fi":"JHI-painotukset","no":"JHI-prioritetsvekter","sv":"JHI-prioritetsvikter"},
    "rebuild.profile.ai_signal_marker": {
        "cs":"AI Signal Marker","en":"AI Signal Marker","de":"KI-Signalmarker","pl":"AI Signal Marker","sk":"AI Signal Marker","at":"KI-Signalmarker","da":"AI-signalmarkør","fi":"Tekoälysignaalin merkintä","no":"AI-signalmarkør","sv":"AI-signalmarkör"},
    "rebuild.profile.certifications_label": {
        "cs":"Certifikace","en":"Certifications","de":"Zertifizierungen","pl":"Certyfikaty","sk":"Certifikácie","at":"Zertifizierungen","da":"Certifikater","fi":"Sertifikaatit","no":"Sertifikater","sv":"Certifieringar"},
    "rebuild.profile.certificates_label": {
        "cs":"Osvědčení","en":"Certificate","de":"Zertifikat","pl":"Zaświadczenie","sk":"Osvedčenie","at":"Zertifikat","da":"Certifikat","fi":"Todistus","no":"Sertifikat","sv":"Intyg"},
}

# ── Ordered replacements: specific (longer) first to avoid nesting ──
# Each tuple: (old_exact_string, new_string)
# IMPORTANT: order matters — longer/more specific strings MUST come before shorter ones
REPLACEMENTS = [

    # ── Helper function signatures & bodies ──
    (
        "const formatVisibility = (value?: string) => {\n  if (value === 'public') return 'Veřejný profil';\n  if (value === 'recruiter') return 'Viditelný firmám';\n  return 'Soukromý profil';\n};",
        "const formatVisibility = (value?: string, t?: (k: string, d: string) => string) => {\n  const _t = t || ((_k: string, d: string) => d);\n  if (value === 'public') return _t('rebuild.profile.visibility_public', 'Veřejný profil');\n  if (value === 'recruiter') return _t('rebuild.profile.visibility_recruiter', 'Viditelný firmám');\n  return _t('rebuild.profile.visibility_private', 'Soukromý profil');\n};"
    ),
    (
        "const formatTransportMode = (value?: string) => {\n  if (value === 'car') return 'Auto';\n  if (value === 'public' || value === 'public_transport') return 'MHD / vlak';\n  if (value === 'bike') return 'Kolo';\n  if (value === 'walk' || value === 'walking') return 'Pěšky';\n  return 'Dle příležitosti';\n};",
        "const formatTransportMode = (value?: string, t?: (k: string, d: string) => string) => {\n  const _t = t || ((_k: string, d: string) => d);\n  if (value === 'car') return _t('rebuild.profile.transport_car', 'Auto');\n  if (value === 'public' || value === 'public_transport') return _t('rebuild.profile.transport_public', 'MHD / vlak');\n  if (value === 'bike') return _t('rebuild.profile.transport_bike', 'Kolo');\n  if (value === 'walk' || value === 'walking') return _t('rebuild.profile.transport_walk', 'Pěšky');\n  return _t('rebuild.profile.transport_flexible', 'Dle příležitosti');\n};"
    ),
    (
        "const formatEmploymentType = (value?: string) => {\n  if (value === 'full_time') return 'Plný úvazek';\n  if (value === 'part_time') return 'Zkrácený úvazek';\n  if (value === 'contract') return 'Kontrakt';\n  if (value === 'internship') return 'Stáž';\n  if (value === 'temporary') return 'Dočasná spolupráce';\n  return 'Flexibilní';\n};",
        "const formatEmploymentType = (value?: string, t?: (k: string, d: string) => string) => {\n  const _t = t || ((_k: string, d: string) => d);\n  if (value === 'full_time') return _t('rebuild.profile.employment_full_time', 'Plný úvazek');\n  if (value === 'part_time') return _t('rebuild.profile.employment_part_time', 'Zkrácený úvazek');\n  if (value === 'contract') return _t('rebuild.profile.employment_contract', 'Kontrakt');\n  if (value === 'internship') return _t('rebuild.profile.employment_internship', 'Stáž');\n  if (value === 'temporary') return _t('rebuild.profile.employment_temporary', 'Dočasná spolupráce');\n  return _t('rebuild.profile.employment_flexible', 'Flexibilní');\n};"
    ),

    # formatUploadedAt fallback
    (
        "if (!value) return 'Právě teď';",
        "if (!value) return 'Právě teď'; // i18n: rebuild.profile.uploaded_just_now"
    ),

    # ── deriveStrengthMetrics: pass t parameter ──
    (
        "const deriveStrengthMetrics = (userProfile: UserProfile, completion: number) => {",
        "const deriveStrengthMetrics = (userProfile: UserProfile, completion: number, t?: (k: string, d: string) => string) => {"
    ),
    (
        "      { label: 'Spolehlivost', value: 0 },\n      { label: 'Praktické myšlení', value: 0 },\n      { label: 'Týmovost', value: 0 },\n      { label: 'Odolnost ve stresu', value: 0 },\n      { label: 'Učení se', value: 0 },",
        "      { label: t ? t('rebuild.profile.strength_reliability', 'Spolehlivost') : 'Spolehlivost', value: 0 },\n      { label: t ? t('rebuild.profile.strength_practical_thinking', 'Praktické myšlení') : 'Praktické myšlení', value: 0 },\n      { label: t ? t('rebuild.profile.strength_teamwork', 'Týmovost') : 'Týmovost', value: 0 },\n      { label: t ? t('rebuild.profile.strength_stress_resilience', 'Odolnost ve stresu') : 'Odolnost ve stresu', value: 0 },\n      { label: t ? t('rebuild.profile.strength_learning', 'Učení se') : 'Učení se', value: 0 },"
    ),
    (
        "    { label: 'Spolehlivost', value: find('d5_values', 76) },\n    { label: 'Praktické myšlení', value: find('d11_problem_decomposition', 72) },\n    { label: 'Týmovost', value: find('d2_social', 68) },\n    { label: 'Odolnost ve stresu', value: find('d4_energy', 66) },\n    { label: 'Učení se', value: find('d6_ai_readiness', Math.max(58, completion - 8)) },",
        "    { label: t ? t('rebuild.profile.strength_reliability', 'Spolehlivost') : 'Spolehlivost', value: find('d5_values', 76) },\n    { label: t ? t('rebuild.profile.strength_practical_thinking', 'Praktické myšlení') : 'Praktické myšlení', value: find('d11_problem_decomposition', 72) },\n    { label: t ? t('rebuild.profile.strength_teamwork', 'Týmovost') : 'Týmovost', value: find('d2_social', 68) },\n    { label: t ? t('rebuild.profile.strength_stress_resilience', 'Odolnost ve stresu') : 'Odolnost ve stresu', value: find('d4_energy', 66) },\n    { label: t ? t('rebuild.profile.strength_learning', 'Učení se') : 'Učení se', value: find('d6_ai_readiness', Math.max(58, completion - 8)) },"
    ),

    # ── deriveIdentityNarrative: pass t parameter ──
    (
        "const deriveIdentityNarrative = (userProfile: UserProfile) => {",
        "const deriveIdentityNarrative = (userProfile: UserProfile, t?: (k: string, d: string) => string) => {"
    ),
    (
        "  const targetRole = intent.targetRole || userProfile.preferences?.desired_role || userProfile.jobTitle || 'Systémový tvůrce';",
        "  const targetRole = intent.targetRole || userProfile.preferences?.desired_role || userProfile.jobTitle || (t ? t('rebuild.profile.target_role_fallback', 'Systémový tvůrce') : 'Systémový tvůrce');"
    ),
    (
        "  const primaryDomainLabel = getCandidateIntentDomainLabel(intent.primaryDomain, locale) || 'Systémová tvorba';",
        "  const primaryDomainLabel = getCandidateIntentDomainLabel(intent.primaryDomain, locale) || (t ? t('rebuild.profile.domain_fallback', 'Systémová tvorba') : 'Systémová tvorba');"
    ),
    (
        "    builderSignals ? 'Projektová a návrhová práce' : '',\n    aiSignals ? 'AI workflow a platformy' : '',\n    mobilitySignals ? 'Mobilita a infrastruktura' : '',\n    humanSignals ? 'Human-centric technologie' : '',\n    'Komplexní systémové role',",
        "    builderSignals ? (t ? t('rebuild.profile.feed_priority_project', 'Projektová a návrhová práce') : 'Projektová a návrhová práce') : '',\n    aiSignals ? (t ? t('rebuild.profile.feed_priority_ai', 'AI workflow a platformy') : 'AI workflow a platformy') : '',\n    mobilitySignals ? (t ? t('rebuild.profile.feed_priority_mobility', 'Mobilita a infrastruktura') : 'Mobilita a infrastruktura') : '',\n    humanSignals ? (t ? t('rebuild.profile.feed_priority_human', 'Human-centric technologie') : 'Human-centric technologie') : '',\n    t ? t('rebuild.profile.feed_priority_complex', 'Komplexní systémové role') : 'Komplexní systémové role',"
    ),
    (
        "    routineAversion ? 'Rutinní administrativa' : '',\n    routineAversion ? 'Čistě exekuční role' : '',\n    'Rigidní operativa',\n    'Práce bez autonomie',",
        "    routineAversion ? (t ? t('rebuild.profile.feed_avoid_routine', 'Rutinní administrativa') : 'Rutinní administrativa') : '',\n    routineAversion ? (t ? t('rebuild.profile.feed_avoid_execution', 'Čistě exekuční role') : 'Čistě exekuční role') : '',\n    t ? t('rebuild.profile.feed_avoid_rigid', 'Rigidní operativa') : 'Rigidní operativa',\n    t ? t('rebuild.profile.feed_avoid_no_autonomy', 'Práce bez autonomie') : 'Práce bez autonomie',"
    ),
    (
        "  const feedMode = sideIncomeSignals\n    ? 'Micro-projects · challenge contracts · sandbox consulting'\n    : 'System design · innovation tracks · architecture challenges';",
        "  const feedMode = sideIncomeSignals\n    ? (t ? t('rebuild.profile.feed_mode_sandbox', 'Micro-projects · challenge contracts · sandbox consulting') : 'Micro-projects · challenge contracts · sandbox consulting')\n    : (t ? t('rebuild.profile.feed_mode_design', 'System design · innovation tracks · architecture challenges') : 'System design · innovation tracks · architecture challenges');"
    ),
    (
        "    ? {\n      title: 'Core Signal Event: Earthship moment',\n      body: 'Došel jsi k řešení typu Earthship bez znalosti existujícího konceptu. To je silný marker nezávislé systémové představivosti a architektonického myšlení.',\n    }\n    : {\n      title: 'Core Signal Event',\n      body: 'AI ve tvém příběhu hledá momenty, kdy ses samostatně dostal k neobvyklému, ale funkčnímu řešení. Tyhle momenty pak používá při matchingu rezonance.',\n    };",
        "    ? {\n      title: t ? t('rebuild.profile.earthship_moment_title', 'Core Signal Event: Earthship moment') : 'Core Signal Event: Earthship moment',\n      body: t ? t('rebuild.profile.earthship_moment_body', 'Došel jsi k řešení typu Earthship bez znalosti existujícího konceptu. To je silný marker nezávislé systémové představivosti a architektonického myšlení.') : 'Došel jsi k řešení typu Earthship bez znalosti existujícího konceptu. To je silný marker nezávislé systémové představivosti a architektonického myšlení.',\n    }\n    : {\n      title: t ? t('rebuild.profile.core_signal_title', 'Core Signal Event') : 'Core Signal Event',\n      body: t ? t('rebuild.profile.core_signal_body', 'AI ve tvém příběhu hledá momenty, kdy ses samostatně dostal k neobvyklému, ale funkčnímu řešení. Tyhle momenty pak používá při matchingu rezonance.') : 'AI ve tvém příběhu hledá momenty, kdy ses samostatně dostal k neobvyklému, ale funkčnímu řešení. Tyhle momenty pak používá při matchingu rezonance.',\n    };"
    ),
    (
        "      { label: 'Meaning', value: 0.35 },\n      { label: 'Growth', value: 0.25 },\n      { label: 'Autonomy', value: 0.25 },\n      { label: 'Money', value: 0.10 },\n      { label: 'Stability', value: 0.05 },",
        "      { label: t ? t('jhi.label_values', 'Values fit') : 'Values fit', value: 0.35 },\n      { label: t ? t('jhi.label_growth', 'Growth') : 'Growth', value: 0.25 },\n      { label: t ? t('rebuild.profile.weight_autonomy', 'Autonomy') : 'Autonomy', value: 0.25 },\n      { label: t ? t('jhi.label_financial', 'Finance') : 'Finance', value: 0.10 },\n      { label: t ? t('rebuild.profile.weight_stability', 'Stability') : 'Stability', value: 0.05 },"
    ),
    (
        "      { label: 'Growth', value: 0.28 },\n      { label: 'Meaning', value: 0.24 },\n      { label: 'Autonomy', value: 0.20 },\n      { label: 'Money', value: 0.16 },\n      { label: 'Stability', value: 0.12 },",
        "      { label: t ? t('jhi.label_growth', 'Growth') : 'Growth', value: 0.28 },\n      { label: t ? t('jhi.label_values', 'Values fit') : 'Values fit', value: 0.24 },\n      { label: t ? t('rebuild.profile.weight_autonomy', 'Autonomy') : 'Autonomy', value: 0.20 },\n      { label: t ? t('jhi.label_financial', 'Finance') : 'Finance', value: 0.16 },\n      { label: t ? t('rebuild.profile.weight_stability', 'Stability') : 'Stability', value: 0.12 },"
    ),
    (
        "  const identityTitle = isJcfpmComplete\n    ? (builderSignals ? 'Vizionářský architekt systémů' : humanSignals && aiSignals ? 'Tvůrce human-centric technologií' : capitalizeLabel(targetRole))\n    : (userProfile.jobTitle || 'Profil se skládá...');",
        "  const identityTitle = isJcfpmComplete\n    ? (builderSignals ? 'Vizionářský architekt systémů' : humanSignals && aiSignals ? 'Tvůrce human-centric technologií' : capitalizeLabel(targetRole))\n    : (userProfile.jobTitle || (t ? t('rebuild.profile.profile_composing', 'Profil se skládá...') : 'Profil se skládá...'));"
    ),
    (
        "  const identitySummary = isJcfpmComplete\n    ? (builderSignals ? 'Tvoje energie patří do tvorby systémů, které propojují lidi, technologie a prostředí. Rutina tě oslabuje, komplexita tě nabíjí.' : humanSignals ? 'Silný signál směřuje k rolím, kde se propojuje dopad na lidi, změna systému a práce s nejasností.' : 'AI z tvého onboardingu čte směr, ve kterém máš tvořit, né jen vykonávat.')\n    : 'Dokonči JCFPM test a Cybershaman ti vytvoří přesnou pracovní identitu.';",
        "  const identitySummary = isJcfpmComplete\n    ? (builderSignals\n        ? (t ? t('rebuild.profile.narrative_builder', 'Tvoje energie patří do tvorby systémů, které propojují lidi, technologie a prostředí. Rutina tě oslabuje, komplexita tě nabíjí.') : 'Tvoje energie patří do tvorby systémů, které propojují lidi, technologie a prostředí. Rutina tě oslabuje, komplexita tě nabíjí.')\n        : humanSignals\n          ? (t ? t('rebuild.profile.narrative_human', 'Silný signál směřuje k rolím, kde se propojuje dopad na lidi, změna systému a práce s nejasností.') : 'Silný signál směřuje k rolím, kde se propojuje dopad na lidi, změna systému a práce s nejasností.')\n          : (t ? t('rebuild.profile.narrative_creator', 'AI z tvého onboardingu čte směr, ve kterém máš tvořit, né jen vykonávat.') : 'AI z tvého onboardingu čte směr, ve kterém máš tvořit, né jen vykonávat.'))\n    : (t ? t('rebuild.profile.complete_test_narrative', 'Dokonči JCFPM test a Cybershaman ti vytvoří přesnou pracovní identitu.') : 'Dokonči JCFPM test a Cybershaman ti vytvoří přesnou pracovní identitu.');"
    ),
    (
        "    burnoutRisk: isJcfpmComplete ? (routineAversion ? 'Rutinní administrativní role' : 'Role bez autonomie a dlouhodobého smyslu') : 'Bude upřesněno po JCFPM',",
        "    burnoutRisk: isJcfpmComplete ? (routineAversion ? (t ? t('rebuild.profile.burnout_risk_routine', 'Rutinní administrativní role') : 'Rutinní administrativní role') : (t ? t('rebuild.profile.burnout_risk_no_autonomy', 'Role bez autonomie a dlouhodobého smyslu') : 'Role bez autonomie a dlouhodobého smyslu')) : (t ? t('rebuild.profile.to_be_refined_jcfpm', 'Bude upřesněno po JCFPM') : 'Bude upřesněno po JCFPM'),"
    ),
    (
        "    strongZone: isJcfpmComplete ? (builderSignals ? 'Komplexní návrh systémů bez existující šablony' : 'Tvorba nových struktur a orientace v nejasnosti') : 'Bude upřesněno po JCFPM',",
        "    strongZone: isJcfpmComplete ? (builderSignals ? (t ? t('rebuild.profile.strong_zone_builder', 'Komplexní návrh systémů bez existující šablony') : 'Komplexní návrh systémů bez existující šablony') : (t ? t('rebuild.profile.strong_zone_creator', 'Tvorba nových struktur a orientace v nejasnosti') : 'Tvorba nových struktur a orientace v nejasnosti')) : (t ? t('rebuild.profile.to_be_refined_jcfpm', 'Bude upřesněno po JCFPM') : 'Bude upřesněno po JCFPM'),"
    ),

    # ── Pass t to the useMemo hooks ──
    (
        "      () => deriveStrengthMetrics(userProfile, completion),\n      [completion, userProfile],",
        "      () => deriveStrengthMetrics(userProfile, completion, t),\n      [completion, userProfile, t],"
    ),
    (
        "      () => deriveIdentityNarrative(userProfile),\n      [userProfile],",
        "      () => deriveIdentityNarrative(userProfile, t),\n      [userProfile, t],"
    ),

    # ── completionTasks: use t() ──
    (
        "      { id: 'experience', label: 'Přidej zkušenosti', copy: 'Doplň další pracovní zkušenosti' },\n      { id: 'skills', label: 'Ověř své dovednosti', copy: 'Získej odznaky a zvyšte důvěryhodnost' },\n      { id: 'signals', label: 'Odpověz na otázky', copy: 'Pomůže nám to lépe tě poznat' },",
        "      { id: 'experience', label: t('rebuild.profile.add_experience_task', 'Přidej zkušenosti'), copy: t('rebuild.profile.add_experience_task_desc', 'Doplň další pracovní zkušenosti') },\n      { id: 'skills', label: t('rebuild.profile.verify_skills_task', 'Ověř své dovednosti'), copy: t('rebuild.profile.verify_skills_task_desc', 'Získej odznaky a zvyšte důvěryhodnost') },\n      { id: 'signals', label: t('rebuild.profile.answer_questions_task', 'Odpověz na otázky'), copy: t('rebuild.profile.answer_questions_task_desc', 'Pomůže nám to lépe tě poznat') },"
    ),
    (
        "    ], []);",
        "    ], [t]);"
    ),

    # ── error messages (inline, in event handlers) ──
    (
        "setPhotoError(t('rebuild.profile.only_images_supported', { defaultValue: 'Only images are supported.' }));",
        "setPhotoError(t('rebuild.profile.only_images_supported', 'Nahrávat lze pouze obrázky.'));"
    ),
    (
        "setPhotoError(t('rebuild.profile.photo_too_large', { defaultValue: 'Photo exceeds 5 MB limit.' }));",
        "setPhotoError(t('rebuild.profile.photo_too_large', 'Fotka nesmí přesáhnout velikost 5 MB.'));"
    ),
    (
        "setPhotoError(error instanceof Error ? error.message : 'Nahrání fotky se nepovedlo.');",
        "setPhotoError(error instanceof Error ? error.message : t('rebuild.profile.photo_upload_failed', 'Nahrání fotky se nepovedlo.'));"
    ),
    (
        "setCvError(validationError === 'size' ? t('rebuild.profile.cv_too_large', { defaultValue: 'Document exceeds 10 MB limit.' }) : t('rebuild.profile.cv_format_unsupported', { defaultValue: 'Only PDF or Word documents are supported.' }));",
        "setCvError(validationError === 'size' ? t('rebuild.profile.cv_too_large', 'Dokument nesmí přesáhnout velikost 10 MB.') : t('rebuild.profile.cv_format_unsupported', 'Podporovány jsou pouze dokumenty PDF nebo Word.'));"
    ),
    (
        "setCvNotice(`Nahráno: ${file.name}`);",
        "setCvNotice(`${t('rebuild.profile.uploaded', 'Nahráno')}: ${file.name}`);"
    ),
    (
        "setCvError(error instanceof Error ? error.message : 'Nahrání dokumentu se nepovedlo.');",
        "setCvError(error instanceof Error ? error.message : t('rebuild.profile.cv_upload_failed', 'Nahrání dokumentu se nepovedlo.'));"
    ),

    # ── JSX: Top section (eyebrow, title, subtitle, action buttons) ──
    # NOTE: We match the exact JSX text used in the file. More specific first.
    (
        "eyebrow={<SectionEyebrow>Můj profil</SectionEyebrow>}",
        "eyebrow={<SectionEyebrow>{t('rebuild.profile.my_profile_title', 'Můj profil')}</SectionEyebrow>}"
    ),
    (
        'title="Můj profil"',
        "title={t('rebuild.profile.my_profile_title', 'Můj profil')}"
    ),
    (
        'subtitle="Tvé dovednosti, zkušenosti a potenciál na jednom místě."',
        "subtitle={t('rebuild.profile.my_profile_subtitle', 'Tvé dovednosti, zkušenosti a potenciál na jednom místě.')}"
    ),

    # Action buttons (longer strings first)
    (
        "{isSavingProfile ? 'Ukládám…' : 'Uložit na server'}",
        "{isSavingProfile ? t('rebuild.profile.saving', 'Ukládám…') : t('rebuild.profile.save_to_server', 'Uložit na server')}"
    ),

    # ── Modal ──
    (
        '<h3 className="text-xl font-semibold text-slate-900">Upravit profil</h3>',
        "<h3 className=\"text-xl font-semibold text-slate-900\">{t('rebuild.profile.edit_profile', 'Upravit profil')}</h3>"
    ),
    # Form labels (longer first where needed)
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Odvozené / doplňkové dovednosti</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.inferred_skills_label', 'Odvozené / doplňkové dovednosti')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Adresa / lokalita</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.address_label', 'Adresa / lokalita')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Pracovní role</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.role_label', 'Pracovní role')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Příběh / bio</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.story_label', 'Příběh / bio')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Preferované podmínky</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.preferences_label', 'Preferované podmínky')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Dovednosti</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.skills_label', 'Dovednosti')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Jméno</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.name_label', 'Jméno')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Telefon</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.phone_label', 'Telefon')}</label>"
    ),
    (
        '<label className="block text-sm font-medium text-slate-700">Jazykové znalosti</label>',
        "<label className=\"block text-sm font-medium text-slate-700\">{t('rebuild.profile.languages_label', 'Jazykové znalosti')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Typ úvazku</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.employment_type_label', 'Typ úvazku')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Doprava</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.transport_label', 'Doprava')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Dojíždění km</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.commute_radius_label', 'Dojíždění km')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Mzda od</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.salary_min_label', 'Mzda od')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Mzda do</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.salary_max_label', 'Mzda do')}</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">LinkedIn</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">LinkedIn</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Portfolio</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">Portfolio</label>"
    ),
    (
        '<label className="mb-1.5 block text-sm font-medium text-slate-700">Viditelnost</label>',
        "<label className=\"mb-1.5 block text-sm font-medium text-slate-700\">{t('rebuild.profile.visibility_label', 'Viditelnost')}</label>"
    ),
    (
        '<label className="mb-1 block text-xs font-medium text-slate-600">Jazyk</label>',
        "<label className=\"mb-1 block text-xs font-medium text-slate-600\">{t('rebuild.profile.language_name_label', 'Jazyk')}</label>"
    ),
    (
        '<label className="mb-1 block text-xs font-medium text-slate-600">Úroveň 1-8</label>',
        "<label className=\"mb-1 block text-xs font-medium text-slate-600\">{t('rebuild.profile.level_label', 'Úroveň 1-8')}</label>"
    ),
    (
        '<label className="mb-1 block text-xs font-medium text-slate-600">Poznámka</label>',
        "<label className=\"mb-1 block text-xs font-medium text-slate-600\">{t('rebuild.profile.note_label', 'Poznámka')}</label>"
    ),
    # Placeholders
    (
        'placeholder="Každou dovednost na nový řádek"',
        "placeholder={t('rebuild.profile.skills_placeholder', 'Každou dovednost na nový řádek')}"
    ),
    (
        'placeholder="Např. leadership, komunikace, analytika"',
        "placeholder={t('rebuild.profile.inferred_skills_placeholder', 'Např. leadership, komunikace, analytika')}"
    ),
    (
        'placeholder="Hybrid, autonomie, žádné noční směny..."',
        "placeholder={t('rebuild.profile.preferences_placeholder', 'Hybrid, autonomie, žádné noční směny...')}"
    ),
    # Select options (specific first)
    (
        '<option value="">Flexibilní</option>',
        "<option value=\"\">{t('rebuild.profile.employment_flexible', 'Flexibilní')}</option>"
    ),
    # Buttons with specific content (longer first)
    (
        '><Plus size={14} /> Přidat jazyk</button>',
        "><Plus size={14} /> {t('rebuild.profile.add_language', 'Přidat jazyk')}</button>"
    ),
    (
        'aria-label="Odebrat jazyk"',
        "aria-label={t('rebuild.profile.remove_language', 'Odebrat jazyk')}"
    ),
    # Modal footer buttons
    (
        'onClick={() => setIsEditingProfile(false)} className={secondaryButtonClass}>\n                  Zrušit\n                </button>',
        "onClick={() => setIsEditingProfile(false)} className={secondaryButtonClass}>\n                  {t('rebuild.profile.cancel', 'Zrušit')}\n                </button>"
    ),
    (
        "{isSavingProfile ? 'Ukládám…' : 'Uložit'}",
        "{isSavingProfile ? t('rebuild.profile.saving', 'Ukládám…') : t('rebuild.profile.save', 'Uložit')}"
    ),

    # ── Profile header card ──
    (
        "aria-label={t('rebuild.profile.change_photo', { defaultValue: 'Change photo' })}",
        "aria-label={t('rebuild.profile.change_photo', 'Změnit fotku')}"
    ),
    (
        "{userProfile.name || 'Tvé jméno'}",
        "{userProfile.name || t('rebuild.profile.name_label', 'Jméno')}"
    ),
    (
        "{completion}% profil kompletní",
        "{completion}% {t('rebuild.profile.completed_pct', 'profil kompletní')}"
    ),
    (
        "parsedData?.jobTitle || userProfile.jobTitle || 'Doplň svou hlavní roli'",
        "parsedData?.jobTitle || userProfile.jobTitle || t('rebuild.profile.fill_main_role', 'Doplň svou hlavní roli')"
    ),
    (
        "userProfile.address || preferences.address || 'Doplň lokalitu'",
        "userProfile.address || preferences.address || t('rebuild.profile.fill_location', 'Doplň lokalitu')"
    ),
    (
        "userProfile.phone || 'Telefon neuveden'",
        "userProfile.phone || t('rebuild.profile.phone_not_specified', 'Telefon neuveden')"
    ),
    (
        "Ochoten dojíždět {preferences.searchRadiusKm} km",
        "{t('rebuild.profile.willing_to_commute', 'Ochoten dojíždět')} {preferences.searchRadiusKm} km"
    ),
    # Buttons with Camera/Upload (more specific first)
    (
        "<Camera size={16} /> Změnit fotku",
        "<Camera size={16} /> {t('rebuild.profile.change_photo', 'Změnit fotku')}"
    ),
    (
        "<Upload size={16} /> Nahrát dokument",
        "<Upload size={16} /> {t('rebuild.profile.upload_document', 'Nahrát dokument')}"
    ),

    # ── Action button "Upravit profil" (in the profile actions bar) ──
    (
        "> { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>\n                  Upravit profil\n                </button>",
        "> { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-[16px] px-4 py-2.5 text-sm')}>\n                  {t('rebuild.profile.edit_profile', 'Upravit profil')}\n                </button>"
    ),

    # ── Work identity section ──
    (
        ">Tvoje pracovní identita</div>",
        ">{t('rebuild.profile.work_identity_title', 'Tvoje pracovní identita')}</div>"
    ),
    (
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">Pracovní směr:</span>",
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">{t('rebuild.profile.work_direction_label', 'Pracovní směr:')}</span>"
    ),
    (
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">Riziko vyhoření:</span>",
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">{t('rebuild.profile.burnout_risk_label', 'Riziko vyhoření:')}</span>"
    ),
    (
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">Silná zóna:</span>",
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">{t('rebuild.profile.strong_zone_label', 'Silná zóna:')}</span>"
    ),
    (
        ">Tvůj pracovní profil je zatím prázdný</div>",
        ">{t('rebuild.profile.empty_profile_title', 'Tvůj pracovní profil je zatím prázdný')}</div>"
    ),
    (
        ">Pro aktivaci AI analýzy tvé identity a silných stránek je potřeba dokončit test.</p>",
        ">{t('rebuild.profile.empty_profile_desc', 'Pro aktivaci AI analýzy tvé identity a silných stránek je potřeba dokončit test.')}</p>"
    ),
    (
        "Spustit JCFPM test <ChevronRight size={14} />",
        "{t('rebuild.profile.start_jcfpm_test', 'Spustit JCFPM test')} <ChevronRight size={14} />"
    ),
    (
        "Zobrazit detail <ChevronRight size={15} />",
        "{t('rebuild.profile.view_detail', 'Zobrazit detail')} <ChevronRight size={15} />"
    ),

    # ── Strengths card ──
    (
        'title="Tvoje silné stránky"',
        "title={t('rebuild.profile.your_strengths_title', 'Tvoje silné stránky')}"
    ),
    (
        ">Dovednosti se zobrazí po JCFPM</p>",
        ">{t('rebuild.profile.strengths_after_jcfpm', 'Dovednosti se zobrazí po JCFPM')}</p>"
    ),

    # ── JHI Index card ──
    (
        'title="JHI Index"',
        "title={t('rebuild.profile.jhi_index_title', 'JHI Index')}"
    ),
    (
        ">z 1000</div>",
        ">{t('rebuild.profile.out_of_1000', 'z 1000')}</div>"
    ),
    (
        "? 'Tvůj Job Human Index ukazuje tvůj potenciál, adaptabilitu a připravenost na nové výzvy.'\n                    : 'Tvůj JHI index se vypočítá na základě výsledků testu a tvého profilu.'",
        "? t('rebuild.profile.jhi_active_desc', 'Tvůj Job Human Index ukazuje tvůj potenciál, adaptabilitu a připravenost na nové výzvy.')\n                    : t('rebuild.profile.jhi_pending_desc', 'Tvůj JHI index se vypočítá na základě výsledků testu a tvého profilu.')"
    ),
    (
        "'Jak JHI funguje?' : 'Spustit výpočet'",
        "t('rebuild.profile.how_jhi_works', 'Jak JHI funguje?') : t('rebuild.profile.start_calculation', 'Spustit výpočet')"
    ),

    # ── Career Direction Map card ──
    (
        'title="Career Direction Map"',
        "title={t('rebuild.profile.career_direction_map', 'Career Direction Map') || 'Career Direction Map'}"
    ),
    (
        "'Primární směr' : index === 1 ? 'Sekundární směr' : index === 2 ? 'Třetí směr' : 'Exploration směr'",
        "t('rebuild.profile.primary_direction', 'Primární směr') : index === 1 ? t('rebuild.profile.secondary_direction', 'Sekundární směr') : index === 2 ? t('rebuild.profile.third_direction', 'Třetí směr') : t('rebuild.profile.exploration_direction', 'Exploration směr')"
    ),
    (
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">AI odhad cílové role:</span>",
        "><span className=\"font-semibold text-[color:var(--dashboard-text-strong)]\">{t('rebuild.profile.ai_target_role_label', 'AI odhad cílové role:')}</span>"
    ),

    # ── Feed card ──
    (
        'title="Jak se upraví feed"',
        "title={t('rebuild.profile.feed_adjustment_title', 'Jak se upraví feed') || 'Jak se upraví feed'}"
    ),
    (
        ">Upřednostnit</div>",
        ">{t('rebuild.profile.feed_prioritize', 'Upřednostnit')}</div>"
    ),
    (
        ">Omezit</div>",
        ">{t('rebuild.profile.feed_restrict', 'Omezit')}</div>"
    ),
    (
        ">Feed mode</div>",
        ">{t('rebuild.profile.feed_mode_label', 'Feed mode')}</div>"
    ),

    # ── JHI Priority Weights card ──
    (
        'title="JHI Priority Weights"',
        "title={t('rebuild.profile.jhi_weights_title', 'JHI Priority Weights')}"
    ),
    (
        ">Po onboardingu se doporučení neřídí jen názvem role, ale i tím, kolik prostoru potřebuješ pro smysl, autonomii a tvorbu.\n                ",
        ">{t('rebuild.profile.jhi_weights_desc', 'Po onboardingu se doporučení neřídí jen názvem role, ale i tím, kolik prostoru potřebuješ pro smysl, autonomii a tvorbu.')}\n                "
    ),

    # ── Core Signal Event card ──
    (
        'title="Core Signal Event"',
        "title={t('rebuild.profile.core_signal_event_title', 'Core Signal Event') || 'Core Signal Event'}"
    ),
    (
        ">AI Signal Marker</div>",
        ">{t('rebuild.profile.ai_signal_marker', 'AI Signal Marker')}</div>"
    ),

    # ── Work experience card ──
    (
        'title="Zkušenosti"',
        "title={t('rebuild.profile.experience_title', 'Zkušenosti')}"
    ),
    (
        # Add button on experience card (specific context)
        "action={<button type=\"button\" className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> Přidat</button>}\n            >\n              <div className=\"space-y-4\">\n                {workHistory",
        "action={<button type=\"button\" className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.add_item', 'Přidat')}</button>}\n            >\n              <div className=\"space-y-4\">\n                {workHistory"
    ),
    (
        ">Zatím tu nejsou zkušenosti. Nahráním CV je doplníš automaticky.</div>",
        ">{t('rebuild.profile.no_experience_desc', 'Zatím tu nejsou zkušenosti. Nahráním CV je doplníš automaticky.')}</div>"
    ),

    # ── Education card ──
    (
        'title="Vzdělání a kurzy"',
        "title={t('rebuild.profile.education_title', 'Vzdělání a kurzy')}"
    ),
    (
        # Add button on education card
        "action={<button type=\"button\" className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> Přidat</button>}\n            >\n              <div className=\"space-y-4\">\n                {education",
        "action={<button type=\"button\" className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.add_item', 'Přidat')}</button>}\n            >\n              <div className=\"space-y-4\">\n                {education"
    ),
    (
        "|| 'Bez roku'",
        "|| t('rebuild.profile.no_year', 'Bez roku')"
    ),
    (
        "t('rebuild.profile.no_education', { defaultValue: 'Education not added yet.' })",
        "t('rebuild.profile.no_education', 'Vzdělání zatím nebylo přidáno.')"
    ),

    # ── Documents & Onboarding card ──
    (
        'title="Dokumenty a onboarding"',
        "title={t('rebuild.profile.documents_title', 'Dokumenty a onboarding')}"
    ),
    (
        "t('rebuild.profile.profile_status', { defaultValue: 'Profile status' })",
        "t('rebuild.profile.profile_status', 'Stav profilu')"
    ),
    (
        "Onboarding {completion >= 70 ? 'dokončen z větší části' : 'ještě potřebuje doplnit několik kroků'}.",
        "{t('rebuild.profile.onboarding_label', 'Onboarding')} {completion >= 70 ? t('rebuild.profile.onboarding_mostly_done', 'dokončen z větší části') : t('rebuild.profile.onboarding_needs_steps', 'ještě potřebuje doplnit několik kroků')}."
    ),
    (
        ">Načítám dokumenty…</div>",
        ">{t('rebuild.profile.loading_documents', 'Načítám dokumenty…')}</div>"
    ),
    (
        ">Zatím tu není žádný dokument.\n                  </div>",
        ">{t('rebuild.profile.no_documents_desc', 'Zatím tu není žádný dokument.')}\n                  </div>"
    ),
    (
        ">Nahráno {formatUploadedAt(document.uploadedAt)}</div>",
        ">{t('rebuild.profile.uploaded', 'Nahráno')} {formatUploadedAt(document.uploadedAt)}</div>"
    ),
    (
        ">Aktivní</span>",
        ">{t('rebuild.profile.active', 'Aktivní')}</span>"
    ),
    (
        ">Vybrat\n                        </button>",
        ">{t('rebuild.profile.select', 'Vybrat')}\n                        </button>"
    ),
    (
        "<Trash2 size={13} /> Odebrat\n                       </button>",
        "<Trash2 size={13} /> {t('rebuild.profile.remove', 'Odebrat')}\n                       </button>"
    ),
    (
        "{cvBusy ? 'Nahrávám…' : 'Nahrát dokument'}",
        "{cvBusy ? t('rebuild.profile.uploading', 'Nahrávám…') : t('rebuild.profile.upload_document', 'Nahrát dokument')}"
    ),

    # ── Quick Tools card ──
    (
        'title="Rychlé nástroje"',
        "title={t('rebuild.profile.quick_tools_title', 'Rychlé nástroje')}"
    ),
    (
        "{ label: 'Daňová kalkulačka', copy: 'Spočítej si čistou mzdu', action: () => navigate('/candidate/insights') },",
        "{ label: t('rebuild.profile.tax_calculator_title', 'Daňová kalkulačka'), copy: t('rebuild.profile.tax_calculator_desc', 'Spočítej si čistou mzdu'), action: () => navigate('/candidate/insights') },"
    ),
    (
        "{ label: 'Nastavení filtrů hledání', copy: 'Uprav, co chceš ve výzvách vidět', action: () => navigate('/candidate/marketplace') },",
        "{ label: t('rebuild.profile.search_filters_title', 'Nastavení filtrů hledání'), copy: t('rebuild.profile.search_filters_desc', 'Uprav, co chceš ve výzvách vidět'), action: () => navigate('/candidate/marketplace') },"
    ),
    (
        "{ label: 'Email a notifikace', copy: 'Spravuj upozornění a souhrny', action: () => void onSaveProfile?.() },",
        "{ label: t('rebuild.profile.notifications_title', 'Email a notifikace'), copy: t('rebuild.profile.notifications_desc', 'Spravuj upozornění a souhrny'), action: () => void onSaveProfile?.() },"
    ),

    # ── My Skills card ──
    (
        'title="Moje dovednosti" icon={<Sparkles size={18} />} action={<button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, \'rounded-full px-3 py-2 text-xs\')}><Plus size={14} /> Upravit</button>}>',
        "title={t('rebuild.profile.my_skills_title', 'Moje dovednosti')} icon={<Sparkles size={18} />} action={<button type=\"button\" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.edit_item', 'Upravit')}</button>}>"
    ),
    (
        ">Dovednosti se objeví po doplnění CV nebo profilu.</div>",
        ">{t('rebuild.profile.no_skills_desc', 'Dovednosti se objeví po doplnění CV nebo profilu.')}</div>"
    ),

    # ── Languages card ──
    (
        'title="Jazykové znalosti" icon={<Languages size={18} />} action={<button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, \'rounded-full px-3 py-2 text-xs\')}><Plus size={14} /> Upravit</button>}>',
        "title={t('rebuild.profile.languages_card_title', 'Jazykové znalosti')} icon={<Languages size={18} />} action={<button type=\"button\" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.edit_item', 'Upravit')}</button>}>"
    ),
    (
        ">Jazyky zatím nejsou doplněné.</div>",
        ">{t('rebuild.profile.no_languages_desc', 'Jazyky zatím nejsou doplněné.')}</div>"
    ),

    # ── Preferred conditions card ──
    (
        'title="Preferované podmínky" icon={<MapPin size={18} />} action={<button type="button" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, \'rounded-full px-3 py-2 text-xs\')}><Plus size={14} /> Upravit</button>}>',
        "title={t('rebuild.profile.preferences_label', 'Preferované podmínky')} icon={<MapPin size={18} />} action={<button type=\"button\" onClick={() => { setEditForm(currentProfileForm); setIsEditingProfile(true); }} className={cn(secondaryButtonClass, 'rounded-full px-3 py-2 text-xs')}><Plus size={14} /> {t('rebuild.profile.edit_item', 'Upravit')}</button>}>"
    ),
    (
        'label="Lokalita"',
        "label={t('rebuild.profile.location_row_label', 'Lokalita')}"
    ),
    (
        'label="Typ úvazku"',
        "label={t('rebuild.profile.employment_type_label', 'Typ úvazku')}"
    ),
    (
        'label="Dojíždění"',
        "label={t('rebuild.profile.commute_row_label', 'Dojíždění')}"
    ),
    (
        'label="Mzda"',
        "label={t('rebuild.profile.salary_row_label', 'Mzda')}"
    ),
    (
        'label="Viditelnost"',
        "label={t('rebuild.profile.visibility_label', 'Viditelnost')}"
    ),
    (
        'label="Další"',
        "label={t('rebuild.profile.other_row_label', 'Další')}"
    ),
    (
        "|| 'Neuvedeno'",
        "|| t('rebuild.profile.not_specified', 'Neuvedeno')"
    ),
    (
        "formatEmploymentType(userProfile.preferences?.desired_employment_type)",
        "formatEmploymentType(userProfile.preferences?.desired_employment_type, t)"
    ),
    (
        "formatTransportMode(userProfile.transportMode)",
        "formatTransportMode(userProfile.transportMode, t)"
    ),
    (
        "formatVisibility(userProfile.preferences?.profile_visibility)",
        "formatVisibility(userProfile.preferences?.profile_visibility, t)"
    ),

    # ── Personal details card ──
    (
        'title="Osobní údaje a nastavení"',
        "title={t('rebuild.profile.personal_details_title', 'Osobní údaje a nastavení')}"
    ),
    (
        'label="E-mail"',
        "label={t('rebuild.profile.email_row_label', 'E-mail')}"
    ),
    (
        'label="Telefon"',
        "label={t('rebuild.profile.phone_label', 'Telefon')}"
    ),
    (
        'label="LinkedIn"',
        "label={t('rebuild.profile.linkedin_label', 'LinkedIn')}"
    ),
    (
        'label="Portfolio"',
        "label={t('rebuild.profile.portfolio_label', 'Portfolio')}"
    ),
    (
        ">Otevřít profil</a>",
        ">{t('rebuild.profile.open_profile_link', 'Otevřít profil')}</a>"
    ),
    (
        ">Otevřít portfolio</a>",
        ">{t('rebuild.profile.open_portfolio_link', 'Otevřít portfolio')}</a>"
    ),

    # ── Profile growth bottom section ──
    (
        ">Profil roste s tebou</div>",
        ">{t('rebuild.profile.profile_growth_title', 'Profil roste s tebou')}</div>"
    ),
    (
        ">Čím víc informací doplníš, tím lépe ti Cybershaman najde ty pravé příležitosti.</p>",
        ">{t('rebuild.profile.profile_growth_desc', 'Čím víc informací doplníš, tím lépe ti Cybershaman najde ty pravé příležitosti.')}</p>"
    ),
    (
        "% vyplněno</div>",
        "% {t('rebuild.profile.filled_pct', 'vyplněno')}</div>"
    ),

    # ── Not sure box ──
    (
        ">Nejsi si jistý?</div>",
        ">{t('rebuild.profile.not_sure_title', 'Nejsi si jistý?')}</div>"
    ),
    (
        ">Cybershaman ti pomůže doplnit tvůj profil krok za krokem.</p>",
        ">{t('rebuild.profile.not_sure_desc', 'Cybershaman ti pomůže doplnit tvůj profil krok za krokem.')}</p>"
    ),
    (
        "<Sparkles size={16} /> Promluvit si",
        "<Sparkles size={16} /> {t('rebuild.profile.talk_to_us', 'Promluvit si')}"
    ),

    # ── Certifications fallback strings inside extractEducation ──
    (
        "school: 'Certifikace',",
        "school: t ? t('rebuild.profile.certifications_label', 'Certifikace') : 'Certifikace',"
    ),
    (
        "field: 'Osvědčení',",
        "field: t ? t('rebuild.profile.certificates_label', 'Osvědčení') : 'Osvědčení',"
    ),

    # ── Salary display ──
    (
        "? `${userProfile.preferences.desired_salary_min.toLocaleString('cs-CZ')} Kč`\n      : 'Neuvedeno';",
        "? `${userProfile.preferences.desired_salary_min.toLocaleString(userProfile.preferredLocale || 'cs')} ${(userProfile.preferredLocale === 'cs' || userProfile.preferredLocale === 'sk') ? 'Kč' : 'EUR'}`\n      : t('rebuild.profile.not_specified', 'Neuvedeno');"
    ),

    # ── archetypeTitle / archetypeCopy ──
    (
        "const archetypeTitle = userProfile.preferences?.jcfpm_v1?.archetype?.title || userProfile.jobTitle || 'Profil se teprve skládá';",
        "const archetypeTitle = userProfile.preferences?.jcfpm_v1?.archetype?.title || userProfile.jobTitle || t('rebuild.profile.profile_composing', 'Profil se skládá...');"
    ),
    (
        "const archetypeCopy = userProfile.preferences?.jcfpm_v1?.archetype?.description || userProfile.story || 'Doplň pár klíčových signálů a Cybershaman ti zpřesní pracovní identitu i doporučené role.';",
        "const archetypeCopy = userProfile.preferences?.jcfpm_v1?.archetype?.description || userProfile.story || t('rebuild.profile.complete_test_narrative', 'Doplň pár klíčových signálů a Cybershaman ti zpřesní pracovní identitu i doporučené role.');"
    ),
]


def set_nested(obj, dotpath, value):
    parts = dotpath.split('.')
    cur = obj
    for p in parts[:-1]:
        if p not in cur:
            cur[p] = {}
        cur = cur[p]
    cur[parts[-1]] = value


def main():
    print("Reading CandidateProfileV2.tsx...")
    with open(FILEPATH, "r", encoding="utf-8") as f:
        code = f.read()

    replaced = 0
    not_found = 0
    for old, new in REPLACEMENTS:
        if old in code:
            code = code.replace(old, new, 1)
            replaced += 1
        else:
            print(f"  NOT FOUND: {repr(old[:80])}")
            not_found += 1

    with open(FILEPATH, "w", encoding="utf-8") as f:
        f.write(code)
    print(f"\nDone: {replaced} replacements, {not_found} not found.")

    # Write translation keys to all 10 locale files
    for lang in next(iter(TRANSLATIONS.values())).keys():
        locpath = os.path.join(LOCALES_DIR, lang, "translation.json")
        if not os.path.exists(locpath):
            print(f"  WARNING: locale {lang} not found at {locpath}")
            continue
        with open(locpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "rebuild" not in data:
            data["rebuild"] = {}
        if "profile" not in data["rebuild"]:
            data["rebuild"]["profile"] = {}

        for key, translations in TRANSLATIONS.items():
            subkey = key.replace("rebuild.profile.", "")
            val = translations.get(lang, translations.get("en", ""))
            data["rebuild"]["profile"][subkey] = val

        # Also add missing keys for certifications in education (CS / EN)
        if lang == "cs":
            data["rebuild"]["profile"]["certifications_label"] = "Certifikace"
            data["rebuild"]["profile"]["certificates_label"] = "Osvědčení"
            data["rebuild"]["profile"]["career_direction_map"] = "Career Direction Map"
            data["rebuild"]["profile"]["feed_adjustment_title"] = "Jak se upraví feed"
            data["rebuild"]["profile"]["core_signal_event_title"] = "Core Signal Event"
            data["rebuild"]["profile"]["onboarding_label"] = "Onboarding"
            data["rebuild"]["profile"]["no_education"] = "Vzdělání zatím nebylo přidáno."
            data["rebuild"]["profile"]["linkedin_label"] = "LinkedIn"
            data["rebuild"]["profile"]["portfolio_label"] = "Portfolio"
        elif lang == "en":
            data["rebuild"]["profile"]["certifications_label"] = "Certifications"
            data["rebuild"]["profile"]["certificates_label"] = "Certificate"
            data["rebuild"]["profile"]["career_direction_map"] = "Career Direction Map"
            data["rebuild"]["profile"]["feed_adjustment_title"] = "Feed adjustment"
            data["rebuild"]["profile"]["core_signal_event_title"] = "Core Signal Event"
            data["rebuild"]["profile"]["onboarding_label"] = "Onboarding"
            data["rebuild"]["profile"]["no_education"] = "Education not added yet."
            data["rebuild"]["profile"]["linkedin_label"] = "LinkedIn"
            data["rebuild"]["profile"]["portfolio_label"] = "Portfolio"

        with open(locpath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write('\n')
        print(f"  Written locale: {lang}")

    print("\nAll locales updated!")


if __name__ == "__main__":
    main()
