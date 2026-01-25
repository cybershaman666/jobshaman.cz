# Deployment Guide for Vercel

## Environment Variables Setup

You need to set these environment variables in your Vercel dashboard:

### Frontend Environment Variables (Prefix with VITE_)
- `VITE_SUPABASE_URL`: Your Supabase project URL
  - Example: `https://frquoinhhxkxnvcyomtr.supabase.co`
- `VITE_SUPABASE_KEY`: Your Supabase anonymous/public key
  - Get from Supabase Dashboard > Settings > API > anon/public key
- `VITE_RESEND_API_KEY`: Your Resend API key for emails
- `VITE_STRIPE_PUBLISHABLE_KEY`: Your Stripe publishable key

## Steps to Set Up Vercel Environment Variables:

1. Go to your Vercel dashboard
2. Select your JobShaman project
3. Go to Settings > Environment Variables
4. Add each variable with the exact name and value
5. Make sure to include the `VITE_` prefix for frontend variables
6. Redeploy your application

## Issues Fixed

✅ **Storage Bucket References**: Updated to use existing `cvs` and `profile_photos` buckets
✅ **Singleton Pattern**: Implemented to prevent multiple Supabase client instances
✅ **Authentication**: Added better session handling and token refresh logic
✅ **Environment Variables**: Added proper Vercel configuration

## Production Checklist

- [ ] Set all environment variables in Vercel dashboard
- [ ] Verify Supabase storage buckets exist (`cvs`, `profile_photos`)
- [ ] Check RLS policies on storage buckets
- [ ] Test authentication flow
- [ ] Test CV upload functionality
- [ ] Test profile photo upload

## Common Issues and Solutions

### "Bucket not found" Error
**Solution**: Make sure buckets `cvs` and `profile_photos` exist in Supabase Storage

### "Invalid Refresh Token" Error  
**Solution**: Clear browser localStorage and login again, or implement the singleton client pattern

### Cookie Domain Issues
**Solution**: Ensure your Supabase project settings match your production domain