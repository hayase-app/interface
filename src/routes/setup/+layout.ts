import { error, redirect } from '@sveltejs/kit'

import native from '#lib/modules/native'
import { outdatedComponent } from '#lib/modules/update'
import { dev } from '$app/env'

export async function load () {
  if (!dev && !native.isApp) return error(401, 'How did you get here?')

  if (await outdatedComponent) redirect(307, '/#/update')
}
