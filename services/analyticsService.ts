interface AnalyticsEvent {
    event: string;
    userId?: string;
    companyId?: string;
    feature?: string;
    tier?: string;
    timestamp: number;
    metadata?: Record<string, any>;
}

class AnalyticsService {
    private static events: AnalyticsEvent[] = [];

    /**
     * Track upgrade trigger event
     */
    static trackUpgradeTrigger(data: {
        userId?: string;
        companyId?: string;
        feature: string;
        currentTier: string;
        reason: string;
        metadata?: Record<string, any>;
    }) {
        const event: AnalyticsEvent = {
            event: 'upgrade_triggered',
            userId: data.userId,
            companyId: data.companyId,
            feature: data.feature,
            tier: data.currentTier,
            timestamp: Date.now(),
            metadata: {
                reason: data.reason,
                ...data.metadata
            }
        };

        this.events.push(event);
        this.logEvent(event);
    }

    /**
     * Track successful upgrade
     */
    static trackUpgradeSuccess(data: {
        userId?: string;
        companyId?: string;
        newTier: string;
        paymentType: 'subscription' | 'one_time';
        amount?: number;
    }) {
        const event: AnalyticsEvent = {
            event: 'upgrade_success',
            userId: data.userId,
            companyId: data.companyId,
            tier: data.newTier,
            timestamp: Date.now(),
            metadata: {
                paymentType: data.paymentType,
                amount: data.amount
            }
        };

        this.events.push(event);
        this.logEvent(event);
    }

    /**
     * Track feature usage
     */
    static trackFeatureUsage(data: {
        userId?: string;
        companyId?: string;
        feature: string;
        tier: string;
    }) {
        const event: AnalyticsEvent = {
            event: 'feature_used',
            userId: data.userId,
            companyId: data.companyId,
            feature: data.feature,
            tier: data.tier,
            timestamp: Date.now()
        };

        this.events.push(event);
        this.logEvent(event);
    }

    /**
     * Log event to console (in production, send to analytics backend)
     */
    private static logEvent(event: AnalyticsEvent) {
        console.log('📊 Analytics Event:', {
            event: event.event,
            userId: event.userId,
            companyId: event.companyId,
            feature: event.feature,
            tier: event.tier,
            timestamp: new Date(event.timestamp).toISOString(),
            metadata: event.metadata
        });

        // In production, send to analytics endpoint:
        // fetch('/api/analytics', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(event)
        // });
    }

    /**
     * Get all events (for debugging/reporting)
     */
    static getEvents(): AnalyticsEvent[] {
        return [...this.events];
    }

    /**
     * Get upgrade trigger analytics
     */
    static getUpgradeAnalytics(): {
        totalTriggers: number;
        featureBreakdown: Record<string, number>;
        tierBreakdown: Record<string, number>;
        recentTriggers: AnalyticsEvent[];
    } {
        const upgradeTriggers = this.events.filter(e => e.event === 'upgrade_triggered');
        
        const featureBreakdown: Record<string, number> = {};
        const tierBreakdown: Record<string, number> = {};
        
        upgradeTriggers.forEach(trigger => {
            if (trigger.feature) {
                featureBreakdown[trigger.feature] = (featureBreakdown[trigger.feature] || 0) + 1;
            }
            if (trigger.tier) {
                tierBreakdown[trigger.tier] = (tierBreakdown[trigger.tier] || 0) + 1;
            }
        });

        return {
            totalTriggers: upgradeTriggers.length,
            featureBreakdown,
            tierBreakdown,
            recentTriggers: upgradeTriggers.slice(-10).reverse()
        };
    }
}

export default AnalyticsService;