-- Expand JCFPM pools + add i18n fields
SET lock_timeout = '5s';
SET statement_timeout = '20min';
SET idle_in_transaction_session_timeout = '2min';

ALTER TABLE public.jcfpm_items
  ADD COLUMN IF NOT EXISTS prompt_i18n jsonb,
  ADD COLUMN IF NOT EXISTS subdimension_i18n jsonb,
  ADD COLUMN IF NOT EXISTS payload_i18n jsonb;

-- New items D1-D6 (Likert)
INSERT INTO public.jcfpm_items
  (id, dimension, subdimension, prompt, prompt_i18n, reverse_scoring, sort_order, item_type, pool_key, variant_index)
VALUES
  ('D1.13', 'd1_cognitive', 'Analytical structuring', 'Kdyz resim slozity problem, rozkreslim si ho do schematu.', '{"en":"When I solve a complex problem, I sketch it into a diagram."}', false, 109, 'likert', 'D1.13', 1),
  ('D1.14', 'd1_cognitive', 'Rapid intuition', 'Davam prednost rychlemu odhadu pred podrobnou analyzou.', '{"en":"I prefer a quick estimate over a detailed analysis."}', true, 110, 'likert', 'D1.14', 1),
  ('D1.15', 'd1_cognitive', 'Evidence first', 'Ocenim, kdyz jsou rozhodnuti podlozena daty, i kdyz to trva dele.', '{"en":"I value decisions backed by data, even if it takes longer."}', false, 111, 'likert', 'D1.15', 1),
  ('D1.16', 'd1_cognitive', 'Adaptive process', 'Vyhovuje mi, kdyz muzu prubezne menit postup podle situace.', '{"en":"I like being able to adjust the process on the fly."}', true, 112, 'likert', 'D1.16', 1),
  ('D1.17', 'd1_cognitive', 'Mental models', 'Casto si tvorim vlastni mentalni model, jak veci funguji.', '{"en":"I often build my own mental model of how things work."}', false, 113, 'likert', 'D1.17', 1),
  ('D1.18', 'd1_cognitive', 'Minimal context', 'Nepotrebuji znat cely kontext, staci mi rychle instrukce.', '{"en":"I do not need full context, quick instructions are enough."}', true, 114, 'likert', 'D1.18', 1),
  ('D1.19', 'd1_cognitive', 'Proof check', 'Predtim nez neco schvalim, chci videt dukazy nebo priklady.', '{"en":"Before I approve something, I want to see evidence or examples."}', false, 115, 'likert', 'D1.19', 1),
  ('D1.20', 'd1_cognitive', 'First impression bias', 'Pri rozhodovani me nejvic vede prvni dojem.', '{"en":"My decisions are driven mostly by first impressions."}', true, 116, 'likert', 'D1.20', 1),
  ('D1.21', 'd1_cognitive', 'Pattern seeking', 'Bavi me hledat skryte souvislosti mezi daty.', '{"en":"I enjoy finding hidden connections between data points."}', false, 117, 'likert', 'D1.21', 1),
  ('D1.22', 'd1_cognitive', 'Simple solutions', 'Mam radsi jednoducha reseni nez slozite analyzy.', '{"en":"I prefer simple solutions over complex analysis."}', true, 118, 'likert', 'D1.22', 1),
  ('D1.23', 'd1_cognitive', 'Structured thinking', 'Strukturovane mysleni mi pomaha dosahovat vysledku.', '{"en":"Structured thinking helps me deliver results."}', false, 119, 'likert', 'D1.23', 1),
  ('D1.24', 'd1_cognitive', 'Decide while doing', 'Casto se rozhodnu az behem prace, ne predem.', '{"en":"I often decide during the work, not beforehand."}', true, 120, 'likert', 'D1.24', 1),

  ('D2.13', 'd2_social', 'Asertivita', 'V jednani si prosazuji svuj pohled, i kdyz je to nepohodlne.', '{"en":"In discussions I push my view even when it feels uncomfortable."}', false, 121, 'likert', 'D2.13', 1),
  ('D2.14', 'd2_social', 'Konfliktni vyhybani', 'Radeji ustupuji, abych predesel konfliktu.', '{"en":"I tend to step back to avoid conflict."}', true, 122, 'likert', 'D2.14', 1),
  ('D2.15', 'd2_social', 'Leadership take-over', 'Kdyz tym tape, prevezmu iniciativu.', '{"en":"When the team is stuck, I take the initiative."}', false, 123, 'likert', 'D2.15', 1),
  ('D2.16', 'd2_social', 'Direct feedback', 'Nerad davam druhym primou zpetnou vazbu.', '{"en":"I dislike giving direct feedback to others."}', true, 124, 'likert', 'D2.16', 1),
  ('D2.17', 'd2_social', 'Debate intensity', 'V debate me bavi ostra vymena nazoru.', '{"en":"I enjoy intense debate and sharp exchange of views."}', false, 125, 'likert', 'D2.17', 1),
  ('D2.18', 'd2_social', 'Selective collaboration', 'Spolupraci preferuji jen tehdy, kdyz je nezbytna.', '{"en":"I prefer collaboration only when it is necessary."}', true, 126, 'likert', 'D2.18', 1),
  ('D2.19', 'd2_social', 'Social outreach', 'Rychle navazuji kontakt i s novymi lidmi.', '{"en":"I quickly connect with new people."}', false, 127, 'likert', 'D2.19', 1),
  ('D2.20', 'd2_social', 'Background role', 'V tymu se drzim spise v pozadi.', '{"en":"In teams I tend to stay in the background."}', true, 128, 'likert', 'D2.20', 1),
  ('D2.21', 'd2_social', 'Boundary setting', 'Umim nastavovat hranice a rikat ne.', '{"en":"I can set boundaries and say no."}', false, 129, 'likert', 'D2.21', 1),
  ('D2.22', 'd2_social', 'Conflict compromise', 'V konfliktu se snazim vyhovet obema stranam i za cenu kompromisu.', '{"en":"In conflict I try to satisfy both sides even if it means compromise."}', true, 130, 'likert', 'D2.22', 1),
  ('D2.23', 'd2_social', 'External representation', 'Libi se mi role, kde reprezentuji tym navenek.', '{"en":"I like roles where I represent the team externally."}', false, 131, 'likert', 'D2.23', 1),
  ('D2.24', 'd2_social', 'Control need', 'Potrebuji mit kontrolu nad tim, jak tym postupuje.', '{"en":"I need to keep control over how the team progresses."}', false, 132, 'likert', 'D2.24', 1),

  ('D3.13', 'd3_motivational', 'Purpose drive', 'Prace ma smysl jen tehdy, kdyz vidi jasny dopad.', '{"en":"Work matters to me only when it has clear impact."}', false, 133, 'likert', 'D3.13', 1),
  ('D3.14', 'd3_motivational', 'Reward focus', 'Bez jasne odmeny se mi tezko udrzuje motivace.', '{"en":"Without a clear reward it is hard for me to stay motivated."}', true, 134, 'likert', 'D3.14', 1),
  ('D3.15', 'd3_motivational', 'Growth seeking', 'Preferuji projekty, kde se mohu ucit nove veci.', '{"en":"I prefer projects where I can learn new things."}', false, 135, 'likert', 'D3.15', 1),
  ('D3.16', 'd3_motivational', 'Performance pressure', 'Tlak na vysledek me motivuje vic nez prostor na rust.', '{"en":"Pressure for results motivates me more than room to grow."}', true, 136, 'likert', 'D3.16', 1),
  ('D3.17', 'd3_motivational', 'Autonomy preference', 'Nejlepe funguji, kdyz si mohu sam urcit postup.', '{"en":"I work best when I can choose the approach myself."}', false, 137, 'likert', 'D3.17', 1),
  ('D3.18', 'd3_motivational', 'Guided execution', 'Vyhovuje mi, kdyz je presne definovano, co mam delat.', '{"en":"I prefer having clearly defined instructions."}', true, 138, 'likert', 'D3.18', 1),
  ('D3.19', 'd3_motivational', 'Mastery drive', 'Dlouhodobe me bavi pilovat dovednost do hloubky.', '{"en":"I enjoy building mastery in depth over the long term."}', false, 139, 'likert', 'D3.19', 1),
  ('D3.20', 'd3_motivational', 'Short-term wins', 'Preferuji rychle vysledky pred dlouhodobymi investicemi.', '{"en":"I prefer quick wins over long-term investments."}', true, 140, 'likert', 'D3.20', 1),
  ('D3.21', 'd3_motivational', 'Internal meaning', 'Vnitrni smysl prace je pro me dulezitejsi nez uznani okolim.', '{"en":"Internal meaning matters more to me than external recognition."}', false, 141, 'likert', 'D3.21', 1),
  ('D3.22', 'd3_motivational', 'Status signal', 'Status a viditelnost jsou pro me silnym motivatorem.', '{"en":"Status and visibility are strong motivators for me."}', true, 142, 'likert', 'D3.22', 1),
  ('D3.23', 'd3_motivational', 'Autonomy stretch', 'Roste moje motivace, kdyz dostanu duveru a volnost.', '{"en":"My motivation grows when I receive trust and freedom."}', false, 143, 'likert', 'D3.23', 1),
  ('D3.24', 'd3_motivational', 'External structure', 'Bez jasne struktury se rychle ztracim.', '{"en":"Without clear structure I get lost quickly."}', true, 144, 'likert', 'D3.24', 1),

  ('D4.13', 'd4_energy', 'Energetic drive', 'Mam dost energie i po delsim pracovnim dni.', '{"en":"I have plenty of energy even after a long workday."}', false, 145, 'likert', 'D4.13', 1),
  ('D4.14', 'd4_energy', 'Need for recovery', 'Po intenzivni praci potrebuji dlouhou regeneraci.', '{"en":"After intense work I need long recovery."}', true, 146, 'likert', 'D4.14', 1),
  ('D4.15', 'd4_energy', 'Emocni reaktivita', 'Kdyz se veci zaseknou, rychle me to rozcili.', '{"en":"When things get stuck, I get irritated quickly."}', false, 147, 'likert', 'D4.15', 1),
  ('D4.16', 'd4_energy', 'Calm under pressure', 'V krizi si drzim klidny odstup.', '{"en":"In a crisis I keep a calm distance."}', true, 148, 'likert', 'D4.16', 1),
  ('D4.17', 'd4_energy', 'Task urgency', 'Kdyz je deadline blizko, zrychlim a jsem efektivnejsi.', '{"en":"When a deadline approaches, I speed up and become more effective."}', false, 149, 'likert', 'D4.17', 1),
  ('D4.18', 'd4_energy', 'Overload sensitivity', 'Prilis mnoho podnetu me rychle vycerpa.', '{"en":"Too many stimuli exhaust me quickly."}', true, 150, 'likert', 'D4.18', 1),
  ('D4.19', 'd4_energy', 'Rapid switching', 'Nevadi mi caste prepinani mezi ukoly.', '{"en":"Frequent task switching does not bother me."}', false, 151, 'likert', 'D4.19', 1),
  ('D4.20', 'd4_energy', 'Long focus', 'Preferuji dlouhe bloky soustredeni bez preruseni.', '{"en":"I prefer long focus blocks without interruptions."}', true, 152, 'likert', 'D4.20', 1),
  ('D4.21', 'd4_energy', 'High intensity', 'Vyhovuje mi pracovat v rychlem a intenzivnim tempu.', '{"en":"I like working at a fast and intense pace."}', false, 153, 'likert', 'D4.21', 1),
  ('D4.22', 'd4_energy', 'Stability need', 'Potrebuji stabilni a predvidatelny rytmus.', '{"en":"I need a stable and predictable rhythm."}', true, 154, 'likert', 'D4.22', 1),
  ('D4.23', 'd4_energy', 'Impulsivita', 'Nekdy zacinam jednat drive, nez si vse promyslim.', '{"en":"Sometimes I act before I fully think things through."}', true, 155, 'likert', 'D4.23', 1),
  ('D4.24', 'd4_energy', 'Sustained pace', 'Lipe se mi dari drzet stabilni tempo nez delat sprinty.', '{"en":"I do better keeping a steady pace than sprinting."}', true, 156, 'likert', 'D4.24', 1),

  ('D5.13', 'd5_values', 'Ethical stance', 'Etika je pro me dulezitejsi nez rychly zisk.', '{"en":"Ethics matter to me more than quick profit."}', false, 157, 'likert', 'D5.13', 1),
  ('D5.14', 'd5_values', 'Competitive drive', 'Vyhra a konkurenicni vyhoda jsou pro me klicove.', '{"en":"Winning and competitive advantage are key for me."}', true, 158, 'likert', 'D5.14', 1),
  ('D5.15', 'd5_values', 'Human impact', 'Preferuji projekty, ktere zlepsuji zivoty konkretnich lidi.', '{"en":"I prefer projects that improve real lives."}', false, 159, 'likert', 'D5.15', 1),
  ('D5.16', 'd5_values', 'Tradition comfort', 'Radseji pracuji v osvedcenych modelech nez v novotach.', '{"en":"I prefer proven models over new experiments."}', true, 160, 'likert', 'D5.16', 1),
  ('D5.17', 'd5_values', 'Sustainability', 'Dlouhodoba udrzitelnost je pro me dulezita pri volbe projektu.', '{"en":"Long-term sustainability matters to me when choosing projects."}', false, 161, 'likert', 'D5.17', 1),
  ('D5.18', 'd5_values', 'Personal gain', 'Nejvetsi smysl mi dava, kdyz to prinasi osobni benefit.', '{"en":"It makes the most sense to me when it brings personal benefit."}', true, 162, 'likert', 'D5.18', 1),
  ('D5.19', 'd5_values', 'Innovation pull', 'Pri vyberu prace uprednostnim inovativni smer.', '{"en":"I prefer innovative directions when choosing work."}', false, 163, 'likert', 'D5.19', 1),
  ('D5.20', 'd5_values', 'Stability anchor', 'Stabilita mi dava pocit jistoty i v nejasnych obdobich.', '{"en":"Stability gives me certainty even in uncertain times."}', true, 164, 'likert', 'D5.20', 1),
  ('D5.21', 'd5_values', 'Community focus', 'Vazim si prace, ktera posiluje komunitu nebo tym.', '{"en":"I value work that strengthens a community or team."}', false, 165, 'likert', 'D5.21', 1),
  ('D5.22', 'd5_values', 'Outcome focus', 'Dulezitejsi je pro me vysledek nez cesta, jak se k nemu dostat.', '{"en":"The outcome is more important to me than the path to get there."}', true, 166, 'likert', 'D5.22', 1),
  ('D5.23', 'd5_values', 'Societal change', 'Bavi me prace, ktera meni status quo.', '{"en":"I enjoy work that changes the status quo."}', false, 167, 'likert', 'D5.23', 1),
  ('D5.24', 'd5_values', 'Instrumental work', 'Praci beru hlavne jako prostredek k financni jistote.', '{"en":"I see work mainly as a means to financial security."}', true, 168, 'likert', 'D5.24', 1),

  ('D6.13', 'd6_ai_readiness', 'Experiment curiosity', 'Rad testuji nove nastroje hned jak se objevi.', '{"en":"I like to try new tools as soon as they appear."}', false, 169, 'likert', 'D6.13', 1),
  ('D6.14', 'd6_ai_readiness', 'Risk caution', 'U novych technologii potrebuji jasna pravidla a zaruky.', '{"en":"With new technologies I need clear rules and guarantees."}', true, 170, 'likert', 'D6.14', 1),
  ('D6.15', 'd6_ai_readiness', 'Learning joy', 'Uceni novych technologii mi prinasi energii.', '{"en":"Learning new technology gives me energy."}', false, 171, 'likert', 'D6.15', 1),
  ('D6.16', 'd6_ai_readiness', 'Change fatigue', 'Prilis rychle zmeny me vycerpavaji.', '{"en":"Changes that come too fast exhaust me."}', true, 172, 'likert', 'D6.16', 1),
  ('D6.17', 'd6_ai_readiness', 'Ambiguity comfort', 'Dovedu pracovat bez jasneho navodu a ucit se za behu.', '{"en":"I can work without clear instructions and learn on the fly."}', false, 173, 'likert', 'D6.17', 1),
  ('D6.18', 'd6_ai_readiness', 'Fear of mistakes', 'Pri novych nastrojich mam obavy z chyb a selhani.', '{"en":"With new tools I worry about making mistakes."}', true, 174, 'likert', 'D6.18', 1),
  ('D6.19', 'd6_ai_readiness', 'AI initiative', 'Aktivne hledam zpusoby, jak AI vyuzit v praxi.', '{"en":"I actively look for ways to use AI in practice."}', false, 175, 'likert', 'D6.19', 1),
  ('D6.20', 'd6_ai_readiness', 'Tool skepticism', 'Vuci AI mam spis zdrzenlivy pristup.', '{"en":"I am rather skeptical about AI."}', true, 176, 'likert', 'D6.20', 1),
  ('D6.21', 'd6_ai_readiness', 'Continuous upskilling', 'Dlouhodobe investuji do rozvoje tech dovednosti.', '{"en":"I invest in developing tech skills over the long term."}', false, 177, 'likert', 'D6.21', 1),
  ('D6.22', 'd6_ai_readiness', 'Need for certainty', 'V nejistych situacich hledam autoritu, ktera me povede.', '{"en":"In uncertain situations I look for authority to guide me."}', true, 178, 'likert', 'D6.22', 1),
  ('D6.23', 'd6_ai_readiness', 'AI experimentation', 'AI nastroje beru jako hriste pro nove napady.', '{"en":"I see AI tools as a playground for new ideas."}', false, 179, 'likert', 'D6.23', 1),
  ('D6.24', 'd6_ai_readiness', 'Tech anxiety', 'Technologicke zmeny ve mne vyvolavaji stres.', '{"en":"Technological change makes me feel stressed."}', true, 180, 'likert', 'D6.24', 1),

  -- D7-D12 interactive expansions
  ('D7.7', 'd7_cognitive_reflection', 'Logic Puzzle', 'V rybniku je lekno, ktere kazdy den zdvojnasobi svou plochu. Pokud za 48 dni pokryje cely rybnik, kdy pokryje polovinu?', '{"en":"A lily pad doubles in size every day. If it covers the whole pond on day 48, when does it cover half?"}', false, 181, 'mcq', 'D7.7', 1),
  ('D7.8', 'd7_cognitive_reflection', 'Probability', 'V krabici je 4 cervene a 6 modrych kouli. Vytahnes jednu bez vraceni. Jakou ma druhy tah pravdepodobnost, ze bude modry?', '{"en":"There are 4 red and 6 blue balls. You draw one without replacement. What is the probability the second draw is blue?"}', false, 182, 'mcq', 'D7.8', 1),
  ('D7.9', 'd7_cognitive_reflection', 'Base rate', 'Test ma 95% presnost. Onemocneni ma 1% prevalence. Co je nejpravdepodobnejsi po pozitivnim testu?', '{"en":"A test is 95% accurate. Prevalence is 1%. What is most likely after a positive result?"}', false, 183, 'mcq', 'D7.9', 1),
  ('D7.10', 'd7_cognitive_reflection', 'Logic', 'Platí: Pokud A => B. A je pravdive. Co plati o B?', '{"en":"If A implies B and A is true, what can we say about B?"}', false, 184, 'mcq', 'D7.10', 1),
  ('D7.11', 'd7_cognitive_reflection', 'Fallacy', 'Ktery argument je klam "falesna dilema"?', '{"en":"Which argument is a false dilemma?"}', false, 185, 'mcq', 'D7.11', 1),
  ('D7.12', 'd7_cognitive_reflection', 'Estimation', 'Pokud 3 lide udelaji 3 ulohy za 3 hodiny, kolik hodin potrebuje 6 lidi na 6 uloh?', '{"en":"If 3 people do 3 tasks in 3 hours, how many hours do 6 people need for 6 tasks?"}', false, 186, 'mcq', 'D7.12', 1),

  ('D8.7', 'd8_digital_eq', 'Escalation Tone', 'Kolega pise: "Tohle se neda stihnout." Jak odpovis?', '{"en":"A colleague writes: \"We cannot make this deadline.\" How do you respond?"}', false, 187, 'scenario_choice', 'D8.7', 1),
  ('D8.8', 'd8_digital_eq', 'Asynchronous stress', 'Po kritice v chatu nekdo napise: "Ok." Co udelas?', '{"en":"After criticism in chat someone replies: \"Ok.\" What do you do?"}', false, 188, 'scenario_choice', 'D8.8', 1),
  ('D8.9', 'd8_digital_eq', 'Customer upset', 'Zakaznik pise: "Jste uplne mimo." Co odpovis?', '{"en":"A customer writes: \"You are completely off.\" What do you reply?"}', false, 189, 'scenario_choice', 'D8.9', 1),
  ('D8.10', 'd8_digital_eq', 'Team conflict', 'Dva kolegove se hadaji ve vlakne. Co udelas?', '{"en":"Two colleagues argue in a thread. What do you do?"}', false, 190, 'scenario_choice', 'D8.10', 1),
  ('D8.11', 'd8_digital_eq', 'Feedback followup', 'Potrebujes upravit praci kolegy. Nejvhodnejsi styl je:', '{"en":"You need to adjust a colleague\\u0027s work. The best style is:"}', false, 191, 'scenario_choice', 'D8.11', 1),
  ('D8.12', 'd8_digital_eq', 'Tone calibration', 'Po dlouhem mlceni prijde zprava bez diakritiky a emocnich slov. Co predpokladas?', '{"en":"After long silence, a message arrives without emotion. What do you assume?"}', false, 192, 'scenario_choice', 'D8.12', 1),

  ('D9.7', 'd9_systems_thinking', 'System Impact', 'Ktery signal nejvice ukazuje negativni zpetnou vazbu?', '{"en":"Which signal best shows a negative feedback loop?"}', false, 193, 'mcq', 'D9.7', 1),
  ('D9.8', 'd9_systems_thinking', 'Causal chain', 'Seřad kroky pricin a nasledku.', '{"en":"Order the steps of cause and effect."}', false, 194, 'ordering', 'D9.8', 1),
  ('D9.9', 'd9_systems_thinking', 'Resource shift', 'Přiřaď zmenu k nejpravdepodobnejsimu dopadu.', '{"en":"Match the change to the most likely impact."}', false, 195, 'drag_drop', 'D9.9', 1),
  ('D9.10', 'd9_systems_thinking', 'Constraint shift', 'Pokud zvysis limit systemu, co je treba zkontrolovat?', '{"en":"If you raise a system limit, what should you check next?"}', false, 196, 'mcq', 'D9.10', 1),
  ('D9.11', 'd9_systems_thinking', 'Second order', 'Ktery efekt je druhorady (secondary)?', '{"en":"Which effect is second-order?"}', false, 197, 'mcq', 'D9.11', 1),
  ('D9.12', 'd9_systems_thinking', 'System stability', 'Ktery zasah stabilizuje system s velkymi vykyvy?', '{"en":"Which intervention stabilizes a system with large swings?"}', false, 198, 'mcq', 'D9.12', 1),

  ('D10.7', 'd10_ambiguity_interpretation', 'Ambiguity Visual', 'Na nejasny signal reagujes spis:', '{"en":"When you see an ambiguous signal, you react more with:"}', false, 199, 'image_choice', 'D10.7', 1),
  ('D10.8', 'd10_ambiguity_interpretation', 'Ambiguity Visual', 'V nove situaci bez dat volis:', '{"en":"In a new situation without data you choose:"}', false, 200, 'image_choice', 'D10.8', 1),
  ('D10.9', 'd10_ambiguity_interpretation', 'Ambiguity Visual', 'Prvni interpretace nejasnosti je:', '{"en":"Your first interpretation of ambiguity is:"}', false, 201, 'image_choice', 'D10.9', 1),
  ('D10.10', 'd10_ambiguity_interpretation', 'Ambiguity Visual', 'Kdyz nic neni jiste, spis:', '{"en":"When nothing is certain, you tend to:"}', false, 202, 'image_choice', 'D10.10', 1),
  ('D10.11', 'd10_ambiguity_interpretation', 'Ambiguity Visual', 'Nejasny trend na trhu je pro tebe:', '{"en":"An unclear market trend is for you:"}', false, 203, 'image_choice', 'D10.11', 1),
  ('D10.12', 'd10_ambiguity_interpretation', 'Ambiguity Visual', 'Bez jasnych instrukci volis:', '{"en":"Without clear instructions you choose:"}', false, 204, 'image_choice', 'D10.12', 1),

  ('D11.7', 'd11_problem_decomposition', 'Prioritization', 'Seřad kroky pri rychlem reseni zakaznickeho problemu.', '{"en":"Order the steps when resolving a customer issue quickly."}', false, 205, 'ordering', 'D11.7', 1),
  ('D11.8', 'd11_problem_decomposition', 'Structuring', 'Co je nejlepsi prvni krok u noveho zadani?', '{"en":"What is the best first step for a new assignment?"}', false, 206, 'mcq', 'D11.8', 1),
  ('D11.9', 'd11_problem_decomposition', 'System planning', 'Přiřaď ulohu k fazi projektu.', '{"en":"Match the task to the project phase."}', false, 207, 'drag_drop', 'D11.9', 1),
  ('D11.10', 'd11_problem_decomposition', 'Roadmap', 'Seřad kroky pro spusteni nove funkce.', '{"en":"Order the steps to launch a new feature."}', false, 208, 'ordering', 'D11.10', 1),
  ('D11.11', 'd11_problem_decomposition', 'Scope control', 'Jak snizis rozsah, kdyz deadline hrozi?', '{"en":"How do you reduce scope when the deadline is at risk?"}', false, 209, 'mcq', 'D11.11', 1),
  ('D11.12', 'd11_problem_decomposition', 'Stakeholder alignment', 'Kdyz neni jasny vlastnik ulohy, udelas:', '{"en":"When task ownership is unclear, you will:"}', false, 210, 'mcq', 'D11.12', 1),

  ('D12.7', 'd12_moral_compass', 'Ethics', 'Najdes chybu v cenach, ktera zvysuje tvoje bonusy. Co udelas?', '{"en":"You find a pricing bug that increases your bonus. What do you do?"}', false, 211, 'scenario_choice', 'D12.7', 1),
  ('D12.8', 'd12_moral_compass', 'Transparency', 'Tym chce skrýt negativni metriky pred klientem. Co zvolis?', '{"en":"The team wants to hide negative metrics from the client. What do you choose?"}', false, 212, 'scenario_choice', 'D12.8', 1),
  ('D12.9', 'd12_moral_compass', 'Data use', 'Dostanes data bez souhlasu uzivatelu. Co udelas?', '{"en":"You receive data without user consent. What do you do?"}', false, 213, 'scenario_choice', 'D12.9', 1),
  ('D12.10', 'd12_moral_compass', 'Pressure', 'Manazer tlaci na zrychleni bez testu. Jak postupujes?', '{"en":"A manager pushes for speed without testing. How do you proceed?"}', false, 214, 'scenario_choice', 'D12.10', 1),
  ('D12.11', 'd12_moral_compass', 'Fairness', 'Algoritmus zlepsi KPI, ale ublizi mensine. Co zvolis?', '{"en":"The algorithm improves KPIs but harms a minority group. What do you choose?"}', false, 215, 'scenario_choice', 'D12.11', 1),
  ('D12.12', 'd12_moral_compass', 'Integrity', 'Kolega chce obejit proces, aby stihl termin. Co udelas?', '{"en":"A colleague wants to bypass the process to hit a deadline. What do you do?"}', false, 216, 'scenario_choice', 'D12.12', 1)
