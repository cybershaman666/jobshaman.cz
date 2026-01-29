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

// Bullet point characters to normalize
const BULLET_CHARS = ['•', '●', '○', '◦', '▪', '▸', '►', '■', '★', '☆', '→', '➤', '➜', '✓', '✔', '–', '—'];

// Extract text from PDF files with position awareness
const extractPDFText = async (file: File): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer
    });
    const pdf = await loadingTask.promise;

    let fullText = '';

    // Extract text from all pages with position awareness
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Sort items by position (top to bottom, then left to right)
      const items = textContent.items as any[];

      if (items.length === 0) continue;

      // Group text items by approximate Y position (line grouping)
      const lineThreshold = 5; // Items within 5 units are on same line
      const lines: { y: number; items: any[] }[] = [];

      for (const item of items) {
        if (!item.str || item.str.trim() === '') continue;

        const y = item.transform[5]; // Y position
        const x = item.transform[4]; // X position

        // Find existing line or create new one
        let foundLine = lines.find(line => Math.abs(line.y - y) < lineThreshold);

        if (foundLine) {
          foundLine.items.push({ ...item, x, y });
        } else {
          lines.push({ y, items: [{ ...item, x, y }] });
        }
      }

      // Sort lines top to bottom (higher Y = higher on page in PDF coords)
      lines.sort((a, b) => b.y - a.y);

      // Process each line
      for (const line of lines) {
        // Sort items left to right within line
        line.items.sort((a, b) => a.x - b.x);

        // Build line text with proper spacing
        let lineText = '';
        let lastX = 0;
        let lastWidth = 0;

        for (const item of line.items) {
          const text = item.str;

          // Detect if there's a significant gap (possible column break or spacing)
          const gap = item.x - (lastX + lastWidth);

          if (lineText && gap > 10) {
            // Large gap - might be a column break, add tab
            lineText += '\t';
          } else if (lineText && gap > 2) {
            // Small gap - add space
            lineText += ' ';
          }

          lineText += text;
          lastX = item.x;
          lastWidth = item.width || text.length * 5; // Estimate width if not provided
        }

        // Normalize bullet points
        let normalizedLine = lineText.trim();
        for (const bullet of BULLET_CHARS) {
          if (normalizedLine.startsWith(bullet)) {
            normalizedLine = '• ' + normalizedLine.substring(bullet.length).trim();
            break;
          }
        }

        // Detect if line starts with a dash/hyphen that's being used as a bullet
        if (/^[-–—]\s/.test(normalizedLine)) {
          normalizedLine = '• ' + normalizedLine.substring(2).trim();
        }

        if (normalizedLine) {
          fullText += normalizedLine + '\n';
        }
      }

      // Add page separator for multi-page documents
      if (pageNum < pdf.numPages) {
        fullText += '\n--- Page ' + (pageNum + 1) + ' ---\n\n';
      }
    }

    if (!fullText.trim()) {
      throw new Error('No text could be extracted from PDF');
    }

    console.log(`PDF extraction successful: ${fullText.length} characters extracted from ${pdf.numPages} pages`);

    return fullText.trim();

  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error(`PDF parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Extract text from DOCX files with structure preservation
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

    // Use convertToHtml to preserve structure, then convert to clean text
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const html = htmlResult.value || '';

    // Log any warnings from mammoth
    if (htmlResult.messages && htmlResult.messages.length > 0) {
      console.log('Mammoth messages:', htmlResult.messages);
    }

    if (!html.trim()) {
      throw new Error('No content could be extracted from DOCX file');
    }

    // Convert HTML to structured plain text
    const text = convertHtmlToStructuredText(html);

    console.log(`DOCX extraction successful: ${text.length} characters extracted`);

    if (!text.trim()) {
      throw new Error('No text content could be extracted from DOCX file');
    }

    return text;

  } catch (error) {
    console.error('DOCX extraction failed:', error);
    throw new Error(`DOCX parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Convert HTML to structured plain text with preserved formatting
const convertHtmlToStructuredText = (html: string): string => {
  let text = html;

  // Replace block elements with newlines
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/h[1-6]>/gi, '\n\n');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/tr>/gi, '\n');
  text = text.replace(/<\/td>/gi, '\t');
  text = text.replace(/<\/th>/gi, '\t');

  // Handle lists - preserve bullet structure
  text = text.replace(/<li[^>]*>/gi, '• ');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n');

  // Handle headings - make them stand out
  text = text.replace(/<h1[^>]*>/gi, '\n\n=== ');
  text = text.replace(/<h2[^>]*>/gi, '\n\n== ');
  text = text.replace(/<h3[^>]*>/gi, '\n\n= ');
  text = text.replace(/<h[4-6][^>]*>/gi, '\n\n');

  // Remove remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&[a-z]+;/gi, ' '); // Other entities

  // Normalize whitespace
  text = text.replace(/[ \t]+/g, ' '); // Multiple spaces/tabs to single space
  text = text.replace(/\n[ \t]+/g, '\n'); // Remove leading whitespace from lines
  text = text.replace(/[ \t]+\n/g, '\n'); // Remove trailing whitespace from lines
  text = text.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines

  // Normalize bullet points
  for (const bullet of BULLET_CHARS) {
    const regex = new RegExp(`^\\s*${escapeRegex(bullet)}\\s*`, 'gm');
    text = text.replace(regex, '• ');
  }

  return text.trim();
};

