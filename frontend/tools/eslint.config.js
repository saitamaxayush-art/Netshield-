// ESLint flat config for the NetShield frontend. Run from frontend/ via `npm run lint`.
// Lives in tools/ so plugins resolve from the isolated tools package (see tools/package.json).
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', '**/node_modules', 'tools/node_modules', 'test-results', 'playwright-report', 'src/types/api.generated.ts'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': ['error', { 'ts-ignore': true, 'ts-nocheck': true, 'ts-expect-error': 'allow-with-description' }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  {
    // Rule 2: the studio, dashboard and data layer show backend results only. The pure graph helpers
    // used by the landing page demos must never be imported there.
    files: ['src/pages/**', 'src/features/**', 'src/services/**', 'src/store/**', 'src/hooks/**', 'src/components/**', 'src/types/**'],
    ignores: ['src/pages/LandingPage.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/graphAlgorithms', '**/lib/graphAlgorithms.*', '**/lib/seededGraphGenerator', '**/lib/seededGraphGenerator.*', '@/landing/**', '**/landing/**'],
              message: 'Landing page helpers compute results locally. Studio, dashboard and data layer code must use backend results.',
            },
          ],
        },
      ],
    },
  },
  {
    // Playwright fixtures call a `use` callback that the hooks rule mistakes for React's use().
    files: ['e2e/**/*.ts'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  }
)
