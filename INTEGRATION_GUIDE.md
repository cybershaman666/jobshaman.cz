# Integration Guide - Clean Search & Career Map

## Quick Start

### 1. Using the Clean Search

Replace your current complex search with the simple version:

**In App.tsx or your main component:**

```typescript
// OLD (complex):
import { usePaginatedJobs } from './hooks/usePaginatedJobs';

const { jobs, loading, performSearch, ... } = usePaginatedJobs({
  userProfile,
  initialPageSize: 50,
  // ... many complex options
});

// NEW (simple):
import { useSimpleJobs } from './hooks/useSimpleJobs';

const {
  jobs,
  loading,
  loadingMore,
  hasMore,
  totalCount,
  performSearch,
  loadMore,
  // Filter setters
  setSearchTerm,
  setFilterWorkArrangement,
  setFilterDatePosted,
  setFilterMinSalary,
  clearAllFilters
} = useSimpleJobs({
  userLat: userProfile.coordinates?.lat,
  userLng: userProfile.coordinates?.lon,
  pageSize: 50,
  sortBy: 'newest' // or 'relevance', 'salary_desc', 'distance'
});

// Use it
<input 
  type="text"
  placeholder="Search jobs..."
  onChange={(e) => performSearch(e.target.value)}
/>

<button onClick={() => setFilterWorkArrangement('remote')}>
  Remote only
</button>

{jobs.map(job => <JobCard key={job.id} job={job} />)}

{hasMore && (
  <button onClick={loadMore} disabled={loadingMore}>
    {loadingMore ? 'Loading...' : 'Load more'}
  </button>
)}
```

### 2. Using the Career Map

**In your career view component:**

```typescript
import CareerMapSelector from './components/CareerMap/CareerMapSelector';
import { CareerRole } from './types/careerMap';

function CareerView({ jobs }) {
  const handleRoleSelect = (role: CareerRole) => {
    console.log('User selected role:', role.title);
    // Filter jobs by this role's family
    // Or navigate to jobs matching this role
  };

  const handleDirectionChange = (directionId) => {
    console.log('User selected direction:', directionId);
    // Track user's career decision
  };

  return (
    <div>
      <h2>Career Map</h2>
      <CareerMapSelector
        jobs={jobs}
        currentRole={userProfile.currentRole}
        onRoleSelect={handleRoleSelect}
        onDirectionChange={handleDirectionChange}
        locale="cs" // or "en", "sk", "de", "pl"
      />
    </div>
  );
}
```

## Filter Options

### useSimpleJobs Options

```typescript
interface UseSimpleJobsOptions {
  // Location (for radius filtering)
  userLat?: number;
  userLng?: number;
  
  // All filters
  searchTerm?: string;
  filterCity?: string;
  filterWorkArrangement?: 'all' | 'remote' | 'hybrid' | 'onsite';
  remoteOnly?: boolean;
  filterContractTypes?: string[]; // ['ico', 'hpp', 'brigada', 'part-time']
  filterExperienceLevels?: string[]; // ['junior', 'medior', 'senior', 'lead']
  filterBenefits?: string[];
  filterMinSalary?: number;
  filterDatePosted?: string; // 'all', '24h', '3d', '7d', '14d'
  countryCodes?: string[]; // ['cz', 'sk']
  excludeCountryCodes?: string[];
  filterLanguageCodes?: string[]; // ['cs', 'sk', 'en']
  
  // Sorting
  sortBy?: 'newest' | 'relevance' | 'salary_desc' | 'distance';
  
  // Pagination
  pageSize?: number;
  
  // Feature flags
  microJobsOnly?: boolean;
  enabled?: boolean;
}
```

## Career Map Life Directions

The career map has 8 life directions with tensions:

1. 🏠 **More Remote Time** - Remote vs Local Impact
2. 🎨 **Less Routine** - Stay Safe vs Explore  
3. 💰 **Higher Income** - Earn More vs Work Less
4. 🌟 **More Meaning** - Purpose vs Security
5. 🏛️ **Stronger Stability** - Stay Safe vs Grow Fast
6. ⚖️ **Better Work-Life Balance** - Life First vs Career First
7. 🚀 **Faster Growth** - Specialize vs Explore
8. 🎯 **More Autonomy** - Lead vs Build

## Architecture

### What was removed from search:
- ❌ Complex scoring (140/80/45/32 point weights)
- ❌ Profile-based reordering
- ❌ External job capping (max 2 in first 8)
- ❌ Aggressive safeguards that zero results
- ❌ Multiple fallback heuristics
- ❌ Discovery filter source tracking

### What was added:
- ✅ Simple boolean matching (job matches or doesn't)
- ✅ Clean, understandable filters
- ✅ Fast backend search with minimal client processing
- ✅ Predictable results (same query = same results)
- ✅ Career map for decision-based navigation

## Migration Path

### Phase 1: Parallel Run (Recommended)
1. Keep old `usePaginatedJobs` running
2. Add `useSimpleJobs` alongside it
3. Compare results
4. Switch when confident

### Phase 2: Career Map Integration  
1. Add CareerMapSelector to a test view
2. Connect to real job data
3. Test with users
4. Integrate into main navigation

### Phase 3: Deprecate Old Code
1. Remove `usePaginatedJobs` usage
2. Delete `discoverySafeguards.ts`
3. Delete `discoveryFetchPipeline.ts`
4. Simplify `AppHeader.tsx` filters

## Testing

### Test the search:
```typescript
// Should return results, not zero out
const { jobs } = useSimpleJobs({
  searchTerm: 'developer',
  filterWorkArrangement: 'remote'
});
console.log(jobs.length); // Should be > 0 if you have jobs
```

### Test the career map:
```typescript
// Should infer directions from jobs
<CareerMapSelector 
  jobs={yourJobs}
  onDirectionChange={(dir) => console.log('Direction:', dir)}
/>
```

## Performance

- **Search**: ~100-300ms (backend hybrid search)
- **Career Map**: ~200-500ms initial load (inference), instant after
- **Memory**: Minimal (no complex caching or scoring)

## Next Steps

1. **Integrate into your app** - Replace old search components
2. **Test with real data** - Verify results quality
3. **Tweak filters** - Add/remove based on user feedback
4. **Career map expansion** - Add more roles, better backend integration
5. **User feedback** - Track which directions users select most

## Support

- See `CLEANUP_SUMMARY.md` for full architecture details
- Check `types/careerMap.ts` for all life direction definitions
- Review `services/simpleSearchService.ts` for filter logic
