import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [
        ...configDefaults.exclude,
        'e2e/**',
        'tests/e2e/**',
        'tests/database/**',   // real DB — run separately with test:db
        'tests/stripe/**',     // real Stripe — run separately with test:stripe
      ],
      root: fileURLToPath(new URL('./', import.meta.url)),
      coverage: {
        provider:  'v8',
        reporter:  ['text', 'json', 'html'],
        include:   ['src/services/**', 'src/composables/**', 'src/stores/**'],
        exclude:   ['src/services/supabaseClient.ts', 'src/**/*.d.ts'],
      },
    },
  }),
)
