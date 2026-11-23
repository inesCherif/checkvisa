import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // pdf.worker is a separate web worker file (only fetched when a PDF is read), not part of the page.
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        // Firebase changes rarely: its own chunk stays cached across app deploys.
        manualChunks(id: string) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (id.includes('node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
});
