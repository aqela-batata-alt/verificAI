import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// ADR-006 (proposta, a confirmar): o build estático é servido pelo mesmo nginx da API,
// em "/", e a API fica em "/api/" (mesma origem). No desenvolvimento, o Vite imita isso
// repassando "/api" ao Django.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxy = {
    '/api': {
      target: env.DEV_API_PROXY_TARGET || 'http://localhost:8000',
      changeOrigin: false,
    },
  }

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 4173, proxy },
    build: {
      target: 'es2022',
      sourcemap: false,
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.js'],
      include: ['src/**/*.test.{js,jsx}'],
      css: false,
      restoreMocks: true,
      clearMocks: true,
    },
  }
})
