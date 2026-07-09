import { readable } from 'simple-store-svelte'
import { derived, get, type Readable } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'

import { client, episodes, type Media } from '../anilist'

import kitsu from './kitsu'
import local from './local'
import mal from './mal'
import simkl from './simkl'

import type { Entry, FullMediaList, UserFrag } from '../anilist/queries'
import type { ResultOf, VariablesOf } from 'gql.tada'

import { derivedArray, derivedTeardown } from '$lib/utils'

export default new class AuthAggregator {
  hasAuth = readable(this.checkAuth(), set => {
    const unsub = [
      client.client.viewer.subscribe(() => set(this.checkAuth())),
      kitsu.viewer.subscribe(() => set(this.checkAuth())),
      mal.viewer.subscribe(() => set(this.checkAuth())),
      simkl.viewer.subscribe(() => set(this.checkAuth()))
    ]

    return () => unsub.forEach(fn => fn())
  })

  viewer = derived([client.client.viewer, kitsu.viewer, mal.viewer, simkl.viewer], ([$anilistViewer, $kitsuViewer, $malViewer, $simklViewer]) => {
    if ($anilistViewer?.viewer?.id) return $anilistViewer.viewer
    if ($kitsuViewer?.id) return $kitsuViewer
    if ($malViewer?.id) return $malViewer
    if ($simklViewer?.id) return $simklViewer
    return null
  })

  syncSettings = persisted('syncSettings', { al: true, local: true, kitsu: true, mal: true, simkl: true })
  // AUTH

  anilist () {
    return !!client.client.viewer.value?.viewer?.id
  }

  kitsu () {
    return !!kitsu.id()
  }

  mal () {
    return !!mal.id()
  }

  simkl () {
    return !!simkl.id()
  }

  checkAuth () {
    return this.anilist() || this.kitsu() || this.mal() || this.simkl()
  }

  id () {
    if (this.anilist()) return client.client.viewer.value!.viewer?.id
    if (this.kitsu()) return kitsu.id()
    if (this.simkl()) return simkl.id()

    return -1
  }

  profile (): ResultOf<typeof UserFrag> | undefined {
    if (this.anilist()) return client.client.viewer.value?.viewer ?? undefined
    if (this.kitsu()) return kitsu.profile()
    if (this.mal()) return mal.profile()
    if (this.simkl()) return simkl.profile()
  }

  medialists = derived(
    [client.medialists, kitsu.userlist, mal.userlist, simkl.userlist, local.userlist],
    ([$client, $kitsu, $mal, $simkl, $local]) => {
      if (this.anilist()) return $client
      if (this.kitsu()) return $kitsu
      if (this.mal()) return $mal
      if (this.simkl()) return $simkl
      return $local
    }
  )

  _entryCache = new Map<number, Readable<ResultOf<typeof FullMediaList> | null>>()
  mediaListEntry (mediaId: number) {
    const cached = this._entryCache.get(mediaId)
    if (cached) return cached

    const base = derivedTeardown(
      [client.medialists, kitsu.userlist, mal.userlist, simkl.userlist],
      ([$alMap, $kitsuList, $malList, $simklList], set: (v: ResultOf<typeof FullMediaList> | null) => void) => {
        set($alMap.get(mediaId) ?? $kitsuList.get(mediaId) ?? $malList.get(mediaId) ?? $simklList.get(mediaId) ?? local.get(mediaId)?.mediaListEntry ?? null)

        return (teardown) => {
          if (teardown) this._entryCache.delete(mediaId)
        }
      }
    )

    this._entryCache.set(mediaId, base)
    return base
  }

  isFavourite (media: Pick<Media, 'isFavourite' | 'id'>) {
    if (this.anilist()) return media.isFavourite
    if (this.kitsu()) return kitsu.isFav(media.id)

    return local.get(media.id)?.isFavourite
  }

  // QUERIES/MUTATIONS

  schedule (onList: boolean | null = true, date: Date) {
    if (this.anilist()) return client.schedule(undefined, onList, date)
    if (this.kitsu()) return kitsu.schedule(onList, date)
    if (this.mal()) return mal.schedule(onList, date)
    if (this.simkl()) return simkl.schedule(onList, date)

    return local.schedule(onList, date)
  }

  toggleFav (id: number) {
    return Promise.allSettled([
      this.anilist() && client.toggleFav(id),
      this.kitsu() && kitsu.toggleFav(id),
      local.toggleFav(id)
    ])
  }

  planningIDs = derivedArray([client.planningIDs, kitsu.planningIDs, local.planningIDs, mal.planningIDs, simkl.planningIDs], ([$client, $kitsu, $local, $mal, $simkl]) => {
    if (this.anilist()) return $client
    if (this.kitsu()) return $kitsu
    if (this.mal()) return $mal
    if (this.simkl()) return $simkl
    if ($local.length) return $local
    return null
  })

  continueIDs = derivedArray([client.continueIDs, kitsu.continueIDs, local.continueIDs, mal.continueIDs, simkl.continueIDs], ([$client, $kitsu, $local, $mal, $simkl]) => {
    if (this.anilist()) return $client
    if (this.kitsu()) return $kitsu
    if (this.mal()) return $mal
    if (this.simkl()) return $simkl
    if ($local.length) return $local
    return null
  })

  sequelIDs = derivedArray([client.sequelIDs], ([$client]) => {
    if (this.anilist()) return $client
    return null
  })

  async watch (outdated: Media, progress: number) {
    if (!isFinite(progress) || progress < 0) return
    const media = (await client.single(outdated.id, navigator.onLine ? 'network-only' : 'cache-first')).data?.Media ?? outdated
    const totalEps = episodes(media) || 1 // episodes or movie which is single episode
    if (totalEps < progress) return // woah, bad data from resolver?!

    const mediaList = get(this.mediaListEntry(media.id))

    const currentProgress = mediaList?.progress ?? 0
    if (currentProgress >= progress) return

    // there's an edge case here that episodes returns 1, because anilist doesn't have episode count for an airing show without an expected end date
    // this can set a media to completed when it shouldn't be, so we check if the media is finished or has episodes
    const canBeCompleted = media.status === 'FINISHED' || media.episodes != null

    const status =
      totalEps === progress && canBeCompleted
        ? 'COMPLETED'
        : mediaList?.status === 'REPEATING' ? 'REPEATING' : 'CURRENT'

    const lists = (mediaList?.customLists as Array<{enabled: boolean, name: string}> | undefined)?.filter(({ enabled }) => enabled).map(({ name }) => name) ?? []

    return await this.entry({ id: media.id, progress, status, lists })
  }

  delete (media: Media) {
    const sync = get(this.syncSettings)

    return Promise.allSettled([
      sync.al && this.anilist() && client.deleteEntry(get(this.mediaListEntry(media.id))?.id),
      sync.kitsu && this.kitsu() && kitsu.deleteEntry(media),
      sync.mal && this.mal() && mal.deleteEntry(media),
      sync.simkl && this.simkl() && simkl.deleteEntry(media),
      sync.local && local.deleteEntry(media)
    ])
  }

  entry (variables: VariablesOf<typeof Entry>) {
    const sync = get(this.syncSettings)
    variables.lists ??= []
    if (!variables.lists.includes('Watched using Hayase')) {
      variables.lists.push('Watched using Hayase')
    }

    return Promise.allSettled([
      sync.al && this.anilist() && client.entry(variables),
      sync.kitsu && this.kitsu() && kitsu.entry(variables),
      sync.mal && this.mal() && mal.entry(variables),
      sync.simkl && this.simkl() && simkl.entry(variables),
      sync.local && local.entry(variables)
    ])
  }

  async setInitialState (media: Media, episode: number) {
    if (episode !== 1) return
    // media is sourced from last torrent cache from local storage, which LIKELY is outdated as it doesn't use urql cache
    // so we fetch the media again to get the latest mediaListEntry
    const updatedMedia = (await client.single(media.id, 'cache-first')).data?.Media ?? media
    const mediaList = get(this.mediaListEntry(updatedMedia.id))

    if (!mediaList) return await this.entry({ id: media.id, progress: 0, status: 'CURRENT' })

    // for single episode media don't set to REPEATING, as restarting the app over and over again will keep setting it to REPEATING, then COMPLETED
    // which means movies won't auto mark as REPEATING, sucks, but necessary
    if (episodes(updatedMedia) === 1 && mediaList.status === 'COMPLETED') return

    if (['COMPLETED', 'PLANNING', 'PAUSED'].includes(mediaList.status ?? '')) {
      const status = mediaList.status === 'COMPLETED' ? 'REPEATING' : 'CURRENT'
      const lists = (mediaList.customLists as Array<{enabled: boolean, name: string}> | undefined)?.filter(({ enabled }) => enabled).map(({ name }) => name) ?? []

      return await this.entry({ id: media.id, progress: 0, status, lists })
    }
  }
}()
