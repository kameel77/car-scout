import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/modules/employee-program/auth/**/__tests__/**/*.unit.test.ts',
      'src/modules/employee-program/auth/**/__tests__/**/*.isolated.test.ts',
      'src/middleware/__tests__/platform-jwt.test.ts'
    ],
    exclude: ['node_modules', 'dist'],
    testTimeout: 10000,
    hookTimeout: 10000,
    globals: true,
    environment: 'node',
  },
});
