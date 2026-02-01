# Fixing Vercel Analytics Domain Error

## Problem

Vercel Analytics is trying to load script from:
```
https://jobshaman.com/_vercel/insights/script.js
```

But the correct domain is `jobshaman.cz`, causing a 404 error.

## Root Cause

Vercel Analytics automatically uses the production domain configured in your Vercel project settings. The error indicates that:

1. Your Vercel project has `jobshaman.com` configured as a domain
2. But the actual production domain should be `jobshaman.cz`

## Solution

### Option 1: Fix Domain in Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `jobshaman` project
3. Go to **Settings** → **Domains**
4. Check configured domains:
   - If `jobshaman.com` is listed, **remove it**
   - Make sure `jobshaman.cz` is set as the **primary domain**
5. Redeploy the project

### Option 2: Disable Analytics Temporarily

If you don't need analytics right now, you can disable it:

**In `App.tsx` (line 778):**
```tsx
{/* Vercel Analytics */}
{false && <Analytics />}  {/* Temporarily disabled */}
```

### Option 3: Configure Analytics Manually

Add explicit configuration to Analytics component:

**In `App.tsx` (line 778):**
```tsx
{/* Vercel Analytics */}
<Analytics 
  mode={import.meta.env.PROD ? 'production' : 'development'}
  debug={!import.meta.env.PROD}
/>
```

## Verification

After fixing the domain:

1. Clear browser cache
2. Visit `https://jobshaman.cz`
3. Open DevTools → Console
4. Verify no errors about `_vercel/insights/script.js`
5. Check Network tab - script should load from `jobshaman.cz`

## Additional Notes

- Vercel Analytics only works on Vercel-hosted projects
- The script URL is automatically generated based on your project's primary domain
- If you have multiple domains, make sure the correct one is set as primary

## Current Status

✅ Analytics component is enabled in code
⚠️ Need to fix domain configuration in Vercel Dashboard
