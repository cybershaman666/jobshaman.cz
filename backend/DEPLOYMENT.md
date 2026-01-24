# Render.io Deployment Guide

This guide explains how to deploy the JobShaman backend services to Render.io.

## Prerequisites
1. A [Render.io](https://render.com) account.
2. A GitHub/GitLab repository with your code.
3. API Keys for:
   - Supabase (URL and Key)
   - Google Gemini (for legality checks)
   - Resend (for email notifications)

## Deployment Steps

### Option 1: Using Blueprint (Recommended)
The project includes a `render.yaml` file that defines all services.
1. Go to the Render Dashboard.
2. Click **New +** -> **Blueprint**.
3. Connect your repository.
4. Render will automatically detect `render.yaml` and propose creating:
   - `jobshaman-api` (FastAPI Web Service)
   - `jobshaman-scraper` (Background Worker)
5. Fill in the missing **Environment Variables** when prompted:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `GEMINI_API_KEY`
   - `RESEND_API_KEY`
6. Click **Apply**.

### Option 2: Manual Setup
If you prefer manual setup:
#### FastAPI Service
- **Service Type**: Web Service
- **Runtime**: Python
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`

#### Scraper Worker
- **Service Type**: Background Worker
- **Runtime**: Python
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `python backend/scraper/scraper_multi.py`

## Integration with Frontend
Once deployed, you should point your frontend (e.g., in a new `jobPublishService.ts`) to the `jobshaman-api` URL to trigger legality checks when a user creates an ad.

```typescript
// Example frontend call
async function publishJob(jobData) {
  // 1. Save to Supabase
  const { data } = await supabase.from('jobs').insert(jobData).select().single();
  
  // 2. Trigger Legality Check on Render
  fetch('https://your-api-url.onrender.com/check-legality', {
    method: 'POST',
    body: JSON.stringify({
      id: data.id,
      title: data.title,
      company: data.company,
      description: data.description
    })
  });
}
```
