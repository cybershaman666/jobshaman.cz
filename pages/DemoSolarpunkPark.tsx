import React from 'react';
import { Sparkles, Compass, Zap, MapPin, DollarSign } from 'lucide-react';
import { SolarpunkGlassHero, CareerPathLine } from '../components/ui/primitives';

/**
 * DemoSolarpunkPark
 * 
 * Full showcase of the "Park Práce" (Work Park) homepage layout.
 * Demonstrates all 7 layers:
 * 1. Hero glass panel
 * 2. Career path line
 * 3. Výzvy (Challenges)
 * 4. Mini výzvy (Seeds)
 * 5. Reality simulator
 * 6. Community activity
 * 7. Footer horizon
 */
export const DemoSolarpunkPark: React.FC = () => {
  // Mock data
  const challenges = [
    {
      id: '1',
      company: 'Talvex Cargo',
      title: 'Zrychlení komunikace mezi recepcí a housekeeping',
      salary: '58 400 Kč',
      distance: '28 min',
      jhi: 7.8,
    },
    {
      id: '2',
      company: 'TechStart Praha',
      title: 'Redesign customer onboarding flow',
      salary: '52 000 Kč',
      distance: '15 min',
      jhi: 8.2,
    },
    {
      id: '3',
      company: 'GreenEnergy AB',
      title: 'Build sustainability dashboard',
      salary: '68 000 Kč',
      distance: 'Remote',
      jhi: 8.7,
    },
  ];

  const miniChallenges = [
    { id: 'm1', title: 'UX audit landing page', hours: 3, price: '3 000 Kč' },
    { id: 'm2', title: 'Copy editing - product', hours: 2, price: '2 000 Kč' },
    { id: 'm3', title: 'Data visualization', hours: 5, price: '5 500 Kč' },
    { id: 'm4', title: 'API documentation', hours: 4, price: '4 200 Kč' },
  ];

  const activityItems = [
    'Jan právě reagoval na výzvu od Talvex',
    'Lucie dokončila mini projekt "Copy editing"',
    'TechStart otevřel dialog s Petrem',
    'Barbora zobrazila zájem o Role "Senior Developer"',
  ];

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      {/* ====== LAYER 1: HERO GLASS PANEL ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-6 sm:py-8">
        <SolarpunkGlassHero
          headline="Work is how we shape the world."
          subheading="Najdi problém, který stojí za řešení."
          primaryAction={{
            label: 'Hledat výzvy',
            onClick: () => console.log('Search challenges'),
            icon: <Sparkles size={16} />,
          }}
          secondaryAction={{
            label: 'Prozkoumat role',
            onClick: () => console.log('Explore roles'),
            icon: <Compass size={16} />,
          }}
          searchPanel={
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)] block">
                🔎 co chceš řešit?
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
                <input
                  type="text"
                  placeholder="role / problém"
                  className="px-3 py-2 bg-white/50 dark:bg-white/5 border border-[var(--border)] rounded-lg text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)]"
                />
                <input
                  type="text"
                  placeholder="místo"
                  className="px-3 py-2 bg-white/50 dark:bg-white/5 border border-[var(--border)] rounded-lg text-sm placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-green)]"
                />
                <button className="px-4 py-2 bg-[var(--accent-green)] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition">
                  Hledat
                </button>
              </div>
            </div>
          }
          metrics={
            <div className="text-xs text-[var(--text-muted)]">
              💡 5,234 výzev • 1,240 rolí • 340 firem • 2,891 lidí hledají
            </div>
          }
        />
      </div>

      {/* ====== LAYER 2: CAREER PATH LINE ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-4">
        <CareerPathLine
          cycles={2}
          height={120}
          waveHeight={25}
          className="opacity-50 dark:opacity-60"
        />
      </div>

      {/* ====== LAYER 3: VÝZVY (CHALLENGES) ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-12">
        <div className="space-y-6">
          <h2 className="app-section-title">
            Výzvy, které firmy právě řeší
          </h2>

          <div className="grid gap-4 lg:grid-cols-3">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className="app-organic-surface rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:border-[rgba(var(--accent-rgb),0.22)] hover:shadow-[var(--shadow-card)]"
                role="button"
                tabIndex={0}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-green)]">
                        {challenge.company}
                      </h3>
                      <p className="text-sm font-semibold text-[var(--text-strong)] mt-2">
                        {challenge.title}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 pt-2">
                    <div className="flex items-center gap-1.5 text-xs">
                      <DollarSign size={14} className="text-[var(--accent)]" />
                      <span className="text-[var(--text)]">{challenge.salary}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <MapPin size={14} className="text-[var(--accent-green)]" />
                      <span className="text-[var(--text)]">{challenge.distance}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Zap size={14} className="text-[var(--accent-sky)]" />
                      <span className="font-semibold">JHI {challenge.jhi}</span>
                    </div>
                  </div>

                  <button className="w-full mt-3 px-3 py-2.5 bg-[var(--accent-green)] text-white rounded-lg text-xs font-semibold hover:opacity-90 transition">
                    Podat ruku týmu
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== LAYER 4: MINI VÝZVY (SEEDS) ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-12">
        <div className="space-y-6">
          <h2 className="app-section-title">
            <span>🌱 Mini výzvy</span>
            <span className="text-sm font-normal text-[var(--text-muted)]">Seeds of work</span>
          </h2>

          <p className="text-sm text-[var(--text-muted)] mb-6">
            Malé projekty, velké příležitosti. Ideální pro rozjezd nebo vedlejší činnost.
          </p>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {miniChallenges.map((mini) => (
              <div
                key={mini.id}
                className="app-organic-panel-soft rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 shadow-[var(--shadow-soft)] transition-all hover:border-[rgba(var(--accent-rgb),0.22)] hover:bg-[var(--surface)]"
                role="button"
                tabIndex={0}
              >
                <div className="space-y-2">
                  <div className="text-lg">🌱</div>
                  <p className="font-semibold text-sm text-[var(--text-strong)]">
                    {mini.title}
                  </p>
                  <div className="flex gap-4 text-xs text-[var(--text-muted)]">
                    <span>{mini.hours}h</span>
                    <span>&bull;</span>
                    <span className="font-semibold text-[var(--accent-green)]">
                      {mini.price}
                    </span>
                  </div>
                  <button className="w-full mt-2 px-2 py-1.5 bg-[var(--accent-green)]/10 border border-[var(--accent-green)]/20 text-[var(--accent-green)] rounded-md text-xs font-semibold hover:bg-[var(--accent-green)]/20 transition">
                    Reagovat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== LAYER 5: REALITY SIMULATOR ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-12">
        <div className="space-y-6">
          <h2 className="app-section-title">
            Jak se role vejde do tvého života?
          </h2>

          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                role: 'Operations manager @ Talvex Cargo',
                income: '58 400 Kč',
                commute: '28 minut',
                arrangement: 'Hybrid',
                satisfaction: 'Ideální fit',
              },
              {
                role: 'Senior Developer @ TechStart',
                income: '72 000 Kč',
                commute: 'Remote',
                arrangement: 'Plné home office',
                satisfaction: 'Skvělá pro fokus',
              },
              {
                role: 'Sustainability Lead @ GreenEnergy',
                income: '68 000 Kč',
                commute: 'Remote',
                arrangement: 'Asynchronní tým',
                satisfaction: 'Flexibilní',
              },
            ].map((item, idx) => (
              <div
                key={idx}
                className="company-surface-soft app-organic-panel-soft rounded-[var(--radius-panel)] border p-4 space-y-3"
              >
                <h3 className="font-semibold text-sm text-[var(--text-strong)]">
                  {item.role}
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Čistý příjem:</span>
                    <span className="font-semibold text-[var(--accent)]">
                      {item.income}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Dojezd:</span>
                    <span className="font-semibold">{item.commute}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Režim:</span>
                    <span>{item.arrangement}</span>
                  </div>
                  <div className="border-t border-[var(--border-subtle)] pt-2 flex justify-between">
                    <span className="text-[var(--text-muted)]">Pro tebe:</span>
                    <span className="font-semibold text-[var(--accent-green)]">
                      {item.satisfaction}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== LAYER 6: COMMUNITY ACTIVITY ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-12">
        <div className="space-y-6">
          <h2 className="app-section-title">
            Právě se děje
          </h2>

          <div className="space-y-3">
            {activityItems.map((item, idx) => (
              <div key={idx} className="app-organic-panel-soft flex items-center gap-4 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-subtle)] p-4 shadow-[var(--shadow-soft)]">
                <div className="h-2.5 w-2.5 rounded-full bg-[var(--accent)] shadow-[0_0_16px_rgba(var(--accent-rgb),0.45)] animate-pulse" />
                <span className="text-sm text-[var(--text)]">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ====== LAYER 7: FOOTER - KLIDNÝ HORIZONT ====== */}
      <div className="mx-auto w-full max-w-[1680px] px-4 sm:px-5 lg:px-6 py-16 border-t border-[var(--border-subtle)] mt-12">
        <div className="text-center space-y-4">
          <p className="text-lg font-medium text-[var(--text)]">
            Work is how we shape the future.
          </p>
          <div className="flex justify-center items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <span>🌅</span>
            <span>JobShaman © 2026 • Budujeme park práce</span>
          </div>
        </div>

        {/* Subtle footer SVG - minimalist skyline */}
        <svg
          viewBox="0 0 1200 100"
          className="w-full h-20 mt-8 opacity-30 dark:opacity-20"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="footerGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.3" />
              <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          {/* Solarpunk minimalist cityscape */}
          <polygon
            points="0,100 20,70 40,80 60,60 80,75 100,50 120,65 140,40 160,55 180,35 200,50 220,60 240,45 260,70 280,55 300,80 320,65 340,85 360,70 380,90 400,75 420,95 440,85 460,100"
            fill="url(#footerGradient)"
          />
        </svg>
      </div>
    </div>
  );
};

export default DemoSolarpunkPark;
