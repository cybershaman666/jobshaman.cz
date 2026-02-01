<div align="center">
<h1>🧙‍♂️ JobShaman</h1>
<p><em>Radical honesty in hiring. AI-powered recruitment that decodes reality and filters bullshit.</em></p>

![Badge](https://img.shields.io/badge/React-18.2.0-blue)
![Badge](https://img.shields.io/badge/FastAPI-0.109.0-green)
![Badge](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Badge](https://img.shields.io/badge/AI-Gemini_1.5_Flash-purple)
![Badge](https://img.shields.io/badge/Stripe-Payments-blue)

</div>

## 🎯 Vision: Radical Truth (Radikální pravda)

JobShaman isn't just another job board. It's an ecosystem designed to eliminate corporate noise and shallow recruitment processes. We believe in **Radical Truth** for candidates and **No-Bullshit Evaluation** for companies.

Using advanced AI, we translate vague job descriptions into "Commute Reality" and "Salary Truth," while providing recruiters with a **Digital Assessment Center** that evaluates the core essence of a candidate, not just their CV.

---

## ✨ Key Features

### 🏢 For Recruiters: The Digital AC
*   **🤖 Digital Assessment Center (AC)**: Automated generation of comprehensive evaluation tests.
    *   **Probing Scenarios**: "Bullshit vs. Reality" tasks that test integrity and ethics.
    *   **Practical Case Studies**: Real-world job samples (Code for devs, Scenarios for planners, etc.).
    *   **Cognitive Logic**: Evaluation of prioritization and analytical thinking.
*   **🔬 Qualitative AI Analysis (Founder's Sidekick)**:
    *   Gemini-powered evaluation of candidate answers.
    *   Deep insights into *how* the candidate thinks, not just *what* they know.
    *   Direct qualitative hiring recommendations (e.g., "High integrity professional", "Theoretical junior").
*   **📊 Recruiter Dashboard**: Full control over job postings, applicant invitations, and detailed result analysis.
*   **💳 Global Invoicing & Stripe**: Automated billing and subscription management for premium recruitment features.

### 🔍 For Candidates: Reality Decoding
*   **📊 Job Happiness Index (JHI)**: A composite score (0-100) based on financial gain, time cost, and mental load.
*   **🚫 Bullshit Meter**: AI-driven red-flag detection in job descriptions.
*   **🚗 Commute Reality**: Real-time calculation of distance, cost, and time spent commuting (Public transport vs. Car).
*   **💰 Financial Clarity**: Net salary calculators and benefit impact analysis.
*   **🤖 Smart Preparation**: AI-generated CV optimizations and cover letters tailored to specific JHI insights.

---

## 🛠️ Tech Stack

### Frontend & UI
*   **React 18.2** with **TypeScript** & **Vite**.
*   **Tailwind CSS**: Modern, dark-mode-first glassmorphic design.
*   **Lucide React**: High-quality SVG icon system.
*   **Framer Motion**: Smooth, performant micro-interactions.

### Backend & Core
*   **FastAPI (Python)**: Robust, asynchronous API handling.
*   **Supabase (PostgreSQL)**: Managed database with RLS policies, Auth, and Storage.
*   **Google Gemini 1.5 Flash**: Orchestrates high-speed AI analysis and assessment generation.
*   **Stripe**: Secure payment processing and billing infrastructure.
*   **Resend**: Transactional email delivery for invitation tokens.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18.x
- Python >= 3.10
- Supabase Project & Google Gemini API Key

### Installation

1.  **Clone the infrastructure**
    ```bash
    git clone <repository-url>
    cd jobshaman
    npm install
    ```

2.  **Environment Setup**
    Configure your `.env.local` (Frontend) and `backend/.env` (Backend) with:
    - `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`
    - `GEMINI_API_KEY`
    - `STRIPE_SECRET_KEY`
    - `RESEND_API_KEY`

3.  **Run the Shaman**
    ```bash
    # Terminal 1: Frontend
    npm run dev

    # Terminal 2: Backend
    cd backend
    uvicorn app.main:app --reload
    ```

---

## 📂 Project Structure

```
├── backend/app/          # FastAPI logic & Database models
├── components/           # React Components (UI, Dashboard, AC)
├── services/             # AI (Gemini), Supabase, & Stripe wrappers
├── pages/                # High-level views (Search, Invitations, Profile)
├── database/             # SQL Migrations & Schema definitions
└── public/locales/       # I18n translations (CS, EN, DE, SK, PL)
```

## 📄 License & Status
**Proprietary.** Developed as a next-generation hiring platform. 
Join us in making job searching more transparent and humane.

---

<div align="center">
<p><em>Built with ❤️ for a world where everyone knows exactly what they're signing up for.</em></p>
</div>