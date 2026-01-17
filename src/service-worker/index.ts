import { clientsClaim, skipWaiting } from 'workbox-core'
import { cleanupOutdatedCaches, matchPrecache, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching'
import { registerRoute, Route } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

import { build, files, prerendered, version } from '$service-worker'

const fallbackURL = '/offline.html'

precacheAndRoute(['JASSUB-WORKER-URLS', fallbackURL, ...prerendered, ...build, ...files].map(url => ({ url, revision: version })))
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
