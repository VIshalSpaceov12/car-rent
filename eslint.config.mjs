import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/.expo/**', '**/node_modules/**', '.superpowers/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // token discipline (web): forbid raw hex in JSX-ish strings + raw left/right margins
      'no-restricted-syntax': [
        'warn',
        {
          selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]",
          message: 'No raw hex — use design tokens / CSS variables (see design.md).',
        },
      ],
    },
  },
  {
    files: ['apps/**/src/app/**/*.tsx', 'apps/**/src/ui/**/*.tsx'],
    rules: { 'no-restricted-syntax': ['error', { selector: "Literal[value=/#[0-9a-fA-F]{3,8}/]", message: 'No raw hex in JSX — use CSS variables.' }] },
  },
  // CommonJS Node config files (babel.config.js, metro.config.js, etc.) use CJS globals
  {
    files: ['**/*.config.js', '**/*.config.cjs'],
    languageOptions: {
      globals: {
        module: 'writable',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        exports: 'writable',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      'no-undef': 'off',
    },
  },
);
