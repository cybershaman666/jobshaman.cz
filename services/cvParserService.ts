const pdfParse = require('pdf-parse');
import { WorkExperience, UserProfile, Education } from '../types';

// Czech and English skill keywords
const SKILL_KEYWORDS = [
  // Programming languages
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'php', 'ruby', 'go', 'rust', 'swift',
  'react', 'angular', 'vue', 'nodejs', 'express', 'django', 'flask', 'spring', 'laravel',
  
  // Databases
  'sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'oracle',
  
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'git', 'ci/cd', 'terraform',
  
  // Design & Frontend
  'html', 'css', 'sass', 'figma', 'photoshop', 'illustrator', 'sketch', 'adobe', 'ui', 'ux',
  
  // Analytics & BI
  'excel', 'power bi', 'tableau', 'google analytics', 'seo', 'sem', 'ppc', 'analytics',
  
  // Project Management
  'agile', 'scrum', 'kanban', 'jira', 'trello', 'confluence', 'slack',
  
  // Czech specific
  'programování', 'databáze', 'webové technologie', 'mobilní aplikace', 'ui/ux design',
  'analýza dat', 'projektový management', 'testování', 'agilní metodiky'
];

// Phone number patterns (Czech and international)
const PHONE_PATTERNS = [
  /\+?420\s*?\d{3}\s*?\d{3}\s*?\d{3}/g,  // +420 XXX XXX XXX
  /\d{3}\s*?\d{3}\s*?\d{3}/g,            // XXX XXX XXX
  /\d{9}/g,                                    // XXXXXXXXX
  /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g    // XXX-XXX-XXXX format
];

// Email pattern
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;



// Education degree patterns
const EDUCATION_PATTERNS = [
  /(bakalář|bachelor|b\.c\.|ing\.)\w*(\w*\s*\w*)*/gi,
  /(magister|master|m\.i\.|mgr\.)\w*(\w*\s*\w*)*/gi,
  /(doktor|ph\.d\.|dr\.)\w*(\w*\s*\w*)*/gi,
  /(vysokoškolské|vysoká škola|univerzita|university|college)/gi
];

interface ParseResult {
  name?: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
  cvText?: string;
  skills?: string[];
  workHistory?: WorkExperience[];
  education?: Education[];
}

export const parseCVFromPDF = async (file: File): Promise<ParseResult> => {
  try {
    // Extract text from PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdfData = await pdfParse(arrayBuffer);
    const text = pdfData.text;
    
    console.log('Extracted PDF text length:', text.length);
    
    const result: ParseResult = {
      cvText: text.substring(0, 300) // First 300 chars for summary
    };
    
    // Extract email
    const emailMatch = text.match(EMAIL_PATTERN);
    if (emailMatch) {
      result.email = emailMatch[0];
    }
    
    // Extract phone
    for (const pattern of PHONE_PATTERNS) {
      const phoneMatch = text.match(pattern);
      if (phoneMatch) {
        result.phone = phoneMatch[0];
        break;
      }
    }
    
    // Extract skills - keyword matching
    const lowerText = text.toLowerCase();
    const foundSkills = new Set<string>();
    
    SKILL_KEYWORDS.forEach(skill => {
      if (lowerText.includes(skill.toLowerCase())) {
        foundSkills.add(skill);
      }
    });
    
    result.skills = Array.from(foundSkills).slice(0, 15); // Top 15 skills
    
    // Extract name (simple heuristic - look for capitalized text near contact info)
    result.name = extractName(text);
    
    // Extract job title (look for current/recent position)
    result.jobTitle = extractJobTitle(text);
    
    // Extract work experience
    result.workHistory = extractWorkExperience(text);
    
    // Extract education
    result.education = extractEducation(text);
    
    console.log('CV parsing result:', result);
    return result;
    
  } catch (error) {
    console.error('PDF parsing failed:', error);
    return {
      cvText: `[Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}]`
    };
  }
};

// Helper function to extract name
const extractName = (text: string): string | undefined => {
  const lines = text.split('\n');
  
  // Look for name patterns - typically first 1-3 lines, capitalized, no special chars
  for (let i = 0; i < Math.min(3, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip empty lines, emails, phones
    if (line.length === 0 || line.includes('@') || PHONE_PATTERNS.some(p => p.test(line))) {
      continue;
    }
    
    // Check if line looks like a name (2-4 words, capitalized)
    const words = line.split(/\s+/).filter(w => w.length > 0);
    if (words.length >= 2 && words.length <= 4) {
      const allWordsCapitalized = words.every(word => 
        /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžý]*$/.test(word)
      );
      
      if (allWordsCapitalized) {
        return line;
      }
    }
  }
  
  return undefined;
};

