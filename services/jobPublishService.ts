import { supabase } from './supabaseService';

const BACKEND_URL = 'https://jobshaman-cz.onrender.com';

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
}

export const publishJob = async (jobData: PublishJobRequest) => {
    if (!supabase) throw new Error("Supabase is not configured");

    try {
        // 1. Insert into Supabase
        const { data, error } = await supabase
            .from('jobs')
            .insert({
                ...jobData,
                legality_status: 'pending', // Initial status before AI check
                scraped_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;

        // 2. Trigger Legality Check on Render
        // We don't await this to avoid blocking the UI, but we could if we want immediate feedback
        fetch(`${BACKEND_URL}/check-legality`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: data.id,
                title: data.title,
                company: data.company,
                description: data.description
            }),
        }).catch(err => console.error("Legality check trigger failed:", err));

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
