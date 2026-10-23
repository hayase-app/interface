import config from 'eslint-config-standard-universal'
import _globals from 'globals'
import tseslint from 'typescript-eslint'

import svelteConfig from './svelte.config.js'

export default tseslint.config(
  ...config({
    ..._globals.browser,
    ..._globals.worker,
    ..._globals.serviceworker,
    AudioWorkletProcessor: false,
    currentTime: false,
    sampleRate: false,
    registerProcessor: false,
    PresentationConnectionEventMap: false,
    PresentationRequestEventMap: false
  }),
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: { allowDefaultProject: ['tests/*.mjs'] },
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
      ],
      'svelte/no-navigation-without-resolve': ['off']
    }
  },
  {
    files: ['tests/*.mjs'],
    languageOptions: {
      globals: _globals.node
    }
  }
)
