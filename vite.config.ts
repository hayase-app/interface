import { resolve } from 'node:path'

import { sveltekit } from '@sveltejs/kit/vite'
import license from 'rollup-plugin-license'
import { defineConfig, type Plugin } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const viteServerConfig = () => ({
  name: 'add-headers',
  configureServer: (server) => {
    server.middlewares.use((req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')
      next()
    })
  }
}) as Plugin

export default defineConfig({
  plugins: [
    sveltekit(),
    viteServerConfig(),
    license({
      thirdParty: {
        allow: '(MIT OR Apache-2.0 OR ISC OR BSD-3-Clause OR BSD-2-Clause)',
        output: resolve(import.meta.dirname, './build/LICENSE.txt'),
        includeSelf: true
      }
    }),
    viteStaticCopy({
      targets: [
        { // VITE IS DOG AND DOESNT SUPPORT DYNAMIC JSON IMPORTS
          src: 'node_modules/doc999tor-fast-geoip/data/*.json',
          dest: 'geoip/'
        }
      ]
    }),
    devtoolsJson()
  ],
  resolve: {
    alias: {
      path: 'path-esm',
      'node-fetch': '',
      // thank you bottleneck for importing useless modules
      './RedisConnection': resolve(import.meta.dirname, 'src/patches/empty.cjs'),
      './RedisConnection.js': resolve(import.meta.dirname, 'src/patches/empty.cjs'),
      './RedisDatastore': resolve(import.meta.dirname, 'src/patches/empty.cjs'),
      './IORedisConnection': resolve(import.meta.dirname, 'src/patches/empty.cjs'),
      './Scripts': resolve(import.meta.dirname, 'src/patches/empty.cjs'),
      debug: resolve(import.meta.dirname, 'src/patches/debug.ts')
    }
  },
  server: { port: 7344 },
  build: {
    target: 'es2020',
    sourcemap: true
  },
  ssr: {
    target: 'webworker'
  },
  optimizeDeps: {
    exclude: ['anitomyscript']
  }
})
