import { Job, UserProfile, LearningResource, SkillsGapAnalysis } from '../types';

export const calculateSkillsMatch = (
  candidateSkills: string[],
  requiredSkills: string[]
): { matchPercentage: number; missingSkills: string[] } => {
  if (!requiredSkills || requiredSkills.length === 0) {
    return { matchPercentage: 100, missingSkills: [] };
  }

  if (!candidateSkills || candidateSkills.length === 0) {
    return { matchPercentage: 0, missingSkills: requiredSkills };
  }

  // Normalize skills to lowercase for comparison
  const normalizedCandidate = candidateSkills.map(skill => skill.toLowerCase().trim());
  const normalizedRequired = requiredSkills.map(skill => skill.toLowerCase().trim());

  // Count matching skills
  const matchedSkills = normalizedRequired.filter(required => 
    normalizedCandidate.some(candidate => 
      candidate.includes(required) || required.includes(candidate) ||
      candidate === required || 
      // Handle common variations
      (candidate.includes('javascript') && required.includes('js')) ||
      (candidate.includes('typescript') && required.includes('ts')) ||
      (candidate.includes('react') && required.includes('reactjs')) ||
      (candidate.includes('python') && required.includes('django')) ||
      (candidate.includes('node') && required.includes('nodejs'))
    )
  );

  const matchPercentage = Math.round((matchedSkills.length / normalizedRequired.length) * 100);
  const missingSkills = normalizedRequired.filter(skill => 
    !matchedSkills.includes(skill)
  ).map(skill => requiredSkills[normalizedRequired.indexOf(skill)]); // Return original case

  return { matchPercentage, missingSkills };
};

export const findLearningResources = (
  missingSkills: string[],
  learningResources: LearningResource[],
  maxResourcesPerSkill: number = 3
): LearningResource[] => {
  const recommendedResources: LearningResource[] = [];
  
  for (const skill of missingSkills) {
    const matchingResources = learningResources.filter(resource =>
      resource.skill_tags.some(tag => 
        tag.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(tag.toLowerCase()) ||
        // Handle skill variations
        (skill.toLowerCase().includes('javascript') && tag.toLowerCase().includes('js')) ||
        (skill.toLowerCase().includes('react') && tag.toLowerCase().includes('reactjs')) ||
        (skill.toLowerCase().includes('python') && tag.toLowerCase().includes('django')) ||
        (skill.toLowerCase().includes('node') && tag.toLowerCase().includes('nodejs'))
      )
    );
    
    // Sort by rating and take top resources
    const topResources = matchingResources
      .sort((a, b) => {
        // Prioritize higher rating, then more reviews
        if (b.rating !== a.rating) return b.rating - a.rating;
        return b.reviews_count - a.reviews_count;
      })
      .slice(0, maxResourcesPerSkill);
    
    recommendedResources.push(...topResources);
  }
  
  // Remove duplicates and sort by overall quality
  const uniqueResources = recommendedResources.filter((resource, index, arr) => 
    arr.findIndex(r => r.id === resource.id) === index
  );
  
  return uniqueResources
    .sort((a, b) => {
      // Sort by rating, difficulty (beginner first), and duration
      if (b.rating !== a.rating) return b.rating - a.rating;
      const difficultyOrder = { 'Beginner': 0, 'Intermediate': 1, 'Advanced': 2 };
      const diffCompare = difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty];
      if (diffCompare !== 0) return diffCompare;
      return a.duration_hours - b.duration_hours;
    })
    .slice(0, 8); // Maximum 8 total recommendations
};

export const analyzeSkillsGap = (
  job: Job,
  userProfile: UserProfile,
  learningResources: LearningResource[]
): SkillsGapAnalysis => {
  const { matchPercentage, missingSkills } = calculateSkillsMatch(
    userProfile.skills || [],
    job.required_skills || []
  );

  // Only recommend resources if match is below 90%
  const recommendedResources = matchPercentage < 90 
    ? findLearningResources(missingSkills, learningResources)
    : [];

  return {
    match_percentage: matchPercentage,
    missing_skills: missingSkills,
    recommended_resources: recommendedResources
  };
};

// Helper function to categorize learning resources
export const categorizeResources = (resources: LearningResource[]): {
  beginner: LearningResource[];
  intermediate: LearningResource[];
  advanced: LearningResource[];
  quick: LearningResource[]; // Under 10 hours
} => {
  const beginner = resources.filter(r => r.difficulty === 'Beginner');
  const intermediate = resources.filter(r => r.difficulty === 'Intermediate');
  const advanced = resources.filter(r => r.difficulty === 'Advanced');
  const quick = resources.filter(r => r.duration_hours <= 10);

  return { beginner, intermediate, advanced, quick };
};

// Helper to estimate time to complete all recommended resources
export const estimateLearningTime = (resources: LearningResource[]): {
  totalHours: number;
  estimatedWeeks: number;
  breakdown: { [key: string]: number };
} => {
  const totalHours = resources.reduce((sum, resource) => sum + resource.duration_hours, 0);
  const estimatedWeeks = Math.ceil(totalHours / 10); // Assuming 10 hours/week of learning
  
  const breakdown = resources.reduce((acc, resource) => {
    const key = resource.difficulty.toLowerCase();
    acc[key] = (acc[key] || 0) + resource.duration_hours;
    return acc;
  }, {} as { [key: string]: number });

  return { totalHours, estimatedWeeks, breakdown };
};