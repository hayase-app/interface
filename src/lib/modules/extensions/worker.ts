import { finalizer } from 'abslink'
import { expose } from 'abslink/w3c'

import SUPPORTS from '../settings/supports'

import type { NZBQuery, WebSeedQuery, WebSeedResult, SearchOptions, AnimeQuery, TorrentResult, TorrentSource, NZBSource, SubtitleSource, Accuracy, WebSeedSource } from './types'

const _fetch = SUPPORTS.isIOS
  ? (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string') {
        input = input.replace(/^https?:\/\//, 'cors://')
      } else if (input instanceof URL) {
        input = new URL(input.toString().replace(/^https?:\/\//, 'cors://'))
      } else if (input instanceof Request) {
        input = new Request(input.url.replace(/^https?:\/\//, 'cors://'), input)
      }
      return fetch(input, init)
    }
  : fetch

interface AccuracyRule {
  setTo: Accuracy
  maxAllowed: Accuracy
}
type TSource = { url: string } & (TorrentSource | NZBSource | SubtitleSource | WebSeedSource)

const ACCURACIES = ['high', 'medium', 'low'] as const
const ACCURACY_RANK: Record<Accuracy, number> = { high: 0, medium: 1, low: 2 }

const RESULT_TYPES = ['batch', 'best', 'alt', undefined] as const

const QUERY_RULES: Record<string, AccuracyRule> = {
  anilistId: { setTo: 'medium', maxAllowed: 'high' }, // for people cheating using AL API to get media
  anidbAid: { setTo: 'medium', maxAllowed: 'high' },
  anidbEid: { setTo: 'high', maxAllowed: 'high' }, // usually means super duper accurate since manual mapping
  tvdbId: { setTo: 'medium', maxAllowed: 'high' },
  tvdbEId: { setTo: 'high', maxAllowed: 'high' }, // usually means super duper accurate since manual mapping
  imdbId: { setTo: 'medium', maxAllowed: 'high' },
  tmdbId: { setTo: 'medium', maxAllowed: 'high' },
  episode: { setTo: 'low', maxAllowed: 'high' }, // allow high since it might be a direct AL API mapping
  episodeCount: { setTo: 'low', maxAllowed: 'high' }, // this is for verifying if something is a batch
  absoluteEpisodeNumber: { setTo: 'low', maxAllowed: 'medium' }, // likely means some sketchy stuff is happening
  resolution: { setTo: 'low', maxAllowed: 'high' },
  exclusions: { setTo: 'low', maxAllowed: 'high' },
  titles: { setTo: 'low', maxAllowed: 'medium' }, // string matching, NO!
  media: { setTo: 'low', maxAllowed: 'medium' } // yeah, this should be a red flag
}

function queryProxy<T extends object> (query: T): { proxy: T, accessed: Set<string> } {
  const accessed = new Set<string>()
  const proxy = new Proxy(query, {
    get (target, prop, receiver) {
      if (typeof prop === 'string') accessed.add(prop)
      return Reflect.get(target, prop, receiver)
    }
  })
  return { proxy, accessed }
}

function computeAccuracy (accessed: Set<string>): Accuracy {
  let bestSetToRank = Infinity
  let worstMaxAllowedRank = 0

  for (const key of accessed) {
    const rule = QUERY_RULES[key]
    if (!rule) continue
    const setToRank = ACCURACY_RANK[rule.setTo]
    const maxAllowedRank = ACCURACY_RANK[rule.maxAllowed]
    if (setToRank < bestSetToRank) bestSetToRank = setToRank
    if (maxAllowedRank > worstMaxAllowedRank) worstMaxAllowedRank = maxAllowedRank
  }

  if (bestSetToRank === Infinity) bestSetToRank = 0

  return ACCURACIES[Math.max(bestSetToRank, worstMaxAllowedRank)]!
}

function sanitizeResults (results: TorrentResult[], max: Accuracy): TorrentResult[] {
  if (!Array.isArray(results)) return []
  const maxRank = ACCURACY_RANK[max]

  return results.reduce<TorrentResult[]>((acc, item) => {
    if (!item || typeof item !== 'object') return acc

    if (typeof item.hash !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(item.hash)) return acc
    if (typeof item.link !== 'string' || item.link.length === 0) return acc

    const accuracyRank = typeof item.accuracy === 'string' ? ACCURACY_RANK[item.accuracy] : undefined

    acc.push({
      hash: item.hash.toLowerCase(),
      accuracy: accuracyRank !== undefined && accuracyRank <= maxRank ? item.accuracy : max,
      title: typeof item.title === 'string' ? item.title : '',
      link: item.link,
      seeders: typeof item.seeders === 'number' && isFinite(item.seeders) ? Math.max(0, Math.round(item.seeders)) : 0,
      leechers: typeof item.leechers === 'number' && isFinite(item.leechers) ? Math.max(0, Math.round(item.leechers)) : 0,
      downloads: typeof item.downloads === 'number' && isFinite(item.downloads) ? Math.max(0, Math.round(item.downloads)) : 0,
      size: typeof item.size === 'number' && isFinite(item.size) ? Math.max(0, item.size) : 0,
      date: item.date instanceof Date && !isNaN(item.date.getTime()) ? item.date : new Date(0),
      id: typeof item.id === 'number' ? item.id : undefined,
      type: RESULT_TYPES.includes(item.type) ? item.type : undefined
    })
    return acc
  }, [])
}

type WorkerState =
  | { type: 'torrent', mod: TorrentSource & { url: string } }
  | { type: 'nzb', mod: NZBSource & { url: string } }
  | { type: 'subtitle', mod: SubtitleSource & { url: string } }
  | { type: 'http', mod: WebSeedSource & { url: string } }

export class ExtensionWorker {
  private _state: WorkerState | null = null
  mod!: Promise<{ url: string } & { test: () => Promise<boolean> }>

  construct (code: string, type: 'torrent' | 'nzb' | 'subtitle' | 'http') {
    this.mod = this.load(code, type)
  }

  async load (code: string, type: 'torrent' | 'nzb' | 'subtitle' | 'http'): Promise<TSource> {
    // WARN: unsafe eval
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))
    const module = await import(/* @vite-ignore */url)
    URL.revokeObjectURL(url)
    const mod = module.default as TSource

    // @ts-expect-error w/e
    this._state = { type, mod }

    return mod
  }

  async loaded () {
    await this.mod
  }

  [finalizer] () {
    console.log('destroyed worker', self.name)
    self.close()
  }

  async url () {
    return (await this.mod).url
  }

  async single (
    query: AnimeQuery | NZBQuery<{ file: string }> | WebSeedQuery<{ file: string }> | Omit<AnimeQuery, 'resolution' | 'exclusions'>,
    options?: SearchOptions
  ): Promise<TorrentResult[] | string | undefined | WebSeedResult | Array<{url: string, language: string}>> {
    const state = this._state!

    switch (state.type) {
      case 'torrent': {
        const { proxy, accessed } = queryProxy({ ...query as AnimeQuery, fetch: _fetch })
        return sanitizeResults(await state.mod.single(proxy, options), computeAccuracy(accessed))
      }
      case 'nzb': {
        return await state.mod.single({ ...query as NZBQuery<{ file: string }>, fetch: _fetch }, options)
      }
      case 'http': {
        return await state.mod.single({ ...query as WebSeedQuery<{ file: string }>, fetch: _fetch }, options)
      }
      case 'subtitle': {
        return await state.mod.single({ ...query as Omit<AnimeQuery, 'resolution' | 'exclusions'>, fetch: _fetch }, options)
      }
    }
  }

  async batch (
    query: AnimeQuery | NZBQuery<{ files: string[], name: string }> | WebSeedQuery<{ files: string[], name: string }>,
    options?: SearchOptions
  ): Promise<TorrentResult[] | string | undefined | WebSeedResult[]> {
    const state = this._state!

    switch (state.type) {
      case 'torrent': {
        const { proxy, accessed } = queryProxy({ ...query as AnimeQuery, fetch: _fetch })
        return sanitizeResults(await state.mod.batch(proxy, options), computeAccuracy(accessed))
      }
      case 'nzb': {
        return await state.mod.batch({ ...query as NZBQuery<{ files: string[], name: string }>, fetch: _fetch }, options)
      }
      case 'http': {
        return await state.mod.batch({ ...query as WebSeedQuery<{ files: string[], name: string }>, fetch: _fetch }, options)
      }
      case 'subtitle':
        throw new Error('batch not supported for subtitle sources')
    }
  }

  async movie (query: AnimeQuery, options?: SearchOptions): Promise<TorrentResult[]> {
    const state = this._state!

    if (state.type !== 'torrent') return []
    const { proxy, accessed } = queryProxy({ ...query, fetch: _fetch })
    return sanitizeResults(await state.mod.movie(proxy, options), computeAccuracy(accessed))
  }

  async test () {
    return await (await this.mod).test()
  }
}

export default expose(new ExtensionWorker())