ON CONFLICT (id) DO UPDATE SET
  dimension = EXCLUDED.dimension,
  subdimension = EXCLUDED.subdimension,
  prompt = EXCLUDED.prompt,
  prompt_i18n = EXCLUDED.prompt_i18n,
  reverse_scoring = EXCLUDED.reverse_scoring,
  sort_order = EXCLUDED.sort_order,
  item_type = EXCLUDED.item_type,
  pool_key = EXCLUDED.pool_key,
  variant_index = EXCLUDED.variant_index;

-- Payloads + i18n for interactive items
UPDATE public.jcfpm_items SET
  payload = CASE id
    WHEN 'D7.7' THEN '{"options":[{"id":"a","label":"24"},{"id":"b","label":"47"},{"id":"c","label":"42"},{"id":"d","label":"48"}],"correct_id":"b"}'::jsonb
    WHEN 'D7.8' THEN '{"options":[{"id":"a","label":"60 %"},{"id":"b","label":"66 %"},{"id":"c","label":"50 %"},{"id":"d","label":"70 %"}],"correct_id":"b"}'::jsonb
    WHEN 'D7.9' THEN '{"options":[{"id":"a","label":"Skutecna pravdepodobnost je stale nizka"},{"id":"b","label":"Temer jiste pozitivni"},{"id":"c","label":"Priblizne 95 %"},{"id":"d","label":"Zavisí na demografii"}],"correct_id":"a"}'::jsonb
    WHEN 'D7.10' THEN '{"options":[{"id":"a","label":"B musi byt pravdive"},{"id":"b","label":"B muze byt pravdive"},{"id":"c","label":"B je nepravdive"},{"id":"d","label":"Nelze rict nic"}],"correct_id":"a"}'::jsonb
    WHEN 'D7.11' THEN '{"options":[{"id":"a","label":"Bud je to perfektni, nebo je to k nicemu"},{"id":"b","label":"Pokud prsi, je mokro"},{"id":"c","label":"Po zmene se to zlepsilo"},{"id":"d","label":"Mnoho lidi to dela"}],"correct_id":"a"}'::jsonb
    WHEN 'D7.12' THEN '{"options":[{"id":"a","label":"3"},{"id":"b","label":"6"},{"id":"c","label":"9"},{"id":"d","label":"12"}],"correct_id":"b"}'::jsonb

    WHEN 'D8.7' THEN '{"options":[{"id":"a","label":"To musime zvladnout."},{"id":"b","label":"Diky za signal, pojdme rychle udelat plan a potvrdit rozsah."},{"id":"c","label":"To neni muj problem."}],"correct_id":"b"}'::jsonb
    WHEN 'D8.8' THEN '{"options":[{"id":"a","label":"Ignoruji to."},{"id":"b","label":"Zkontroluji v soukromi, zda je vse OK."},{"id":"c","label":"Odpovim sarkasticky."}],"correct_id":"b"}'::jsonb
    WHEN 'D8.9' THEN '{"options":[{"id":"a","label":"To neni pravda."},{"id":"b","label":"Mrzi me to, pojdme si ujasnit, co presne nesedi."},{"id":"c","label":"Takhle s nami nemluvte."}],"correct_id":"b"}'::jsonb
    WHEN 'D8.10' THEN '{"options":[{"id":"a","label":"Necham to plynout."},{"id":"b","label":"Pozvu oba do kratkeho klidneho callu."},{"id":"c","label":"Napisu, kdo ma pravdu."}],"correct_id":"b"}'::jsonb
    WHEN 'D8.11' THEN '{"options":[{"id":"a","label":"Sepsat fakta, dopad a konkretni navrh."},{"id":"b","label":"Vypsat jen chyby."},{"id":"c","label":"Resit to verejne."}],"correct_id":"a"}'::jsonb
    WHEN 'D8.12' THEN '{"options":[{"id":"a","label":"Nic se nedeje"},{"id":"b","label":"Radsi si overim kontext"},{"id":"c","label":"Je urcite nastvany"}],"correct_id":"b"}'::jsonb

    WHEN 'D9.7' THEN '{"options":[{"id":"a","label":"Vyssi cena snizi poptavku"},{"id":"b","label":"Vice uzivatelu zvysi doporuceni"},{"id":"c","label":"Vice testu snizi chyby"},{"id":"d","label":"Nizsi latence zlepsi UX"}],"correct_id":"a"}'::jsonb
    WHEN 'D9.8' THEN '{"options":[{"id":"o1","label":"Podnet"},{"id":"o2","label":"Reakce"},{"id":"o3","label":"Dopad"},{"id":"o4","label":"Zpetna vazba"}],"correct_order":["o1","o2","o3","o4"]}'::jsonb
    WHEN 'D9.9' THEN '{"sources":[{"id":"s1","label":"Snizeni ceny"},{"id":"s2","label":"Zkrateni dodani"},{"id":"s3","label":"Zlepseni podpory"}],"targets":[{"id":"t1","label":"Vetsi poptavka"},{"id":"t2","label":"Vyssi spokojenost"},{"id":"t3","label":"Vyssi loajalita"}],"correct_pairs":[{"source":"s1","target":"t1"},{"source":"s2","target":"t2"},{"source":"s3","target":"t3"}]}'::jsonb
    WHEN 'D9.10' THEN '{"options":[{"id":"a","label":"Bezpecnost a navazujici limity"},{"id":"b","label":"Jen rychlost"},{"id":"c","label":"Nic"},{"id":"d","label":"Marketing"}],"correct_id":"a"}'::jsonb
    WHEN 'D9.11' THEN '{"options":[{"id":"a","label":"Zmena UI"},{"id":"b","label":"Zmena chovani uzivatelu po case"},{"id":"c","label":"Zmena barvy"},{"id":"d","label":"Zmena fontu"}],"correct_id":"b"}'::jsonb
    WHEN 'D9.12' THEN '{"options":[{"id":"a","label":"Zavest tlumici pravidla"},{"id":"b","label":"Zrychlit vse"},{"id":"c","label":"Ignorovat vykyvy"},{"id":"d","label":"Zmensit monitoring"}],"correct_id":"a"}'::jsonb

    WHEN 'D10.7' THEN '{"options":[{"id":"a","label":"Riziko","image_url":"__D10_IMAGE_A__"},{"id":"b","label":"Prilezitost","image_url":"__D10_IMAGE_B__"},{"id":"c","label":"Nejasny signal","image_url":"__D10_IMAGE_C__"}],"correct_id":"b"}'::jsonb
    WHEN 'D10.8' THEN '{"options":[{"id":"a","label":"Bezpecny ramec","image_url":"__D10_IMAGE_A__"},{"id":"b","label":"Rychly pruzkum","image_url":"__D10_IMAGE_B__"},{"id":"c","label":"Vyckavani","image_url":"__D10_IMAGE_C__"}],"correct_id":"b"}'::jsonb
    WHEN 'D10.9' THEN '{"options":[{"id":"a","label":"Ověřit rizika","image_url":"__D10_IMAGE_A__"},{"id":"b","label":"Hledat prilezitosti","image_url":"__D10_IMAGE_B__"},{"id":"c","label":"Ignorovat","image_url":"__D10_IMAGE_C__"}],"correct_id":"b"}'::jsonb
    WHEN 'D10.10' THEN '{"options":[{"id":"a","label":"Brzdit","image_url":"__D10_IMAGE_A__"},{"id":"b","label":"Testovat","image_url":"__D10_IMAGE_B__"},{"id":"c","label":"Cekat","image_url":"__D10_IMAGE_C__"}],"correct_id":"b"}'::jsonb
    WHEN 'D10.11' THEN '{"options":[{"id":"a","label":"Hrozba","image_url":"__D10_IMAGE_A__"},{"id":"b","label":"Sance","image_url":"__D10_IMAGE_B__"},{"id":"c","label":"Sum","image_url":"__D10_IMAGE_C__"}],"correct_id":"b"}'::jsonb
    WHEN 'D10.12' THEN '{"options":[{"id":"a","label":"Postupovat opatrne","image_url":"__D10_IMAGE_A__"},{"id":"b","label":"Zkusit pilot","image_url":"__D10_IMAGE_B__"},{"id":"c","label":"Nechat byt","image_url":"__D10_IMAGE_C__"}],"correct_id":"b"}'::jsonb

    WHEN 'D11.7' THEN '{"options":[{"id":"o1","label":"Ziskat fakta"},{"id":"o2","label":"Navrhnout reseni"},{"id":"o3","label":"Potvrdit s klientem"},{"id":"o4","label":"Nasadit opravu"}],"correct_order":["o1","o2","o3","o4"]}'::jsonb
    WHEN 'D11.8' THEN '{"options":[{"id":"a","label":"Ujasnit cil a kriterium uspechu"},{"id":"b","label":"Hned zacit"},{"id":"c","label":"Pridat lidi"},{"id":"d","label":"Pockat"}],"correct_id":"a"}'::jsonb
    WHEN 'D11.9' THEN '{"sources":[{"id":"s1","label":"Zmapovat potreby"},{"id":"s2","label":"Navrhnout reseni"},{"id":"s3","label":"Dodat MVP"}],"targets":[{"id":"t1","label":"Discovery"},{"id":"t2","label":"Design"},{"id":"t3","label":"Build"}],"correct_pairs":[{"source":"s1","target":"t1"},{"source":"s2","target":"t2"},{"source":"s3","target":"t3"}]}'::jsonb
    WHEN 'D11.10' THEN '{"options":[{"id":"o1","label":"Definovat cil"},{"id":"o2","label":"Navrhnout reseni"},{"id":"o3","label":"Postavit"},{"id":"o4","label":"Otestovat"},{"id":"o5","label":"Spustit"}],"correct_order":["o1","o2","o3","o4","o5"]}'::jsonb
    WHEN 'D11.11' THEN '{"options":[{"id":"a","label":"Osekat vedlejsi pozadavky"},{"id":"b","label":"Pridat deadline"},{"id":"c","label":"Ignorovat"},{"id":"d","label":"Zvednout cenu"}],"correct_id":"a"}'::jsonb
    WHEN 'D11.12' THEN '{"options":[{"id":"a","label":"Zajistit vlastnika a zodpovednost"},{"id":"b","label":"Delat to sam"},{"id":"c","label":"Pockat"},{"id":"d","label":"Poslat do chatu"}],"correct_id":"a"}'::jsonb

    WHEN 'D12.7' THEN '{"options":[{"id":"a","label":"Nechat to byt"},{"id":"b","label":"Nahlasit chybu"},{"id":"c","label":"Vyuzit to"}],"correct_id":"b"}'::jsonb
    WHEN 'D12.8' THEN '{"options":[{"id":"a","label":"Skryt to"},{"id":"b","label":"Otevrene popsat rizika"},{"id":"c","label":"Nechat rozhodnout jine"}],"correct_id":"b"}'::jsonb
    WHEN 'D12.9' THEN '{"options":[{"id":"a","label":"Pouzit data"},{"id":"b","label":"Ziskat souhlas nebo data nepouzit"},{"id":"c","label":"Ignorovat to"}],"correct_id":"b"}'::jsonb
    WHEN 'D12.10' THEN '{"options":[{"id":"a","label":"Zastavit a navrhnout minimalni test"},{"id":"b","label":"Pustit bez testu"},{"id":"c","label":"Prehodit odpovednost"}],"correct_id":"a"}'::jsonb
    WHEN 'D12.11' THEN '{"options":[{"id":"a","label":"Nechat to bez zmeny"},{"id":"b","label":"Zastavit a hledat ferovejsi variantu"},{"id":"c","label":"Skryt metriky"}],"correct_id":"b"}'::jsonb
    WHEN 'D12.12' THEN '{"options":[{"id":"a","label":"Souhlasit"},{"id":"b","label":"Trvat na procesu"},{"id":"c","label":"Ignorovat"}],"correct_id":"b"}'::jsonb
  END,
  payload_i18n = CASE id
    WHEN 'D7.7' THEN '{"en":{"options":[{"id":"a","label":"24"},{"id":"b","label":"47"},{"id":"c","label":"42"},{"id":"d","label":"48"}]}}'::jsonb
    WHEN 'D7.8' THEN '{"en":{"options":[{"id":"a","label":"60 %"},{"id":"b","label":"66 %"},{"id":"c","label":"50 %"},{"id":"d","label":"70 %"}]}}'::jsonb
    WHEN 'D7.9' THEN '{"en":{"options":[{"id":"a","label":"The true probability is still low"},{"id":"b","label":"Almost certainly positive"},{"id":"c","label":"About 95 %"},{"id":"d","label":"Depends on demographics"}]}}'::jsonb
    WHEN 'D7.10' THEN '{"en":{"options":[{"id":"a","label":"B must be true"},{"id":"b","label":"B may be true"},{"id":"c","label":"B is false"},{"id":"d","label":"Cannot conclude"}]}}'::jsonb
    WHEN 'D7.11' THEN '{"en":{"options":[{"id":"a","label":"Either it is perfect or it is worthless"},{"id":"b","label":"If it rains, it is wet"},{"id":"c","label":"After the change it improved"},{"id":"d","label":"Many people do it"}]}}'::jsonb
    WHEN 'D7.12' THEN '{"en":{"options":[{"id":"a","label":"3"},{"id":"b","label":"6"},{"id":"c","label":"9"},{"id":"d","label":"12"}]}}'::jsonb

    WHEN 'D8.7' THEN '{"en":{"options":[{"id":"a","label":"We have to handle it."},{"id":"b","label":"Thanks for the signal. Let us make a quick plan and confirm scope."},{"id":"c","label":"Not my problem."}]}}'::jsonb
    WHEN 'D8.8' THEN '{"en":{"options":[{"id":"a","label":"Ignore it."},{"id":"b","label":"Check in privately if everything is OK."},{"id":"c","label":"Reply sarcastically."}]}}'::jsonb
    WHEN 'D8.9' THEN '{"en":{"options":[{"id":"a","label":"That is not true."},{"id":"b","label":"Sorry to hear that, let us clarify what is off."},{"id":"c","label":"Do not speak to us like that."}]}}'::jsonb
    WHEN 'D8.10' THEN '{"en":{"options":[{"id":"a","label":"Let it run."},{"id":"b","label":"Invite both to a short calm call."},{"id":"c","label":"State who is right."}]}}'::jsonb
    WHEN 'D8.11' THEN '{"en":{"options":[{"id":"a","label":"Describe facts, impact, and a concrete proposal."},{"id":"b","label":"List only errors."},{"id":"c","label":"Handle it publicly."}]}}'::jsonb
    WHEN 'D8.12' THEN '{"en":{"options":[{"id":"a","label":"Nothing is wrong"},{"id":"b","label":"Verify the context first"},{"id":"c","label":"They are surely angry"}]}}'::jsonb

    WHEN 'D9.7' THEN '{"en":{"options":[{"id":"a","label":"Higher price reduces demand"},{"id":"b","label":"More users increase referrals"},{"id":"c","label":"More tests reduce defects"},{"id":"d","label":"Lower latency improves UX"}]}}'::jsonb
    WHEN 'D9.8' THEN '{"en":{"options":[{"id":"o1","label":"Input"},{"id":"o2","label":"Response"},{"id":"o3","label":"Impact"},{"id":"o4","label":"Feedback"}]}}'::jsonb
    WHEN 'D9.9' THEN '{"en":{"sources":[{"id":"s1","label":"Lower price"},{"id":"s2","label":"Faster delivery"},{"id":"s3","label":"Better support"}],"targets":[{"id":"t1","label":"Higher demand"},{"id":"t2","label":"Higher satisfaction"},{"id":"t3","label":"Higher loyalty"}]}}'::jsonb
    WHEN 'D9.10' THEN '{"en":{"options":[{"id":"a","label":"Security and downstream limits"},{"id":"b","label":"Only speed"},{"id":"c","label":"Nothing"},{"id":"d","label":"Marketing"}]}}'::jsonb
    WHEN 'D9.11' THEN '{"en":{"options":[{"id":"a","label":"UI change"},{"id":"b","label":"Behavior change over time"},{"id":"c","label":"Color change"},{"id":"d","label":"Font change"}]}}'::jsonb
    WHEN 'D9.12' THEN '{"en":{"options":[{"id":"a","label":"Introduce damping rules"},{"id":"b","label":"Speed everything up"},{"id":"c","label":"Ignore swings"},{"id":"d","label":"Reduce monitoring"}]}}'::jsonb

    WHEN 'D10.7' THEN '{"en":{"options":[{"id":"a","label":"Risk"},{"id":"b","label":"Opportunity"},{"id":"c","label":"Unclear signal"}]}}'::jsonb
    WHEN 'D10.8' THEN '{"en":{"options":[{"id":"a","label":"Safe frame"},{"id":"b","label":"Fast probe"},{"id":"c","label":"Wait"}]}}'::jsonb
    WHEN 'D10.9' THEN '{"en":{"options":[{"id":"a","label":"Verify risks"},{"id":"b","label":"Look for opportunities"},{"id":"c","label":"Ignore"}]}}'::jsonb
    WHEN 'D10.10' THEN '{"en":{"options":[{"id":"a","label":"Brake"},{"id":"b","label":"Experiment"},{"id":"c","label":"Wait"}]}}'::jsonb
    WHEN 'D10.11' THEN '{"en":{"options":[{"id":"a","label":"Threat"},{"id":"b","label":"Opportunity"},{"id":"c","label":"Noise"}]}}'::jsonb
    WHEN 'D10.12' THEN '{"en":{"options":[{"id":"a","label":"Proceed cautiously"},{"id":"b","label":"Run a pilot"},{"id":"c","label":"Leave it"}]}}'::jsonb

    WHEN 'D11.7' THEN '{"en":{"options":[{"id":"o1","label":"Gather facts"},{"id":"o2","label":"Propose a fix"},{"id":"o3","label":"Confirm with client"},{"id":"o4","label":"Deploy the fix"}]}}'::jsonb
    WHEN 'D11.8' THEN '{"en":{"options":[{"id":"a","label":"Clarify goal and success criteria"},{"id":"b","label":"Start immediately"},{"id":"c","label":"Add people"},{"id":"d","label":"Wait"}]}}'::jsonb
    WHEN 'D11.9' THEN '{"en":{"sources":[{"id":"s1","label":"Map needs"},{"id":"s2","label":"Design solution"},{"id":"s3","label":"Deliver MVP"}],"targets":[{"id":"t1","label":"Discovery"},{"id":"t2","label":"Design"},{"id":"t3","label":"Build"}]}}'::jsonb
    WHEN 'D11.10' THEN '{"en":{"options":[{"id":"o1","label":"Define goal"},{"id":"o2","label":"Design solution"},{"id":"o3","label":"Build"},{"id":"o4","label":"Test"},{"id":"o5","label":"Launch"}]}}'::jsonb
    WHEN 'D11.11' THEN '{"en":{"options":[{"id":"a","label":"Trim secondary requirements"},{"id":"b","label":"Push deadline"},{"id":"c","label":"Ignore"},{"id":"d","label":"Raise price"}]}}'::jsonb
    WHEN 'D11.12' THEN '{"en":{"options":[{"id":"a","label":"Assign an owner and responsibility"},{"id":"b","label":"Do it yourself"},{"id":"c","label":"Wait"},{"id":"d","label":"Post in chat"}]}}'::jsonb

    WHEN 'D12.7' THEN '{"en":{"options":[{"id":"a","label":"Leave it"},{"id":"b","label":"Report the issue"},{"id":"c","label":"Use it"}]}}'::jsonb
    WHEN 'D12.8' THEN '{"en":{"options":[{"id":"a","label":"Hide it"},{"id":"b","label":"Describe the risks openly"},{"id":"c","label":"Let others decide"}]}}'::jsonb
    WHEN 'D12.9' THEN '{"en":{"options":[{"id":"a","label":"Use the data"},{"id":"b","label":"Get consent or do not use it"},{"id":"c","label":"Ignore it"}]}}'::jsonb
    WHEN 'D12.10' THEN '{"en":{"options":[{"id":"a","label":"Pause and run a minimal test"},{"id":"b","label":"Ship without testing"},{"id":"c","label":"Shift responsibility"}]}}'::jsonb
    WHEN 'D12.11' THEN '{"en":{"options":[{"id":"a","label":"Keep it as is"},{"id":"b","label":"Stop and find a fairer option"},{"id":"c","label":"Hide the metrics"}]}}'::jsonb
    WHEN 'D12.12' THEN '{"en":{"options":[{"id":"a","label":"Agree"},{"id":"b","label":"Stick to the process"},{"id":"c","label":"Ignore"}]}}'::jsonb
  END
