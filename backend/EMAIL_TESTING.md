# Email Testing Guide

## Problem Identified

The Resend email service is configured but emails are not being sent. Here's what was found:

### Issues Found:

1. ✅ **FIXED**: Missing `RESEND_API_KEY` in backend environment files
   - Added to `/backend/.env`
   - Added to `/backend/.env.local`

2. ⚠️ **ACTION REQUIRED**: Missing Python `resend` package
   - Package is listed in `requirements.txt` but not installed in your environment

## How to Fix

### Option 1: Install in Virtual Environment (Recommended)

```bash
cd /home/misha/Stažené/jobshaman/backend

# Create virtual environment
python -m venv venv

# Activate it (fish shell)
source venv/bin/activate.fish

# Install dependencies
pip install -r requirements.txt

# Test email
python test_email.py
```

### Option 2: Install with pipx (Alternative)

```bash
# Install pipx if not already installed
sudo pacman -S python-pipx

# Install resend
pipx install resend
```

### Option 3: System-wide (Not Recommended)

```bash
pip install --break-system-packages resend
```

## Testing Email Functionality

Once dependencies are installed, run:

```bash
cd /home/misha/Stažené/jobshaman/backend
python test_email.py
```

**Expected output:**
```
============================================================
🧪 Testing Resend Email Configuration
============================================================
✅ RESEND_API_KEY is set: re_8e5t1i6...4Cha

📧 Sending test email...
📧 Attempting to send email to floki@jobshaman.cz: 🧪 Test Email from JobShaman
✅ Email sent successfully to floki@jobshaman.cz

✅ Test email sent successfully to floki@jobshaman.cz
📬 Please check your inbox (and spam folder)
```

## Where Emails Are Sent From

The app sends emails in these scenarios:

1. **Job Legality Check** (`/backend/app/routers/jobs.py`):
   - When a job is flagged as illegal or needs review
   - Sends to admin: `floki@jobshaman.cz`
   - Sends to recruiter: their registered email

2. **Assessment Results** (`/backend/app/routers/assessments.py`):
   - When candidate assessment is completed
   - Sends results to candidate's email

## Verifying Email Configuration

Check if API key is loaded:

```bash
cd /home/misha/Stažené/jobshaman/backend
python -c "from app.core.config import RESEND_API_KEY; print('API Key:', RESEND_API_KEY[:10] + '...' if RESEND_API_KEY else 'NOT SET')"
```

## Production Deployment

Make sure to set `RESEND_API_KEY` environment variable on Render.io:

1. Go to Render.io dashboard
2. Select your backend service
3. Environment → Add environment variable
4. Key: `RESEND_API_KEY`
5. Value: `re_8e5t1i6j_MbS1pmYYPY64uuA9Tkjj4Cha`

## Next Steps

1. Install Python dependencies (see options above)
2. Run test script: `python test_email.py`
3. Check email inbox (and spam folder)
4. If test succeeds, emails should work in production too
5. Update Render.io environment variables if needed
