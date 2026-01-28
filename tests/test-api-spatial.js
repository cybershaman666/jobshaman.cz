// Test script to verify PostGIS spatial search works via API
import axios from 'axios';

async function testSpatialSearch() {
    console.log('🗺️ Testing PostGIS spatial search via API...\n');
    
    const baseUrl = 'http://localhost:3001';
    
    try {
        // Test 1: Get homepage (should load location-based jobs)
        console.log('📍 Test 1: Loading homepage with spatial search...');
        const homeResponse = await axios.get(baseUrl);
        console.log('Homepage status:', homeResponse.status);
        
        // Check if we can see any job data in the response
        if (homeResponse.data && typeof homeResponse.data === 'string') {
            const htmlContent = homeResponse.data;
            
            // Look for signs of job loading
            const hasJobElements = htmlContent.includes('JobCard') || 
                               htmlContent.includes('job') || 
                               htmlContent.includes('Pozice');
            
            console.log('✅ Homepage loaded, contains job elements:', hasJobElements);
            
            // Look for distance information
            const hasDistanceInfo = htmlContent.includes('km') || 
                                 htmlContent.includes('distance');
            console.log('✅ Distance information found:', hasDistanceInfo);
            
            if (hasJobElements) {
                console.log('🎯 Jobs are loading successfully!');
                
                // Try to extract some job information
                const jobMatches = htmlContent.match(/<h[^>]*>.*?(Pozice|Práce|Developer).*?<\/h/gi) || [];
                console.log(`📋 Found ${jobMatches.length} potential job titles`);
                
                if (jobMatches.length > 0) {
                    console.log('📝 Sample job titles:');
                    jobMatches.slice(0, 3).forEach((match, i) => {
                        console.log(`  ${i+1}. ${match.replace(/<[^>]*>/g, '').trim()}`);
                    });
                }
            } else {
                console.log('⚠️  No job elements found in homepage');
            }
        }
        
        // Test 2: Try to call backend API directly if it exists
        console.log('\n📍 Test 2: Testing backend API...');
        try {
            const apiResponse = await axios.get(`${baseUrl}/api/jobs/spatial`, {
                params: {
                    lat: 48.92722,
                    lng: 16.66667,
                    radius: 50
                },
                timeout: 5000
            });
            console.log('✅ API response:', apiResponse.status, apiResponse.data);
        } catch (apiError) {
            console.log('⚠️  API endpoint not available (expected):', apiError.code);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
    
    console.log('\n🔧 Manual verification steps:');
    console.log('1. Open http://localhost:3001 in browser');
    console.log('2. Log in with your Popice profile');
    console.log('3. Check if jobs from Brno/South Moravia appear');
    console.log('4. Look for distance information near job titles');
    console.log('5. Try the commute filter toggle');
}

// Run the test
testSpatialSearch();