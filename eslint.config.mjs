// One ESLint config for the whole monorepo. Sections: shared TypeScript rules, the NestJS
// services (CLAUDE.md A/AN/MO rules made mechanical) and the Astro + React apps (W/WA rules).
import js from '@eslint/js';
import astro from 'eslint-plugin-astro';
import betterTailwind from 'eslint-plugin-better-tailwindcss';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { fileURLToPath } from 'node:url';

/** better-tailwindcss reads the real app CSS (Tailwind + HeroUI + brand theme), by absolute path. */
const tailwindEntry = (app) =>
  fileURLToPath(new URL(`./apps/${app}/src/styles/global.css`, import.meta.url));

const SERVICES = ['apps/api/**/*.ts', 'apps/card-network/**/*.ts', 'packages/nest-core/**/*.ts'];
const WEB_TSX = ['apps/web/**/*.tsx', 'apps/admin/**/*.tsx', 'packages/ui/**/*.tsx'];
const UI_WRAPPERS = ['packages/ui/src/components/**/*.tsx'];

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/.astro/**',
      '**/node_modules/**',
      '**/generated/**',
      '.claude/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-console': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: SERVICES,
    rules: {
      // Nest classes are referenced through decorators and DI only.
      '@typescript-eslint/no-extraneous-class': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'NewExpression[callee.name=/^(BadRequest|NotFound|Forbidden|Unauthorized|Conflict|InternalServerError)Exception$/]',
          message: 'AN3: throw AppHttpException with a catalog code instead.',
        },
        {
          selector: "NewExpression[callee.name='PrismaClient']",
          message:
            'AN4: inject PrismaService; PrismaClient only in seed, scripts and test harness.',
        },
        {
          selector: 'MemberExpression[property.name=/^(\\$queryRawUnsafe|\\$executeRawUnsafe)$/]',
          message: 'AN6: raw SQL only through tagged $queryRaw / $executeRaw templates.',
        },
        {
          selector: "CallExpression[callee.object.name='Prisma'][callee.property.name='raw']",
          message: 'AN6: Prisma.raw is banned.',
        },
        {
          selector: "CallExpression[callee.name='parseFloat']",
          message: 'MO1/A6: money is integer cents; never parseFloat.',
        },
      ],
    },
  },
  {
    files: [
      'apps/*/prisma/seed.ts',
      'apps/*/scripts/**/*.ts',
      'apps/*/test/**/*.ts',
      'apps/*/src/**/__tests__/**/*.ts',
      'packages/nest-core/src/**/__tests__/**/*.ts',
    ],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    files: WEB_TSX,
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
      'better-tailwindcss': betterTailwind,
    },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: {
      react: { version: '19.3' },
      'better-tailwindcss': { entryPoint: tailwindEntry('web') },
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...betterTailwind.configs['recommended-error'].rules,
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
      'better-tailwindcss/no-unregistered-classes': 'off',
      'react/prop-types': 'off',
      'react/no-danger': 'error',
      'react/forbid-elements': [
        'error',
        {
          forbid: ['button', 'input', 'select', 'textarea', 'table'].map((element) => ({
            element,
            message: 'W7: use the @acme/ui wrapper.',
          })),
        },
      ],
    },
  },
  {
    files: UI_WRAPPERS,
    rules: { 'react/forbid-elements': 'off' },
  },
  ...astro.configs.recommended,
  ...astro.configs['jsx-a11y-recommended'],
  {
    // WA9: canonical Tailwind v4 classes in .astro too, where all static markup lives (WA1).
    files: ['apps/*/src/**/*.astro', 'packages/ui/src/**/*.astro'],
    plugins: { 'better-tailwindcss': betterTailwind },
    settings: { 'better-tailwindcss': { entryPoint: tailwindEntry('web') } },
    rules: {
      ...betterTailwind.configs['recommended-error'].rules,
      'better-tailwindcss/enforce-consistent-line-wrapping': 'off',
      'better-tailwindcss/no-unregistered-classes': 'off',
    },
  },
  {
    files: ['apps/admin/**/*.{tsx,astro}'],
    settings: { 'better-tailwindcss': { entryPoint: tailwindEntry('admin') } },
  },
  {
    // OB1: observability SDKs only inside observability/adapters/.
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}'],
    ignores: ['**/observability/adapters/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@sentry/*', 'posthog-*', '@logtail/*', '@opentelemetry/*', 'dd-trace'],
              message: 'OB1: import observability SDKs only in observability/adapters/.',
            },
          ],
        },
      ],
    },
  },
);
