module.exports = {
  extends: [
    '@loopback/eslint-config', // Extend LoopBack's base ESLint configuration
    'eslint:recommended', // Enforce recommended ESLint rules
    'plugin:@typescript-eslint/recommended', // Enable TypeScript-specific linting
    'plugin:prettier/recommended', // Integrate Prettier for consistent formatting
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  parser: '@typescript-eslint/parser', // Use TypeScript parser
  parserOptions: {
    project: './tsconfig.json', // Link ESLint to your TypeScript config
    tsconfigRootDir: __dirname,
    ecmaVersion: 2020, // Match your `target` in `tsconfig.json`
    sourceType: 'module', // Allow `import`/`export` syntax
  },
  plugins: [
    '@typescript-eslint', // TypeScript-specific linting rules
    'prettier', // Prettier integration
    'import',
  ],
  rules: {
    // Prettier Integration
    'prettier/prettier': 'error', // Treat formatting issues as errors

    // TypeScript Rules
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }], // Ignore unused variables prefixed with `_`
    '@typescript-eslint/no-explicit-any': 'warn', // Discourage usage of `any`
    '@typescript-eslint/explicit-function-return-type': 'off', // Disable enforced return types
    '@typescript-eslint/no-empty-function': 'warn', // Warn against empty functions
    '@typescript-eslint/consistent-type-imports': 'error', // Enforce consistent type-only imports

    // General JavaScript/ESLint Rules
    'no-console': 'warn', // Discourage `console.log` in production code
    'prefer-const': 'error', // Enforce `const` for variables that are never reassigned
    eqeqeq: ['error', 'always'], // Enforce strict equality checks
    curly: 'error', // Require curly braces for control statements

    // Import Rules
    'import/order': [
      'error',
      {
        groups: [
          ['builtin', 'external'],
          ['internal'],
          ['parent', 'sibling', 'index'],
        ],
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],
    'import/no-unresolved': 'off', // Let TypeScript handle unresolved imports

    // LoopBack Specific Overrides
    '@typescript-eslint/ban-ts-comment': 'off', // Allow `@ts-ignore` for LoopBack-specific use cases
    'no-shadow': 'off', // Avoid conflict with TypeScript `enum` declarations
    '@typescript-eslint/no-shadow': ['error'], // Enforce TypeScript's `no-shadow`

    // Formatting Rules
    'padding-line-between-statements': [
      'error',
      {
        blankLine: 'always',
        prev: ['if', 'for', 'while', 'switch', 'try'],
        next: '*',
      }, // Adds an empty line before control statements
      { blankLine: 'always', prev: 'block', next: '*' }, // Adds an empty line after block statements (like function declarations)
      { blankLine: 'always', prev: '*', next: 'return' }, // Adds an empty line before return statements
    ],
  },
  overrides: [
    {
      files: ['*.ts'],
      rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'off', // Don't enforce return types on module boundaries
      },
    },
    {
      files: ['*.test.ts', '*.spec.ts'], // Testing files
      env: {
        jest: true, // Enable Jest globals
      },
      rules: {
        'no-console': 'off', // Allow `console.log` in tests
      },
    },
  ],
  env: {
    node: true, // Node.js global variables and Node.js scoping
    es2020: true, // Support ES2020 features
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: './tsconfig.json', // Resolve paths based on TypeScript config
      },
    },
  },
};
