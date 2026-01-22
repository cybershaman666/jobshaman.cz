import { ContextualRelevanceScore, FlaggedBenefit, WorkMode, JobType, LocationType, ScheduleType } from '../types';

// Benefit categories and their typical relevance patterns
const BENEFIT_CATEGORIES = {
  FLEXIBILITY: ['flexibilní začátek/konec', 'home office', 'remote work', 'flexibilní doba', 'práce z domova'],
  OFFICE_ENVIRONMENT: ['kávovar', 'ovoce v kanclu', 'pizza days', 'občerstvení', 'relaxační místnost', 'table football'],
  COMMUTING: ['služební auto', 'příspěvek na dopravu', 'parkovací místo', 'karta na MHD'],
  HEALTH_WELLNESS: ['multisport', 'sick days', 'zdravotní volno', 'penzijní připojištění', 'životní pojištění'],
  GROWTH: ['školení', 'kurzy', 'konference', 'vzdělávání', 'rozpočet na vzdělávání', 'kariérní růst'],
  FINANCIAL: ['esop', 'zaměstnanecké akcie', 'roční bonusy', '13. plat', 'stravenky', 'cafeteria'],
  EQUIPMENT: ['notebook', 'telefon', 'hardware', 'macbook']
};

// Rule engine for benefit relevance scoring
class ContextualRelevanceScorer {
  /**
   * Main scoring function that evaluates benefit relevance based on job context
   */
  calculateRelevanceScore(
    benefits: string[],
    workMode: WorkMode,
    jobType: JobType,
    locationType: LocationType = 'fixed',
    scheduleType: ScheduleType = 'fixed'
  ): ContextualRelevanceScore {
    const flaggedBenefits = this.evaluateBenefits(benefits, workMode, jobType, locationType, scheduleType);
    const score = this.calculateScore(flaggedBenefits);
    const summary = this.generateSummary(score, flaggedBenefits);

    return {
      contextual_relevance_score: score,
      flagged_benefits: flaggedBenefits,
      summary_text: summary
    };
  }

  /**
   * Evaluate each benefit's relevance based on job context
   */
  private evaluateBenefits(
    benefits: string[],
    workMode: WorkMode,
    jobType: JobType,
    _locationType: LocationType,
    scheduleType: ScheduleType
  ): FlaggedBenefit[] {
    return benefits.map(benefit => {
      const normalizedBenefit = benefit.toLowerCase().trim();
      
      // Determine benefit category
      const category = this.getBenefitCategory(normalizedBenefit);
      
      // Apply relevance rules based on job context
      const { relevance, explanation, weight } = this.applyRelevanceRules(
        normalizedBenefit,
        category,
        workMode,
        jobType,
        _locationType,
        scheduleType
      );

      return {
        benefit: benefit,
        relevance,
        explanation,
        weight
      };
    });
  }

  /**
   * Categorize benefit for rule application
   */
  private getBenefitCategory(benefit: string): string {
    for (const [category, keywords] of Object.entries(BENEFIT_CATEGORIES)) {
      if (keywords.some(keyword => benefit.includes(keyword))) {
        return category;
      }
    }
    return 'OTHER';
  }

