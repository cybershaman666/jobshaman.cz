# JobShaman Solarpunk Design System v2

## 🎨 Overview

**Visual**: Clean, minimal, unified solarpunk aesthetic  
**Emotion**: Optimistic technology that helps people shape the future  
**Philosophy**: Work is how we shape the world. Every job matters.

---

## 📐 Design Tokens

### Color System (Unified Light & Dark)

#### Primary Energy - Amber/Gold
- **Light**: `#d97706` - Warmth, sun, energy
- **Dark**: `#fbbf24` - Brighter on dark bg
- **CSS**: `var(--accent)`, `var(--accent-rgb)`

#### Growth & Connection - Green
- **Light**: `#10b981` - Life, growth, positive change
- **Dark**: `#34d399` - Emerald for visibility
- **CSS**: `var(--accent-green)`, `var(--accent-green-rgb)`
- **Usage**: Energy nodes, growth signals, success states

#### Technology & Clarity - Sky Blue
- **Light**: `#3b82f6` - Technology, clarity, intelligence
- **Dark**: `#60a5fa` - Bright sky
- **CSS**: `var(--accent-sky)`, `var(--accent-sky-rgb)`
- **Usage**: Information, secondary actions, tech emphasis

#### Backgrounds
- **Light**: `#f6f5ee` (warm cream), `#fbf6ea` (accent layer)
- **Dark**: `#08111f` (navy), `#0d1728` (accent layer)
- **CSS**: `var(--bg)`, `var(--bg-accent)`

#### Text Hierarchy
- **Strong**: `#122033` (light) / `#f5f8fc` (dark) – Headlines, critical info
- **Standard**: `#223249` (light) / `#d8e0eb` (dark) – Body copy
- **Muted**: `#5d6c82` (light) / `#a3b0c2` (dark) – Secondary info
- **Faint**: `#8694a8` (light) / `#7d8aa0` (dark) – Tertiary, hints

---

## 🧩 Solarpunk Primitive Components

### 1. SolarpunkPath – Career Journey Symbolism
```tsx
<SolarpunkPath orientation="arc" className="w-24 h-24 text-[var(--accent-green)]" />
```
- **What**: Thin curved lines representing progression
- **Where**: Hero sections, progress flows, connection points
- **Style**: Opacity 0.4, subtle, almost invisible
- **Inspiration**: Logo S-curve, natural paths

### 2. EnergyNode – Activity & Connection Signal
```tsx
<EnergyNode size="md" active={true} pulse={true} />
```
- **What**: Pulsing dot representing collaborative energy
- **Where**: Handshake counts, active dialogues, badge indicators
- **Animation**: 2s pulse (opacity + scale)
- **Color**: `var(--accent-green)` (default)

### 3. EnergyNodeRing – Multiple Active Participants
```tsx
<EnergyNodeRing count={5} maxVisible={3} />
```
- **What**: Circular arrangement of energy nodes
- **Where**: Shows "5 people engaging" with smart overflow
- **Arrangement**: Staggered animation based on index
- **Display**: Shows max 3 + "+2" overflow label

### 4. GrowthSignal – Achievement Progression
```tsx
<GrowthSignal level={12} variant="emoji" />
```
- **Emoji Progression**: 🌱 (1-2) → 🌿 (3-7) → 🍀 (8-15) → 🌳 (16+)
- **Dot Variant**: Colored circle (opacity-based progression)
- **Where**: Profile achievements, solved problems, milestones
- **Symbolism**: From seed to tree = career growth

### 5. SolarpunkProgressFlow – Multi-Step Journey
```tsx
<SolarpunkProgressFlow 
  steps={[
    { label: 'Understand', completed: true },
    { label: 'Respond', completed: false },
    { label: 'Connect', completed: false }
  ]}
  currentStep={1}
/>
```
- **Visual**: Numbered circles with connecting lines
- **States**: Complete (green), Current (outlined), Future (grey)
- **Animation**: Pulsing line between current and next step
- **Where**: Handshake flow, application journey

---

## 🎯 Background Systems

### Hero Background (`.solarpunk-hero-bg`)
- **Layers**:
  1. Path gradient (145deg, green accent)
  2. Sky reflection (top-right, blue accent)
  3. Warm light (bottom, amber)
  4. Subtle grid (opacity 0.02)
- **Effect**: Minimalist solarpunk atmosphere
- **Dark Mode**: Same structure, darker base

### Surface Card (`.solarpunk-surface`)
- **Default**: White/dark bg + border
- **Hover**: Subtle green gradient + green border
- **Transition**: 0.2s ease
- **Usage**: All main content cards

### Accent Background (`.solarpunk-accent-bg`)
- **Light**: Green + blue gradient (very subtle)
- **Border**: Green accent border
- **Usage**: Call-to-action sections, highlighted areas

### Path Line Signature (`.solarpunk-path-line::before`)
- **Visual**: Thin vertical line (1px) with green gradient
- **Position**: Center, flowing top to bottom
- **Opacity**: 0.6
- **Effect**: Signature element reminiscent of logo

