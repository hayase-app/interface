import { redirect } from '@sveltejs/kit'

import { browser } from '$app/environment'
import { breakpoints } from '$lib/utils'

export function load () {
  if (browser && breakpoints.value.md) {
    return redirect(307, '/#/app/settings/player')
  }
}
