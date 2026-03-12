import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/__mocks__/**'],
    },
  },
  resolve: {
    alias: {
      vscode: path.resolve(__dirname, './src/__mocks__/vscode.ts'),
    },
  },
});
