# Search Cleanup & Career Map Implementation

## Overview

This document describes the clean search implementation and the new career map feature for JobShaman.

---

## Part 1: Search Cleanup (LinkedIn/Jobs.cz Style)

### Problem
The old search had:
- **Complex scoring algorithms** (140/80/45/32 point weights for different fields)
- **Multiple ranking algorithms** with manual query scoring
- **Aggressive filtering** that zeroed out results despite 72K jobs in database
- **External job capping** (max 2 external jobs in first 8 results)
- **Profile-based reordering** that confused users
- **Safeguards** that filtered out legitimate jobs

### Solution: Simple, Fast Search

#### New Files Created

1. **`services/simpleSearchService.ts`** (340 lines)
   - Clean, simple boolean matching
   - No complex scoring weights
   - Fast client-side filtering
   - Basic filters only: location, work arrangement, date, salary, contract type, experience, benefits

2. **`hooks/useSimpleJobs.ts`** (280 lines)
   - Simple fetch + filter hook
   - No profile-based reordering
   - No aggressive fallbacks
   - No safeguards that zero out results
   - Clean API with filter setters

#### Key Differences

| Feature | Old (jobService.ts) | New (simpleSearchService.ts) |
|---------|---------------------|------------------------------|
| **Matching** | Complex scoring (140/80/45/32 pts) | Simple boolean (matches or doesn't) |
| **Ranking** | Multi-algorithm with manual query score | Backend handles ranking, we display |
| **External Jobs** | Capped at 2 in first 8 results | No artificial caps |
| **Profile Reordering** | Yes, based on candidate intent | No reordering |
| **Safeguards** | Multiple filters that zero results | No aggressive safeguards |
| **Lines of Code** | 3451 lines | 340 lines |

#### Simple Filters Included

✅ **Text Search** - Simple keyword matching (title, company, location, description)
✅ **Location** - City and radius filtering
✅ **Work Arrangement** - Remote / Hybrid / Onsite
✅ **Date Posted** - 24h, 3d, 7d, 14d, all
✅ **Salary Range** - Minimum salary filter
✅ **Contract Type** - IČO, HPP, Brigáda, Part-time
✅ **Experience Level** - Junior, Medior, Senior, Lead
✅ **Benefits** - Simple tag matching
✅ **Country/Language** - Basic filtering

#### Removed

❌ Complex scoring weights (140/80/45/32 points)
❌ Manual query scoring (`scoreJobForManualQuery`)
❌ External job capping (`applyExternalTopCap`)
❌ Profile-based reordering (`annotateJobsForCandidate` for reordering)
❌ Aggressive safeguards (`createDomesticCountrySafeguard`)
❌ Fallback heuristics (`jobSearchFallbackHeuristics`)
❌ Discovery filter source tracking
❌ Complex contract keyword derivation

#### How to Use

```typescript
import { useSimpleJobs } from './hooks/useSimpleJobs';

function MyComponent() {
  const {
    jobs,
    loading,
    performSearch,
    setFilterWorkArrangement,
    setFilterDatePosted,
    clearAllFilters
  } = useSimpleJobs({
    pageSize: 50,
    sortBy: 'newest'
  });

  return (
    <div>
      <input onChange={e => performSearch(e.target.value)} />
      {jobs.map(job => <JobCard key={job.id} job={job} />)}
    </div>
  );
}
```

---

## Part 2: Career Map (Two-Layer Decision Model)

### Philosophy

The career map is **not about showing job listings**. It's about **showing decisions**:

- **Layer 1** - Life Directions (what do you want to change?)
- **Layer 2** - Roles (which roles serve that direction?)

This is a **personal, readable, actionable** model based on tensions between current state and goals.

### Tension Model

Life directions are defined by **tensions** (not just preferences):

| Tension | From | To |
|---------|------|----|
| **Stay safe vs Grow fast** | High risk, high growth | Secure and steady |
| **Earn more vs Work less** | Lower pay, more time | Higher pay, more effort |
| **Specialize vs Explore** | Jack of all trades | Deep specialist |
| **Lead vs Build** | Individual contributor | Team leader |
| **Remote vs Local impact** | On-site required | Fully remote |

### New Files Created

1. **`types/careerMap.ts`** (340 lines)
   - Life direction types with tensions
   - Career role types
   - Predefined 8 life directions with CS/EN localization
   - Helper functions for mapping roles to directions

2. **`services/careerMapService.ts`** (400 lines)
   - Backend API integration (`/api/career-map/taxonomy`, `/api/career-map/infer`)
   - Local fallback inference when backend unavailable
   - Role family to life direction mapping
   - State management helpers

3. **`components/CareerMap/CareerMapSelector.tsx`** (450 lines)
   - Clean, visual UI component
   - Two-layer navigation (directions → roles)
   - Tension display
   - Role difficulty badges
   - Sample job counts
   - Full CS/EN localization

### Life Directions Implemented

1. 🏠 **More Remote Time** - Work from anywhere, async-first roles
2. 🎨 **Less Routine** - Dynamic work with changing challenges
3. 💰 **Higher Income** - Maximize earning potential
4. 🌟 **More Meaning** - Work aligned with personal values
5. 🏛️ **Stronger Stability** - Long-term security, predictable path
6. ⚖️ **Better Work-Life Balance** - Healthy boundaries, flexible time
7. 🚀 **Faster Growth** - Rapid skill development, promotion trajectory
8. 🎯 **More Autonomy** - Self-directed work, decision-making power

Each direction includes:
- **Tension** - What conflict does this resolve?
- **Poles** - From what → To what
- **Example roles** - Concrete positions that serve this direction
- **Job count** - How many jobs match this direction

### How to Use

```typescript
import CareerMapSelector from './components/CareerMap/CareerMapSelector';

function CareerView({ jobs }) {
  return (
    <CareerMapSelector
      jobs={jobs}
      currentRole="Software Developer"
      onRoleSelect={(role) => {
        console.log('Selected role:', role);
        // Navigate to jobs for this role
      }}
      onDirectionChange={(direction) => {
        console.log('Direction changed:', direction);
      }}
      locale="cs"
    />
  );
}
```

### Backend Integration

The career map uses existing backend APIs:

1. **`GET /api/career-map/taxonomy`**
   - Returns role taxonomy and relations
   - Used for transition difficulty calculation

2. **`POST /api/career-map/infer`**
   - Accepts jobs, returns inferred role families and domains
   - Used to suggest life directions

If backend is unavailable, falls back to local keyword-based inference.

---

## Architecture

### Search Flow (New)

```
User types search term
    ↓
useSimpleJobs hook
    ↓
simpleSearchService.fetchJobsSimple()
    ↓
Backend hybrid search (fast)
    ↓
Simple client-side filters (boolean match)
    ↓
Display jobs (no reordering, no scoring)
```

### Career Map Flow

```
User's jobs/profile
    ↓
buildCareerMapState()
    ↓
Backend inference (or local fallback)
    ↓
Inferred life directions
    ↓
User selects direction
    ↓
Load roles for that direction
    ↓
User selects role
    ↓
Navigate to matching jobs
```

---

## Next Steps

### To integrate the new search:

1. **Replace `usePaginatedJobs` with `useSimpleJobs`** in `App.tsx`:
   ```typescript
   // Old
   const { jobs, loading, ... } = usePaginatedJobs({ userProfile, ... });
   
   // New
   const { jobs, loading, ... } = useSimpleJobs({
     userLat: userProfile.coordinates?.lat,
     userLng: userProfile.coordinates?.lon,
     ...
   });
   ```

2. **Update filter UI** to use simple setters:
   ```typescript
   // Old: complex filter toggles
   toggleBenefitFilter('dog_friendly');
   
   // New: simple setter
   setFilterBenefits(['dog_friendly']);
   ```

3. **Remove old complex filters** from `AppHeader.tsx` and `CareerOSCandidateWorkspace.tsx`

### To integrate career map:

1. **Add CareerMapSelector to your view**:
   ```typescript
   import CareerMapSelector from './components/CareerMap/CareerMapSelector';
   
   // In your career view component
   <CareerMapSelector
     jobs={jobs}
     currentRole={userProfile.currentRole}
     onRoleSelect={handleRoleSelect}
   />
   ```

2. **Connect to job filtering** - when user selects a role, filter jobs:
   ```typescript
   const handleRoleSelect = (role: CareerRole) => {
     // Filter jobs by role family
     setFilterRoleFamily(role.role_family);
   };
   ```

3. **Add to navigation** - career map can be a tab/scene in `AppSceneRouter`

---

## File Summary

### New Files (Search)
- `services/simpleSearchService.ts` - Clean search service
- `hooks/useSimpleJobs.ts` - Simple job fetching hook

### New Files (Career Map)
- `types/careerMap.ts` - Type definitions and life directions
- `services/careerMapService.ts` - Career map service with backend integration
- `components/CareerMap/CareerMapSelector.tsx` - Clean UI component

### Old Files (Still exist, not modified)
- `services/jobService.ts` - Complex search (3451 lines) - **can be deprecated**
- `hooks/usePaginatedJobs.ts` - Complex hook (994 lines) - **can be deprecated**
- `hooks/discovery/discoverySafeguards.ts` - Safeguards - **can be removed**
- `hooks/discovery/discoveryFetchPipeline.ts` - Complex pipeline - **can be removed**

---

## Benefits

### Search
✅ **Fast** - No complex scoring, just boolean matching
✅ **Predictable** - Same query = same results (no profile-based reordering)
✅ **Transparent** - Users understand why jobs appear
✅ **No zero results** - Removed aggressive filtering that cleared results
✅ **Maintainable** - 340 lines vs 3451 lines

### Career Map
✅ **Decision-focused** - Shows directions, not just jobs
✅ **Personal** - Based on user's tensions and goals
✅ **Actionable** - Each direction has concrete roles
✅ **Readable** - Clear, visual, understandable
✅ **Backend-integrated** - Uses existing taxonomy and inference APIs
