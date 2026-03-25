import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './'),
      '@workspace/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
    // Env vars injected for all tests
    env: {
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      REDIS_HOST: 'localhost',
      REDIS_PORT: '6379',
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    // Include existing co-located tests AND the new tests/ directory
    include: [
      'lib/**/*.test.ts',
      'tests/unit/**/*.test.ts',
      'tests/integration/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'node_modules', '.next'],
    },
  },
});
