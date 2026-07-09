import { createStore, set, get } from 'idb-keyval'
import { writable } from 'simple-store-svelte'
import { derived, readable } from 'svelte/store'

import { client, type Media } from '../anilist'

import type { Entry, FullMediaList } from '../anilist/queries'
import type { ResultOf, VariablesOf } from 'gql.tada'

import { arrayEqual } from '$lib/utils'

export interface StoredMedia {
  id: number
  isFavourite: boolean
  mediaListEntry: ResultOf<typeof FullMediaList> | null
}

function asNumber (value: unknown): value is number {
  return typeof value === 'number' && isFinite(value)
}

function sanitiseByKey (key: 'status' | 'score' | 'repeat' | 'progress', value: VariablesOf<typeof Entry>[typeof key]): VariablesOf<typeof Entry>[typeof key] {
  if (value == null) return value
  if (key === 'score') {
    return asNumber(value) ? value / 10 : null
  }
  if (key === 'progress') {
    return asNumber(value) ? Math.max(0, value) : null
  }
  if (key === 'repeat') {
    return asNumber(value) ? Math.max(0, value) : null
  }
  if (key === 'status') {
    return typeof value === 'string' ? value : null
  }
  return null
}

export default new class LocalSync {
  store = createStore('watchlist', 'local')

  entries = writable(new Map<number, StoredMedia>())
  userlist = derived(this.entries, $entries => {
    return new Map<number, ResultOf<typeof FullMediaList>>($entries.entries().filter(([_, e]) => e.mediaListEntry != null).map(([id, e]) => [id, e.mediaListEntry!]))
  })

  constructor () {
    get('entries', this.store).then((s: Record<number, StoredMedia> | undefined) => {
      this.entries.set(new Map(Object.entries(s ?? {}).map(([id, v]) => [Number(id), v])))
    })
    this.entries.subscribe(entries => {
      set('entries', Object.fromEntries(entries.entries()), this.store)
    })
  }

  get (id: number) {
    return this.entries.value.get(id)
  }

  _getEntry (id: number): StoredMedia {
    // const media = client.client.readQuery(IDMedia, { id })?.data?.Media
    return this.entries.value.get(id) ?? {
      id,
      isFavourite: false,
      mediaListEntry: {
        id,
        mediaId: id,
        customLists: null,
        progress: null,
        repeat: null,
        score: null,
        status: null
      }
    }
  }

  schedule (onList: boolean | null = true, date: Date) {
    const ids = [...this.entries.value.values().map(({ mediaListEntry }) => mediaListEntry?.id).filter(e => e != null)]
    return client.schedule(onList && ids.length ? ids : undefined, undefined, date)
  }

  async toggleFav (id: number) {
    this.entries.update(entries => {
      const entry = this._getEntry(id)

      entry.isFavourite = !entry.isFavourite
      entries.set(id, entry)
      return entries
    })
  }

  async deleteEntry (media: Media) {
    const id = media.id
    this.entries.update(entries => {
      const entry = this._getEntry(id)

      entry.mediaListEntry = null
      entries.set(media.id, entry)
      return entries
    })
  }

  continueIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    const sub = this.entries.subscribe(entries => {
      if (!entries.size) return []

      const ids: number[] = []

      for (const [alId, entry] of entries) {
        if (entry.mediaListEntry?.status === 'REPEATING' || entry.mediaListEntry?.status === 'CURRENT') {
          ids.push(alId)
        }
      }

      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      set(ids)
    })
    return sub
  })

  planningIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    const sub = this.entries.subscribe(entries => {
      if (!entries.size) return []

      const ids: number[] = []

      for (const [alId, entry] of entries) {
        if (entry.mediaListEntry?.status === 'PLANNING') {
          ids.push(alId)
        }
      }

      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      set(ids)
    })
    return sub
  })

  async entry (variables: VariablesOf<typeof Entry>) {
    const entry = this._getEntry(variables.id)
    entry.mediaListEntry ??= {
      id: variables.id,
      mediaId: variables.id,
      customLists: null,
      progress: null,
      repeat: null,
      score: null,
      status: null
    }

    const keys = ['status', 'score', 'repeat', 'progress'] as Array<keyof typeof variables>
    for (const key of keys) {
      // @ts-expect-error idk how to fix this tbf
      entry.mediaListEntry[key] = sanitiseByKey(key, variables[key]) ?? entry.mediaListEntry[key] ?? null
    }

    this.entries.update(entries => {
      entries.set(variables.id, entry)
      return entries
    })
  }
}()
