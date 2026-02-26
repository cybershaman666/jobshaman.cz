import React from 'react';
import { JcfpmSnapshotV1 } from '../../types';

interface Props {
  snapshot: JcfpmSnapshotV1;
}

const DIMENSION_META: Record<string, { title: string; definition: string; subdims: string }> = {
  d1_cognitive: {
    title: 'Kognitivní styl',
    definition: 'Způsob zpracování informací a řešení problémů.',
    subdims: 'Analytické vs. intuitivní • Struktura vs. improvizace • Detail vs. big picture',
  },
  d2_social: {
    title: 'Sociální orientace',
    definition: 'Preferovaný způsob interakce s lidmi a týmové dynamiky.',
    subdims: 'Solo vs. team • Leadership drive • External vs. internal communication',
  },
  d3_motivational: {
    title: 'Motivační profil',
    definition: 'Co tě pohání a co považuješ za odměnu.',
    subdims: 'Autonomie vs. struktura • Mastery vs. performance • Intrinsic vs. extrinsic',
  },
  d4_energy: {
    title: 'Energetický pattern',
    definition: 'Tempo, intenzita a styl práce.',
    subdims: 'Sprint vs. steady • Multitasking vs. deep work • Urgence vs. stabilita',
  },
  d5_values: {
    title: 'Hodnotová kotvení',
    definition: 'Co musí práce přinášet, aby dávala smysl.',
    subdims: 'Impact vs. osobní růst • Inovace vs. stabilita • Vztahy vs. výkon',
  },
  d6_ai_readiness: {
    title: 'Adaptační kapacita (AI Readiness)',
    definition: 'Jak dobře prosperuješ v měnícím se tech prostředí.',
    subdims: 'Učení nového • Tolerance nejistoty • Aktivní práce s AI',
  },
};

