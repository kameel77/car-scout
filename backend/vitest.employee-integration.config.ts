import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/modules/employee-program/auth/**/__tests__/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'src/modules/employee-program/auth/**/__tests__/**/*.isolated.test.ts',
      'src/modules/employee-program/auth/**/__tests__/**/*.unit.test.ts'
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
    // NO globalSetup to prevent loading .env
  },
});