// Helper function to extract job title
const extractJobTitle = (text: string): string | undefined => {
  const lowerText = text.toLowerCase();
  
  // Common Czech job title patterns
  const titlePatterns = [
    /(?:současný|aktuální|current)?\s*(pozice|position|role|pracovní pozice)[\s:]*([^,\n]{2,50})/i,
    /(?:jako|as|working as)[\s]*([^,\n]{2,50})/i,
    /([a-záčďéěíňóřšťúžý\s]*(specialista|manager|developer|analytik|koordinátor|vedoucí|konzultant|administrátor|designer|engineer))/i
  ];
  
  for (const pattern of titlePatterns) {
    const match = lowerText.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return undefined;
};

// Helper function to extract work experience
const extractWorkExperience = (text: string): WorkExperience[] => {
  const lines = text.split('\n');
  const experiences: WorkExperience[] = [];
  
  let currentExperience: Partial<WorkExperience> = {};
  let experienceSection = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if we're in experience section
    if (/(praxe|experience|zkušenosti|work history)/i.test(line)) {
      experienceSection = true;
      continue;
    }
    
    if (/(vzdělání|education|školení)/i.test(line)) {
      experienceSection = false;
      continue;
    }
    
    if (!experienceSection) continue;
    
    // Look for dates
    const dateMatch = line.match(/(\d{1,2}[./]\s*\d{1,2}[./]\s*\d{4}|\d{4}[./]\s*\d{1,2}[./]\s*\d{1,2}|do\s*současnosti|present)/i);
    
    if (dateMatch) {
      // Save previous experience if exists
      if (currentExperience.role || currentExperience.company) {
        experiences.push({
          id: `exp-${experiences.length}`,
          role: currentExperience.role || '',
          company: currentExperience.company || '',
          duration: currentExperience.duration || '',
          description: currentExperience.description || ''
        });
      }
      
      currentExperience = {
        duration: dateMatch[0]
      };
      continue;
    }
    
    // Look for company names (usually after dates)
    if (currentExperience.duration && !currentExperience.company && line.length > 3) {
      currentExperience.company = line;
      continue;
    }
    
    // Look for job titles (usually after company)
    if (currentExperience.company && !currentExperience.role && line.length > 3) {
      currentExperience.role = line;
      continue;
    }
    
    // Description (usually bullet points or paragraphs after title)
    if (currentExperience.role && (line.startsWith('•') || line.startsWith('-') || line.length > 20)) {
      currentExperience.description = (currentExperience.description || '') + line + ' ';
    }
  }
  
  // Add last experience
  if (currentExperience.role || currentExperience.company) {
    experiences.push({
      id: `exp-final`,
      role: currentExperience.role || '',
      company: currentExperience.company || '',
      duration: currentExperience.duration || '',
      description: currentExperience.description || ''
    });
  }
  
  return experiences.slice(0, 5); // Limit to 5 most recent experiences
};

// Helper function to extract education
const extractEducation = (text: string): Education[] => {
  const lines = text.split('\n');
  const education: Education[] = [];
  
  let educationSection = false;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Check if we're in education section
    if (/(vzdělání|education|školení|škola)/i.test(trimmedLine)) {
      educationSection = true;
      continue;
    }
    
    if (/(praxe|experience|zkušenosti|work history)/i.test(trimmedLine)) {
      educationSection = false;
      continue;
    }
    
    if (!educationSection) continue;
    
    // Check for degree patterns
    for (const pattern of EDUCATION_PATTERNS) {
      const match = trimmedLine.match(pattern);
      if (match) {
        const degree = match[0];
        let school = '';
        let year = '';
        
        // Look for year in surrounding lines
        const yearMatch = trimmedLine.match(/\d{4}/);
        if (yearMatch) {
          year = yearMatch[0];
        }
        
        // Look for school name (usually contains university/vysoká škola)
        if (/(univerzita|vysoká škola|university|college)/i.test(trimmedLine)) {
          school = trimmedLine;
        }
        
          const edu: Education = { 
            id: `edu-${education.length}`,
            school: school || '', 
            degree: degree || '',
            field: '', // Not extracted by our current logic
            year: year || ''
          };
          education.push(edu);
        break;
      }
    }
  }
  
  return education.slice(0, 3); // Limit to 3 most recent educations
};

// Main function to parse CV with fallback to Gemini
export const parseProfileFromCVWithFallback = async (
  file: File
): Promise<Partial<UserProfile>> => {
  try {
    // First, try algorithmic parsing
    const algorithmicResult = await parseCVFromPDF(file);
    
    // Check if we got meaningful results
    const hasData = algorithmicResult.skills && 
                  algorithmicResult.skills.length > 0 || 
                  (algorithmicResult.workHistory && algorithmicResult.workHistory.length > 0) ||
                  algorithmicResult.name ||
                  algorithmicResult.email;
    
    if (hasData) {
      console.log('Algorithmic parsing successful:', algorithmicResult.skills?.length, 'skills');
      return algorithmicResult;
    }
    
    console.log('Algorithmic parsing failed, falling back to Gemini...');
    
    // Fallback to Gemini if algorithmic parsing fails
    const { parseProfileFromCV } = await import('./geminiService');
    
    // Convert file to base64 for Gemini
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    
    return await parseProfileFromCV({
      base64: base64Data,
      mimeType: file.type
    });
    
  } catch (error) {
    console.error('CV parsing failed completely:', error);
    return {
      cvText: `[Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}]`
    };
  }
};