const JcfpmReportPanel: React.FC<Props> = ({ snapshot }) => {
  const { dimension_scores, fit_scores, ai_report } = snapshot;
  const uniqueFitScores = React.useMemo(() => {
    const seen = new Set<string>();
    const items = (fit_scores || []).filter((role) => {
      const titleKey = (role.title || '').toString().trim().toLowerCase();
      const key = titleKey || (role.role_id || '').toString();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return items;
  }, [fit_scores]);

  const describeScore = (dim: string, raw: number, percentile: number) => {
    const rounded = Math.round(raw * 10) / 10;
    const band = percentile >= 85 ? 'high' : percentile >= 50 ? 'mid' : 'low';
    const lookup: Record<string, { high: string; mid: string; low: string }> = {
      d1_cognitive: {
        high: `Analytické myšlení je u tebe výrazně silné (${rounded}/7). Skvěle rozkládáš problémy, hledáš vzorce a děláš rozhodnutí na základě logiky.`,
        mid: `Kognitivní styl je vyvážený (${rounded}/7). Umíš kombinovat analytiku i intuici podle situace.`,
        low: `Více se opíráš o intuici a celkový dojem (${rounded}/7). Daří se ti v situacích, kde není dost dat a je potřeba cit.`,
      },
      d2_social: {
        high: `Silná sociální orientace (${rounded}/7). Přirozeně tě baví spolupráce, vedení a práce s lidmi.`,
        mid: `Sociální orientace je vyvážená (${rounded}/7). Dokážeš fungovat v týmu i samostatně.`,
        low: `Preferuješ samostatnost (${rounded}/7). Nejvíc ti vyhovuje klid a soustředění bez častých interakcí.`,
      },
      d3_motivational: {
        high: `Vysoká vnitřní motivace (${rounded}/7). Tlačí tě smysl, autonomie a osobní růst.`,
        mid: `Motivace je vyvážená (${rounded}/7). Umíš fungovat v různých stylech odměn a vedení.`,
        low: `Silněji reaguješ na vnější motivátory (${rounded}/7). Jasná pravidla, cíle a odměny tě drží v tempu.`,
      },
      d4_energy: {
        high: `Zvládáš vysoké tempo (${rounded}/7). Umíš fungovat v intenzivních a dynamických situacích.`,
        mid: `Energetický styl je stabilní (${rounded}/7). Umíš si tempo přizpůsobit, když je potřeba.`,
        low: `Preferuješ klidnější tempo (${rounded}/7). Dlouhodobě ti sedí stabilní rytmus bez neustálých změn.`,
      },
      d5_values: {
        high: `Silné hodnotové ukotvení v impactu a inovacích (${rounded}/7). Potřebuješ smysl a přesah.`,
        mid: `Hodnoty máš vyvážené (${rounded}/7). Dokážeš fungovat v různých typech kultur.`,
        low: `Spíše tě drží stabilita a praktické jistoty (${rounded}/7). V prostředí chaosu bys mohl/a trpět.`,
      },
      d6_ai_readiness: {
        high: `Vysoká AI readiness (${rounded}/7). Rychle se učíš nové nástroje a změny tě spíš posilují.`,
        mid: `AI readiness je vyvážená (${rounded}/7). Nové technologie zvládáš, když je dobré vedení.`,
        low: `AI změny pro tebe nejsou přirozené (${rounded}/7). Potřebuješ stabilitu a jasný rámec.`,
      },
    };
    return lookup[dim]?.[band] || `Skóre ${rounded}/7.`;
  };

  const longNarrative = (dim: string, raw: number, percentile: number) => {
    const rounded = Math.round(raw * 10) / 10;
    const band = percentile >= 85 ? 'high' : percentile >= 50 ? 'mid' : 'low';
    const paragraphs: Record<string, { high: string; mid: string; low: string }> = {
      d1_cognitive: {
        high:
          `Tvůj kognitivní styl je výrazně analytický (${rounded}/7). To znamená, že v hlavě přirozeně rozkládáš složité situace na menší části, hledáš vzorce a preferuješ logiku nad odhadem. Tato síla se velmi dobře uplatní v rolích, kde je potřeba strukturovat chaos – data, strategie, procesní optimalizace, architektura řešení nebo rozhodování s velkým množstvím vstupů. V praxi to znamená, že se nenecháš snadno strhnout emocí nebo tlakem a dokážeš být ten/ta, kdo dodá racionální rámec. Pozor však na jednu věc: někdy se můžeš příliš dlouho „zaseknout“ ve fázi analýzy a odkládat rozhodnutí, které by v dané situaci stačilo udělat rychle. Pomáhá si nastavit časové limity nebo testovat malé experimenty místo hledání perfektního řešení. Ve spolupráci s kreativnějšími kolegy tvoříš skvělý stabilizační pilíř.`,
        mid:
          `Tvůj kognitivní styl je vyvážený (${rounded}/7). Umíš kombinovat analytiku s intuicí podle toho, co situace vyžaduje. Když jsou data, pracuješ racionálně; když chybí, dokážeš se opřít o zkušenost a rychlý odhad. Tato flexibilita je cenná v rolích, kde se mění kontext – produkt, projektové řízení, leadership, konzultace nebo kreativní strategie. V praxi to znamená, že zvládáš jak strukturované, tak „nejasné“ úkoly, a umíš přepínat mezi detailním a „big‑picture“ pohledem. Rizikem může být, že bez jasného rámce ztratíš prioritu – pomáhá pracovat s krátkými checklisty nebo „decision rules“. Celkově jde o velmi adaptivní profil, který dobře funguje v rychle se měnícím prostředí.`,
        low:
          `Tvůj kognitivní styl je spíše intuitivní (${rounded}/7). Přirozeně se opíráš o celkový dojem, zkušenost a cit pro situaci. To je obrovská výhoda v prostředích, kde je málo dat, vysoká nejistota a je potřeba rychle vnímat nuance – například v komunikaci s lidmi, kreativitě, designu, obchodu nebo v rolích, kde rozhoduje timing. V praxi to znamená, že často „cítíš“, co je správné, ještě než to lze tvrdě dokázat. Můžeš ale narazit na prostředí, které vyžaduje rigorózní analytické zdůvodnění každého kroku – tam je vhodné se opřít o kolegy nebo jednoduché rámce (např. 2–3 klíčové metriky). Tvé rozhodování bývá rychlé a odvážné, ale pozor na to, aby nebylo příliš impulzivní v situacích s velkou odpovědností.`,
      },
      d2_social: {
        high:
          `Sociální orientace je u tebe velmi silná (${rounded}/7). Energii ti dává práce s lidmi, spolupráce a často i leadership. Umíš číst atmosféru, zapojovat druhé a posouvat tým dopředu. To je skvělé pro role typu team lead, product owner, account management, HR nebo facilitace. V praxi to znamená, že se cítíš dobře v prostředí, kde můžeš budovat vztahy a ovlivňovat směr. Rizikem může být únava z přílišného „people managementu“ nebo potřeba potěšit všechny – pomáhá jasné vymezení odpovědnosti a hranic. Tvoje síla je schopnost vytvářet kohezivní tým a zvyšovat motivaci lidí kolem sebe.`,
        mid:
          `Sociální orientace je vyvážená (${rounded}/7). Umíš fungovat jak v týmu, tak samostatně. Tato flexibilita je velmi praktická, protože ti umožňuje přizpůsobit se typu práce i kultuře firmy. V praxi zvládáš komunikaci, ale zároveň nepotřebuješ neustálou interakci, abys podal/a dobrý výkon. Silně ti bude vyhovovat prostředí, kde máš autonomii, ale zároveň možnost spolupráce, když to dává smysl. Rizikem může být, že se někdy „rozplyneš“ mezi rolí člena týmu a lídra – pomáhá vědomě přepínat podle situace a jasně si určit, kdy vedeš a kdy podporuješ.`,
        low:
          `Preferuješ samostatnost (${rounded}/7). Nejlépe funguješ v prostředí, kde se můžeš soustředit bez častých interakcí a hluku. To je velká výhoda v rolích, které vyžadují hluboké soustředění, expertizu nebo individuální výkon. V praxi to znamená, že umíš být nezávislý/á, ale můžeš se cítit přetížený/á v neustálém „meeting mode“. Pomáhá jasná struktura spolupráce – domluvit si pravidelné, ale omezené synchronizace. Tvůj přínos je stabilita, preciznost a schopnost dotahovat věci bez vnějšího tlaku.`,
      },
      d3_motivational: {
        high:
          `Tvůj motivační profil je silně vnitřní (${rounded}/7). Pohání tě smysl, autonomie a možnost růstu, ne jen odměna nebo status. V praxi to znamená, že podáváš nejlepší výkon v prostředí, kde máš prostor rozhodovat a cítíš, že práce něco znamená. To je skvělé pro inovativní týmy, startupy, výzkum nebo role, kde můžeš tvořit. Rizikem může být frustrace v rigidních strukturách nebo přílišná idealizace práce – pomáhá si nastavit realistické cíle a najít „drobné smysly“ i v rutinních úkolech. Tvoje síla je schopnost dlouhodobě držet tah bez vnější kontroly.`,
        mid:
          `Motivace je u tebe vyvážená (${rounded}/7). Dokážeš fungovat jak na základě vnitřního smyslu, tak i jasných vnějších cílů. To je velmi adaptivní – zvládáš prostředí s KPI i kreativnější prostředí. V praxi to znamená, že se umíš přizpůsobit tomu, co firma nebo tým potřebuje, a neztrácíš výkon, když se mění podmínky. Rizikem může být rozptýlení mezi více typy motivátorů – pomáhá si ujasnit, co je v dané fázi nejdůležitější (např. růst vs. stabilita).`,
        low:
          `Silněji reaguješ na vnější motivátory (${rounded}/7). Jasné cíle, pravidla a odměny ti dávají stabilitu a výkon. V praxi to znamená, že umíš být velmi efektivní, když máš měřitelné výsledky a jasně daný rámec. To je skvělé pro role s KPI, procesy a systémem (sales, operations, performance). Rizikem může být vyhoření, pokud odměny dlouhodobě nepřicházejí nebo nejsou férové – proto je důležité mít transparentní očekávání. Tvoje síla je disciplína a schopnost doručovat výsledky.`,
      },
      d4_energy: {
        high:
          `Energetický pattern je u tebe vysoký (${rounded}/7). Umíš fungovat v rychlém tempu, zvládat tlak a přepínat mezi úkoly. To je silná výhoda v dynamických rolích a rychle se měnícím prostředí. V praxi to znamená, že se dokážeš „rozjet“ a doručit výkon, když je třeba. Rizikem je přetížení nebo dlouhodobé vyčerpání – pomáhá vědomě plánovat odpočinek a regeneraci. Tvoje síla je vysoká výkonnost v krizových situacích.`,
        mid:
          `Tvůj energetický styl je vyvážený (${rounded}/7). Zvládáš stabilní tempo i nárazové zrychlení, což ti dává flexibilitu. V praxi se umíš adaptovat na různé režimy práce. Rizikem může být rozostření hranic mezi prací a odpočinkem – pomáhá vědomě plánovat rytmus dne. Tvoje síla je stabilita v různorodých podmínkách.`,
        low:
          `Preferuješ klidnější a stabilní tempo (${rounded}/7). V praxi to znamená, že podáváš nejlepší výkon, když máš čas na soustředění a méně nárazových změn. To je výhoda pro role vyžadující preciznost a konzistenci. Rizikem je přehlcení v prostředí s chaosem a častými změnami – pomáhá nastavit jasné priority a chránit si časové bloky.`,
      },
      d5_values: {
        high:
          `Hodnotové kotvení je u tebe silné (${rounded}/7). Hledáš smysl, impact a inovace. V praxi to znamená, že potřebuješ vidět, že práce něco zlepšuje nebo posouvá. Když to cítíš, výkon roste; když ne, motivace klesá. To je skvělé pro role s misí, inovací nebo viditelným dopadem. Rizikem může být frustrace v prostředí, které je čistě procesní nebo krátkodobě orientované. Pomáhá si uvědomit, že i malé zlepšení může být smysluplné. Tvoje síla je schopnost dávat práci hlubší význam.`,
        mid:
          `Hodnoty máš vyvážené (${rounded}/7). Umíš fungovat v různých typech kultur a prostředí, protože nejsi extrémně vyhraněný/á. V praxi to znamená, že se dokážeš přizpůsobit firmám s různými prioritami. Rizikem může být, že ti bude chybět „silný tah“, pokud prostředí nebude jasně definovat směr. Pomáhá si vědomě vybrat, co je pro tebe v dané fázi nejdůležitější.`,
        low:
          `Spíše preferuješ stabilitu, jistotu a praktický užitek (${rounded}/7). V praxi to znamená, že ti vyhovuje jasně strukturované prostředí, kde jsou věci „předvídatelné“. To je výhoda v rolích s procesy, compliance nebo stabilním výstupem. Rizikem může být frustrace v chaotickém, experimentálním prostředí. Tvoje síla je spolehlivost a stabilní výkon.`,
      },
      d6_ai_readiness: {
        high:
          `Tvoje AI readiness je velmi vysoká (${rounded}/7). Rychle se učíš nové nástroje a změny tě spíš posilují než stresují. V praxi to znamená, že můžeš být early adopter, který zavádí nové postupy a technologie. Tato schopnost tě předurčuje k rolím s AI/tech složkou, kde je potřeba experimentovat a hledat nové možnosti. Rizikem může být nuda v prostředí, kde se nic nemění. Pomáhá hledat projekty s inovací. Tvoje síla je adaptabilita a technologická odvaha.`,
        mid:
          `AI readiness je vyvážená (${rounded}/7). Nové technologie zvládáš, když je k tomu dobré vedení a smysl. V praxi znamená, že se umíš adaptovat, ale nepotřebuješ být první. To je vhodné pro role, kde se AI využívá, ale není to hlavní náplň. Rizikem je, že pokud změna přijde příliš rychle, můžeš potřebovat více podpory – pomáhá průběžné vzdělávání.`,
        low:
          `AI změny pro tebe nejsou přirozené (${rounded}/7). Potřebuješ stabilitu a jasný rámec, abys mohl/a podávat dobrý výkon. To neznamená, že se AI nemůžeš naučit – jen to vyžaduje více času a podpory. V praxi ti budou sedět role, kde je technologie spíš nástroj než hlavní obsah práce. Tvoje síla je schopnost držet konzistentní výkon v ustáleném prostředí.`,
      },
    };
    return paragraphs[dim]?.[band] || `Skóre ${rounded}/7.`;
  };

  const printReport = () => {
    const dimCards = (dimension_scores || [])
      .map((row) => {
        const meta = DIMENSION_META[row.dimension] || { title: row.dimension, definition: '', subdims: '' };
        return `
          <div class="card">
            <div class="eyebrow">${meta.title}</div>
            <div class="metrics">
              <div class="metric"><div class="label">Skóre</div><div class="value">${row.raw_score} / 7</div></div>
              <div class="metric"><div class="label">Percentil</div><div class="value">${row.percentile}</div><div class="sub">(${row.percentile_band})</div></div>
              <div class="chip"><div class="label">Výsledek</div><div class="value">${row.label}</div></div>
            </div>
            <div class="definition">${meta.definition}</div>
            <div class="subdims">${meta.subdims}</div>
            <div class="short">${describeScore(row.dimension, row.raw_score, row.percentile)}</div>
            <div class="long">${longNarrative(row.dimension, row.raw_score, row.percentile)}</div>
          </div>
        `;
      })
      .join('');

    const roles = uniqueFitScores
      .slice(0, 10)
      .map((role) => `
        <div class="card">
          <div class="role-title">${role.title}</div>
          <div class="badges">
            <span class="badge">Fit: ${role.fit_score}%</span>
            ${role.ai_impact ? `<span class="badge alt">AI: ${role.ai_impact}</span>` : ''}
            ${role.remote_friendly ? `<span class="badge alt">Remote: ${role.remote_friendly}</span>` : ''}
          </div>
          <div class="meta">${role.salary_range ? `Plat: ${role.salary_range}` : 'Plat: —'}${role.salary_range && role.growth_potential ? ' • ' : ''}${role.growth_potential ? `Růst: ${role.growth_potential}` : ''}</div>
          <div class="meta">AI dopad: ${role.ai_impact || '—'} • Remote: ${role.remote_friendly || '—'}</div>
        </div>
      `)
      .join('');

    const ai = ai_report || {
      strengths: [],
      ideal_environment: [],
      top_roles: [],
      development_areas: [],
      next_steps: [],
      ai_readiness: '',
    };
    const aiBlock = `
      <div class="section">
        <h2>AI interpretace</h2>
        <div class="grid">
          <div class="card">
            <div class="eyebrow">Silné stránky</div>
            <ul>${ai.strengths.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="card">
            <div class="eyebrow">Ideální prostředí</div>
            <ul>${ai.ideal_environment.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">Top role (AI)</div>
          <ul>${ai.top_roles.map((r: any) => `<li><strong>${r.title}</strong>: ${r.reason}</li>`).join('')}</ul>
        </div>
        <div class="grid">
          <div class="card">
            <div class="eyebrow">Rozvojové oblasti</div>
            <ul>${ai.development_areas.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
          <div class="card">
            <div class="eyebrow">Další kroky</div>
            <ul>${ai.next_steps.map((s: string) => `<li>${s}</li>`).join('')}</ul>
          </div>
        </div>
        <div class="card">
          <div class="eyebrow">AI readiness</div>
          <p>${ai.ai_readiness}</p>
        </div>
      </div>
    `;
    const html = `
      <html>
        <head>
          <title>JCFPM Report</title>
          <style>
            body { font-family: Inter, Arial, sans-serif; color: #0b1220; padding: 28px; background: #f8fafc; }
            h1 { font-family: Fraunces, serif; margin-bottom: 8px; }
            h2 { font-size: 18px; margin: 24px 0 12px; }
            .brand { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
            .brand-left { display: flex; align-items: center; gap: 12px; }
            .logo { width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #22d3ee, #38bdf8); color: white; font-weight: 800; font-size: 18px; letter-spacing: 0.04em; }
            .brand-title { font-weight: 800; font-size: 16px; letter-spacing: 0.08em; text-transform: uppercase; color: #0e7490; }
            .brand-sub { font-size: 12px; color: #64748b; }
            .section { margin-top: 18px; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
            .card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08); margin-bottom: 12px; }
            .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #0e7490; margin-bottom: 6px; font-weight: 700; }
            .metrics { display: flex; gap: 10px; flex-wrap: wrap; }
            .metric { border: 1px solid #bae6fd; background: #e0f2fe; border-radius: 10px; padding: 8px 10px; min-width: 110px; }
            .metric .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #0e7490; }
            .metric .value { font-size: 16px; font-weight: 700; }
            .metric .sub { font-size: 11px; color: #475569; }
            .chip { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 999px; padding: 6px 12px; }
            .chip .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.12em; color: #64748b; }
            .chip .value { font-size: 12px; font-weight: 700; }
            .definition { font-size: 12px; color: #334155; margin-top: 8px; }
            .subdims { font-size: 11px; color: #64748b; margin-top: 4px; }
            .short { font-size: 12px; color: #334155; margin-top: 8px; }
            .long { font-size: 13px; color: #0f172a; margin-top: 8px; line-height: 1.5; }
            .role-title { font-weight: 700; font-size: 14px; }
            .badges { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
            .badge { border: 1px solid #bae6fd; background: #e0f2fe; color: #0e7490; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; }
            .badge.alt { border-color: #c7d2fe; background: #eef2ff; color: #1d4ed8; }
            .meta { font-size: 12px; color: #475569; margin-top: 6px; }
            ul { padding-left: 18px; margin: 6px 0 0; }
            li { margin-bottom: 6px; }
            @media print {
              body { background: #ffffff; }
              .card { box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <div class="brand">
            <div class="brand-left">
              <div class="logo">JS</div>
              <div>
                <div class="brand-title">JobShaman</div>
                <div class="brand-sub">Career Fit & Potential Model (JCFPM v1)</div>
              </div>
            </div>
            <div class="brand-sub">Datum: ${snapshot.completed_at}</div>
          </div>
          <h1>JCFPM Report</h1>
          <div class="section">
            <h2>Dimenze</h2>
            ${dimCards}
          </div>
          <div class="section">
            <h2>Top role podle fit skóre</h2>
            ${roles}
          </div>
          ${aiBlock}
        </body>
      </html>
    `;
    const win = window.open('', '_blank', 'width=900,height=800');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4">
      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="jcfpm-heading text-sm font-semibold">Jak číst výsledky</div>
        <div className="mt-2 text-xs text-slate-600">
          Skóre dimenze je průměr 12 položek (1–7). Percentil ukazuje, jak jsi na škále vůči ostatním.
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
          <div className="jcfpm-metric-pill">1.0–2.5 → 0–15 (nízké)</div>
          <div className="jcfpm-metric-pill">2.5–4.5 → 15–50 (nižší)</div>
          <div className="jcfpm-metric-pill">4.5–5.5 → 50–85 (vyvážené)</div>
          <div className="jcfpm-metric-pill">5.5–7.0 → 85–100 (vysoké)</div>
        </div>
        <div className="mt-3 text-xs text-slate-600">
          Fit score (0–100) vyjadřuje shodu s ideálním profilem role. Čím vyšší číslo, tím bližší match.
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={printReport} className="jcfpm-secondary-button">Tisk / PDF</button>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
          <div className="jcfpm-info-card">
            <div className="font-semibold text-slate-700">Jak číst percentily</div>
            <div className="mt-1">Např. 80. percentil znamená, že jsi výše než 80 % lidí v dané dimenzi.</div>
          </div>
          <div className="jcfpm-info-card">
            <div className="font-semibold text-slate-700">Jak číst fit score</div>
            <div className="mt-1">70–85 = dobrá shoda, 85+ = velmi silná shoda.</div>
          </div>
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="flex items-center justify-between gap-2">
          <h4 className="jcfpm-heading text-lg font-semibold">Career Fit Report</h4>
          <span className="rounded-full border border-cyan-200/70 bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-700">
            Percentily a interpretace
          </span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {dimension_scores.map((row) => (
            <div key={row.dimension} className="jcfpm-report-card-lite jcfpm-report-dimension">
              <div className="text-xs uppercase tracking-wider text-cyan-700">
                {DIMENSION_META[row.dimension]?.title || row.dimension}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <div className="jcfpm-score-chip">
                  <div className="text-[10px] uppercase tracking-wider text-cyan-700">Skóre</div>
                  <div className="text-lg font-semibold text-slate-900">{row.raw_score} / 7</div>
                </div>
                <div className="jcfpm-score-chip jcfpm-score-chip-alt">
                  <div className="text-[10px] uppercase tracking-wider text-cyan-700">Percentil</div>
                  <div className="text-lg font-semibold text-slate-900">{row.percentile}</div>
                  <div className="text-[11px] text-slate-600">({row.percentile_band})</div>
                </div>
                <div className="jcfpm-label-chip">
                  <span className="text-[10px] uppercase tracking-wider">Výsledek</span>
                  <span className="text-sm font-semibold">{row.label}</span>
                </div>
              </div>
              <div className="mt-2 text-xs text-slate-700">{DIMENSION_META[row.dimension]?.definition}</div>
              <div className="mt-1 text-[11px] text-slate-600">{DIMENSION_META[row.dimension]?.subdims}</div>
              <div className="mt-3 text-xs text-slate-700">{describeScore(row.dimension, row.raw_score, row.percentile)}</div>
              <div className="mt-3 text-sm text-slate-700 leading-relaxed">
                {longNarrative(row.dimension, row.raw_score, row.percentile)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="jcfpm-report-card jcfpm-report-section">
        <div className="jcfpm-heading text-sm font-semibold">Top role podle fit skóre</div>
        <div className="mt-1 text-xs text-slate-600">
          Fit score je vypočtený podle vážené vzdálenosti od ideálního profilu role (0–100).
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {uniqueFitScores.slice(0, 10).map((role, idx) => (
            <div key={`${role.title}-${idx}`} className="jcfpm-report-card-lite jcfpm-report-role">
              <div className="text-sm font-semibold text-slate-800">{role.title}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="jcfpm-score-badge">Fit: {role.fit_score}%</span>
                {role.ai_impact ? <span className="jcfpm-score-badge jcfpm-score-badge-alt">AI: {role.ai_impact}</span> : null}
                {role.remote_friendly ? <span className="jcfpm-score-badge jcfpm-score-badge-alt">Remote: {role.remote_friendly}</span> : null}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {role.salary_range ? `Plat: ${role.salary_range}` : null}
                {role.salary_range && role.growth_potential ? ' • ' : null}
                {role.growth_potential ? `Růst: ${role.growth_potential}` : null}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {role.ai_impact ? `AI dopad: ${role.ai_impact}` : 'AI dopad: —'}
                {' • '}
                {role.remote_friendly ? `Remote: ${role.remote_friendly}` : 'Remote: —'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ai_report ? (
        <div className="jcfpm-report-card jcfpm-report-section">
          <div className="jcfpm-heading text-sm font-semibold">AI interpretace</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="jcfpm-report-card-lite">
              <div className="text-xs uppercase tracking-wider text-cyan-700">Silné stránky</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.strengths.map((item, idx) => (
                  <li key={`strength-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="jcfpm-report-card-lite">
              <div className="text-xs uppercase tracking-wider text-cyan-700">Ideální prostředí</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.ideal_environment.map((item, idx) => (
                  <li key={`env-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="jcfpm-report-card-lite mt-3">
            <div className="text-xs uppercase tracking-wider text-cyan-700">Top role (AI)</div>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {ai_report.top_roles.map((role, idx) => (
                <li key={`ai-role-${idx}`}>- {role.title}: {role.reason}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="jcfpm-report-card-lite">
              <div className="text-xs uppercase tracking-wider text-cyan-700">Rozvojové oblasti</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.development_areas.map((item, idx) => (
                  <li key={`dev-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="jcfpm-report-card-lite">
              <div className="text-xs uppercase tracking-wider text-cyan-700">Další kroky</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.next_steps.map((item, idx) => (
                  <li key={`next-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="jcfpm-report-card-lite mt-3 text-sm text-slate-600">
            <span className="text-xs uppercase tracking-wider text-cyan-700">AI readiness</span>
            <div className="mt-2">{ai_report.ai_readiness}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JcfpmReportPanel;
