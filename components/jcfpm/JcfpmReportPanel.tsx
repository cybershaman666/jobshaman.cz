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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-slate-800 shadow-sm">
        <div className="text-sm font-semibold">Jak číst výsledky</div>
        <div className="mt-2 text-xs text-slate-600">
          Skóre dimenze je průměr 12 položek (1–7). Percentil ukazuje, jak jsi na škále vůči ostatním.
        </div>
        <div className="mt-3 grid gap-2 text-xs text-slate-600 md:grid-cols-2">
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">1.0–2.5 → 0–15 (nízké)</div>
          <div className="rounded-lg border border-sky-100 bg-sky-50/60 px-3 py-2">2.5–4.5 → 15–50 (nižší)</div>
          <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2">4.5–5.5 → 50–85 (vyvážené)</div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2">5.5–7.0 → 85–100 (vysoké)</div>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-slate-800 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-lg font-semibold">Career Fit Report</h4>
          <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-700">
            Percentily a interpretace
          </span>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {dimension_scores.map((row) => (
            <div key={row.dimension} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-emerald-700">
                {DIMENSION_META[row.dimension]?.title || row.dimension}
              </div>
              <div className="mt-1 text-lg font-semibold">{row.raw_score} / 7</div>
              <div className="mt-1 text-xs text-slate-600">Percentil: {row.percentile} ({row.percentile_band})</div>
              <div className="mt-2 text-xs text-slate-700">{DIMENSION_META[row.dimension]?.definition}</div>
              <div className="mt-1 text-[11px] text-slate-600">{DIMENSION_META[row.dimension]?.subdims}</div>
              <div className="mt-2 text-xs text-slate-600">{row.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-slate-800 shadow-sm">
        <div className="text-sm font-semibold">Top role podle fit skóre</div>
        <div className="mt-1 text-xs text-slate-600">
          Fit score je vypočtený podle vážené vzdálenosti od ideálního profilu role (0–100).
        </div>
        <div className="mt-2 grid gap-3 md:grid-cols-2">
          {(fit_scores || []).slice(0, 10).map((role, idx) => (
            <div key={`${role.title}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-sm font-semibold text-slate-800">{role.title}</div>
              <div className="mt-1 text-xs text-slate-600">Fit: {role.fit_score}%</div>
              <div className="mt-1 text-xs text-slate-600">
                {role.salary_range ? `Plat: ${role.salary_range}` : null}
                {role.salary_range && role.growth_potential ? ' • ' : null}
                {role.growth_potential ? `Růst: ${role.growth_potential}` : null}
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {role.ai_impact ? `AI dopad: ${role.ai_impact}` : null}
                {role.ai_impact && role.remote_friendly ? ' • ' : null}
                {role.remote_friendly ? `Remote: ${role.remote_friendly}` : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {ai_report ? (
        <div className="rounded-2xl border border-emerald-100 bg-white p-4 text-slate-800 shadow-sm">
          <div className="text-sm font-semibold">AI interpretace</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-emerald-700">Silné stránky</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.strengths.map((item, idx) => (
                  <li key={`strength-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-emerald-700">Ideální prostředí</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.ideal_environment.map((item, idx) => (
                  <li key={`env-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wider text-emerald-700">Top role (AI)</div>
            <ul className="mt-2 space-y-2 text-sm text-slate-600">
              {ai_report.top_roles.map((role, idx) => (
                <li key={`ai-role-${idx}`}>- {role.title}: {role.reason}</li>
              ))}
            </ul>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-emerald-700">Rozvojové oblasti</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.development_areas.map((item, idx) => (
                  <li key={`dev-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="text-xs uppercase tracking-wider text-emerald-700">Další kroky</div>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {ai_report.next_steps.map((item, idx) => (
                  <li key={`next-${idx}`}>- {item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-600 shadow-sm">
            <span className="text-xs uppercase tracking-wider text-emerald-700">AI readiness</span>
            <div className="mt-2">{ai_report.ai_readiness}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JcfpmReportPanel;
