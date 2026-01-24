<div align="center">
<h1>🧙‍♂️ JobShaman</h1>
<p><em>Human-centric, noise-aware hiring platform that decodes job reality and measures happiness</em></p>

![Badge](https://img.shields.io/badge/React-18.2.0-blue)
![Badge](https://img.shields.io/badge/TypeScript-5.3.3-blue)
![Badge](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Badge](https://img.shields.io/badge/Vite-7.3.1-orange)
![Badge](https://img.shields.io/badge/AI-Gemini-purple)

</div>

## 🎯 About JobShaman

JobShaman is a revolutionary job platform that cuts through corporate noise and provides transparent, data-driven job analysis. We believe in realistic job happiness metrics, not just salary numbers. Our AI-powered platform filters out corporate clichés, calculates actual net income, and quantifies job satisfaction using verified metrics.

### ✨ Key Features

#### 🔍 **For Job Seekers**
- **📊 Job Happiness Index (JHI)**: Composite score (0-100) evaluating finances, time cost, mental load, growth, and values
- **🚫 Bullshit Meter**: AI detection of corporate clichés and red flags in job descriptions
- **💰 Financial Reality Calculator**: Actual net income after taxes, benefits, and commute costs
- **🚗 Commute Analysis**: Distance, time, and cost analysis with multiple transport modes
- **📋 CV Management**: Upload, parse, and manage multiple CV documents with automatic data extraction
- **🤖 AI-Powered Insights**: Job description analysis, salary estimation, and career path recommendations
- **📚 Skills Gap Analysis**: Identify missing skills and get learning resource recommendations

#### 🏢 **For Companies & Recruiters**
- **✍️ Job Description Optimization**: AI-powered ad optimization removing corporate jargon
- **🎯 Smart Candidate Matching**: AI-powered candidate-job compatibility scoring
- **📝 Assessment Creation**: Technical assessments for candidate evaluation
- **📈 Company Dashboard**: Comprehensive management interface with analytics
- **💡 Benefit Insights**: Market data on benefit popularity and employee impact

#### 🌟 **Unique Innovations**
- **🏆 EU Transparency Badge**: Highlights jobs with disclosed salary ranges
- **👻 Ghosting Rate Tracking**: Company response transparency metrics
- **🔄 Turnover Analysis**: Employee retention insights
- **📚 Career Pathfinder**: Government-funded courses marketplace with skill gap analysis
- **📉 Contextual Relevance Scoring**: Benefit relevance based on job type and work mode

## 🛠️ Tech Stack

### Frontend
- **React 18.2.0** with TypeScript
- **Vite** for lightning-fast development and builds
- **Tailwind CSS** with custom component design
- **Lucide React** for beautiful icons
- **Recharts** for data visualization
- **PWA Support** with offline capabilities

### Backend & Services
- **Supabase** (PostgreSQL) for database, auth, and storage
- **Google Gemini AI** for intelligent features
- **PDF.js** & **Mammoth** for document parsing
- **Resend** for email communications

### Infrastructure
- **Vercel Analytics** for usage tracking
- **Error Boundaries** for robust error handling
- **Cookie Consent** management for GDPR compliance

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.0.0
- Supabase account
- Google Gemini API key

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd jobshaman
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure the following variables in `.env.local`:
   ```bash
   # API Keys
   GEMINI_API_KEY=your_gemini_api_key
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_KEY=your_supabase_anon_key
   VITE_RESEND_API_KEY=your_resend_api_key
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

## 📱 Core User Flows

### 🎓 Job Seeker Journey
1. **Smart Registration** - Quick profile creation with CV parsing
2. **Intelligent Job Search** - Filter by location, benefits, JHI score, and commute time
3. **Deep Job Analysis** - View JHI breakdown, salary transparency, and red flag warnings
4. **Seamless Applications** - AI-generated cover letters and optimized CV selection
5. **Career Development** - Skills gap analysis with personalized learning paths

### 🏢 Company Experience
1. **Company Onboarding** - Create comprehensive company profiles
2. **Job Creation** - AI-optimized job postings with benefit insights
3. **Candidate Matching** - Intelligent scoring and assessment tools
4. **Analytics Dashboard** - Track application metrics and candidate quality

## 🗄️ Database Architecture

### Main Tables
- **profiles** - User authentication and basic information
- **candidate_profiles** - Extended candidate data (skills, experience, preferences)
- **recruiter_profiles** - Recruiter information and company associations
- **companies** - Company details, culture, and transparency metrics
- **jobs** - Job postings with scraped data and AI analysis
- **cv_documents** - CV file management and parsed content
- **learning_resources** - Career development courses and marketplace data
- **assessment_results** - Technical assessment and evaluation data

## 🧠 AI-Powered Features

### Job Analysis
- **Red Flag Detection** - Identifies toxic work culture indicators
- **Salary Estimation** - Predicts compensation for undisclosed salaries
- **Cultural Fit Analysis** - Evaluates alignment with work style preferences
- **Skill Requirements Parsing** - Extracts and categorizes required competencies

### Candidate Services
- **CV Intelligence** - Automatic skill and experience extraction
- **Cover Letter Generation** - Personalized, cliché-free content
- **Career Pathing** - Skills gap analysis with course recommendations
- **Interview Preparation** - Role-specific assessment practice

## 🔧 Development

### Build Commands
```bash
npm run dev      # Development server with hot reload
npm run build    # Production build
npm run preview  # Preview production build
```

### Project Structure
```
src/
├── components/          # React components
│   ├── ui/             # Reusable UI components
│   ├── JobCard.tsx     # Job listing with JHI score
│   ├── JHIChart.tsx    # Happiness index visualization
│   └── ProfileEditor.tsx # User profile management
├── services/           # Business logic and API calls
│   ├── supabaseService.ts
│   ├── geminiService.ts
│   └── jobService.ts
├── types/              # TypeScript type definitions
├── utils/              # Helper functions and utilities
└── App.tsx            # Main application router
```

## 🌍 Deployment

### Production Deployment
```bash
npm run build
```

The application is optimized for Vercel deployment with:
- **Edge Functions** for API routes
- **Image Optimization** for performance
- **Analytics** integration
- **PWA** capabilities

### Environment Variables
- **NODE_ENV** - Set to `production`
- **VITE_PROJECT_NAME** - Project identifier
- **VITE_BUILDER** - Build tool (vite)
- **FRAMEWORK** - Framework identifier (vite)

## 🔒 Security Features

- **Supabase RLS** - Row Level Security for data protection
- **JWT Authentication** - Secure token-based auth
- **CORS Configuration** - Cross-origin resource sharing policies
- **Input Sanitization** - Protection against XSS attacks
- **Secure File Upload** - Validated file uploads to Supabase Storage

## 📊 Analytics & Monitoring

- **Vercel Analytics** - Real-time performance metrics
- **Error Boundaries** - Graceful error handling
- **Performance Monitoring** - Load time optimization
- **User Journey Tracking** - Application usage insights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary and all rights are reserved.

## 🙏 Acknowledgments

- Built with modern web technologies and AI capabilities
- Powered by Supabase for backend services
- Enhanced with Google Gemini AI for intelligent features
- Designed with user privacy and transparency in mind

---

<div align="center">
<p>Made with ❤️ for better job experiences worldwide</p>
<p>Join us in making job searching more transparent and humane</p>
</div>