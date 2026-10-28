// @ts-check

// As apps/web does: plugins resolve from the shared config's own
// dependencies, not from whatever this workspace hoists.
require('@bigcommerce/eslint-config/patch');

/** @type {import('eslint').Linter.LegacyConfig} */
const config = {
  root: true,
  extends: ['@bigcommerce/catalyst/base', '@bigcommerce/catalyst/prettier'],
  rules: {
    '@typescript-eslint/consistent-type-assertions': 'off',
    '@typescript-eslint/naming-convention': 'off',
    'no-underscore-dangle': ['error', { allow: ['__typename'] }],
    'check-file/filename-naming-convention': 'off',
  },
  ignorePatterns: ['/src/generated/**', '/dist/**'],
};

module.exports = config;
