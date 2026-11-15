import { loadConfig } from '@sveltejs/load-config'
import config from 'eslint-config-standard-universal'
import _globals from 'globals'
import tseslint from 'typescript-eslint'

const configResult = await loadConfig('./', { traverse: false })
const svelteConfig = configResult && 'config' in configResult ? configResult.config : undefined

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
  }
)
