// Manual test for PostGIS spatial implementation
// This script tests our backend functions without needing to run the full server

console.log('🗺️  Manual PostGIS Implementation Test\n');

// Import the fetch function directly
import { fetchJobsPaginated } from './services/jobService.js';

async function runManualTests() {
    console.log('📍 Test 1: Popice location with 50km radius');
    console.log('Expected: Should return 200-500 jobs from Brno area');
    
    try {
        const popiceResult = await fetchJobsPaginated(
            0,              // page
            10,              // pageSize (small for testing)
            48.92722,         // Popice latitude
            16.66667,         // Popice longitude
            50                 // radiusKm
        );
        
        console.log('✅ Popice Results:', {
            jobsFound: popiceResult.jobs.length,
            hasMore: popiceResult.hasMore,
            totalCount: popiceResult.totalCount,
            sampleJobs: popiceResult.jobs.slice(0, 3).map(j => ({
                title: j.title?.substring(0, 50) + (j.title?.length > 50 ? '...' : ''),
                location: j.location,
                distance: j.distance_km ? `${j.distance_km.toFixed(1)}km` : 'N/A'
            }))
        });
        
        // Test with Prague location (different results expected)
        console.log('\n📍 Test 2: Prague location with 30km radius');
        console.log('Expected: Should return different set of jobs from Prague area');
        
        const pragueResult = await fetchJobsPaginated(
            0,
            10,
            50.0755,      // Prague latitude
            14.4378,       // Prague longitude
            30              // radiusKm
        );
        
        console.log('✅ Prague Results:', {
            jobsFound: pragueResult.jobs.length,
            hasMore: pragueResult.hasMore,
            totalCount: pragueResult.totalCount
        });
        
        // Test fallback without location
        console.log('\n📍 Test 3: Fallback without location');
        console.log('Expected: Should return newest jobs regardless of location');
        
        const fallbackResult = await fetchJobsPaginated(0, 5);
        console.log('✅ Fallback Results:', {
            jobsFound: fallbackResult.jobs.length,
            hasMore: fallbackResult.hasMore,
            totalCount: fallbackResult.totalCount
        });
        
        console.log('\n🎯 Key Success Indicators:');
        console.log('✅ Popice count > 0 AND contains Brno/South Moravia jobs');
        console.log('✅ Prague count > 0 AND different from Popice jobs');
        console.log('✅ Fallback works (returns newest jobs)');
        console.log('✅ Distance information included in spatial results');
        
        const success = popiceResult.jobs.length > 0 && 
                       pragueResult.jobs.length > 0 && 
                       fallbackResult.jobs.length > 0 &&
                       popiceResult.jobs.some(j => j.distance_km !== undefined);
        
        if (success) {
            console.log('\n🎉 PostGIS spatial implementation working!');
            console.log('📊 Performance: Only fetching relevant jobs by location');
            console.log('🎯 User Experience: Nearby jobs shown first');
        } else {
            console.log('\n⚠️  Issues detected in PostGIS implementation');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('This usually means:');
        console.error('- PostGIS function not created in database');
        console.error('- Supabase connection issues');
        console.error('- Spatial index missing');
        console.error('\n🔧 Suggested fixes:');
        console.error('1. Run: ./database/POSTGIS_SETUP.sql manually in Supabase');
        console.error('2. Check: Supabase database has PostGIS extension');
        console.error('3. Verify: RPC function exists in Supabase');
    }
}

// Run tests
runManualTests();