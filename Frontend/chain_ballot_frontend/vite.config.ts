import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,        
  },
  // base: process.env.VITE_BASE_PATH || "/Chainballot-Online-voting-system-with-Blockchain/tree/main/Frontend/chain_ballot_frontend"
})
