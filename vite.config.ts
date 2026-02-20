import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  base: '/', // Use absolute paths for assets
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          if (id.includes('/@supabase/')) return 'vendor-supabase';
          // Keep Sentry with the generic vendor chunk to avoid circular-chunk edge cases.
          if (id.includes('/@sentry/')) return 'vendor';
          if (id.includes('/@google/genai/')) return 'vendor-ai';
          if (id.includes('/pdfjs-dist/build/pdf.worker')) return 'vendor-pdf-worker';
          if (id.includes('/pdfjs-dist/') || id.includes('/mammoth/')) return 'vendor-docs';
          if (id.includes('/recharts/')) return 'vendor-charts';
          if (id.includes('/@openrouter/sdk/')) return 'vendor-ai';
          if (id.includes('/@stripe/')) return 'vendor-stripe';
          if (id.includes('/resend/')) return 'vendor-email';
          if (id.includes('/lodash') || id.includes('/underscore')) return 'vendor-utils';
          // Keep i18n in generic vendor to avoid circular chunk graph.
          if (id.includes('/i18next/') || id.includes('/react-i18next/') || id.includes('/i18next-browser-languagedetector/') || id.includes('/i18next-http-backend/')) return 'vendor';
          if (id.includes('/@stripe/stripe-js/')) return 'vendor-stripe';
          if (id.includes('/@vercel/analytics/')) return 'vendor-analytics';
          if (id.includes('/framer-motion/') || id.includes('/lucide-react/')) return 'vendor-ui';
          if (id.includes('/markdown-to-jsx/') || id.includes('/marked/')) return 'vendor-markdown';
          return 'vendor';
        }
      }
    }
  },
  root: process.cwd(), // Explicitly set root to current directory
  publicDir: 'public',
  define: {
    // Avoid leaking full process.env into client bundle
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});
