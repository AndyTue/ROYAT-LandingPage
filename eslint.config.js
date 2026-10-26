// @ts-check
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      '.lighthouseci/',
      'public/img/',
      // Material local que no forma parte del repo.
      '.claude/',
      'docs/',
      'reference/',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
    rules: {
      eqeqeq: 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: {
      // CSP y seguridad: el HTML se genera en el build; en runtime solo textContent o <template>.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name=/^(innerHTML|outerHTML)$/]',
          message: 'Usa textContent o <template> + cloneNode (STANDARDS §3).',
        },
        {
          selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: 'Usa <template> + cloneNode (STANDARDS §3).',
        },
      ],
      'no-eval': 'error',
      'no-implied-eval': 'error',
    },
  },
  {
    files: ['*.js', 'scripts/**/*.{js,mjs}', 'tests/**/*.js'],
    languageOptions: { globals: globals.node },
  },
];
