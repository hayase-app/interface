import { get } from 'idb-keyval'

import { REMOTE_HOSTS_KEY, type SavedHostInfo } from '#lib/modules/remote'

export async function load () {
  return {
    savedHosts: await get<SavedHostInfo[]>(REMOTE_HOSTS_KEY) ?? []
  }
}
