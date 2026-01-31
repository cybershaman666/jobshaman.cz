import { supabase } from './supabaseService';
import { geocodeWithCaching } from './geocodingService';

import { BACKEND_URL } from '../constants';

export interface PublishJobRequest {
    title: string;
    company: string;
    description: string;
    location: string;
    salary_from?: number;
    salary_to?: number;
    contract_type?: string;
    benefits?: string[];
    source?: string;
    contact_email?: string;
    workplace_address?: string;
    company_id?: string;
    work_type?: string;
}

export const publishJob = async (jobData: PublishJobRequest) => {
    if (!supabase) throw new Error("Supabase is not configured");

    try {
        // 0. Geocode Address
        let lat = null;
        let lng = null;
        const addressToGeocode = jobData.workplace_address || jobData.location;

        if (addressToGeocode) {
            try {
                const coords = await geocodeWithCaching(addressToGeocode);
                if (coords) {
                    lat = coords.lat;
                    lng = coords.lon;
                }
            } catch (err) {
                console.warn("Geocoding failed for new job:", err);
            }
        }

        // 1. Insert into Supabase
        const { data, error } = await supabase
            .from('jobs')
            .insert({
                ...jobData,
                lat,
                lng,
                company_id: jobData.company_id,
                legality_status: 'pending', // Initial status before AI check
                scraped_at: new Date().toISOString(),
                source: jobData.source || 'jobshaman.cz'
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Generate and update internal URL for manual postings if missing
        if (!data.url) {
            const internalUrl = `https://jobshaman.cz/jobs/${data.id}`;
            const { error: updateError } = await supabase
                .from('jobs')
                .update({ url: internalUrl })
                .eq('id', data.id);

            if (!updateError) {
                data.url = internalUrl;
            } else {
                console.error("Failed to update job URL:", updateError);
            }
        }

        // 3. Trigger Legality Check on Render
        // We need the session to authorize the request
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        console.log(`🚀 [DEBUG] Triggering legality check for job ${data.id}...`);
        console.log(`📡 [DEBUG] Backend URL: ${BACKEND_URL}`);

        try {
            const response = await fetch(`${BACKEND_URL}/check-legality`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                    id: data.id,
                    title: data.title,
                    company: data.company,
                    description: data.description,
                    location: data.location
                }),
            });

            const result = await response.json();
            if (response.ok) {
                console.log(`✅ [DEBUG] Legality check completed for job ${data.id}:`, result);
            } else {
                console.error(`❌ [DEBUG] Legality check failed for job ${data.id} with status ${response.status}:`, result);
                // We don't throw here to avoid blocking the UI success message, 
                // but the job will remain 'pending' in the dashboard.
            }
        } catch (err) {
            console.error("❌ [DEBUG] Legality check trigger network error:", err);
        }

        return data;
    } catch (error) {
        console.error("Failed to publish job:", error);
        throw error;
    }
};

export const getCandidateMatches = async (jobId: string | number) => {
    try {
        const response = await fetch(`${BACKEND_URL}/match-candidates?job_id=${jobId}`, {
            method: 'POST'
        });
        return await response.json();
    } catch (error) {
        console.error("Failed to fetch candidate matches:", error);
        throw error;
    }
};

export const triggerManualScrape = async () => {
    try {
        const response = await fetch(`${BACKEND_URL}/scrape`);
        return await response.json();
    } catch (error) {
        console.error("Manual scrape trigger failed:", error);
        throw error;
    }
};