WHERE id IN (
  'D7.7','D7.8','D7.9','D7.10','D7.11','D7.12',
  'D8.7','D8.8','D8.9','D8.10','D8.11','D8.12',
  'D9.7','D9.8','D9.9','D9.10','D9.11','D9.12',
  'D10.7','D10.8','D10.9','D10.10','D10.11','D10.12',
  'D11.7','D11.8','D11.9','D11.10','D11.11','D11.12',
  'D12.7','D12.8','D12.9','D12.10','D12.11','D12.12'
);

-- Generate variants for new pool keys
INSERT INTO public.jcfpm_items
  (id, dimension, subdimension, prompt, prompt_i18n, reverse_scoring, sort_order, item_type, payload, payload_i18n, assets, pool_key, variant_index)
SELECT
  base.id || '_v' || lpad(gs::text, 2, '0') AS id,
  base.dimension,
  base.subdimension,
  base.prompt || ' (varianta ' || gs || ')' AS prompt,
  base.prompt_i18n,
  base.reverse_scoring,
  base.sort_order,
  base.item_type,
  base.payload,
  base.payload_i18n,
  base.assets,
  base.pool_key,
  gs AS variant_index
FROM public.jcfpm_items base
CROSS JOIN generate_series(2, 10) gs
WHERE base.pool_key = base.id
  AND base.variant_index = 1
  AND base.sort_order >= 109
