import { redirect } from '@sveltejs/kit'

import { extensionInstalURL } from '$lib/components/ui/extensions'

export function load ({ params, url }) {
  let installUrl = url.searchParams.get('url') ?? params.url ?? ''

  if (installUrl.startsWith('https:/') && !installUrl.startsWith('https://')) {
    installUrl = 'https://' + installUrl.slice(7)
  } else if (installUrl.startsWith('http:/') && !installUrl.startsWith('http://')) {
    installUrl = 'http://' + installUrl.slice(6)
  }
  installUrl = installUrl.replace(/\/+$/, '')

  extensionInstalURL.set(installUrl)

  return redirect(307, '/')
}
