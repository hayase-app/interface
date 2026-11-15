import { clientsClaim, skipWaiting } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching'
import { registerRoute, Route } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

import SUPPORTS from '#lib/modules/settings/supports'
import { version } from '$app/env'
import { assets, immutable, prerendered } from '$app/manifest'

const fallbackURL = '/offline.html'

const filterOutWorkers = (url: string) => {
  if (SUPPORTS.isMobile) return true

  return !(url.includes('codec.worker') || url.includes('audioWorklet'))
}

const filterOutLargeAssets = (url: string) => !/(video\.mkv|NotoSans(HK|JP|KR)\.woff2)$/.test(url)

precacheAndRoute([{ path: fallbackURL }, ...prerendered, ...immutable, ...assets]
  .filter(({ path }) => filterOutLargeAssets(path) && filterOutWorkers(path))
  .map(({ path }) => ({ url: path, revision: version }))
)

cleanupOutdatedCaches()
clientsClaim()
skipWaiting()

registerRoute(new Route(({ request }) => request.mode === 'navigate',
  new NetworkOnly({
    plugins: [new PrecacheFallbackPlugin({ fallbackURL }),
      {
        async fetchDidSucceed ({ response }) {
          if (response.ok) return response

          return await matchPrecache(fallbackURL) ?? response
        }
      }]
  })
))
