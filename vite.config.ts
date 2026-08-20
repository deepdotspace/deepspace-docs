import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import generouted from '@generouted/react-router/plugin'
import { cloudflare } from '@cloudflare/vite-plugin'
import { deepspaceBuild } from 'deepspace/build'

export default defineConfig({
  plugins: [
    react(),
    generouted(),
    cloudflare(),
    // Owns the app-id define, the client dedupe list, and removal of the
    // preview `.dev.vars` the Cloudflare plugin drops next to the built
    // worker in plaintext.
    deepspaceBuild({ appDir: fileURLToPath(new URL('.', import.meta.url)) }),
  ],
})