ON CONFLICT (id) DO NOTHING;

-- Backfill EN translations for baseline D1-D6 items
UPDATE public.jcfpm_items SET
  prompt_i18n = CASE id
    WHEN 'D1.1' THEN '{"en":"Before making a decision I need to analyze all available data and numbers."}'::jsonb
    WHEN 'D1.2' THEN '{"en":"I often decide based on intuition and first impression."}'::jsonb
    WHEN 'D1.3' THEN '{"en":"I prefer detailed plans and clear structure when solving tasks."}'::jsonb
    WHEN 'D1.4' THEN '{"en":"I work best when I can improvise and adapt to the situation."}'::jsonb
    WHEN 'D1.5' THEN '{"en":"I enjoy focusing on details and precision in my work."}'::jsonb
    WHEN 'D1.6' THEN '{"en":"I focus more on the big picture and strategy than on individual details."}'::jsonb
    WHEN 'D1.7' THEN '{"en":"When I solve a problem I go through each step systematically."}'::jsonb
    WHEN 'D1.8' THEN '{"en":"The best solutions often come to me spontaneously without long thinking."}'::jsonb
    WHEN 'D1.9' THEN '{"en":"I like clearly defined procedures and rules."}'::jsonb
    WHEN 'D1.10' THEN '{"en":"I like an environment where not everything is fixed and I can experiment."}'::jsonb
    WHEN 'D1.11' THEN '{"en":"I enjoy reading complex analyses and statistics."}'::jsonb
    WHEN 'D1.12' THEN '{"en":"I rely more on my experience and feelings than on facts."}'::jsonb

    WHEN 'D2.1' THEN '{"en":"I work best when I can be alone most of the time."}'::jsonb
    WHEN 'D2.2' THEN '{"en":"I thrive in an environment where I collaborate intensively with others."}'::jsonb
    WHEN 'D2.3' THEN '{"en":"I like taking a leadership role in team projects."}'::jsonb
    WHEN 'D2.4' THEN '{"en":"I feel best as a team member rather than a leader."}'::jsonb
    WHEN 'D2.5' THEN '{"en":"I enjoy working with clients and external partners."}'::jsonb
    WHEN 'D2.6' THEN '{"en":"I prefer working on internal projects without interaction with external people."}'::jsonb
    WHEN 'D2.7' THEN '{"en":"I often come up with ideas that the team then develops together."}'::jsonb
    WHEN 'D2.8' THEN '{"en":"I prefer working on my own projects without needing to coordinate with others."}'::jsonb
    WHEN 'D2.9' THEN '{"en":"I have a natural ability to motivate and lead others."}'::jsonb
    WHEN 'D2.10' THEN '{"en":"I prefer work where I am accountable only to myself for results."}'::jsonb
    WHEN 'D2.11' THEN '{"en":"Regular communication and information exchange with colleagues are important to me."}'::jsonb
    WHEN 'D2.12' THEN '{"en":"I often build working relationships with people outside my organization."}'::jsonb

    WHEN 'D3.1' THEN '{"en":"It is essential for me to have freedom to decide how I work."}'::jsonb
    WHEN 'D3.2' THEN '{"en":"I prefer environments with clear rules and expectations."}'::jsonb
    WHEN 'D3.3' THEN '{"en":"I am motivated by continuous improvement and developing new skills."}'::jsonb
    WHEN 'D3.4' THEN '{"en":"Achieving results matters more to me than improving the process."}'::jsonb
    WHEN 'D3.5' THEN '{"en":"Work fulfills me in itself regardless of reward."}'::jsonb
    WHEN 'D3.6' THEN '{"en":"Financial reward and recognition are key motivators for me."}'::jsonb
    WHEN 'D3.7' THEN '{"en":"I like to experiment and find new ways of working without external pressure."}'::jsonb
    WHEN 'D3.8' THEN '{"en":"I work best with clear guidance and structured leadership."}'::jsonb
    WHEN 'D3.9' THEN '{"en":"I enjoy learning new things even if it does not bring immediate results."}'::jsonb
    WHEN 'D3.10' THEN '{"en":"I focus on concrete goals and measurable results."}'::jsonb
    WHEN 'D3.11' THEN '{"en":"My strongest motivation comes from inner satisfaction in work."}'::jsonb
    WHEN 'D3.12' THEN '{"en":"I need external recognition and feedback to feel motivated."}'::jsonb

    WHEN 'D4.1' THEN '{"en":"I work best in sprints with high intensity followed by rest."}'::jsonb
    WHEN 'D4.2' THEN '{"en":"I prefer a constant, stable work pace throughout the day."}'::jsonb
    WHEN 'D4.3' THEN '{"en":"I can handle working on multiple things at once without problems."}'::jsonb
    WHEN 'D4.4' THEN '{"en":"I focus best when I work on a single task at a time."}'::jsonb
    WHEN 'D4.5' THEN '{"en":"In crisis situations and under time pressure I perform best."}'::jsonb
    WHEN 'D4.6' THEN '{"en":"Stress and urgency drain me and reduce my performance."}'::jsonb
    WHEN 'D4.7' THEN '{"en":"I like intense periods followed by rest."}'::jsonb
    WHEN 'D4.8' THEN '{"en":"I prefer a regular routine with minimal swings in workload."}'::jsonb
    WHEN 'D4.9' THEN '{"en":"I can effectively switch between tasks during the day."}'::jsonb
    WHEN 'D4.10' THEN '{"en":"I need long time blocks for deep focused work."}'::jsonb
    WHEN 'D4.11' THEN '{"en":"I can quickly respond to unexpected changes and requests."}'::jsonb
    WHEN 'D4.12' THEN '{"en":"I work best in predictable environments with few surprises."}'::jsonb

    WHEN 'D5.1' THEN '{"en":"It is important to me that my work has a positive impact on society."}'::jsonb
    WHEN 'D5.2' THEN '{"en":"I focus mainly on my personal growth and success."}'::jsonb
    WHEN 'D5.3' THEN '{"en":"I am drawn to working on new innovative projects."}'::jsonb
    WHEN 'D5.4' THEN '{"en":"I value stability and proven procedures."}'::jsonb
    WHEN 'D5.5' THEN '{"en":"Work makes sense to me when I help others or contribute to a shared goal."}'::jsonb
    WHEN 'D5.6' THEN '{"en":"Meaning for me is reaching personal milestones and achievements."}'::jsonb
    WHEN 'D5.7' THEN '{"en":"I am interested in work that pushes boundaries and changes the status quo."}'::jsonb
    WHEN 'D5.8' THEN '{"en":"I prefer proven methods with predictable results."}'::jsonb
    WHEN 'D5.9' THEN '{"en":"I want my work to have a visible impact on specific people\u0027s lives."}'::jsonb
    WHEN 'D5.10' THEN '{"en":"I feel most fulfilled when I reach challenging personal goals."}'::jsonb
    WHEN 'D5.11' THEN '{"en":"Quality relationships with colleagues and the team are a source of meaning at work."}'::jsonb
    WHEN 'D5.12' THEN '{"en":"Work is primarily a means to financial security for me."}'::jsonb

    WHEN 'D6.1' THEN '{"en":"I like trying new technologies and tools as soon as they appear."}'::jsonb
    WHEN 'D6.2' THEN '{"en":"I prefer tools and processes that I already know well."}'::jsonb
    WHEN 'D6.3' THEN '{"en":"Learning new things excites me and I see it as an opportunity."}'::jsonb
    WHEN 'D6.4' THEN '{"en":"Learning new things stresses me and I prefer to stick with what I know."}'::jsonb
    WHEN 'D6.5' THEN '{"en":"I can work effectively in uncertain environments without clear rules."}'::jsonb
    WHEN 'D6.6' THEN '{"en":"Uncertainty makes me uneasy and I need clear direction."}'::jsonb
    WHEN 'D6.7' THEN '{"en":"I actively experiment with AI tools (ChatGPT Midjourney Copilot)."}'::jsonb
    WHEN 'D6.8' THEN '{"en":"I have no experience with AI tools and I am not sure how to use them."}'::jsonb
    WHEN 'D6.9' THEN '{"en":"I am interested in how AI will change my field and I actively learn about it."}'::jsonb
    WHEN 'D6.10' THEN '{"en":"Technological changes in my field worry me."}'::jsonb
    WHEN 'D6.11' THEN '{"en":"I adapt quickly to new systems and processes at work."}'::jsonb
    WHEN 'D6.12' THEN '{"en":"I need time to get used to new work processes."}'::jsonb
  END,
  subdimension_i18n = CASE id
    WHEN 'D1.1' THEN '{"en":"Analytical thinking"}'::jsonb
    WHEN 'D1.2' THEN '{"en":"Intuitive thinking"}'::jsonb
    WHEN 'D1.3' THEN '{"en":"Preference for structure"}'::jsonb
    WHEN 'D1.4' THEN '{"en":"Improvisation"}'::jsonb
    WHEN 'D1.5' THEN '{"en":"Detail orientation"}'::jsonb
    WHEN 'D1.6' THEN '{"en":"Big picture"}'::jsonb
    WHEN 'D1.7' THEN '{"en":"Systematic approach"}'::jsonb
    WHEN 'D1.8' THEN '{"en":"Spontaneity"}'::jsonb
    WHEN 'D1.9' THEN '{"en":"Preference for rules"}'::jsonb
    WHEN 'D1.10' THEN '{"en":"Experimentation"}'::jsonb
    WHEN 'D1.11' THEN '{"en":"Analytical depth"}'::jsonb
    WHEN 'D1.12' THEN '{"en":"Experience-based decisions"}'::jsonb

    WHEN 'D2.1' THEN '{"en":"Solo work"}'::jsonb
    WHEN 'D2.2' THEN '{"en":"Team collaboration"}'::jsonb
    WHEN 'D2.3' THEN '{"en":"Leadership drive"}'::jsonb
    WHEN 'D2.4' THEN '{"en":"Team member preference"}'::jsonb
    WHEN 'D2.5' THEN '{"en":"External communication"}'::jsonb
    WHEN 'D2.6' THEN '{"en":"Internal focus"}'::jsonb
    WHEN 'D2.7' THEN '{"en":"Collaborative initiative"}'::jsonb
    WHEN 'D2.8' THEN '{"en":"Independent work"}'::jsonb
    WHEN 'D2.9' THEN '{"en":"Leadership ability"}'::jsonb
    WHEN 'D2.10' THEN '{"en":"Individual accountability"}'::jsonb
    WHEN 'D2.11' THEN '{"en":"Team communication"}'::jsonb
    WHEN 'D2.12' THEN '{"en":"External networking"}'::jsonb

    WHEN 'D3.1' THEN '{"en":"Autonomy"}'::jsonb
    WHEN 'D3.2' THEN '{"en":"Structure"}'::jsonb
    WHEN 'D3.3' THEN '{"en":"Mastery goals"}'::jsonb
    WHEN 'D3.4' THEN '{"en":"Performance goals"}'::jsonb
    WHEN 'D3.5' THEN '{"en":"Intrinsic motivation"}'::jsonb
    WHEN 'D3.6' THEN '{"en":"Extrinsic motivation"}'::jsonb
    WHEN 'D3.7' THEN '{"en":"Experimental autonomy"}'::jsonb
    WHEN 'D3.8' THEN '{"en":"Structured guidance"}'::jsonb
    WHEN 'D3.9' THEN '{"en":"Learning orientation"}'::jsonb
    WHEN 'D3.10' THEN '{"en":"Goal orientation"}'::jsonb
    WHEN 'D3.11' THEN '{"en":"Intrinsic satisfaction"}'::jsonb
    WHEN 'D3.12' THEN '{"en":"External validation"}'::jsonb

    WHEN 'D4.1' THEN '{"en":"Sprint pattern"}'::jsonb
    WHEN 'D4.2' THEN '{"en":"Steady state"}'::jsonb
    WHEN 'D4.3' THEN '{"en":"Multitasking"}'::jsonb
    WHEN 'D4.4' THEN '{"en":"Deep work"}'::jsonb
    WHEN 'D4.5' THEN '{"en":"Urgency performance"}'::jsonb
    WHEN 'D4.6' THEN '{"en":"Stress sensitivity"}'::jsonb
    WHEN 'D4.7' THEN '{"en":"Intensity cycling"}'::jsonb
    WHEN 'D4.8' THEN '{"en":"Consistent load"}'::jsonb
    WHEN 'D4.9' THEN '{"en":"Task switching"}'::jsonb
    WHEN 'D4.10' THEN '{"en":"Focus blocks"}'::jsonb
    WHEN 'D4.11' THEN '{"en":"Adaptability speed"}'::jsonb
    WHEN 'D4.12' THEN '{"en":"Predictability preference"}'::jsonb

    WHEN 'D5.1' THEN '{"en":"Social impact"}'::jsonb
    WHEN 'D5.2' THEN '{"en":"Individual focus"}'::jsonb
    WHEN 'D5.3' THEN '{"en":"Innovation orientation"}'::jsonb
    WHEN 'D5.4' THEN '{"en":"Stability preference"}'::jsonb
    WHEN 'D5.5' THEN '{"en":"Contribution value"}'::jsonb
    WHEN 'D5.6' THEN '{"en":"Achievement value"}'::jsonb
    WHEN 'D5.7' THEN '{"en":"Change orientation"}'::jsonb
    WHEN 'D5.8' THEN '{"en":"Proven methods"}'::jsonb
    WHEN 'D5.9' THEN '{"en":"Direct impact"}'::jsonb
    WHEN 'D5.10' THEN '{"en":"Personal achievement"}'::jsonb
    WHEN 'D5.11' THEN '{"en":"Relational value"}'::jsonb
    WHEN 'D5.12' THEN '{"en":"Instrumental value"}'::jsonb

    WHEN 'D6.1' THEN '{"en":"Early adoption"}'::jsonb
    WHEN 'D6.2' THEN '{"en":"Familiarity preference"}'::jsonb
    WHEN 'D6.3' THEN '{"en":"Learning enthusiasm"}'::jsonb
    WHEN 'D6.4' THEN '{"en":"Learning resistance"}'::jsonb
    WHEN 'D6.5' THEN '{"en":"Ambiguity tolerance"}'::jsonb
    WHEN 'D6.6' THEN '{"en":"Clarity need"}'::jsonb
    WHEN 'D6.7' THEN '{"en":"AI engagement"}'::jsonb
    WHEN 'D6.8' THEN '{"en":"AI unfamiliarity"}'::jsonb
    WHEN 'D6.9' THEN '{"en":"AI awareness"}'::jsonb
    WHEN 'D6.10' THEN '{"en":"Tech anxiety"}'::jsonb
    WHEN 'D6.11' THEN '{"en":"Adaptation speed"}'::jsonb
    WHEN 'D6.12' THEN '{"en":"Adaptation time"}'::jsonb
  END
