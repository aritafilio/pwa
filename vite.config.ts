// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Proxy solo en desarrollo (npm run dev)
  server: {
    proxy: {
      // Todo lo que empiece con /api se redirige a tu backend local
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Opcional: reescribe si tu backend NO tiene prefijo /api
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  // Opcional: también en vite preview (npm run build && npm run preview)
  preview: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
