import { defineConfig } from 'vite';

// This is a dummy config for Vercel.
// The actual frontend code is in the 'frontend' directory.
// Vercel runs 'npm run build' in the root, which delegates to the frontend folder,
// and copies the result into 'dist' in the root.
// This file ensures Vercel knows to serve from the 'dist' folder.

export default defineConfig({});
