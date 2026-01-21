import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Polyfill process.env for local development if needed by some libs
    'process.env': process.env
  },
  server: {
    port: 3000, // Explicitly set port 3000 as seen in error logs
    open: true
  }
});