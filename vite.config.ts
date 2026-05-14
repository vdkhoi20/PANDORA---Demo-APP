import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    // Accept Host headers from common tunneling services so the dev server
    // can be reached through ngrok / cloudflared / localtunnel when demoing
    // from a different machine. Leading dots match any subdomain.
    allowedHosts: [
      'localhost',
      '127.0.0.1',
      '.nguyenvanloc.com',
      '.ngrok-free.app',
      '.ngrok-free.dev',
      '.ngrok.app',
      '.ngrok.io',
      '.trycloudflare.com',
      '.loca.lt',
    ],
  },
});
