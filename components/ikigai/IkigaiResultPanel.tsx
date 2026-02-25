import React from 'react';
import { IkigaiSnapshotV1 } from '../../types';

interface Props {
  snapshot: IkigaiSnapshotV1;
}

const metricClass = 'rounded-xl border border-cyan-200/30 bg-slate-950/45 p-3';

const IkigaiResultPanel: React.FC<Props> = ({ snapshot }) => {
  const { scores, psych_profile, recommended_paths } = snapshot;

  return (
    <div className="rounded-2xl border border-cyan-200/25 bg-slate-950/55 p-4 text-cyan-50">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-lg font-semibold">IKIGAI syntéza</h4>
        <span className="rounded-full border border-cyan-300/35 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-cyan-200">
          Jádro {scores.ikigai_core_score}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-5">
        <div className={metricClass}><div className="text-xs text-cyan-200/80">Nadšení</div><div className="text-xl font-bold">{scores.love_score}</div></div>
        <div className={metricClass}><div className="text-xs text-cyan-200/80">Síla</div><div className="text-xl font-bold">{scores.strength_score}</div></div>
        <div className={metricClass}><div className="text-xs text-cyan-200/80">Potřeba</div><div className="text-xl font-bold">{scores.need_score}</div></div>
        <div className={metricClass}><div className="text-xs text-cyan-200/80">Odměna</div><div className="text-xl font-bold">{scores.reward_score}</div></div>
        <div className={metricClass}><div className="text-xs text-cyan-200/80">Jistota</div><div className="text-xl font-bold">{psych_profile.confidence_score}</div></div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/75 p-3">
          <div className="text-xs uppercase tracking-wider text-cyan-300">Archetyp</div>
          <div className="mt-1 text-lg font-semibold">{psych_profile.archetype_code}</div>
          {psych_profile.blended_archetype ? <div className="mt-1 text-xs text-slate-300">{psych_profile.blended_archetype}</div> : null}
          <div className="mt-2 text-xs text-slate-400">{psych_profile.disclaimer}</div>
        </div>

        <div className="rounded-xl border border-slate-700/70 bg-slate-900/75 p-3">
          <div className="text-xs uppercase tracking-wider text-cyan-300">Napěťové vektory</div>
          <ul className="mt-2 space-y-1 text-sm text-slate-200">
            {scores.tension_vectors.map((vector, index) => (
              <li key={`${vector}-${index}`}>- {vector}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-700/70 bg-slate-900/75 p-3">
        <div className="text-xs uppercase tracking-wider text-cyan-300">Doporučené směry</div>
        <ul className="mt-2 space-y-1 text-sm text-slate-200">
          {recommended_paths.map((item, index) => (
            <li key={`${item}-${index}`}>- {item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default IkigaiResultPanel;
