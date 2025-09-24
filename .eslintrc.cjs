module.exports = {
  root: true,
  env: {
    node: true,
    es2022: true,
    browser: true
  },
  ignorePatterns: [
    'dist',
    'node_modules',
    'coverage',
    'build',
    '*.config.js',
    '*.config.cjs',
    'prisma/migrations/**/*',
    'infrastructure/**/*.yml',
    'infrastructure/**/*.yaml',
    'infrastructure/**/*.json'
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'unused-imports', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:import/recommended',
    'plugin:import/typescript',
    'prettier'
  ],
  rules: {
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    '@typescript-eslint/no-unused-vars': 'off',
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'import/order': [
      'warn',
      {
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true }
      }
    ]
  },
  settings: {
    'import/resolver': {
      typescript: {
        project: [
          __dirname + '/tsconfig.json',
          __dirname + '/apps/api/tsconfig.json',
          __dirname + '/apps/web/tsconfig.json'
        ]
      },
      node: {
        moduleDirectory: ['node_modules', 'apps/web/node_modules']
      }
    }
  }
};
