
# Handshake Component Integration Guide

## 🎯 Overview

New handshake components are ready to be integrated into the existing app. They sit **alongside** the current implementation (in separate folders) and can be gradually migrated.

## 📦 Component Structure

### Candidate Side
**Location**: `/frontend/src/rebuild/candidate/handshake/`

```
CandidateHandshakeLayout         ← Main entry point (replaces CandidateExperience)
├── 7 Step Components            ← Each handles one phase
├── UI Components                ← Reusable (Progress, Packet, Container)
├── useHandshakeSession Hook     ← State management with auto-save
└── index.ts                     ← Clean exports
```

### Recruiter Side  
**Location**: `/frontend/src/rebuild/recruiter/handshake/`

```
RecruiterHandshakeView           ← Main entry point
├── Readout Panels               ← Answers, Metrics, Score, Feedback Form
├── useHandshakeReadout Hook     ← State + API calls
└── index.ts                     ← Clean exports
```

---

## 🔌 Integration Checkpoints

### 1. **Route Mapping** (Next Step)
Location: `frontend/src/rebuild/JobshamanRebuildApp.tsx`

Replace route from old to new:
```tsx
// OLD
const CandidateJourneyPage = React.lazy(() => 
  import('./candidate/CandidateExperience').then(m => ({ default: m.CandidateJourneyPage }))
);

// NEW
const CandidateJourneyPage = React.lazy(() => 
  import('./candidate/handshake/CandidateHandshakeLayout').then(m => ({ default: m.CandidateHandshakeLayout }))
);
```

### 2. **Page Props & Callbacks**
New layout expects these props:
```tsx
<CandidateHandshakeLayout
  handshakeId="uuid"
  role={role}
  company={company}
  blueprint={blueprint}
  initialSession={session}
  preferences={preferences}
  userProfile={userProfile}
  activeCvDocument={cvDoc}
  
  // Callbacks
  onNavigateBack={() => navigate('/candidate/marketplace')}
  onNavigateToStep={(stepId) => navigate(`/handshake/${id}/${stepId}`)}
  onFinalizeHandshake={async (session, score) => {...}}
  onAddExternalSubmission={() => {...}}
  
  finalizeBusy={isSubmitting}
/>
```

### 3. **API Endpoints (Already Exist)**
No changes needed - components use:
- `patchHandshakeAnswer()` - auto-save
- `finalizeHandshake()` - submit
- `addExternalHandshakeSubmission()` - work samples
- `decideV2CompanyHandshake()` - recruiter decision

### 4. **Translations (i18n)**
All strings use `t()` calls. Keys needed in your i18n files:

**Candidate:**
```
rebuild.journey.{step names, buttons, labels}
rebuild.handshake.*
rebuild.jcfpm.* (existing)
```

**Recruiter:**
```
rebuild.recruiter.{decision, feedback, assessment}
rebuild.handshake.*
```

Add these to your Czech + English translation files.

---

## 🧪 Quick Test

### Minimal Integration (No Navigation Changes)

```tsx
import { CandidateHandshakeLayout } from './candidate/handshake';

// Render directly with mock data
<CandidateHandshakeLayout
  handshakeId="test-123"
  role={mockRole}
  company={mockCompany}
  blueprint={mockBlueprint}
  initialSession={mockSession}
  preferences={mockPrefs}
  userProfile={mockUser}
  activeCvDocument={null}
  onNavigateBack={() => console.log('back')}
  onNavigateToStep={(id) => console.log('step:', id)}
  onFinalizeHandshake={async () => console.log('finalize')}
/>
```

### Recruiter Test

```tsx
import { RecruiterHandshakeView } from './recruiter/handshake';

<RecruiterHandshakeView
  companyId="company-uuid"
  handshakeId="handshake-uuid"
  onNavigateBack={() => console.log('back')}
/>
```

---

## 🔄 Migration Strategy

### Phase 1: Parallel (Current)
- New components exist in `/handshake/` folder
- Old code still in `CandidateExperience.tsx`
- No production changes yet

### Phase 2: Feature Flag
Add flag in app config:
```tsx
const USE_NEW_HANDSHAKE = false; // Toggle at runtime

<Route path="/handshake/:id">
  {USE_NEW_HANDSHAKE ? (
    <CandidateHandshakeLayout {...props} />
  ) : (
    <CandidateJourneyPage {...oldProps} />
  )}
</Route>
```

### Phase 3: Gradual Rollout
- Enable for 10% of users → 25% → 50% → 100%
- Monitor completion rates, errors
- Keep old code as fallback

### Phase 4: Cleanup
- Remove `CandidateExperience.tsx` once new is stable
- Archive old step components
- Update docs

---

## ⚡ Performance Notes

**Auto-save**: 
- Debounced 800ms (configurable via `useHandshakeSession`)
- Only saves changed fields
- Fails silently (user can manually save if needed)

**State Management**:
- No external state library needed
- Single `useHandshakeSession` hook manages all
- Dirty tracking prevents unnecessary saves

**Code Splitting**:
- All step components are separate files
- Can be lazy-loaded if needed
- Main layout ~1KB gzipped

---

## 🎨 Design System Alignment

Components use:
- ✓ Tailwind CSS (same as existing)
- ✓ Lucide icons (same as existing)
- ✓ Solarpunk colors (#1f5fbf, #0f95ac)
- ✓ Spacing: 4px rhythm (tailwind standard)
- ✓ Rounded: 8-12px (matches current UI)

No new CSS or dependencies needed.

---

## 📋 Checklist for Next Steps

- [ ] Add i18n translation keys
- [ ] Test CandidateHandshakeLayout with real data
- [ ] Test RecruiterHandshakeView with real data
- [ ] Create feature flag in app config
- [ ] Route new handshakes to new component
- [ ] Verify auto-save works (check Network tab)
- [ ] Test mobile responsiveness
- [ ] Load test with multiple concurrent handshakes
- [ ] Verify all recruiter decisions work
- [ ] Document any custom modifications needed

---

## 💡 Common Issues & Fixes

### Auto-save not triggering
→ Check `useHandshakeSession` hook `isDirty` state
→ Verify `patchHandshakeAnswer` API is working

### Styles look wrong
→ Ensure Tailwind CSS is configured in parent
→ Check dark mode CSS variables are set

### Types missing
→ Import from `./index.ts` (has all exports)
→ Check TypeScript `tsconfig.json` path mapping

### i18n keys not found
→ Add missing keys to translation files
→ Use `defaultValue` as fallback

---

**Components Ready for Integration! 🚀**

Contact: See `JobshamanRebuildApp.tsx` for integration guidance
