import typescript from 'eslint-config-next/typescript';

// Keep the TypeScript checks used by the workspace reproducible when this
// repository is checked out on its own (CI must not depend on a parent config).
export default [
  { ignores: ['.next/**', 'node_modules/**', 'vendor/**', 'public/**', 'out/**', 'build/**', 'playwright-report/**', 'test-results/**', 'next-env.d.ts'] },
  ...typescript.map(config => ({ ...config, files: ['**/*.ts', '**/*.tsx'] })),
  { files: ['**/*.ts', '**/*.tsx'], rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/no-unused-expressions': 'error',
    'prefer-const': 'error',
  } },
];
