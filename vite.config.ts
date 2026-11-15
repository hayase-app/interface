import { readdir, readFile, writeFile, copyFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'

import staticAdapter, { type AdapterOptions } from '@sveltejs/adapter-static'
import { sveltekit } from '@sveltejs/kit/vite'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'
import license from 'rollup-plugin-license'
import { defineConfig, type Plugin } from 'vite'
import devtoolsJson from 'vite-plugin-devtools-json'
import { viteStaticCopy } from 'vite-plugin-static-copy'

import type { Adapter, Builder } from '@sveltejs/kit'

type AdapterWithFontPreloadOptions = AdapterOptions & {
  fontNames?: string[]
  formats?: string[]
}

/**
 * Static adapter wrapper that injects font preload links after the build is complete
 */
const adapterWithFontPreload = (options: AdapterWithFontPreloadOptions = {}): Adapter => {
  const { fontNames = ['nunito'], formats = ['woff2', 'woff'], ...staticOptions } = options

  const baseAdapter = staticAdapter(staticOptions)

  return {
    name: 'adapter-static-with-font-preload',

    async adapt (builder: Builder) {
      await baseAdapter.adapt(builder)

      const outDir = './build' // Static adapter always writes to 'build' directory
      try {
        const assetsDir = join(outDir, '_app/immutable/assets')

        const assetFiles = await readdir(assetsDir)
        const fontFiles = assetFiles.filter(file => {
          const lowerFileName = file.toLowerCase()
          return formats.some(format => lowerFileName.endsWith(`.${format}`)) &&
          fontNames.some(name => lowerFileName.includes(name.toLowerCase()))
        })

        if (fontFiles.length === 0) return

        console.log('Found fonts to preload:', fontFiles)

        const preloadLinks = fontFiles.map(fontFile => {
          const format = fontFile.split('.').pop()
          return `\t<link rel="preload" href="/_app/immutable/assets/${fontFile}" as="font" type="font/${format}" crossorigin>`
        }).join('\n')

        const htmlPath = join(outDir, '/index.html')

        try {
          const html = await readFile(htmlPath, 'utf-8')

          if (typeof html !== 'string') throw new TypeError(`${htmlPath} is not a text file`)

          const headPattern = '</head>'
          const replacement = `${preloadLinks}\n${headPattern}`

          const updated = html.replace(headPattern, replacement)

          if (updated !== html) {
            await writeFile(htmlPath, updated, 'utf-8')
            console.log(`Added font preload links to ${htmlPath}`)
          }
        } catch (error) {
          console.log(`Could not process ${htmlPath}:`, error)
        }
      } catch (error) {
        console.error('Error injecting font preloads:', error)
      }

      // copy index.html to offline.html for offline fallback for service worker
      try {
        const indexPath = join(outDir, 'index.html')
        const offlinePath = join(outDir, 'offline.html')
        await copyFile(indexPath, offlinePath)
        console.log('Created offline.html for service worker offline fallback')
      } catch (error) {
        console.error('Error creating offline.html for service worker:', error)
      }

      // copy license file to build directory
      try {
        const src = resolve(import.meta.dirname, 'node_modules/.cache/license-deps.txt')
        const dst = join(outDir, 'LICENSE.txt')
        await copyFile(src, dst)
        console.log('Copied license file to build directory')
      } catch (error) {
        console.error('Error copying license file to build directory:', error)
      }
    }
  }
}

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
    sveltekit({
      preprocess: vitePreprocess(),
      onwarn: (warning, handler) => {
        if (warning.code.includes('a11y')) return
        if (warning.code === 'element_invalid_self_closing_tag') return
        handler?.(warning)
      },
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          'script-src': ['self', 'wasm-unsafe-eval', 'blob:', 'trusted-types-eval'],
          'style-src': ['self', 'unsafe-inline'],
          'style-src-attr': ['unsafe-inline'],
          'img-src': ['self', 'blob:', 'https:', 'data:'],
          'font-src': ['self'],
          'connect-src': ['self', 'https:', 'wss:', 'cors:', 'http://localhost:*', 'http://*.local:*'],
          'frame-src': ['self', 'https://www.youtube-nocookie.com'],
          'worker-src': ['self', 'blob:'],
          'media-src': ['self', 'https://v.animethemes.moe', 'http://localhost:*', 'http://*.local:*', 'blob:', 'https://remotion.media'],
          'object-src': ['none'],
          'base-uri': ['self'],
          'form-action': ['self'],
          'frame-ancestors': ['self'],
          'manifest-src': ['self']
        }
      },
      router: {
        type: 'hash',
        resolution: 'client'
      },
      adapter: adapterWithFontPreload({
        // this fallback override is intentional, as otherwise the font preload isnt included
        fallback: 'index.html',
        fontNames: ['nunito-latin-wght'],
        formats: ['woff2', 'woff']
      }),
      version: {
        name: process.env.npm_package_version
      }
    }),
    viteServerConfig(),
    license({
      thirdParty: {
        allow: '(MIT OR Apache-2.0 OR ISC OR BSD-3-Clause OR BSD-2-Clause OR MPL-2.0 OR LGPL-2.1 OR LGPL-2.1+)',
        // written early in generateBundle, sveltekit adapter recreates build/ after, so copy in closeBundle
        output: resolve(import.meta.dirname, 'node_modules/.cache/license-deps.txt'),
        includeSelf: true
      }
    }),
    viteStaticCopy({
      targets: [
        { // VITE IS DOG AND DOESNT SUPPORT DYNAMIC JSON IMPORTS
          src: 'node_modules/doc999tor-fast-geoip/data/*.json',
          dest: 'geoip/',
          rename: { stripBase: true }
        }
      ]
    }),
    devtoolsJson()
  ],
  resolve: {
    alias: {
      '#lib': resolve(import.meta.dirname, 'src/lib'),
      path: 'path-esm',
      'node-fetch': '',
      // no exports :/
      'bittorrent-tracker/lib/client/websocket-tracker.js': resolve(import.meta.dirname, 'node_modules/bittorrent-tracker/lib/client/websocket-tracker.js'),
      debug: resolve(import.meta.dirname, 'src/patches/debug.ts')
    }
  },
  server: { port: 7344 },
  build: {
    target: 'esnext',
    sourcemap: true,
    assetsInlineLimit: 0
  },
  worker: {
    format: 'es'
  },
  optimizeDeps: {
    exclude: ['anitomyscript']
  }
})
