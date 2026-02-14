import { BACKEND_URL } from '../constants';
import { authenticatedFetch } from './csrfService';

export type JobInteractionEventType =
    | 'impression'
    | 'swipe_left'
    | 'swipe_right'
    | 'open_detail'
    | 'apply_click'
    | 'save'
    | 'unsave';

export interface JobInteractionPayload {
    jobId: string | number;
    eventType: JobInteractionEventType;
    dwellTimeMs?: number;
    sessionId?: string;
    requestId?: string;
    signalValue?: number;
    scrollDepth?: number;
    scoringVersion?: string;
    modelVersion?: string;
    metadata?: Record<string, any>;
}

export const trackJobInteraction = async (payload: JobInteractionPayload): Promise<void> => {
    try {
        const response = await authenticatedFetch(`${BACKEND_URL}/jobs/interactions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: typeof payload.jobId === 'string' ? parseInt(payload.jobId, 10) : payload.jobId,
                event_type: payload.eventType,
                dwell_time_ms: payload.dwellTimeMs ?? null,
                session_id: payload.sessionId ?? null,
                request_id: payload.requestId ?? null,
                signal_value: payload.signalValue ?? null,
                scroll_depth: payload.scrollDepth ?? null,
                scoring_version: payload.scoringVersion ?? null,
                model_version: payload.modelVersion ?? null,
                metadata: payload.metadata ?? null
            })
        });

        if (!response.ok) {
            console.warn('⚠️ Failed to track job interaction:', response.status, response.statusText);
        }
    } catch (error) {
        console.warn('⚠️ Error tracking job interaction:', error);
    }
};
