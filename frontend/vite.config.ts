import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['localhost', '127.0.0.1', 'host.docker.internal'],
    warmup: {
      clientFiles: ['./src/pages/auth/LoginPage.tsx', './src/pages/DashboardPage.tsx'],
    },
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: [
        '**/node_modules/**', '**/.git/**', '**/dist/**', '**/.tmp/**',
        '**/test-results*/**', '**/playwright-report/**',
      ],
    },
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-charts': ['recharts'],
          'vendor-ui': ['lucide-react'],
          'vendor-http': ['axios'],
          'vendor-state': ['zustand'],
        },
      },
    },
  },
})
