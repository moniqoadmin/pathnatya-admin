import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'SHOULD_'],
  preview: {
    // Leading "." allows the domain and all Railway-generated subdomains
    allowedHosts: ['.up.railway.app'],
  },
})
