import { ContextualRelevanceScore, FlaggedBenefit, WorkMode, JobType, LocationType, ScheduleType } from '../types';

// Benefit categories and their typical relevance patterns
const BENEFIT_CATEGORIES = {
  FLEXIBILITY: [
    'flexibilní začátek/konec', 'home office', 'remote work', 'flexibilní doba', 'práce z domova',
    'homeoffice', 'mobiles arbeiten', 'flexibel', 'gleitzeit', 'praca zdalna', 'elastyczne godziny'
  ],
  OFFICE_ENVIRONMENT: [
    'kávovar', 'ovoce', 'pizza', 'občerstvení', 'relax', 'fotbálek', 'table football', 'pes', 'dog',
    'psí', 'pet', 'herna', 'playstation', 'office', 'obst', 'getränke', 'kantine', 'kawa', 'owoce'
  ],
  COMMUTING: [
    'služební auto', 'příspěvek na dopravu', 'parkovací místo', 'karta na MHD',
    'dienstwagen', 'firmenwagen', 'parkplatz', 'öpnv', 'bilet komunikacji', 'samochód służbowy'
  ],
  HEALTH_WELLNESS: [
    'multisport', 'sick days', 'zdravotní volno', 'penzijní připojištění', 'životní pojištění',
    'krankenversicherung', 'privatkrankenversicherung', 'opieka medyczna', 'ubezpieczenie'
  ],
  GROWTH: [
    'školení', 'kurzy', 'konference', 'vzdělávání', 'rozpočet na vzdělávání', 'kariérní růst',
    'weiterbildung', 'training', 'szkolenia', 'kursy', 'rozwoj kariery'
  ],
  FINANCIAL: [
    'esop', 'zaměstnanecké akcie', 'roční bonusy', '13. plat', 'stravenky', 'cafeteria',
    'mitarbeiteraktien', 'aktienoptionen', 'bonus', 'premia', 'trzynasta pensja'
  ],
  EQUIPMENT: ['notebook', 'telefon', 'hardware', 'macbook', 'diensthandy', 'firmenhandy', 'laptop']
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
          explanation: 'Flexibilní benefity jsou vysoce relevantní pro vzdálené/hybridní role',
          weight: 1.0
        };
      }
      if (workMode === 'onsite') {
        return {
          relevance: 'weakly_relevant',
          explanation: 'Nějaká flexibilita může platit pro prezenční role s pevnými hodinami',
          weight: 0.5
        };
      }
      if (workMode === 'field') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Terénní role typicky mají pevný harmonogram podle potřeb klientů',
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
            explanation: 'Benefity kancelářského prostředí přímo platí pro prezenční kancelářské role',
            weight: 1.0
          };
        }
        return {
          relevance: 'weakly_relevant',
          explanation: 'Kancelářské vybavení může být používáno občas v hybridních rolích',
          weight: 0.5
        };
      }
      if (workMode === 'remote') {
        // Wit & Context Logic: Absurd Office Perks for Remote Jobs

        if (benefit.includes('dog') || benefit.includes('pes') || benefit.includes('psí') || benefit.includes('pet')) {
          return {
            relevance: 'context_mismatch',
            explanation: 'Firma sice nabízí dog-friendly office, ale jelikož budete pracovat z obýváku, doporučujeme probrat s vaším psem, jestli s vaší celodenní přítomností u něj doma souhlasí.',
            weight: 0.0
          };
        }

        if (benefit.includes('ovoce') || benefit.includes('káva') || benefit.includes('občerstvení') || benefit.includes('pizza') || benefit.includes('snídaně')) {
          return {
            relevance: 'context_mismatch',
            explanation: 'Ovoce v kanceláři je super, ale přes obrazovku vám ho bohužel nepošlou. Budete se muset spolehnout na vlastní lednici.',
            weight: 0.0
          };
        }

        if (benefit.includes('fotbálek') || benefit.includes('relax') || benefit.includes('playstation') || benefit.includes('herna') || benefit.includes('table football')) {
          return {
            relevance: 'context_mismatch',
            explanation: 'Fotbálek v kanclu vás asi nevytrhne, leda byste si ho jeli zahrát v rámci teambuildingu jednou za kvartál.',
            weight: 0.0
          };
        }

        return {
          relevance: 'context_mismatch',
          explanation: 'Benefity kancelářského prostředí (jako tento) jsou u plně vzdálené role spíše úsměvné.',
          weight: 0.0
        };
      }
      if (jobType === 'field' || jobType === 'logistics') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Terénní/logistické role zřídka přistupují do kancelářských zařízení',
          weight: 0.0
        };
      }
    }

    // COMMUTING BENEFITS
    if (category === 'COMMUTING') {
      if (workMode === 'onsite') {
        return {
          relevance: 'relevant',
          explanation: 'Dopravní benefity jsou nezbytné pro prezenční role',
          weight: 1.0
        };
      }
      if (workMode === 'hybrid') {
        return {
          relevance: 'weakly_relevant',
          explanation: 'Dopravní benefity částečně platí pro hybridní role',
          weight: 0.5
        };
      }
      if (workMode === 'remote') {
        return {
          relevance: 'context_mismatch',
          explanation: 'Dopravní benefity neplatí pro plně vzdálené role',
          weight: 0.0
        };
      }
      if (jobType === 'field') {
        return {
          relevance: 'relevant',
          explanation: 'Dopravní benefity jsou nezbytné pro terénní role',
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
            explanation: 'Sick days jsou důležité pro kontinuitu zdravotní péče ve směnném provozu',
            weight: 1.0
          };
        }
      }
      // Health benefits are generally relevant across all roles
      return {
        relevance: 'relevant',
        explanation: 'Zdravotní benefity platí pro všechny pracovní uspořádání',
        weight: 1.0
      };
    }

    // GROWTH BENEFITS
    if (category === 'GROWTH') {
      if (jobType === 'technical' || jobType === 'office') {
        return {
          relevance: 'relevant',
          explanation: 'Růstové příležitosti jsou vysoce ceněny v technických/kancelářských rolích',
          weight: 1.0
        };
      }
      return {
        relevance: 'weakly_relevant',
        explanation: 'Růstové benefity mohou být dostupné ale méně zdůrazňované v tomto typu role',
        weight: 0.5
      };
    }

    // FINANCIAL BENEFITS
    if (category === 'FINANCIAL') {
      if (benefit.includes('stravenky') || benefit.includes('obědy')) {
        if (workMode === 'remote') {
          return {
            relevance: 'weakly_relevant',
            explanation: 'Stravovací benefity mohou být částečně dostupné pro vzdálené pracovníky',
            weight: 0.5
          };
        }
        return {
          relevance: 'relevant',
          explanation: 'Stravovací benefity jsou standardní pro prezenční role',
          weight: 1.0
        };
      }
      // Other financial benefits are generally relevant
      return {
        relevance: 'relevant',
        explanation: 'Finanční benefity platí napříč různými pracovními uspořádáními',
        weight: 1.0
      };
    }

    // EQUIPMENT BENEFITS
    if (category === 'EQUIPMENT') {
      if (workMode === 'remote' || workMode === 'hybrid') {
        return {
          relevance: 'relevant',
          explanation: 'Vybavení je nezbytné pro vzdálenou/hybridní práci',
          weight: 1.0
        };
      }
      if (jobType === 'technical') {
        return {
          relevance: 'relevant',
          explanation: 'Technické role typicky vyžadují specializované vybavení',
          weight: 1.0
        };
      }
      return {
        relevance: 'weakly_relevant',
        explanation: 'Vybavení může být poskytnuto ale je méně kritické pro tuto roli',
        weight: 0.5
      };
    }

    // Default case for uncategorized benefits
    return {
      relevance: 'weakly_relevant',
      explanation: 'Relevance benefitu není jasná bez specifického kontextu',
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
      return "Uvedené benefity dobře odpovídají pracovnímu uspořádání této role.";
    } else if (score >= 60) {
      return "Některé uvedené benefity mohou mít omezenou použitelnost pro tuto roli.";
    } else if (score >= 40) {
      return "Několik uvedených benefitů nemusí plně platit pro pracovní uspořádání této role.";
    } else {
      return "Mnoho uvedených benefitů se zdá být nekonzistentních s pracovním uspořádáním této role.";
    }
  }

  /**
   * Helper function to infer work mode from existing job data
   */
  static inferWorkMode(jobType: string, description: string, workModel?: string): WorkMode {
    const lowerDesc = description.toLowerCase();
    const lowerType = jobType.toLowerCase();
    const lowerModel = (workModel || '').toLowerCase();

    if (lowerModel.includes('remote')) return 'remote';
    if (lowerModel.includes('hybrid')) return 'hybrid';
    if (lowerModel.includes('onsite') || lowerModel.includes('on-site')) return 'onsite';

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
