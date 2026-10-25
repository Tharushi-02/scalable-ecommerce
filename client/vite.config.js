import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Anything starting with /api is forwarded to the Express API
      '/api': 'http://localhost:4000',
    },
  },
});