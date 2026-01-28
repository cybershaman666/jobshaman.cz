# 🔄 Transport Mode - Migration & Integration Guide

## Overview

Když budete chtít integrovat PostGIS a databázovou persistenci, tento guide vám ukáže přesně jak na to.

---

## Phase 1: PostGIS Distance Integration (Estimated: 2 hours)

### 1.1 Update transportService.ts

Přidat novou funkci pro výpočet vzdálenosti:

```typescript
// services/transportService.ts - add new function

/**
 * Calculate actual distance using PostGIS in Supabase
 */
export async function calculatePostGISDistance(
  userCoordinates: { lat: number; lng: number },
  jobCoordinates: { lat: number; lng: number }
): Promise<number> {
  // This will call your Supabase PostGIS function
  const { data, error } = await supabase.rpc('calculate_distance', {
    user_lat: userCoordinates.lat,
    user_lng: userCoordinates.lng,
    job_lat: jobCoordinates.lat,
    job_lng: jobCoordinates.lng
  });

  if (error) {
    console.error('PostGIS distance calculation failed:', error);
    return 5; // Fallback to 5km
  }

  return data || 5;
}
```

### 1.2 Update ProfileEditor.tsx

```typescript
// components/ProfileEditor.tsx - update TransportModeSelector props

import { calculatePostGISDistance } from '../services/transportService';

// Inside component:
const [commuteDist, setCommuteDist] = useState(5);

useEffect(() => {
  if (profile.coordinates && jobLocation?.coordinates) {
    calculatePostGISDistance(
      profile.coordinates,
      jobLocation.coordinates
    ).then(setCommuteDist);
  }
}, [profile.coordinates, jobLocation]);

// In render:
<TransportModeSelector
  distanceKm={commuteDist}  // Now real distance instead of 5
  selectedMode={profile.transportMode || 'public'}
  onModeChange={(mode) => onChange({...profile, transportMode: mode})}
/>
```

### 1.3 Database Migration

```sql
-- Create PostGIS function in Supabase
CREATE OR REPLACE FUNCTION calculate_distance(
  user_lat float8,
  user_lng float8,
  job_lat float8,
  job_lng float8
)
RETURNS float8 AS $$
BEGIN
  RETURN ST_Distance(
    ST_Point(user_lng, user_lat)::geography,
    ST_Point(job_lng, job_lat)::geography
  ) / 1000; -- Convert to km
END;
$$ LANGUAGE plpgsql;
```

---

## Phase 2: Database Persistence (Estimated: 1.5 hours)

### 2.1 Update user_profiles table

```sql
-- Add transport mode column if not exists
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS transport_mode varchar(20) DEFAULT 'public'
CHECK (transport_mode IN ('car', 'public', 'bike', 'walk'));

-- Add index for fast filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_transport_mode 
ON user_profiles(transport_mode);
```

### 2.2 Update ProfileEditor.tsx

```typescript
// Save to database on change
const handleTransportModeChange = async (mode: TransportMode) => {
  // Update local state
  onChange({...profile, transportMode: mode});

  // Save to database
  const { error } = await supabase
    .from('user_profiles')
    .update({ transport_mode: mode })
    .eq('id', profile.id);

  if (error) {
    console.error('Failed to save transport mode:', error);
    // Show error toast
  }
};

// Update component:
<TransportModeSelector
  // ... other props
  onModeChange={handleTransportModeChange}
/>
```

### 2.3 Load from Database

```typescript
// In ProfileEditor useEffect for loading profile

const loadProfile = async () => {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (data) {
    setProfile({
      ...data,
      transportMode: data.transport_mode as TransportMode
    });
  }
};
```

---

## Phase 3: Job Recommendation Integration (Estimated: 2 hours)

### 3.1 Create Job Filtering Service

```typescript
// services/jobFilteringService.ts

import { TransportMode, calculateTransportCost } from './transportService';

export interface JobAccessibilityCheck {
  isAccessible: boolean;
  commuteCost: number;
  commuteTime: number;
  affordability: 'high' | 'medium' | 'low';
}

export function isJobAccessible(
  job: Job,
  userProfile: UserProfile,
  maxMonthlyBudget: number = 2000 // default
): JobAccessibilityCheck {
  // Calculate distance between job and user
  const distance = calculateDistance(
    userProfile.coordinates,
    job.coordinates
  );

  // Get transport cost for user's preferred mode
  const cost = calculateTransportCost(
    distance,
    userProfile.transportMode || 'public',
    // city and country from profile
  );

  const isAccessible = cost.monthlyCost <= maxMonthlyBudget;
  const affordability = cost.monthlyCost < maxMonthlyBudget * 0.25 
    ? 'high' 
    : cost.monthlyCost < maxMonthlyBudget * 0.75 
      ? 'medium' 
      : 'low';

  return {
    isAccessible,
    commuteCost: cost.monthlyCost,
    commuteTime: cost.dailyTime,
    affordability
  };
}
```

