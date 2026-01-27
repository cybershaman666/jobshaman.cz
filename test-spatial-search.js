// Test the PostGIS spatial implementation
// This script verifies the spatial search functionality

import { fetchJobsPaginated } from '../services/jobService';

async function testSpatialSearch() {
    console.log('🧪 Testing PostGIS spatial search implementation...\n');

    // Test Case 1: Popice (your location)
    console.log('📍 Test 1: Search jobs within 50km of Popice');
    const popiceResult = await fetchJobsPaginated(
        0,      // page
        10,     // pageSize (small for testing)
        48.92722, // Popice latitude
        16.66667, // Popice longitude  
        50        // radiusKm
    );
    
    console.log('Popice Results:', {
        jobsFound: popiceResult.jobs.length,
        hasMore: popiceResult.hasMore,
        totalCount: popiceResult.totalCount,
        sampleJobs: popiceResult.jobs.slice(0, 3).map(j => ({
            title: j.title,
            location: j.location,
            distance: j.distance_km
        }))
    });
    
    // Test Case 2: Prague (should get different results)
    console.log('\n📍 Test 2: Search jobs within 30km of Prague');
    const pragueResult = await fetchJobsPaginated(
        0,
        10,
        50.0755,  // Prague latitude
        14.4378,  // Prague longitude
        30        // radiusKm
    );
    
    console.log('Prague Results:', {
        jobsFound: pragueResult.jobs.length,
        hasMore: pragueResult.hasMore,
        totalCount: pragueResult.totalCount,
        sampleJobs: pragueResult.jobs.slice(0, 3).map(j => ({
            title: j.title,
            location: j.location,
            distance: j.distance_km
        }))
    });

    // Test Case 3: No location parameters (fallback)
    console.log('\n📍 Test 3: Fallback without location (should work)');
    const fallbackResult = await fetchJobsPaginated(0, 5);
    
    console.log('Fallback Results:', {
        jobsFound: fallbackResult.jobs.length,
        hasMore: fallbackResult.hasMore,
        totalCount: fallbackResult.totalCount,
        sampleJobs: fallbackResult.jobs.slice(0, 3).map(j => ({
            title: j.title,
            location: j.location
        }))
    });

    // Test Case 4: Large radius (should get more jobs)
    console.log('\n📍 Test 4: Large radius search (100km from Popice)');
    const largeRadiusResult = await fetchJobsPaginated(
        0,
        10,
        48.92722,
        16.66667,
        100   // 100km radius
    );
    
    console.log('Large Radius Results:', {
        jobsFound: largeRadiusResult.jobs.length,
        hasMore: largeRadiusResult.hasMore,
        totalCount: largeRadiusResult.totalCount
    });

    console.log('\n✅ Spatial search testing completed!');
    console.log('Expected behavior:');
    console.log('- Popice should return 200-500 jobs within 50km');
    console.log('- Prague should return different set of jobs');
    console.log('- Fallback should return newest jobs regardless of location');
    console.log('- Large radius should return more jobs than small radius');
}

// Run the test
testSpatialSearch().catch(console.error);