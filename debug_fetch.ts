
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://frquoinhhxkxnvcyomtr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZycXVvaW5oaHhreG52Y3lvbXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4ODMyMzUsImV4cCI6MjA4NDQ1OTIzNX0.cJyu1wUtcCjzWkd_MfXJhrF5d0XV0i622PrpbzM3lWs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function debugJobs() {
    console.log("Debugging jobs (checking lat/lng)...");

    const { data, error } = await supabase
        .from('jobs')
        .select('id, title, country_code, lat, lng')
        .eq('country_code', 'at')
        .order('id', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (data) {
        data.forEach(job => {
            console.log(`Job ${job.id} | AT | Lat: ${job.lat}, Lng: ${job.lng} | Title: ${job.title.substring(0, 30)}...`);
        });
    }
}

debugJobs();
