import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/modules/employee-program/**/__tests__/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      'src/modules/employee-program/**/__tests__/**/*.isolated.test.ts',
      'src/modules/employee-program/**/__tests__/**/*.unit.test.ts'
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
    globals: true,
    environment: 'node',
    fileParallelism: false,
    // NO globalSetup to prevent loading .env
  },
});
