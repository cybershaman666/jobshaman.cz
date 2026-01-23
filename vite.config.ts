import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: process.cwd(), // Explicitly set root to current directory
  publicDir: 'public',
  base: './', // Use relative paths for Vercel deployment
  define: {
    // Polyfill process.env for local development if needed by some libs
    'process.env': process.env
  },
  server: {
    host: '0.0.0.0', // Allow external access
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['lucide-react'],
          supabase: ['@supabase/supabase-js'],
          charts: ['recharts']
        }
      }
    }
  }
});