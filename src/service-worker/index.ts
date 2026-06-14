import { clientsClaim, skipWaiting } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching'
import { registerRoute, Route } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

import SUPPORTS from '$lib/modules/settings/supports'
import { build, files, prerendered, version } from '$service-worker'

const fallbackURL = '/offline.html'

const filterOutWorkers = (url: string) => {
  if (SUPPORTS.isMobile) return true

  return !(url.includes('codec.worker') || url.includes('audioWorklet'))
}

precacheAndRoute(['JASSUB-WORKER-URLS', fallbackURL, ...prerendered, ...build, ...files].filter(filterOutWorkers).map(url => ({ url, revision: version })))
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