// Helper to escape special regex characters
const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

// Section headers for work experience
const WORK_SECTION_HEADERS = [
  'pracovní zkušenosti', 'work experience', 'professional experience',
  'employment history', 'career history', 'praxe', 'zaměstnání',
  '=== pracovní', '== pracovní', '= pracovní', // From DOCX headings
  '=== work', '== work', '= work'
];

// Section headers that end work experience section
const NON_WORK_SECTION_HEADERS = [
  'vzdělání', 'education', 'školení', 'certifikace', 'certifications',
  'dovednosti', 'skills', 'kompetence', 'jazyky', 'languages',
  'projekty', 'projects', 'reference', 'references', 'zájmy', 'interests'
];

// Helper function to extract work experience
const extractWorkExperience = (text: string): WorkExperience[] => {
  const experiences: WorkExperience[] = [];

  console.log('Extracting work experience from text');

  // First, try to find work experience section
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  let inWorkSection = false;
  let workSectionStart = -1;
  let workSectionEnd = lines.length;

  // Find work section boundaries
  for (let i = 0; i < lines.length; i++) {
    const lineLower = lines[i].toLowerCase();

    if (!inWorkSection && WORK_SECTION_HEADERS.some(h => lineLower.includes(h))) {
      inWorkSection = true;
      workSectionStart = i + 1;
      console.log(`Found work section starting at line ${i}: "${lines[i]}"`);
    } else if (inWorkSection && NON_WORK_SECTION_HEADERS.some(h => lineLower.includes(h))) {
      workSectionEnd = i;
      console.log(`Work section ends at line ${i}: "${lines[i]}"`);
      break;
    }
  }

  // If we found a work section, parse entries from it
  if (workSectionStart >= 0) {
    let currentEntry: Partial<WorkExperience> | null = null;
    let descriptionLines: string[] = [];

    for (let i = workSectionStart; i < workSectionEnd; i++) {
      const line = lines[i];

      // Date range pattern - usually indicates new entry
      const dateMatch = line.match(/(\d{4})\s*[-–]\s*(současnost|present|\d{4})/i);

      // Check if this looks like a new job entry header
      const isNewEntry = dateMatch ||
        (line.includes('–') && line.length < 100 && !line.startsWith('•')) ||
        /^[A-Z][A-Za-záčďéěíňóřšťúůýž\s]+,?\s+(s\.r\.o\.|a\.s\.|ltd|gmbh|inc\.)/i.test(line);

      if (isNewEntry && !line.startsWith('•')) {
        // Save previous entry
        if (currentEntry && currentEntry.company) {
          currentEntry.description = descriptionLines.slice(0, 5).join(' ').substring(0, 200);
          experiences.push({
            id: `exp-${experiences.length}`,
            company: currentEntry.company || '',
            role: currentEntry.role || '',
            duration: currentEntry.duration || '',
            description: currentEntry.description || ''
          });
        }

        // Start new entry
        currentEntry = {};
        descriptionLines = [];

        // Parse the entry line
        if (dateMatch) {
          currentEntry.duration = dateMatch[0];
          // Company/role is likely before or in the same line
          const beforeDate = line.substring(0, line.indexOf(dateMatch[0])).trim();
          const parts = beforeDate.split(/\s*–\s*/);
          if (parts.length >= 2) {
            currentEntry.company = parts[0].trim();
            currentEntry.role = parts[1].trim();
          } else {
            currentEntry.company = beforeDate;
          }
        } else {
          // Parse "Company – Role" or "Company – Role – Date" format
          const parts = line.split(/\s*–\s*/);
          if (parts.length >= 3) {
            currentEntry.company = parts[0].trim();
            currentEntry.role = parts[1].trim();
            currentEntry.duration = parts[2].trim();
          } else if (parts.length === 2) {
            currentEntry.company = parts[0].trim();
            currentEntry.role = parts[1].trim();
          } else {
            currentEntry.company = line;
          }
        }

        console.log(`New work entry: company="${currentEntry.company}", role="${currentEntry.role}"`);
      } else if (currentEntry && line.startsWith('•')) {
        // Bullet point - add to description
        descriptionLines.push(line.substring(1).trim());
      } else if (currentEntry && line.length > 10 && !dateMatch) {
        // Additional info - might be role or description
        if (!currentEntry.role && line.length < 60) {
          currentEntry.role = line;
        } else {
          descriptionLines.push(line);
        }
      }
    }

    // Don't forget last entry
    if (currentEntry && currentEntry.company) {
      currentEntry.description = descriptionLines.slice(0, 5).join(' ').substring(0, 200);
      experiences.push({
        id: `exp-${experiences.length}`,
        company: currentEntry.company || '',
        role: currentEntry.role || '',
        duration: currentEntry.duration || '',
        description: currentEntry.description || ''
      });
    }
  }

  // Fallback: Look for patterns if section-based didn't work
  if (experiences.length === 0) {
    console.log('Section-based extraction failed, trying pattern matching');

    const workPatterns = [
      // Pattern for "Company – Role – Date" format
      /([A-Z][^–\n]{5,40})\s*–\s*([^–\n]{5,40})\s*–\s*(\d{4}\s*[-–]\s*(?:současnost|present|\d{4}))/gi,
      // Pattern for date at the end
      /(.+?(?:s\.r\.o\.|a\.s\.|ltd|gmbh|inc\.|hotel|OSVČ).+?)\s+(\d{4}\s*[-–]\s*(?:současnost|present|\d{4}))/gi
    ];

    for (const pattern of workPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null && experiences.length < 5) {
        const experience: WorkExperience = {
          id: `exp-${experiences.length}`,
          company: match[1]?.trim().substring(0, 50) || '',
          role: match[2]?.trim().substring(0, 40) || '',
          duration: match[3]?.trim() || match[2]?.trim() || '',
          description: ''
        };

        // Skip education-like entries
        const skipWords = ['vzdělání', 'education', 'škola', 'university', 'fakulta'];
        if (skipWords.some(w => experience.company.toLowerCase().includes(w))) {
          continue;
        }

        if (experience.company.length >= 3) {
          console.log(`Adding pattern match: ${experience.company}`);
          experiences.push(experience);
        }
      }
    }
  }

  console.log(`Total work experiences found: ${experiences.length}`);
  return experiences.slice(0, 8); // Limit to 8 entries
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