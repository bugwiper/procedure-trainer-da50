import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const DETERMINISM_MESSAGE =
  'Pure code replays bit for bit in node and every browser: no Math.random, Math.exp, Math.pow or ** (use + - * / and the engine clamp and quantise).';

const PURITY_MESSAGE =
  'src/engine, src/scenario and src/aircraft stay framework-free and deterministic: no Preact/UI imports, no browser globals, no timers, no wall-clock time.';

export default defineConfig([
  globalIgnores([
    'dist',
    'dist-e2e',
    'node_modules',
    'playwright-report',
    'test-results',
    '.planning',
    '.input',
  ]),
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // The project service cannot see JS config files (TS 6 solution-style tsconfig).
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Purity boundary: deterministic grading engine and aircraft data (CLAUDE.md).
    files: ['src/engine/**/*.ts', 'src/aircraft/**/*.ts', 'src/scenario/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['preact', 'preact/*', '@preact/*', '**/ui/**'], message: PURITY_MESSAGE },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...[
          'window',
          'document',
          'navigator',
          'localStorage',
          'sessionStorage',
          'setTimeout',
          'setInterval',
          'requestAnimationFrame',
          'fetch',
        ].map((name) => ({ name, message: PURITY_MESSAGE })),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: PURITY_MESSAGE },
        { object: 'performance', property: 'now', message: PURITY_MESSAGE },
        { object: 'Math', property: 'random', message: DETERMINISM_MESSAGE },
        { object: 'Math', property: 'exp', message: DETERMINISM_MESSAGE },
        { object: 'Math', property: 'pow', message: DETERMINISM_MESSAGE },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: "BinaryExpression[operator='**']", message: DETERMINISM_MESSAGE },
        { selector: "AssignmentExpression[operator='**=']", message: DETERMINISM_MESSAGE },
      ],
    },
  },
]);