  /**
   * Core relevance rules engine
   */
  private applyRelevanceRules(
    benefit: string,
    category: string,
    workMode: WorkMode,
    jobType: JobType,
    _locationType: LocationType,
    scheduleType: ScheduleType
  ): { relevance: 'relevant' | 'weakly_relevant' | 'context_mismatch', explanation: string, weight: number } {
    
    // FLEXIBILITY BENEFITS
    if (category === 'FLEXIBILITY') {
      if (workMode === 'remote' || workMode === 'hybrid') {
        return {
          relevance: 'relevant',
          explanation: 'Flexibility benefits are highly relevant for remote/hybrid roles',
          weight: 1.0
        };
      }
      if (workMode === 'onsite') {
        return {
          relevance: 'weakly_relevant',
          explanation: 'Some flexibility may apply to onsite roles with core hours',
          weight: 0.5
        };
      }
      if (workMode === 'field') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Field roles typically have fixed schedules based on client needs',
          weight: 0.0
        };
      }
    }

    // OFFICE ENVIRONMENT BENEFITS
    if (category === 'OFFICE_ENVIRONMENT') {
      if (workMode === 'onsite' || workMode === 'hybrid') {
        if (jobType === 'office') {
          return {
            relevance: 'relevant',
            explanation: 'Office environment benefits directly apply to onsite office roles',
            weight: 1.0
          };
        }
        return {
          relevance: 'weakly_relevant',
          explanation: 'Office amenities may be used occasionally in hybrid roles',
          weight: 0.5
        };
      }
      if (workMode === 'remote') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Office environment benefits do not apply to fully remote roles',
          weight: 0.0
        };
      }
      if (jobType === 'field' || jobType === 'logistics') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Field/logistics roles rarely access office facilities',
          weight: 0.0
        };
      }
    }

    // COMMUTING BENEFITS
    if (category === 'COMMUTING') {
      if (workMode === 'onsite') {
        return {
          relevance: 'relevant',
          explanation: 'Commuting benefits are essential for onsite roles',
          weight: 1.0
        };
      }
      if (workMode === 'hybrid') {
        return {
          relevance: 'weakly_relevant',
          explanation: 'Commuting benefits partially apply to hybrid roles',
          weight: 0.5
        };
      }
      if (workMode === 'remote') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Commuting benefits do not apply to fully remote roles',
          weight: 0.0
        };
      }
      if (jobType === 'field') {
        return {
          relevance: 'relevant',
          explanation: 'Commuting/transport benefits are essential for field roles',
          weight: 1.0
        };
      }
    }

    // HEALTH & WELLNESS BENEFITS
    if (category === 'HEALTH_WELLNESS') {
      if (benefit.includes('sick days') || benefit.includes('zdravotní volno')) {
        if (scheduleType === 'shift-based') {
          return {
            relevance: 'relevant',
            explanation: 'Sick days are important for shift-based healthcare continuity',
            weight: 1.0
          };
        }
      }
      // Health benefits are generally relevant across all roles
      return {
        relevance: 'relevant',
        explanation: 'Health and wellness benefits apply to all work arrangements',
        weight: 1.0
      };
    }

    // GROWTH BENEFITS
    if (category === 'GROWTH') {
      if (jobType === 'technical' || jobType === 'office') {
        return {
          relevance: 'relevant',
          explanation: 'Growth opportunities are highly valued in technical/office roles',
          weight: 1.0
        };
      }
      return {
        relevance: 'weakly_relevant',
        explanation: 'Growth benefits may be available but less emphasized in this role type',
        weight: 0.5
      };
    }

    // FINANCIAL BENEFITS
    if (category === 'FINANCIAL') {
      if (benefit.includes('stravenky') || benefit.includes('obědy')) {
        if (workMode === 'remote') {
          return {
            relevance: 'weakly_relevant',
            explanation: 'Meal benefits may be partially available for remote workers',
            weight: 0.5
          };
        }
        return {
          relevance: 'relevant',
          explanation: 'Meal benefits are standard for onsite roles',
          weight: 1.0
        };
      }
      // Other financial benefits are generally relevant
      return {
        relevance: 'relevant',
        explanation: 'Financial benefits apply across different work arrangements',
        weight: 1.0
      };
    }

    // EQUIPMENT BENEFITS
    if (category === 'EQUIPMENT') {
      if (workMode === 'remote' || workMode === 'hybrid') {
        return {
          relevance: 'relevant',
          explanation: 'Equipment benefits are essential for remote/hybrid work',
          weight: 1.0
        };
      }
      if (jobType === 'technical') {
        return {
          relevance: 'relevant',
          explanation: 'Technical roles typically require specialized equipment',
          weight: 1.0
        };
      }
      return {
        relevance: 'weakly_relevant',
        explanation: 'Equipment may be provided but is less critical for this role',
        weight: 0.5
      };
    }

    // Default case for uncategorized benefits
    return {
      relevance: 'weakly_relevant',
      explanation: 'Benefit relevance unclear without specific context',
      weight: 0.5
    };
  }

  /**
   * Calculate overall contextual relevance score (0-100)
   */
  private calculateScore(flaggedBenefits: FlaggedBenefit[]): number {
    if (flaggedBenefits.length === 0) return 100; // No benefits = perfect score by default

    const totalWeight = flaggedBenefits.reduce((sum, benefit) => sum + benefit.weight, 0);
    const maxPossibleWeight = flaggedBenefits.length; // All benefits would be weight 1.0

    const score = (totalWeight / maxPossibleWeight) * 100;
    return Math.round(score);
  }

  /**
   * Generate neutral, factual summary text
   */
  private generateSummary(score: number, _flaggedBenefits: FlaggedBenefit[]): string {
    if (score >= 80) {
      return "Listed benefits align well with this role's work setup.";
    } else if (score >= 60) {
      return "Some listed benefits may have limited applicability to this role's work setup.";
    } else if (score >= 40) {
      return "Several listed benefits may not fully apply to this role's work setup.";
    } else {
      return "Many listed benefits appear inconsistent with this role's work setup.";
    }
  }

  /**
   * Helper function to infer work mode from existing job data
   */
  static inferWorkMode(jobType: string, description: string): WorkMode {
    const lowerDesc = description.toLowerCase();
    const lowerType = jobType.toLowerCase();

    if (lowerType.includes('remote') || lowerDesc.includes('remote') || lowerDesc.includes('home office')) {
      return 'remote';
    }
    if (lowerType.includes('hybrid') || lowerDesc.includes('hybrid')) {
      return 'hybrid';
    }
    if (lowerDesc.includes('terén') || lowerDesc.includes('field') || lowerType.includes('řidič') || lowerType.includes('kurýr')) {
      return 'field';
    }
    return 'onsite';
  }

  /**
   * Helper function to infer job type from title and description
   */
  static inferJobType(title: string, description: string): JobType {
    const text = (title + ' ' + description).toLowerCase();

    if (text.includes('řidič') || text.includes('kurýr') || text.includes('doprava')) {
      return 'logistics';
    }
    if (text.includes('terén') || text.includes('technik') || text.includes('instalatér')) {
      return 'field';
    }
    if (text.includes('pečovatel') || text.includes('zdravotní') || text.includes('sestra')) {
      return 'care';
    }
    if (text.includes('prodavač') || text.includes('obsluha') || text.includes('recepce')) {
      return 'service';
    }
    if (text.includes('developer') || text.includes('programátor') || text.includes('it') || text.includes('analytik')) {
      return 'technical';
    }
    return 'office';
  }
}

export const contextualRelevanceScorer = new ContextualRelevanceScorer();
export { ContextualRelevanceScorer };