WHERE id IN (
  'D1.1','D1.2','D1.3','D1.4','D1.5','D1.6','D1.7','D1.8','D1.9','D1.10','D1.11','D1.12',
  'D2.1','D2.2','D2.3','D2.4','D2.5','D2.6','D2.7','D2.8','D2.9','D2.10','D2.11','D2.12',
  'D3.1','D3.2','D3.3','D3.4','D3.5','D3.6','D3.7','D3.8','D3.9','D3.10','D3.11','D3.12',
  'D4.1','D4.2','D4.3','D4.4','D4.5','D4.6','D4.7','D4.8','D4.9','D4.10','D4.11','D4.12',
  'D5.1','D5.2','D5.3','D5.4','D5.5','D5.6','D5.7','D5.8','D5.9','D5.10','D5.11','D5.12',
  'D6.1','D6.2','D6.3','D6.4','D6.5','D6.6','D6.7','D6.8','D6.9','D6.10','D6.11','D6.12'
);

-- EN translations for interactive baseline pools D7-D12 (items 1-6)
UPDATE public.jcfpm_items SET
  prompt_i18n = CASE id
    WHEN 'D7.1' THEN '{"en":"A bat and a ball cost 110 CZK. The bat costs 100 CZK more than the ball. How much does the ball cost?"}'::jsonb
    WHEN 'D7.2' THEN '{"en":"5 machines make 5 parts in 5 minutes. How many parts do 100 machines make in 100 minutes?"}'::jsonb
    WHEN 'D7.3' THEN '{"en":"You increase a price by 25% and then decrease it by 20%. Compared to the original price the result is:"}'::jsonb
    WHEN 'D7.4' THEN '{"en":"A model has 99% accuracy, but positives are only 1% of data. The most likely issue is:"}'::jsonb
    WHEN 'D7.5' THEN '{"en":"Which argument is the post hoc fallacy?"}'::jsonb
    WHEN 'D7.6' THEN '{"en":"If A implies B and B is true, what can we say about A?"}'::jsonb

    WHEN 'D8.1' THEN '{"en":"After a longer discussion a colleague writes only: \"Ok.\" What is the best response?"}'::jsonb
    WHEN 'D8.2' THEN '{"en":"A client writes: \"This is a disappointment.\" How do you reply?"}'::jsonb
    WHEN 'D8.3' THEN '{"en":"After an incident the chat is silent. What do you do?"}'::jsonb
    WHEN 'D8.4' THEN '{"en":"A new joiner is getting lost in an async team. How do you help?"}'::jsonb
    WHEN 'D8.5' THEN '{"en":"You need to give critical feedback in text. The best approach is:"}'::jsonb
    WHEN 'D8.6' THEN '{"en":"A colleague replies briefly and sarcastically. What is appropriate?"}'::jsonb

    WHEN 'D9.1' THEN '{"en":"Match the change to the most likely impact."}'::jsonb
    WHEN 'D9.2' THEN '{"en":"You speed up one part of the process but the next stays the same. What is likely?"}'::jsonb
    WHEN 'D9.3' THEN '{"en":"Order the flow in a system."}'::jsonb
    WHEN 'D9.4' THEN '{"en":"Match the change to a secondary effect."}'::jsonb
    WHEN 'D9.5' THEN '{"en":"Which signal best shows a reinforcing feedback loop?"}'::jsonb
    WHEN 'D9.6' THEN '{"en":"After changing one part of a system you should verify:"}'::jsonb

    WHEN 'D10.1' THEN '{"en":"In the abstract image you first see:"}'::jsonb
    WHEN 'D10.2' THEN '{"en":"An unclear market trend makes you feel more:"}'::jsonb
    WHEN 'D10.3' THEN '{"en":"At first glance at an unclear signal you choose:"}'::jsonb
    WHEN 'D10.4' THEN '{"en":"In a situation without clear data you naturally choose:"}'::jsonb
    WHEN 'D10.5' THEN '{"en":"When instructions are not clear, your first interpretation is:"}'::jsonb
    WHEN 'D10.6' THEN '{"en":"You tend to see an unclear signal as:"}'::jsonb

    WHEN 'D11.1' THEN '{"en":"Order the steps to create an MVP."}'::jsonb
    WHEN 'D11.2' THEN '{"en":"Assign the task to the project phase."}'::jsonb
    WHEN 'D11.3' THEN '{"en":"Order the steps when handling an incident."}'::jsonb
    WHEN 'D11.4' THEN '{"en":"What is the best first step for a vague assignment?"}'::jsonb
    WHEN 'D11.5' THEN '{"en":"Assign the artifact to the prompting layer."}'::jsonb
    WHEN 'D11.6' THEN '{"en":"Order the steps to decompose a complex task."}'::jsonb

    WHEN 'D12.1' THEN '{"en":"You receive sensitive data that could improve a model, but the user did not consent. What do you do?"}'::jsonb
    WHEN 'D12.2' THEN '{"en":"The team wants to hide a product weakness from the client. How do you act?"}'::jsonb
    WHEN 'D12.3' THEN '{"en":"An algorithm increases conversions but disadvantages some users. What do you do?"}'::jsonb
    WHEN 'D12.4' THEN '{"en":"You find a compensation calculation error that helps you short-term. What do you do?"}'::jsonb
    WHEN 'D12.5' THEN '{"en":"A manager pushes for a fast release without a security audit. What do you choose?"}'::jsonb
    WHEN 'D12.6' THEN '{"en":"You notice systematic data bias. How do you proceed?"}'::jsonb
  END,
  subdimension_i18n = CASE id
    WHEN 'D7.1' THEN '{"en":"Cognitive Reflection"}'::jsonb
    WHEN 'D7.2' THEN '{"en":"Logic Puzzle"}'::jsonb
    WHEN 'D7.3' THEN '{"en":"Percent Change"}'::jsonb
    WHEN 'D7.4' THEN '{"en":"Data Reasoning"}'::jsonb
    WHEN 'D7.5' THEN '{"en":"Logical Fallacy"}'::jsonb
    WHEN 'D7.6' THEN '{"en":"Logic"}'::jsonb

    WHEN 'D8.1' THEN '{"en":"Tone Reading"}'::jsonb
    WHEN 'D8.2' THEN '{"en":"Conflict Chat"}'::jsonb
    WHEN 'D8.3' THEN '{"en":"Async Team"}'::jsonb
    WHEN 'D8.4' THEN '{"en":"Onboarding"}'::jsonb
    WHEN 'D8.5' THEN '{"en":"Feedback"}'::jsonb
    WHEN 'D8.6' THEN '{"en":"Tone Shift"}'::jsonb

    WHEN 'D9.1' THEN '{"en":"Systems Mapping"}'::jsonb
    WHEN 'D9.2' THEN '{"en":"Bottleneck"}'::jsonb
    WHEN 'D9.3' THEN '{"en":"System Flow"}'::jsonb
    WHEN 'D9.4' THEN '{"en":"Secondary Effects"}'::jsonb
    WHEN 'D9.5' THEN '{"en":"Feedback Loop"}'::jsonb
    WHEN 'D9.6' THEN '{"en":"Impact Check"}'::jsonb

    WHEN 'D10.1' THEN '{"en":"Ambiguity Visual"}'::jsonb
    WHEN 'D10.2' THEN '{"en":"Ambiguity Visual"}'::jsonb
    WHEN 'D10.3' THEN '{"en":"Ambiguity Visual"}'::jsonb
    WHEN 'D10.4' THEN '{"en":"Ambiguity Visual"}'::jsonb
    WHEN 'D10.5' THEN '{"en":"Ambiguity Visual"}'::jsonb
    WHEN 'D10.6' THEN '{"en":"Ambiguity Visual"}'::jsonb

    WHEN 'D11.1' THEN '{"en":"Decomposition"}'::jsonb
    WHEN 'D11.2' THEN '{"en":"Planning"}'::jsonb
    WHEN 'D11.3' THEN '{"en":"Incident Response"}'::jsonb
    WHEN 'D11.4' THEN '{"en":"Structuring"}'::jsonb
    WHEN 'D11.5' THEN '{"en":"AI Workflow"}'::jsonb
    WHEN 'D11.6' THEN '{"en":"Prioritization"}'::jsonb

    WHEN 'D12.1' THEN '{"en":"Ethics"}'::jsonb
    WHEN 'D12.2' THEN '{"en":"Integrity"}'::jsonb
    WHEN 'D12.3' THEN '{"en":"Fairness"}'::jsonb
    WHEN 'D12.4' THEN '{"en":"Transparency"}'::jsonb
    WHEN 'D12.5' THEN '{"en":"Pressure"}'::jsonb
    WHEN 'D12.6' THEN '{"en":"Whistleblowing"}'::jsonb
  END
