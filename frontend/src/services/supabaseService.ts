import { supabase, clearSupabaseAuthStorage, refreshSession } from './supabaseClient';
import { BACKEND_URL } from '../constants';
import { uploadExternalCandidateDocument } from './externalAssetService';
import { CVDocument } from '../types';

export { supabase, clearSupabaseAuthStorage, refreshSession };

// Analytics cooldowns
const ANALYTICS_NETWORK_COOLDOWN_MS = 120_000;
let analyticsNetworkCooldownUntil = 0;
let lastAnalyticsNetworkLogAt = 0;

const isLikelySupabaseNetworkError = (error: any): boolean => {
    const msg = String(error?.message || error || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();
    const status = Number(error?.status || error?.statusCode || 0);
    return (
        msg.includes('networkerror') ||
        msg.includes('failed to fetch') ||
        msg.includes('fetch resource') ||
        msg.includes('cors') ||
        msg.includes('statement timeout') ||
        code === '57014' ||
        status >= 500
    );
};

export const trackAnalyticsEvent = async (event: {
    event_type: string;
    user_id?: string;
    company_id?: string;
    feature?: string;
    tier?: string;
    metadata?: any;
}): Promise<void> => {
    const payload = {
        event_type: event.event_type,
        company_id: event.company_id || null,
        feature: event.feature || null,
        tier: event.tier || null,
        metadata: event.metadata || {}
    };

    const now = Date.now();
    const canTryBackend = BACKEND_URL && now >= analyticsNetworkCooldownUntil;

    if (canTryBackend) {
        try {
            const response = await fetch(`${BACKEND_URL.replace(/\/$/, '')}/analytics/track`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                keepalive: true,
                body: JSON.stringify(payload)
            });
            if (response.ok) return;
            if (response.status >= 500) {
                analyticsNetworkCooldownUntil = Date.now() + ANALYTICS_NETWORK_COOLDOWN_MS;
                if (Date.now() - lastAnalyticsNetworkLogAt > 30_000) {
                    console.warn('Analytics endpoint unavailable. Using fallback temporarily.');
                    lastAnalyticsNetworkLogAt = Date.now();
                }
            }
        } catch (error) {
            if (isLikelySupabaseNetworkError(error)) {
                analyticsNetworkCooldownUntil = Date.now() + ANALYTICS_NETWORK_COOLDOWN_MS;
                if (Date.now() - lastAnalyticsNetworkLogAt > 30_000) {
                    console.warn('Analytics endpoint unavailable. Using fallback temporarily.');
                    lastAnalyticsNetworkLogAt = Date.now();
                }
            } else {
                console.warn('Analytics backend track skipped:', error);
            }
        }
    }
};

const sanitizeFileName = (name: string): string => {
    return name
        .replace(/[^a-zA-Z0-9.\-_]/g, '_')
        .replace(/_{2,}/g, '_')
        .substring(0, 255);
};

export const uploadCVFile = async (_userId: string, file: File): Promise<string> => {
    const asset = await uploadExternalCandidateDocument(file);
    return asset.url;
};

export const uploadCVDocument = async (
    userId: string,
    file: File,
    meta: { label?: string; locale?: string } = {}
): Promise<CVDocument | null> => {
    if (!supabase) return null;

    try {
        const asset = await uploadExternalCandidateDocument(file);

        const insertPayload: any = {
            user_id: userId,
            file_name: asset.object_key || asset.path || `${userId}/${Date.now()}-${sanitizeFileName(file.name)}`,
            original_name: sanitizeFileName(file.name),
            file_url: asset.url,
            external_asset_id: asset.asset_id || null,
            file_size: file.size,
            content_type: file.type,
            is_active: false,
            label: meta.label || null,
            locale: meta.locale || null
        };

        const { data, error } = await supabase
            .from('cv_documents')
            .insert(insertPayload)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Upload CV document error:', error);
        throw error;
    }
};

export const updateUserCVSelection = async (userId: string, cvId: string): Promise<boolean> => {
    if (!supabase) return false;

    try {
        // First, set all CVs for this user to inactive
        await supabase
            .from('cv_documents')
            .update({ is_active: false })
            .eq('user_id', userId);

        // Then set the selected CV to active
        const { error } = await supabase
            .from('cv_documents')
            .update({
                is_active: true,
                last_used: new Date().toISOString()
            })
            .eq('id', cvId)
            .eq('user_id', userId);

        if (error) {
            console.error('CV selection update error:', error);
            return false;
        }
        return true;
    } catch (error) {
        console.error('CV selection update failed:', error);
        return false;
    }
};

export const updateCVDocumentParsedData = async (
    userId: string,
    cvId: string,
    parsedData: any
): Promise<boolean> => {
    if (!supabase) return false;
    try {
        const toJsonSafe = (value: any): any => {
            try {
                return JSON.parse(JSON.stringify(value, (_k, v) => {
                    if (v === undefined) return null;
                    if (typeof v === 'number' && !Number.isFinite(v)) return null;
                    return v;
                }));
            } catch {
                return {};
            }
        };

        const updatePayload: any = {
            parsed_data: toJsonSafe(parsedData || {}),
            parsed_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('cv_documents')
            .update(updatePayload)
            .eq('id', cvId)
            .eq('user_id', userId);

        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Update CV parsed data error:', error);
        return false;
    }
};
