
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from both root and backend just in case
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, 'backend', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchJob() {
    console.log("Searching for Job ID 17080...");

    // Try primary key first
    let { data: job, error } = await supabase
        .from('jobs')
        .select('*')
        .eq('id', 17080)
        .maybeSingle();

    if (error) {
        console.error("Error fetching by ID:", error);
    }

    if (!job) {
        console.log("Job not found by ID 17080. Searching for jobs with '17080' in URL or other fields...");
        const { data: searchData, error: searchError } = await supabase
            .from('jobs')
            .select('*')
            .or('url.ilike.%17080%,description.ilike.%17080%,title.ilike.%17080%')
            .limit(5);

        if (searchError) console.error("Search error:", searchError);
        if (searchData && searchData.length > 0) {
            console.log(`Found ${searchData.length} potential matches.`);
            job = searchData[0];
        }
    }

    if (job) {
        console.log("--- JOB FOUND ---");
        console.log("ID:", job.id);
        console.log("Title:", job.title);
        console.log("Company:", job.company);
        console.log("URL:", job.url);
        console.log("Description (first 500 chars):", job.description ? job.description.substring(0, 500) : "NULL");
        console.log("JHI Score:", job.jhi_score);
        console.log("Legality Status:", job.legality_status);
        console.log("AI Analysis:", JSON.stringify(job.ai_analysis, null, 2));
    } else {
        console.log("Job 17080 not found in database.");
    }
}

fetchJob();
