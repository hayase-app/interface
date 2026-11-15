import { redirect } from '@sveltejs/kit'

import { breakpoints } from '#lib/utils'
import { browser } from '$app/env'

export function load () {
  if (browser && breakpoints.value.md) {
    return redirect(307, '/#/app/client/overview')
  }
}
