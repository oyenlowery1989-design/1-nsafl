import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      NEXT_PUBLIC_REWARD_ASSET_ISSUER: 'GAJVAQ5DCOJVZ6AL3P4QVDTGMOHRVHG6WJ6252SOCLTX5MXXX22Y67FL',
      // Module-level consts (e.g. REWARD_SENDER_SECRET in lib/stellar-payment.ts) read
      // process.env at import time; Vite hoists static imports above other top-level
      // statements, so a test file's inline `process.env.X = ...` before its import
      // runs too late. Declare env here instead — same reason NEXT_PUBLIC_REWARD_ASSET_ISSUER
      // is set above.
      REWARD_SENDER_SECRET: 'SAZRKJADWVP4YGBTRRSVOSTGKGXXOMLLEGPFSYIFJ2TB4L5SG5HNGCQV',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