---

## ✨ Animation Palette

All animations defined in Tailwind config + CSS:

### Solarpunk Pulse
```css
animation: solarpunk-pulse 2s ease-in-out infinite;
```
- Opacity: 1 → 0.8 → 1
- Scale: 1 → 1.1 → 1
- **Use**: Energy nodes, notification badges

### Solarpunk Glow
```css
animation: solarpunk-glow 3s ease-in-out infinite;
```
- Box-shadow: 0 → 8px → 0
- **Use**: Hover states, active indicators

### Energy Flow
```css
animation: energy-flow 1.5s ease-in infinite;
```
- Travel: -100% → 0% → exit
- **Use**: Progress lines, data flow visualization

### Handshake Pulse
```css
animation: handshake-pulse 1s ease-out;
```
- Notification expansion + fade
- **Use**: New message alerts, action confirmations

---

## 🏗️ Component Integration Points

### JobCard
```tsx
{openDialoguesLabel && (
  <div className="inline-flex items-center gap-2 ...">
    <MessageCircle size={11} />
    <span>{openDialoguesLabel}</span>
    <EnergyNodeRing count={job.open_dialogues_count} maxVisible={3} />
  </div>
)}
```
- Shows: "5 Open Dialogues" + 3 pulsing nodes + "+2"
- Color: Emerald theme

### ProfileEditor
```tsx
{solutionSnapshots.map((snapshot, idx) => (
  <div className="...">
    <GrowthSignal 
      level={idx + 1} 
      variant="emoji" 
    />
  </div>
))}
```
- Shows: 🌱 → 🌿 → 🍀 → 🌳
- Progression visible at a glance

### DemoHandshakePage
```tsx
<SolarpunkProgressFlow 
  steps={handshakeSteps}
  currentStep={stepIndex}
/>
```
- Shows: Problem → Response → Dialog → Complete
- Interactive flow indicator

---

## 🎨 Unified Design Principles

### ✅ DO
- **Subtlety**: Animations under 2-3 seconds, opacity < 0.6 for backgrounds
- **Consistency**: Use design tokens for all colors
- **Hierarchy**: Green for growth, Gold for energy, Blue for tech
- **Accessibility**: All animations optional, focus states visible
- **Progressive**: Works beautifully without animations too

### ❌ DON'T
- Overuse animations – they should feel peaceful, not frantic
- Break the color palette – stick to Gold, Green, Blue + neutrals
- Add stark contrast – solarpunk is warm and inclusive
- Use legacy CSS variables – always use CSS custom properties
- Create rigid, mechanical feel – nature-inspired curves welcome

---

## 🎯 Copy & Language Overhaul

**Old Corporate Language → New Solarpunk Philosophy**

| Before | After | Why |
|--------|-------|-----|
| "Job Board" | "Problems worth solving" | Emphasizes impact |
| "Send Response" | "Offer your hand" | Human connection |
| "Find Work" | "Shape the future" | Meaning over transaction |
| "Complete Profile" | "Ready to help" | Purpose over data |
| "Match Score" | "Compatibility" | Relationship over algorithm |

### Hero One-Liner
> **"Work is how we shape the world. Choose where you help."**

This encapsulates JobShaman's entire solarpunk philosophy.

---

## 📱 Responsive Scaling

All components scale beautifully:
- **sm**: 0.85rem radius, stacked layout
- **md**: 1.1rem radius, grid starts
- **lg**: 1.35rem radius, full desktop
- **xl+**: 1.75rem radius, spacious layouts

---

## 🔄 Future Extensions

- [ ] Homepage hero with illustrated solarpunk cityscape (minimal, pastel)
- [ ] Background path line animation (flowing from top)
- [ ] Signature "3-element" feature unique to JobShaman
- [ ] Microcopy content audit (implement solarpunk language)
- [ ] Particle effects for major milestones
- [ ] Haptic feedback for mobile (optional)

---

## 📊 Design System Stats

- **CSS Size**: 3,722 lines (optimized, down from 3,845)
- **Components**: 5 solarpunk primitives
- **Animations**: 10+ keyframe animations
- **Colors**: 9 design tokens (3 primary + 6 secondary/contextual)
- **Breakpoints**: 4 responsive tiers
- **Dark Mode**: Full support with warm dark tones

---

## 🚀 Quick Start

To use solarpunk components:

```tsx
import { 
  SolarpunkPath, 
  EnergyNode, 
  EnergyNodeRing,
  GrowthSignal,
  SolarpunkProgressFlow 
} from './components/ui/primitives';

// In your component
<div className="solarpunk-surface">
  <SolarpunkProgressFlow steps={steps} currentStep={0} />
  {active && <EnergyNodeRing count={5} />}
  <GrowthSignal level={12} variant="emoji" />
</div>
```

---

## ✨ Impact

This unified design system transforms JobShaman from:
- **Before**: Corporate job board with scattered design
- **After**: Optimistic platform for meaningful work

The solarpunk aesthetic isn't decoration—it's communication that JobShaman believes work should shape the world.