### 3.2 Update Job Search Component

```typescript
// components/JobSearch.tsx

const filteredJobs = useMemo(() => {
  return jobs.filter(job => {
    const accessibility = isJobAccessible(
      job,
      profile,
      profile.maxCommuteBudget || 2000
    );
    return accessibility.isAccessible;
  });
}, [jobs, profile]);
```

### 3.3 Display Commute Info on Job Card

```typescript
// components/JobCard.tsx

const accessibility = isJobAccessible(job, userProfile);

<div className="mt-2 p-2 bg-slate-50 rounded">
  <p className="text-xs text-slate-600">
    Cesta do práce: ~{accessibility.commuteTime} minut, 
    {accessibility.commuteCost} Kč/měsíc
  </p>
  <div className="mt-1 h-1 bg-slate-200 rounded-full overflow-hidden">
    <div 
      className={`h-full ${
        accessibility.affordability === 'high' 
          ? 'bg-green-500' 
          : accessibility.affordability === 'medium'
            ? 'bg-yellow-500'
            : 'bg-red-500'
      }`}
      style={{
        width: `${
          Math.min(accessibility.commuteCost / profile.maxCommuteBudget, 1) * 100
        }%`
      }}
    />
  </div>
</div>
```

---

## Phase 4: Salary Adjustment Calculations (Estimated: 1.5 hours)

### 4.1 Create Salary Service

```typescript
// services/salaryAdjustmentService.ts

export function calculateSalaryAdjustment(
  baseOffer: number,
  userProfile: UserProfile,
  job: Job
): {
  adjustment: number;
  adjusted: number;
  breakdown: string;
} {
  // Calculate monthly commute cost
  const distance = calculateDistance(
    userProfile.coordinates,
    job.coordinates
  );

  const commuteCost = calculateTransportCost(distance, userProfile.transportMode)
    .monthlyCost;

  // Gross salary is typically 1.2x net (Czech approximation)
  const grossRequired = commuteCost * 12 / 0.8; // Simplification

  // Usually negotiate 50% of commute cost
  const adjustment = Math.round(commuteCost * 6); // 50% of yearly cost

  return {
    adjustment,
    adjusted: baseOffer + adjustment,
    breakdown: `Posunutí o ${adjustment} Kč/měsíc pro pokrytí dopravy (${commuteCost} Kč/měsíc)`
  };
}
```

### 4.2 Display in Salary Negotiation

```typescript
// components/SalaryNegotiation.tsx

const adjustment = calculateSalaryAdjustment(
  job.salary,
  profile,
  job
);

<div className="p-4 bg-amber-50 rounded-lg">
  <h3 className="font-bold text-amber-900">Doporučená smluvní úprava</h3>
  <p className="text-sm text-amber-800 mt-2">
    Vzhledem k vaší dopravě do práce ({adjustment.breakdown})
  </p>
  <p className="text-lg font-bold text-amber-900 mt-2">
    Doporučujeme: {adjustment.adjusted.toLocaleString('cs-CZ')} Kč/měsíc
  </p>
</div>
```

---

## Phase 5: Environmental Score (Optional, Estimated: 1 hour)

### 5.1 Create Carbon Score Service

```typescript
// services/carbonScoreService.ts

export function calculateCarbonEmissions(
  distanceKm: number,
  transportMode: TransportMode
): number {
  // Grams of CO2 per km
  const emissions = {
    car: 150,      // Petrol car average
    public: 45,    // Bus/train average
    bike: 0,
    walk: 0
  };

  return distanceKm * 2 * 22 * emissions[transportMode]; // Monthly emissions
}

export function getCarbonScore(mode: TransportMode): number {
  const scores = {
    walk: 100,
    bike: 95,
    public: 60,
    car: 10
  };
  return scores[mode];
}
```

### 5.2 Display in Transport Selector

```typescript
// In TransportModeSelector.tsx

const carbonScore = getCarbonScore(mode);
const yearlyEmissions = calculateCarbonEmissions(distanceKm, mode);

<div className="mt-2 text-xs text-slate-600">
  🌍 CO2: {yearlyEmissions.toLocaleString()} g/rok
  <span className="ml-2">Skóre: {carbonScore}/100</span>
</div>
```

---

## Testing Strategy

### Unit Tests for New Functions

