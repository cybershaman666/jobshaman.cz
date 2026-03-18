# JobShaman Solarpunk Design System

## Philosophy

Solarpunk for JobShaman is **minimal, human-centered, and functional**. It's not about visual noise or fantasy, but about infusing the product with meaning through:

- **The Path** – Career Journey Symbolism
- **Energy Nodes** – Connection & Activity Signals
- **Growing Signals** – Achievement Progression

The goal: Make work feel like **growth, connection, and purpose** rather than just employment.

---

## 1. The Path (`SolarpunkPath`)

### What it is
A thin curved line symbolic of career progression: from understanding a problem → responding → engaging in dialogue.

### Where to use it
- Career flow visualizations
- Progress indicators
- Connection points between UI sections
- Loading states

### Component
```tsx
import { SolarpunkPath } from './ui/primitives';

<SolarpunkPath orientation="arc" className="w-24 h-24 text-[var(--accent-green)]" />
```

**Props:**
- `orientation`: 'vertical' | 'horizontal' | 'arc' (default: 'arc')
- `className`: Tailwind classes (color via `text-*` or `currentColor`)

### Visual Rule
Keep it **very subtle** (opacity ~0.4). It serves as a background signal, not a primary element.

---

## 2. Energy Nodes (`EnergyNode`)

### What they represent
- Active dialogues
- Collaborative energy
- Real-time participation
- Connection points

### Single Node
```tsx
import { EnergyNode } from './ui/primitives';

<EnergyNode size="md" active={true} pulse={true} />
```

**Props:**
- `size`: 'sm' | 'md' | 'lg'
- `active`: Boolean (controls opacity)
- `pulse`: Boolean (enables animation)
- `className`: Tailwind classes

### Node Ring (Multiple Nodes)
```tsx
<EnergyNodeRing count={5} maxVisible={3} />
```

**Props:**
- `count`: Total number of nodes
- `delay`: Animation stagger delay (default: 0.1s)
- `maxVisible`: How many nodes to show before "+X" label
- `className`: Tailwind classes

### Real-World Usage
Used in **JobCard** to show how many candidates are engaging with a specific role:

```tsx
{openDialoguesLabel && (
  <div className="inline-flex items-center gap-2 ...">
    <MessageCircle size={11} />
    <span>{openDialoguesLabel}</span>
    <EnergyNodeRing count={job.open_dialogues_count} maxVisible={3} />
  </div>
)}
```

---

## 3. Growing Signals (`GrowthSignal`)

### What they represent
Achievement progression through solved problems:
- `🌱` (Sprout) – 1-2 solutions
- `🌿` (Leaf) – 3-7 solutions
- `🍀` (Clover) – 8-15 solutions
- `🌳` (Tree) – 16+ solutions
- `○` (Empty) – 0 solutions

### Component
```tsx
import { GrowthSignal } from './ui/primitives';

<GrowthSignal level={12} variant="emoji" />
```

**Props:**
- `level`: Number representing achievement level (0-20+)
- `variant`: 'emoji' (🌱🌿🌳) | 'dot' (colored circle)
- `className`: Tailwind classes

### Real-World Usage
In **ProfileEditor**, showing progression in solved problems:

```tsx
<GrowthSignal 
  level={solutionSnapshots.length} 
  variant="emoji" 
  className="text-base"
/>
```

---

## 4. Progress Flows (`SolarpunkProgressFlow`)

### What it represents
A multi-step journey showing progress, current position, and upcoming steps.

Used in **handshake flow** to visualize: Problem → Response → Dialogue → Complete.

### Component
```tsx
import { SolarpunkProgressFlow } from './ui/primitives';

<SolarpunkProgressFlow 
  steps={[
    { label: 'Understand Problem', completed: true },
    { label: 'Build Response', completed: false },
    { label: 'First Dialogue', completed: false },
    { label: 'Hired', completed: false }
  ]}
  currentStep={1}
/>
```

**Props:**
- `steps`: Array of `{ label: string; completed: boolean }`
- `currentStep`: Index of current step (0-based)
- `className`: Tailwind classes

