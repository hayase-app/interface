import config from 'eslint-config-standard-universal'
import _globals from 'globals'
import tseslint from 'typescript-eslint'

import svelteConfig from './svelte.config.js'

export default tseslint.config(
  ...config({
    ..._globals.browser,
    ..._globals.worker,
    ..._globals.serviceworker
  }),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        svelteConfig
      }
    },
    ignores: ['build/', '.svelte-kit/', 'node_modules/'],
    rules: {
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        {
          ignoreConditionalTests: true,
          ignoreMixedLogicalExpressions: false,
          ignorePrimitives: true
        }
      ]
    }
  }
)
