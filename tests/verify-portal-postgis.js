
import { supabase } from './services/supabaseService';
import { publishJob } from './services/jobPublishService';

async function verifyPortalPostGIS() {
    console.log('🚀 Starting Verification for Portal Job PostGIS indexing...');

    const testJob = {
        title: "Test Job for PostGIS - Brno",
        company: "PostGIS Tester",
        description: "This is a test job to verify that geocoding works for portal-posted jobs. It should be geocoded to Brno coordinates.",
        location: "Brno, CZ",
        salary_from: 50000,
        contract_type: "Full-time"
    };

    try {
        console.log('1. Publishing test job...');
        const publishedData = await publishJob(testJob);
        const jobId = publishedData.id;
        console.log(`✅ Job published with ID: ${jobId}`);

        console.log('2. Waiting for background geocoding (5 seconds)...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        console.log('3. Verifying coordinates and geometry in Supabase...');
        const { data: job, error } = await supabase
            .from('jobs')
            .select('lat, lng, geom')
            .eq('id', jobId)
            .single();

        if (error) throw error;

        console.log('Results from database:');
        console.log(`   Lat: ${job.lat}`);
        console.log(`   Lng: ${job.lng}`);
        console.log(`   Geom: ${job.geom ? '✅ Exists' : '❌ Missing'}`);

        if (job.lat && job.lng && job.geom) {
            console.log('✨ SUCCESS: Portal job was correctly geocoded and PostGIS geometry was updated!');
        } else {
            console.log('❌ FAILURE: Geocoding or PostGIS update failed.');
        }

        // Cleanup
        // await supabase.from('jobs').delete().eq('id', jobId);
        // console.log('🧹 Test job cleaned up.');

    } catch (err) {
        console.error('❌ Verification failed:', err.message);
    }
}

// Note: This script needs to be run in an environment where Vite/modules are resolved.
// For manual verification, follow the steps in walkthrough.md.
// verifyPortalPostGIS();
