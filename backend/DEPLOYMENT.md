# Render.io Deployment Guide

This guide explains how to deploy the JobShaman backend services to Render.io.

## Prerequisites
1. A [Render.io](https://render.com) account.
2. A GitHub/GitLab repository with your code.
3. API Keys for:
   - Supabase (URL and Key)
   - Google Gemini (for legality checks)
   - Resend (for email notifications)
   - Stripe (Secret Key for payment processing)

## Deployment Steps

### Option 1: Using Blueprint (Recommended)
The project includes a `render.yaml` file that defines all services.
1. Go to the Render Dashboard.
2. Click **New +** -> **Blueprint**.
3. Connect your repository.
4. Render will automatically detect `render.yaml` and propose creating:
   - `jobshaman-backend` (FastAPI Web Service with integrated Scraper)
5. Fill in the missing **Environment Variables** when prompted:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `GEMINI_API_KEY`
   - `RESEND_API_KEY`
   - `STRIPE_SECRET_KEY` (Your Stripe Secret Key, starting with `sk_`)
   - `SECRET_KEY` (Any random string for one-click tokens)
   - `API_BASE_URL` (Your Render URL, e.g., `https://jobshaman-backend.onrender.com`)
6. Click **Apply**.

### Option 2: Manual Setup (If Blueprint fails)
If you created the Web Service manually, you **MUST** set these values in **Settings**:
- **Build Command**: `pip install -r backend/requirements.txt` (or just `pip install -r requirements.txt`)
- **Start Command**: `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --chdir backend --bind 0.0.0.0:$PORT --timeout 120`

### ⚠️ Troubleshooting: Build Failed / Start Failed
1. **requirements.txt not found**: If Render fails during build, ensure your **Build Command** is set correctly. *Fixed: I have also added a copy of `requirements.txt` to the root directory for extra safety.*
2. **No module named 'backend' / 'app'**: If Render fails to start, ensure your **Start Command** includes `--chdir backend`.

**TO FIX IT:**
1. Go to **Settings** in your Render dashboard for `jobshaman-backend`.
2. Find **Build Command** and ensure it is: `pip install -r requirements.txt`
3. Find **Start Command** and ensure it is exactly:
   `gunicorn -k uvicorn.workers.UvicornWorker app.main:app --chdir backend --bind 0.0.0.0:$PORT --timeout 120`
4. Click **Save Changes**.

### 🧹 Deep Clean Procedure (Run this locally)
The server is likely seeing old versions of files. Run these exact commands in your terminal to fix it:
```bash
# 1. Ensure old files are physically gone
rm backend/scraper_multi.py 
rm scraper_multi.py

# 2. Tell Git to track these deletions!
git add .
git commit -m "chore: clean up backend structure and fix imports"
git push origin main
```

### 🔑 Environment Variables Checklist
Ensure these are set in Render -> Settings -> Environment Variables:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `GEMINI_API_KEY`
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY` (Starts with `sk_`, get from Stripe Dashboard > API Keys)
- `SECRET_KEY` (Can be anything)
- `API_BASE_URL` (e.g. https://jobshaman-cz.onrender.com)

## Integrated Scraper (Free Plan)
The scraper is now baked into the API service. It runs automatically every 12 hours.
- To trigger it manually, visit: `https://your-app.onrender.com/scrape`
- **Tip**: Since Render's free tier sleeps after 15 mins of inactivity, use a service like [cron-job.org](https://cron-job.org) to ping the `/scrape` endpoint every 12 hours. This will wake up the app and perform the scraping.

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