```typescript
// services/jobFilteringService.test.ts

describe('Job Accessibility', () => {
  it('should mark jobs within budget as accessible', () => {
    const job = { coordinates: { lat: 50.08, lng: 14.44 } };
    const profile = { 
      coordinates: { lat: 50.07, lng: 14.43 },
      transportMode: 'public',
      maxCommuteBudget: 2000
    };

    const result = isJobAccessible(job, profile);
    expect(result.isAccessible).toBe(true);
  });
});
```

### Integration Tests

```typescript
// Test full flow: distance → cost → filtering
describe('Complete Job Filtering Flow', () => {
  it('should filter jobs by commute cost', async () => {
    // Setup
    const jobs = [
      { id: 1, coordinates: { lat: 50.08, lng: 14.44 } }, // Close
      { id: 2, coordinates: { lat: 50.50, lng: 15.00 } }  // Far
    ];

    // Test
    const filtered = jobs.filter(job => 
      isJobAccessible(job, profile, 500)
    );

    // Verify
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(1);
  });
});
```

---

## Database Schema Updates Summary

```sql
-- Phase 2: User preferences
ALTER TABLE user_profiles ADD COLUMN transport_mode varchar(20);

-- Phase 3: Job accessibility cache (optional, for performance)
CREATE TABLE job_accessibility (
  job_id uuid,
  user_id uuid,
  distance_km float,
  commute_cost_monthly int,
  is_accessible boolean,
  last_updated timestamp,
  PRIMARY KEY (job_id, user_id)
);

-- Phase 4: Salary history tracking (optional)
CREATE TABLE salary_offers (
  id uuid PRIMARY KEY,
  job_id uuid,
  user_id uuid,
  base_offer int,
  transport_adjustment int,
  final_offer int,
  accepted boolean,
  created_at timestamp
);
```

---

## Rollback Strategy

If something goes wrong:

```bash
# Rollback Phase 1 (PostGIS)
# - Revert to hardcoded 5km in TransportModeSelector
# - Remove calculatePostGISDistance import

# Rollback Phase 2 (Database)
# - Keep transport_mode column but don't save
# - Use local state only

# Rollback Phase 3 (Job Filtering)
# - Disable job filtering
# - Show all jobs regardless of accessibility

# Rollback Phase 4 (Salary)
# - Remove salary adjustment feature
# - Show base offer only

# Rollback Phase 5 (Carbon)
# - Remove carbon score display
# - Keep transport mode selection
```

---

## Performance Optimization Tips

1. **Cache PostGIS results** for 1 hour
2. **Batch job accessibility checks** instead of per-job
3. **Use memoization** for repeated calculations
4. **Index database columns** properly
5. **Lazy load** carbon scores
6. **Debounce** job filtering

---

## Success Criteria for Each Phase

### Phase 1 ✓
- [ ] Real distances from PostGIS
- [ ] Accurate cost calculations
- [ ] No performance degradation

### Phase 2 ✓
- [ ] Transport mode saves to database
- [ ] Loads correctly on page refresh
- [ ] No data loss

### Phase 3 ✓
- [ ] Jobs filtered by accessibility
- [ ] Commute info shows on job cards
- [ ] Users understand the filtering

### Phase 4 ✓
- [ ] Salary adjustments calculated
- [ ] Recommendations displayed
- [ ] Users can negotiate

### Phase 5 ✓
- [ ] Carbon scores shown
- [ ] Users understand impact
- [ ] Eco-friendly options highlighted

---

## Timeline & Resource Estimation

| Phase | Duration | Effort | Priority |
|-------|----------|--------|----------|
| 1. PostGIS | 2 hours | Medium | HIGH |
| 2. Database | 1.5 hours | Low | HIGH |
| 3. Job Filtering | 2 hours | Medium | MEDIUM |
| 4. Salary Adjust | 1.5 hours | Low | MEDIUM |
| 5. Carbon Score | 1 hour | Low | LOW |

**Total**: ~8 hours for complete implementation

---

## Support & Debugging

### Common Issues

1. **PostGIS not returning results**
   - Check Supabase function is deployed
   - Verify coordinates format
   - Check network tab for RPC calls

2. **Database saves failing**
   - Verify schema migration ran
   - Check RLS policies
   - Review error logs

3. **Job filtering performance**
   - Implement pagination
   - Add caching layer
   - Use indexes

4. **Salary calculations wrong**
   - Verify COMMUTE_COSTS constants
   - Check distance calculation
   - Review formula in calculateSalaryAdjustment

---

## References

- [Supabase PostGIS Docs](https://supabase.com/docs/guides/database/extensions/postgis)
- [Transport Mode Service API](./TRANSPORT_MODE_DOCUMENTATION.md)
- [Implementation Dashboard](./IMPLEMENTATION_DASHBOARD.md)

---

**Next Step**: Pick Phase 1 and follow the guide step-by-step!

Pokud máte otázky, koukněte do existující dokumentace nebo spusťte verify skript.
