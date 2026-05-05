# Cybershaman Visual QA

This pass covers the new rebuild shell and legacy Cybershaman surfaces after adding light, dark, and system theme support.

## Automated Preflight

Run:

```bash
npm run audit:cybershaman-visual
npm run typecheck
npm run build
```

Automated coverage:

- Legacy Cybershaman shell files are removed, so the old map, old company shell, and old handshake shell cannot be mounted.
- Legacy `cybershaman-legacy` theme overrides are removed from the rebuild theme CSS.
- The rebuild theme provider supports `system`, `light`, and `dark`, and exposes stable resolved theme selectors.
- Header brand uses `/logotext-transparent.png` in light mode and `/logotextdark.png` in dark mode.
- Narrative onboarding uses `/logo-transparent.png` as the brand-only mark.
- Narrative onboarding is kept as the current product ritual surface and is no longer tagged as a legacy shell.
- Candidate insights uses the new screenshot-inspired dashboard shell, including sidebar, archetype card, growth card, blind spots, challenges, handshakes, growth map, and mentor advice.
- Recruiter root dashboard uses the same shared dashboard shell and keeps the recruiter command card mounted.
- Dashboard visuals are bundled locally as `/cybershaman-archetype-orbit.svg` and `/cybershaman-brain-growth.svg`.
- Focused QA routes remain routable: marketplace, candidate insights, JCFPM, and recruiter workspace.

## Manual Browser Matrix

Run this with browser/system theme set to both light and dark:

| Surface | Desktop | Mobile | Checks |
| :--- | :--- | :--- | :--- |
| Narrative onboarding | `/candidate/insights` with incomplete candidate profile | same | Ritual/auth screens readable, consent checkboxes visible, external login buttons visible, final quest can enter app. |
| Marketplace | `/` | same | Hero and job cards fit viewport, no clipped CTA text, theme toggle changes contrast cleanly. |
| Candidate dashboard | `/candidate/insights` | same | Sidebar, topbar, archetype orbit, right column, challenge/handshake cards, growth map, and mentor bar match the screenshot layout rhythm without overlap. |
| JCFPM | `/candidate/jcfpm` | same | Question controls stable, progress/readout cards readable in light and dark. |
| Recruiter workspace | `/recruiter`, `/recruiter/assessment-center`, `/recruiter/talent-pool` | same | Root dashboard shares the candidate layout system; forms, candidate cards, and recruiter dialogue thread remain readable. |
| Handshake | Start from a role card | same | Step cards, answer fields, finalization state, and backend fallback errors remain legible. |

Suggested viewports:

- Desktop: `1440x1000`
- Narrow laptop: `1024x768`
- Mobile: `390x844`

Brand checks:

- In light theme, the header logo should show the sun variant.
- In dark theme, the header logo should show the moon variant.
- In onboarding, the logo should appear as the standalone mark without text and without a checkerboard background.

## Current Status

- Automated preflight is in place.
- Local browser screenshot tooling is not installed in this environment, so the manual browser matrix is still required before marking the production TODO visual QA item complete.
