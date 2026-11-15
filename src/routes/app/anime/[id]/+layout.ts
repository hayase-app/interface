import { error } from '@sveltejs/kit'
import { get } from 'svelte/store'

import type { LayoutLoad } from './$types'

import { getParentForSpecial } from '#lib/modules/anilist'
import client, { asyncStore } from '#lib/modules/anilist/client'
import { IDMedia } from '#lib/modules/anilist/queries'
import { episodes } from '#lib/modules/anizip'

export const load: LayoutLoad = async ({ params, fetch }) => {
  const id = Number(params.id)
  const store = asyncStore(IDMedia, { id }, { requestPolicy: 'cache-first' })

  const info = client.animePage(id)
  let eps = await episodes(id, fetch)

  if (!eps?.mappings?.anidb_id) {
    const anime = await store
    const parentID = getParentForSpecial(get(anime).Media!)
    if (!parentID) return { eps, info, anime }
    eps = await episodes(parentID, fetch)
  }

  try {
    return {
      eps,
      info,
      anime: await store
    }
  } catch (err) {
    return error(500, err as Error)
  }
}
