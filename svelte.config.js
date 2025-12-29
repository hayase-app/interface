import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

import staticAdapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/**
 * Custom adapter wrapper that extends @sveltejs/adapter-static
 * to inject font preload links after the build is complete
 *
 * @param {import('@sveltejs/adapter-static').AdapterOptions & {fontNames?: string[], formats?: string[]}} options
 * @returns {import('@sveltejs/kit').Adapter}
 */
const adapterWithFontPreload = (options = {}) => {
  const { fontNames = ['nunito'], formats = ['woff2', 'woff'], ...staticOptions } = options

  const baseAdapter = staticAdapter(staticOptions)

  return {
    name: 'adapter-static-with-font-preload',

    async adapt (builder) {
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
          const html = /** @type {string} */ (await readFile(htmlPath, 'utf-8'))

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
    }
  }
}

/** @type {import('@sveltejs/kit').Config} */
const config = {
  onwarn: (warning, handler) => {
    if (warning.code.includes('a11y')) return
    if (warning.code === 'element_invalid_self_closing_tag') return
    handler?.(warning)
  },
  preprocess: vitePreprocess({}),
  kit: {
    adapter: adapterWithFontPreload({
      fallback: 'index.html',
      fontNames: ['nunito-latin-wght'],
      formats: ['woff2', 'woff']
    }),
    version: {
      name: process.env.npm_package_version
    },
    alias: {
      'lucide-svelte/dist/Icon.svelte': './node_modules/lucide-svelte/dist/Icon.svelte'
    }
  },
  runtime: ''
}

export default config
