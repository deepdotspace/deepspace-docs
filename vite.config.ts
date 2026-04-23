import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import generouted from '@generouted/react-router/plugin'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), generouted(), cloudflare()],
  resolve: {
    dedupe: ['react', 'react-dom', 'better-auth'],
  },
})
