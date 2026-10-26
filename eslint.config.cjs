const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  { ignores: ['spikes/**', '**/node_modules/**', '**/dist/**', '**/.expo/**'] },
  expoConfig,
  {
    settings: {
      'import/resolver': {
        typescript: {
          project: ['apps/mobile/tsconfig.json', 'packages/*/tsconfig.json'],
        },
      },
    },
  },
]);