WHERE id IN (
  'D7.1','D7.2','D7.3','D7.4','D7.5','D7.6',
  'D8.1','D8.2','D8.3','D8.4','D8.5','D8.6',
  'D9.1','D9.2','D9.3','D9.4','D9.5','D9.6',
  'D10.1','D10.2','D10.3','D10.4','D10.5','D10.6',
  'D11.1','D11.2','D11.3','D11.4','D11.5','D11.6',
  'D12.1','D12.2','D12.3','D12.4','D12.5','D12.6'
);

-- EN payload labels for interactive baseline pools
UPDATE public.jcfpm_items SET
  payload_i18n = CASE id
    WHEN 'D7.1' THEN '{"en":{"options":[{"id":"a","label":"5 CZK"},{"id":"b","label":"10 CZK"},{"id":"c","label":"15 CZK"},{"id":"d","label":"20 CZK"}]}}'::jsonb
    WHEN 'D7.2' THEN '{"en":{"options":[{"id":"a","label":"100"},{"id":"b","label":"500"},{"id":"c","label":"2000"},{"id":"d","label":"10000"}]}}'::jsonb
    WHEN 'D7.3' THEN '{"en":{"options":[{"id":"a","label":"higher"},{"id":"b","label":"lower"},{"id":"c","label":"the same"},{"id":"d","label":"cannot determine"}]}}'::jsonb
    WHEN 'D7.4' THEN '{"en":{"options":[{"id":"a","label":"Accuracy is misleading due to class imbalance"},{"id":"b","label":"The model has too low recall"},{"id":"c","label":"Data are always high quality"},{"id":"d","label":"The model is perfect"}]}}'::jsonb
    WHEN 'D7.5' THEN '{"en":{"options":[{"id":"a","label":"After the logo change sales increased, so the logo caused growth"},{"id":"b","label":"If it rains it is wet. It rains, so it is wet"},{"id":"c","label":"Everyone I know does it, so it is correct"},{"id":"d","label":"If A then B. Not B, therefore not A"}]}}'::jsonb
    WHEN 'D7.6' THEN '{"en":{"options":[{"id":"a","label":"A must be true"},{"id":"b","label":"A may or may not be true"},{"id":"c","label":"A is definitely false"},{"id":"d","label":"We cannot say anything about A"}]}}'::jsonb

    WHEN 'D8.1' THEN '{"en":{"options":[{"id":"a","label":"Ignore it, it is a confirmation."},{"id":"b","label":"Ask if everything is OK or something is missing."},{"id":"c","label":"Send a long explanation without a question."}]}}'::jsonb
    WHEN 'D8.2' THEN '{"en":{"options":[{"id":"a","label":"That is unfair."},{"id":"b","label":"Sorry to hear that. Can you clarify what exactly is not working?"},{"id":"c","label":"I will explain why it is like that."}]}}'::jsonb
    WHEN 'D8.3' THEN '{"en":{"options":[{"id":"a","label":"Wait until someone opens it."},{"id":"b","label":"Open a short check-in thread and offer support."},{"id":"c","label":"Send technical logs without comment."}]}}'::jsonb
    WHEN 'D8.4' THEN '{"en":{"options":[{"id":"a","label":"Send links without context."},{"id":"b","label":"Provide brief context and offer time for questions."},{"id":"c","label":"Tell them to ask someone else."}]}}'::jsonb
    WHEN 'D8.5' THEN '{"en":{"options":[{"id":"a","label":"Write only the error without context."},{"id":"b","label":"Describe facts plus impact plus offer a solution."},{"id":"c","label":"Post it publicly in the channel."}]}}'::jsonb
    WHEN 'D8.6' THEN '{"en":{"options":[{"id":"a","label":"Ignore the tone and continue the topic."},{"id":"b","label":"Check in privately if everything is OK."},{"id":"c","label":"Respond with the same sarcasm."}]}}'::jsonb

    WHEN 'D9.1' THEN '{"en":{"sources":[{"id":"s1","label":"Price increase"},{"id":"s2","label":"Shorter delivery time"},{"id":"s3","label":"Better support quality"}],"targets":[{"id":"t1","label":"Lower demand"},{"id":"t2","label":"Higher satisfaction"},{"id":"t3","label":"Higher loyalty"}]}}'::jsonb
    WHEN 'D9.2' THEN '{"en":{"options":[{"id":"a","label":"Improvement of all metrics"},{"id":"b","label":"Bottleneck in the next part"},{"id":"c","label":"Reduced variability"},{"id":"d","label":"No impact"}]}}'::jsonb
    WHEN 'D9.3' THEN '{"en":{"options":[{"id":"o1","label":"Input"},{"id":"o2","label":"Processing"},{"id":"o3","label":"Output"},{"id":"o4","label":"Feedback"}]}}'::jsonb
    WHEN 'D9.4' THEN '{"en":{"sources":[{"id":"s1","label":"Higher marketing spend"},{"id":"s2","label":"Lower error rate"},{"id":"s3","label":"Higher turnover"}],"targets":[{"id":"t1","label":"Higher demand"},{"id":"t2","label":"Lower complaints"},{"id":"t3","label":"Loss of know-how"}]}}'::jsonb
    WHEN 'D9.5' THEN '{"en":{"options":[{"id":"a","label":"User growth increases referrals, which increases further growth"},{"id":"b","label":"Higher price reduces demand"},{"id":"c","label":"More tests reduce defects"},{"id":"d","label":"Lower latency improves UX"}]}}'::jsonb
    WHEN 'D9.6' THEN '{"en":{"options":[{"id":"a","label":"Only the local metric"},{"id":"b","label":"Impacts on downstream parts and long-term effects"},{"id":"c","label":"Opinion of the loudest person"},{"id":"d","label":"Nothing"}]}}'::jsonb

    WHEN 'D10.1' THEN '{"en":{"options":[{"id":"a","label":"Risk"},{"id":"b","label":"Opportunity"},{"id":"c","label":"Unclear signal"}]}}'::jsonb
    WHEN 'D10.2' THEN '{"en":{"options":[{"id":"a","label":"Need to slow down"},{"id":"b","label":"Desire to experiment"},{"id":"c","label":"Wait and see"}]}}'::jsonb
    WHEN 'D10.3' THEN '{"en":{"options":[{"id":"a","label":"Verify risks"},{"id":"b","label":"Look for opportunities"},{"id":"c","label":"Ignore"}]}}'::jsonb
    WHEN 'D10.4' THEN '{"en":{"options":[{"id":"a","label":"Safe frame"},{"id":"b","label":"Quick probe"},{"id":"c","label":"Inaction"}]}}'::jsonb
    WHEN 'D10.5' THEN '{"en":{"options":[{"id":"a","label":"Potential threat"},{"id":"b","label":"Potential growth"},{"id":"c","label":"Random noise"}]}}'::jsonb
    WHEN 'D10.6' THEN '{"en":{"options":[{"id":"a","label":"Risk"},{"id":"b","label":"Opportunity"},{"id":"c","label":"Noise"}]}}'::jsonb

    WHEN 'D11.1' THEN '{"en":{"options":[{"id":"o1","label":"Define goal"},{"id":"o2","label":"Set hypotheses"},{"id":"o3","label":"Build prototype"},{"id":"o4","label":"Test"},{"id":"o5","label":"Iterate"}]}}'::jsonb
    WHEN 'D11.2' THEN '{"en":{"sources":[{"id":"s1","label":"Map user needs"},{"id":"s2","label":"Design solution"},{"id":"s3","label":"Deliver MVP"}],"targets":[{"id":"t1","label":"Discovery"},{"id":"t2","label":"Design"},{"id":"t3","label":"Build"}]}}'::jsonb
    WHEN 'D11.3' THEN '{"en":{"options":[{"id":"o1","label":"Stabilize service"},{"id":"o2","label":"Diagnose cause"},{"id":"o3","label":"Fix"},{"id":"o4","label":"Post-mortem"}]}}'::jsonb
    WHEN 'D11.4' THEN '{"en":{"options":[{"id":"a","label":"Start immediately"},{"id":"b","label":"Clarify goal and success criteria"},{"id":"c","label":"Add more people"},{"id":"d","label":"Wait for instructions"}]}}'::jsonb
    WHEN 'D11.5' THEN '{"en":{"sources":[{"id":"s1","label":"Base rules and roles"},{"id":"s2","label":"Specific request"},{"id":"s3","label":"Evaluation criteria"}],"targets":[{"id":"t1","label":"System"},{"id":"t2","label":"User"},{"id":"t3","label":"Evaluation"}]}}'::jsonb
    WHEN 'D11.6' THEN '{"en":{"options":[{"id":"o1","label":"Define outcome"},{"id":"o2","label":"Break into parts"},{"id":"o3","label":"Prioritize by impact"},{"id":"o4","label":"Assign responsibilities"}]}}'::jsonb

    WHEN 'D12.1' THEN '{"en":{"options":[{"id":"a","label":"Use them because they help"},{"id":"b","label":"Get consent or do not use the data"},{"id":"c","label":"Use them anonymously without informing"}]}}'::jsonb
    WHEN 'D12.2' THEN '{"en":{"options":[{"id":"a","label":"Agree, as long as the deal closes"},{"id":"b","label":"Propose openly naming the risk and offering a solution"},{"id":"c","label":"Ignore it"}]}}'::jsonb
    WHEN 'D12.3' THEN '{"en":{"options":[{"id":"a","label":"Keep it if performance grows"},{"id":"b","label":"Stop deployment and find a fairer variant"},{"id":"c","label":"Hide the metrics"}]}}'::jsonb
    WHEN 'D12.4' THEN '{"en":{"options":[{"id":"a","label":"Leave it"},{"id":"b","label":"Report the bug"},{"id":"c","label":"Wait to see if someone notices"}]}}'::jsonb
    WHEN 'D12.5' THEN '{"en":{"options":[{"id":"a","label":"Ship it"},{"id":"b","label":"Stop and propose a minimal audit"},{"id":"c","label":"Shift responsibility to another team"}]}}'::jsonb
    WHEN 'D12.6' THEN '{"en":{"options":[{"id":"a","label":"Ignore it"},{"id":"b","label":"Raise the issue and propose a fix"},{"id":"c","label":"Send it anonymously without more"}]}}'::jsonb
  END
WHERE id IN (
  'D7.1','D7.2','D7.3','D7.4','D7.5','D7.6',
  'D8.1','D8.2','D8.3','D8.4','D8.5','D8.6',
  'D9.1','D9.2','D9.3','D9.4','D9.5','D9.6',
  'D10.1','D10.2','D10.3','D10.4','D10.5','D10.6',
  'D11.1','D11.2','D11.3','D11.4','D11.5','D11.6',
  'D12.1','D12.2','D12.3','D12.4','D12.5','D12.6'
);
