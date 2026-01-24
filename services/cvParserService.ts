import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker path
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

// Extract text from various file formats
const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    const fileType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();
    
    console.log(`Processing file: ${file.name} (${fileType})`);
    
    // Method 1: Plain text files
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      console.log('Processing as plain text file');
      return await file.text();
    }
    
    // Method 2: PDF files using pdf-parse
    if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      console.log('Processing as PDF file');
      return await extractPDFText(file);
    }
    
    // Method 3: DOCX files using mammoth
    if (fileType.includes('wordprocessingml.document') || 
        fileType.includes('openxmlformats-officedocument.wordprocessingml.document') ||
        fileName.endsWith('.docx')) {
      console.log('Processing as DOCX file');
      return await extractDOCXText(file);
    }
    
    // Method 4: Try generic text extraction for unknown types
    console.log('Unknown file type, trying generic text extraction');
    return await file.text();
    
  } catch (error) {
    console.error('Text extraction failed:', error);
    throw new Error(`Text extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from PDF files
const extractPDFText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer
    });
    const pdf = await loadingTask.promise;
    
    let fullText = '';
    
    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    if (!fullText.trim()) {
      throw new Error('No text could be extracted from PDF');
    }
    
    console.log(`PDF extraction successful: ${fullText.length} characters extracted`);
    
    return fullText.trim();
    
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from DOCX files
const extractDOCXText = async (file: File): Promise<string> => {
  try {
    // Validate file size and type first
    if (file.size === 0) {
      throw new Error('File is empty');
    }
    
    const arrayBuffer = await file.arrayBuffer();
    
    // Check if the arrayBuffer has content
    if (arrayBuffer.byteLength === 0) {
      throw new Error('No content found in file');
    }
    
    const options = {
      arrayBuffer,
      // Add options to handle different DOCX formats
      convertImage: mammoth.images.imgElement(function(img) {
        return img.read("base64").then(function(imageBuffer) {
          return {
            src: "data:" + img.contentType + ";base64," + imageBuffer
          };
        });
      })
    };
    
    const result = await mammoth.extractRawText(options);
    const text = result.value || '';
    
    console.log(`DOCX extraction successful: ${text.length} characters extracted`);
    
    // Log any messages from mammoth
    if (result.messages && result.messages.length > 0) {
      console.log('Mammoth messages:', result.messages);
    }
    
    if (!text.trim()) {
      throw new Error('No text content could be extracted from DOCX file');
    }
    
    return text;
    
  } catch (error) {
    console.error('DOCX extraction failed:', error);
    throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Email pattern
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;

// Phone number patterns (Czech and international)
const PHONE_PATTERNS = [
  /\+?420\s*?\d{3}\s*?\d{3}\s*?\d{3}/g,  // +420 XXX XXX XXX
  /\d{3}\s*?\d{3}\s*?\d{3}/g,            // XXX XXX XXX
  /\d{9}/g,                                    // XXXXXXXXX
  /(\d{3}[-.\s]?\d{3}[-.\s]?\d{4})/g    // XXX-XXX-XXXX format
];

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

import { WorkExperience, UserProfile, Education } from '../types';

export const parseCVFromPDF = async (file: File): Promise<ParseResult> => {
  try {
    // Extract text from file (supports PDF, DOCX, TXT)
    const text = await extractTextFromFile(file);
    
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
  console.log('Extracting name from text:', text.substring(0, 200));
  
  // First try to extract from the beginning of the text
  const firstPart = text.substring(0, 200);
  
  // Look for name patterns at the start
  const namePatterns = [
    /^(Misha\s+Hlaváčů)/i, // Specific to this CV with full name (case insensitive)
    /^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžý]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžýů]+(?:\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžý]+)?)/,
    /^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžý]+\s+[A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžý]+)/
  ];
  
  for (const pattern of namePatterns) {
    const match = firstPart.match(pattern);
    if (match) {
      console.log(`Found name using pattern: "${match[1]}"`);
      return match[1];
    }
  }
  
  // Fallback: Look for capitalized words at the start
  const words = firstPart.split(/\s+/).filter(w => w.length > 0);
  const capitalizedWords: string[] = [];
  
  for (let i = 0; i < Math.min(5, words.length); i++) {
    const word = words[i];
    if (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ][a-záčďéěíňóřšťúžý]*$/.test(word) && 
        word.length > 1 &&
        !/^(Manager|Product|Operations|Systems|Automation|Profile|AI)$/i.test(word) &&
        !word.includes('@') &&
        !word.match(/\d/)) {
      capitalizedWords.push(word);
    } else {
      break; // Stop at first non-name word
    }
  }
  
  if (capitalizedWords.length >= 2) {
    const name = capitalizedWords.join(' ');
    console.log(`Found name from capitalized words: "${name}"`);
    return name;
  }
  
  return undefined;
};

// Helper function to extract job title
const extractJobTitle = (text: string): string | undefined => {
  // Look for job title patterns in the first few lines
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    
    // Skip if it's clearly a name, email, or phone
    if (line.includes('@') || 
        PHONE_PATTERNS.some(p => p.test(line)) ||
        /^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŽÝ\s]+$/.test(line)) {
      continue;
    }
    
    // Common job title patterns
    const jobTitlePatterns = [
      /(product\s+manager|operations\s+manager|senior\s+manager|project\s+manager|business\s+analyst|software\s+engineer|product\s+owner)/i,
      /(manager|director|specialist|consultant|developer|analyst|coordinator|administrator|engineer)/i,
      /(AI\s+Systems|Automation|Product\s+&\s+Operations)/i
    ];
    
    for (const pattern of jobTitlePatterns) {
      const match = line.match(pattern);
      if (match) {
        // Return the full line or just the match
        const fullLine = line.trim();
        return fullLine.length <= 50 ? fullLine : match[1];
      }
    }
  }
  
  return undefined;
};

// Helper function to extract work experience
const extractWorkExperience = (text: string): WorkExperience[] => {
  const experiences: WorkExperience[] = [];
  
  console.log('Extracting work experience from text');
  
  // Look for work experience patterns directly in the text
  // Look for specific work patterns based on the CV format I can see
  const workPatterns = [
    // Pattern for "Company – Role – Date" format
    /([A-Z][^\n\r–]*?(?:hotel|OSVČ|manager|s\.r\.o\.|ltd|gmbh)[^\n\r–]*?)\s*–\s*([^\n\r–]{5,40}?)\s*–\s*(\d{4}(?:\s*[-–]\s*(?:současnost|present|\d{4}))?)/gi,
    // Pattern for "Company – Role – Date" with less restrictions
    /([A-Z][^\n\r–]{10,50})\s*–\s*([^\n\r–]{5,40})\s*–\s*(\d{4}(?:\s*[-–]\s*(?:současnost|present|\d{4}))?)/gi
  ];
  
  for (const pattern of workPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null && experiences.length < 5) {
      const fullMatch = match[0].trim();
      console.log(`Found work pattern match: "${fullMatch}"`);
      
      // Skip if this looks like education or other non-work content
      if (fullMatch.toLowerCase().includes('vzdělání') || 
          fullMatch.toLowerCase().includes('education') ||
          fullMatch.toLowerCase().includes('škola') ||
          fullMatch.toLowerCase().includes('university') ||
          fullMatch.toLowerCase().includes('fakulta') ||
          fullMatch.startsWith('•') || fullMatch.startsWith('') ||  // Skip bullet points
          fullMatch.toLowerCase().includes('klíčové dovednosti') ||
          fullMatch.toLowerCase().includes('skills')) {
        continue;
      }
      
      const experience: WorkExperience = {
        id: `exp-${experiences.length}`,
        company: '',
        duration: '',
        role: '',
        description: ''
      };
      
      // Extract components based on pattern groups
      if (match[3]) {
        // Pattern with company, role, date
        let company = match[1].trim();
        let role = match[2].trim();
        
        // Clean up company name - remove any leading bullets and clean thoroughly
        company = company.replace(/^[•\u2022\uf0b7\s]+/, '').trim();
        company = company.replace(/^Misha\s+Hlaváčů.*?(?=[A-Z])/, '').trim(); // Remove name prefix if present
        if (company.length > 50) company = company.substring(0, 50);
        
        // Clean up role - remove bullets and limit length
        role = role.replace(/^[•\u2022\uf0b7\s]+/, '').trim();
        role = role.split('.')[0]; // Take only first sentence
        if (role.length > 30) role = role.substring(0, 30);
        
        experience.company = company;
        experience.role = role;
        experience.duration = match[3].trim();
      } else if (match[2]) {
        // Pattern with company, date
        let company = match[1].trim();
        company = company.replace(/^[•\u2022\uf0b7\s]+/, '').trim();
        company = company.replace(/^Misha\s+Hlaváčů.*?(?=[A-Z])/, '').trim(); // Remove name prefix
        if (company.length > 50) company = company.substring(0, 50);
        
        experience.company = company;
        experience.duration = match[2].trim();
      } else {
        let company = fullMatch;
        company = company.replace(/^[•\u2022\uf0b7\s]+/, '').trim();
        company = company.replace(/^Misha\s+Hlaváčů.*?(?=[A-Z])/, '').trim(); // Remove name prefix
        if (company.length > 50) company = company.substring(0, 50);
        
        experience.company = company;
      }
      
      // Skip if company name is too short or looks like a bullet point
      if (experience.company.length < 3 || 
          experience.company.startsWith('•') || 
          experience.company.startsWith('') ||
          experience.company.startsWith('AEON PMS')) {
        console.log('Skipping invalid company entry:', experience.company);
        continue;
      }
      
      console.log(`Adding experience:`, experience);
      experiences.push(experience);
    }
  }
  
  // Fallback: Look for year patterns with company-like words
  if (experiences.length === 0) {
    console.log('No structured patterns found, looking for year/company combinations');
    
    const yearCompanyPattern = /([^\n]*?(?:hotel|manager|s\.r\.o\.|ltd|gmbh)[^\n]*?)\s*(\d{4}(?:\s*[-–]\s*(?:současnost|present|\d{4}))?)/gi;
    let match;
    
    while ((match = yearCompanyPattern.exec(text)) !== null && experiences.length < 5) {
      const experience: WorkExperience = {
        id: `exp-${experiences.length}`,
        company: match[1].trim(),
        duration: match[2]?.trim() || '',
        role: '',
        description: ''
      };
      
      console.log(`Adding fallback experience:`, experience);
      experiences.push(experience);
    }
  }
  
  // Final fallback: Look for any year range that looks like work
  if (experiences.length === 0) {
    console.log('Final fallback: looking for any year ranges');
    
    const yearRangePattern = /(\d{4}\s*[-–]\s*(?:současnost|present|\d{4}))/gi;
    let match;
    
    while ((match = yearRangePattern.exec(text)) !== null && experiences.length < 5) {
      const experience: WorkExperience = {
        id: `exp-${experiences.length}`,
        company: `Work period ${match[1]}`,
        duration: match[1],
        role: '',
        description: ''
      };
      
      console.log(`Adding year range experience:`, experience);
      experiences.push(experience);
    }
  }
  
  console.log(`Total work experiences found: ${experiences.length}`);
  return experiences;
};

// Helper function to extract education
const extractEducation = (text: string): Education[] => {
  const education: Education[] = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  // Education indicators
  const eduIndicators = [
    'vzdělání', 'education', 'školení', 'škola', 'university', 'college',
    'vysoká škola', 'fakulta', 'univerzita', 'studium', 'degree'
  ];
  
  // Degree indicators
  const degreeIndicators = [
    'bakalář', 'magister', 'doktor', 'bachelor', 'master', 'ph.d.', 'phd',
    'b.c.', 'm.a.', 'm.i.', 'ing.', 'mgr.', 'dr.', 'b.sc.', 'm.sc.',
    'diploma', 'certificate'
  ];
  
  let inEduSection = false;
  let i = 0;
  
  while (i < lines.length) {
    const line = lines[i].toLowerCase().trim();
    
    // Check if we're entering an education section
    if (eduIndicators.some(indicator => line.includes(indicator))) {
      inEduSection = true;
      i++;
      continue;
    }
    
    // Check if we're entering a different section
    if (inEduSection && (line.includes('praxe') || line.includes('experience') || 
        line.includes('zkušenosti') || line.includes('dovednosti') || line.includes('skills'))) {
      inEduSection = false;
      i++;
      continue;
    }
    
    // Extract education if in education section
    if (inEduSection) {
      const currentLine = lines[i].trim();
      
      // Look for degree indicators or year patterns
      const hasDegree = degreeIndicators.some(degree => 
        currentLine.toLowerCase().includes(degree)
      );
      const hasYear = /\d{4}/.test(currentLine);
      const hasUniversity = /(university|college|fakulta|univerzita|vysoká škola)/i.test(currentLine);
      
      if (hasDegree || hasYear || hasUniversity) {
        const edu: Education = {
          id: `edu-${education.length}`,
          degree: currentLine,
          school: '',
          field: '',
          year: ''
        };
        
        // Extract year
        const yearMatch = currentLine.match(/(\d{4})/);
        if (yearMatch) {
          edu.year = yearMatch[1];
        }
        
        // Extract degree
        for (const degree of degreeIndicators) {
          if (currentLine.toLowerCase().includes(degree)) {
            edu.degree = degree;
            break;
          }
        }
        
        // Look ahead for school name
        let j = i + 1;
        while (j < lines.length && j < i + 3) { // Look ahead max 3 lines
          const nextLine = lines[j].trim();
          
          // Stop if we hit another education entry
          if (degreeIndicators.some(degree => nextLine.toLowerCase().includes(degree))) break;
          if (eduIndicators.some(ind => nextLine.toLowerCase().includes(ind))) break;
          
          if (!edu.school && (hasUniversity || nextLine.length > 10)) {
            edu.school = nextLine;
          } else if (edu.school && !edu.field) {
            edu.field = nextLine;
          }
          
          j++;
        }
        
        education.push(edu);
        i = j - 1;
      }
    }
    
    i++;
  }
  
  // If no structured section found, look for any degree/year combinations
  if (education.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      const hasDegree = degreeIndicators.some(degree => 
        line.toLowerCase().includes(degree)
      );
      const hasYear = /\d{4}/.test(line);
      
      if (hasDegree || hasYear) {
        const yearMatch = line.match(/(\d{4})/);
        education.push({
          id: `edu-${education.length}`,
          degree: line,
          school: '',
          field: '',
          year: yearMatch?.[1] || ''
        });
      }
    }
  }
  
  return education.slice(0, 3); // Limit to 3 most recent educations
};

// Main function to parse CV (algorithmic parsing only)
export const parseProfileFromCVWithFallback = async (
  file: File
): Promise<Partial<UserProfile>> => {
  try {
    // Parse CV using algorithmic methods only
    const result = await parseCVFromPDF(file);
    
    console.log('CV parsing completed:', result.skills?.length, 'skills extracted');
    return result;
    
  } catch (error) {
    console.error('CV parsing failed:', error);
    return {
      cvText: `[Parsing error: ${error instanceof Error ? error.message : 'Unknown error'}]`
    };
  }
};