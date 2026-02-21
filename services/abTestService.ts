interface ABTestVariant {
    id: string;
    name: string;
    config: Record<string, any>;
    weight: number; // Percentage allocation (0-100)
}

interface ABTest {
    id: string;
    name: string;
    variants: ABTestVariant[];
    enabled: boolean;
    startDate?: string;
    endDate?: string;
}

interface ABTestConfig {
    [testId: string]: ABTest;
}

class ABTestService {
    private static storageKey = 'jobshaman_ab_tests';
    private static userVariants: Record<string, string> = {};

    /**
     * Define A/B tests configuration
     */
    private static getTests(): ABTestConfig {
        return {
            pricing_display_test: {
                id: 'pricing_display_test',
                name: 'Pricing Display Format',
                enabled: true,
                variants: [
                    {
                        id: 'current',
                        name: 'Current Format',
                        config: {
                            showMonthly: true,
                            showAnnual: false,
                            highlightAnnual: false,
                            ctaText: 'Aktivovat Professional',
                            priceDisplay: '999 €/měsíc'
                        },
                        weight: 50
                    },
                    {
                        id: 'annual_discount',
                        name: 'Annual Discount Format',
                        config: {
                            showMonthly: true,
                            showAnnual: true,
                            highlightAnnual: true,
                            ctaText: 'Ušetřete 10% - Roční plán',
                            priceDisplay: '10 789 €/rok (999 €/měsíc)',
                            originalPrice: '999 €/měsíc'
                        },
                        weight: 30
                    },
                    {
                        id: 'value_proposition',
                        name: 'Value Proposition Format',
                        config: {
                            showMonthly: true,
                            showAnnual: false,
                            highlightAnnual: false,
                            ctaText: 'Zrychlete nábor o 40%',
                            priceDisplay: 'Investice: 999 €/měsíc',
                            valueProps: ['Neomezené inzeráty', 'AI Assessmenty', 'Rychlejší nábor']
                        },
                        weight: 20
                    }
                ]
            },
            upgrade_modal_test: {
                id: 'upgrade_modal_test',
                name: 'Upgrade Modal Design',
                enabled: false, // Disabled by default
                variants: [
                    {
                        id: 'current',
                        name: 'Current Design',
                        config: {
                            layout: 'two_column',
                            showComparison: true,
                            socialProof: false
                        },
                        weight: 70
                    },
                    {
                        id: 'minimal',
                        name: 'Minimal Design',
                        config: {
                            layout: 'single_column',
                            showComparison: false,
                            socialProof: true
                        },
                        weight: 30
                    }
                ]
            },
            welcome_hero_test: {
                id: 'welcome_hero_test',
                name: 'Welcome Hero Messaging',
                enabled: true,
                variants: [
                    {
                        id: 'problem_first',
                        name: 'Problem First',
                        config: {
                            messagingStyle: 'problem'
                        },
                        weight: 34
                    },
                    {
                        id: 'aspiration_first',
                        name: 'Aspiration First',
                        config: {
                            messagingStyle: 'aspiration'
                        },
                        weight: 33
                    },
                    {
                        id: 'efficiency_first',
                        name: 'Efficiency First',
                        config: {
                            messagingStyle: 'efficiency'
                        },
                        weight: 33
                    }
                ]
            }
        };
    }

    /**
     * Get user's variant for a specific test
     */
    static getVariant(testId: string): ABTestVariant | null {
        const tests = this.getTests();
        const test = tests[testId];
        
        if (!test || !test.enabled) {
            return null;
        }

        // Check if user already has a variant assigned
        if (this.userVariants[testId]) {
            const variant = test.variants.find(v => v.id === this.userVariants[testId]);
            return variant || test.variants[0];
        }

        // Assign variant based on weighted random selection
        const random = Math.random() * 100;
        let cumulativeWeight = 0;
        
        for (const variant of test.variants) {
            cumulativeWeight += variant.weight;
            if (random < cumulativeWeight) {
                this.userVariants[testId] = variant.id;
                this.saveUserVariants();
                return variant;
            }
        }

        // Fallback to first variant
        this.userVariants[testId] = test.variants[0].id;
        this.saveUserVariants();
        return test.variants[0];
    }

    /**
     * Get configuration for a test variant
     */
    static getConfig(testId: string): Record<string, any> {
        const variant = this.getVariant(testId);
        return variant?.config || {};
    }

    /**
     * Check if user is in specific variant
     */
    static isVariant(testId: string, variantId: string): boolean {
        const variant = this.getVariant(testId);
        return variant?.id === variantId;
    }

    /**
     * Track conversion event for A/B test
     */
    static trackConversion(testId: string, event: string, value?: number) {
        const variant = this.getVariant(testId);
        if (!variant) return;

        console.log('🧪 A/B Test Conversion:', {
            testId,
            variantId: variant.id,
            variantName: variant.name,
            event,
            value,
            timestamp: new Date().toISOString()
        });

        // In production, send to analytics:
        // fetch('/api/ab-test-conversion', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({
        //         testId,
        //         variantId: variant.id,
        //         event,
        //         value,
        //         timestamp: Date.now()
        //     })
        // });
    }

    /**
     * Get all active tests for user
     */
    static getUserTests(): Record<string, { test: ABTest; variant: ABTestVariant }> {
        const tests = this.getTests();
        const result: Record<string, { test: ABTest; variant: ABTestVariant }> = {};

        for (const [testId, test] of Object.entries(tests)) {
            if (test.enabled) {
                const variant = this.getVariant(testId);
                if (variant) {
                    result[testId] = { test, variant };
                }
            }
        }

        return result;
    }

    /**
     * Reset user's A/B test assignments (for testing)
     */
    static resetAssignments(): void {
        this.userVariants = {};
        localStorage.removeItem(this.storageKey);
    }

    /**
     * Load user variants from localStorage
     */
    private static loadUserVariants(): void {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.userVariants = JSON.parse(stored);
            }
        } catch (error) {
            console.error('Failed to load A/B test variants:', error);
        }
    }

    /**
     * Save user variants to localStorage
     */
    private static saveUserVariants(): void {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.userVariants));
        } catch (error) {
            console.error('Failed to save A/B test variants:', error);
        }
    }

    /**
     * Initialize A/B testing service
     */
    static init(): void {
        this.loadUserVariants();
        
        // Log user's test assignments for debugging
        const userTests = this.getUserTests();
        if (Object.keys(userTests).length > 0) {
            console.log('🧪 A/B Tests Active:', 
                Object.entries(userTests).map(([testId, { test, variant }]) => ({
                    testId,
                    testName: test.name,
                    variantId: variant.id,
                    variantName: variant.name
                }))
            );
        }
    }
}

// Initialize on import
ABTestService.init();

export default ABTestService;