### Visual Behavior
- **Completed steps**: Green circle with checkmark
- **Current step**: Outlined green circle with scale animation
- **Future steps**: Muted grey

---

## CSS Utilities & Animations

### Available Animations
All animations are defined in `index.css` and `tailwind.config.js`:

```ts
// Use in className
className="animate-solarpunk-pulse"  // Pulsing effect
className="animate-solarpunk-glow"   // Glow effect
className="animate-energy-flow"      // Left-to-right travel
className="animate-handshake-pulse"  // Handshake notification
```

### Available Style Classes
```css
.solarpunk-pulse { }           // Pulsing animation
.solarpunk-glow { }            // Glowing aura
.solarpunk-path-flow { }       // Path animation
.solarpunk-interactive { }     // Hover effect for interactive elements
.energy-node-active { }        // Active node styling
.app-path-glow { }             // Subtle radial gradient for cards
```

---

## Design Rules

### ✅ DO
- Keep animations **subtle and under 2 seconds**
- Use the **green accent** (`--accent-green: #5eb486`) for energy and growth
- Layer effects (path + glow + soft shadows)
- Test in both light and dark modes
- Make animations **optional** (progressive enhancement)

### ❌ DO NOT
- Make animations permanent or distracting
- Overuse colors—limit to brand palette
- Add animations to performance-critical paths
- Use different animation speeds across similar elements
- Create rigid, mechanical feel

---

## Color Palette (Solarpunk-Specific)

```css
--accent-green: #5eb486;           /* Primary energy/growth color */
--accent-green-rgb: 94 180 134;    /* For rgba() usage */
--accent-green-soft: var(--accent-green-soft);  /* Soft background */

/* Use in conjunction with existing palette: */
--accent: #d58c27;                 /* Amber – secondary */
--accent-sky: #6eb1dc;             /* Sky blue – tertiary */
```

---

## Implementation Checklist

### For New Components
- [ ] Import solarpunk primitive(s)
- [ ] Add animation classes if applicable
- [ ] Test in light/dark modes
- [ ] Ensure animations don't break accessibility
- [ ] Use `className="solarpunk-interactive"` for hover effects
- [ ] Keep animations under 3 seconds
- [ ] Document usage in component's JSDoc

### For Existing Components
- [ ] Add EnergyNodeRing to collection/count displays
- [ ] Add GrowthSignal to achievement/progress sections
- [ ] Use SolarpunkProgressFlow for multi-step flows
- [ ] Add subtle glow effects to key cards

---

## Example: Full Integration

```tsx
import { 
  EnergyNodeRing, 
  GrowthSignal, 
  SolarpunkProgressFlow 
} from './ui/primitives';

export const JobCard = ({ job, profile }) => {
  return (
    <div className="app-path-glow rounded-lg p-4">
      {/* Progress indicator */}
      <SolarpunkProgressFlow 
        steps={[...]}
        currentStep={progressIndex}
      />

      {/* Activity indicator */}
      {job.open_dialogues_count > 0 && (
        <div className="flex items-center gap-2 mt-4">
          <span>Active conversations:</span>
          <EnergyNodeRing count={job.open_dialogues_count} />
        </div>
      )}

      {/* Achievement display */}
      <div className="flex items-center gap-2">
        <GrowthSignal level={profile.solved_count} />
        <span>{profile.solved_count} problems solved</span>
      </div>
    </div>
  );
};
```

---

## Accessibility Considerations

- Animations respect `prefers-reduced-motion`
- Energy nodes and progress are not sole indicators (always have text labels)
- Color is not the only means of conveying status
- All interactive elements have proper focus states

---

## Performance Notes

- Framer Motion animations use GPU acceleration
- Pulse animations use `transform` and `opacity` (performant properties)
- EnergyNodeRing limits visible nodes to prevent DOM bloat
- All animations are optional (progressive enhancement)

---

## Future Enhancements

- [ ] Customizable animation durations per context
- [ ] Path visualization for entire user journey
- [ ] Particle effects for major milestones
- [ ] Sound design (optional auditory feedback)
- [ ] Haptic feedback for mobile interactions
