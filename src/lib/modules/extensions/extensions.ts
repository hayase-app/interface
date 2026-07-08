import Debug from 'debug'
import { get } from 'svelte/store'
import { toast } from 'svelte-sonner'

import { dedupeAiring, episodes, isMovie, type Media, getParentForSpecial, isSingleEpisode } from '../anilist'
import { episodes as _episodes } from '../anizip'
import native from '../native'
import { settings, type videoResolutions } from '../settings'

import { storage } from './storage'

import type { TorrentResult, WebSeedResult } from './types'
import type { EpisodesResponse, Titles, Episode } from '../anizip/types'
import type { AnitomyResult } from 'anitomyscript'

import { dev } from '$app/environment'
import { savedOptions as extensionOptions, savedConfigs } from '$lib/modules/extensions'
import { anitomyscript, toSettled } from '$lib/utils'

const exclusions: string[] = []

if (!dev) {
  const formats = [
    ['video/mp4; codecs="hev1.1.6.L93.B0"', ['HEVC', 'x265', 'H.265']]
  ] as const

  const video = document.createElement('video')
  for (const [format, tags] of formats) {
    if (!video.canPlayType(format)) exclusions.push(...tags)
  }
}
const debug = Debug('ui:extensions')

export let fillerEpisodes: Record<number, number[] | undefined> = {}

fetch('https://raw.githubusercontent.com/ThaUnknown/filler-scrape/master/filler.json').then(async res => {
  fillerEpisodes = await res.json()
})

export class ExtensionError extends Error {
  extension
  error
  name = 'ExtensionError'

  constructor (error: Error, extension: string) {
    super()
    this.error = error
    this.extension = extension
  }
}

export type StreamedTorrentResult = TorrentResult & { extension: Set<string>, parseObject: AnitomyResult }

// TODO: these 2 exports need to be moved to a better place
export interface SingleEpisode {
  episode: number
  image?: string
  summary?: string
  rating?: string
  runtime?: number
  title?: Titles
  length?: number
  airdate?: string
  airingAt?: Date
  filler: boolean
  anidbEid?: number
  tvdbId?: number
  tvdbShowId?: number
  absoluteEpisodeNumber?: number
}

export function episodeByAirDate (alDate: Date | undefined, episodes: Map<string, Episode & { airdatems?: number }>, episode: number): Episode & { airdatems?: number } | undefined {
  if (!alDate || !+alDate) return episodes.get('' + episode)
  // 1 is key for episod 1, not index

  // find closest episodes by air date, multiple episodes can have the same air date distance
  const closestEpisodes: Episode[] = episodes.values().reduce<Episode[]>((prev, curr) => {
    if (!prev[0]) return [curr]
    const prevDate = Math.abs(+new Date(prev[0].airdate ?? 0) - +alDate)
    const currDate = Math.abs(+new Date(curr.airdate ?? 0) - +alDate)
    if (prevDate === currDate) {
      prev.push(curr)
      return prev
    }
    if (currDate < prevDate) return [curr]
    return prev
  }, [])

  if (!closestEpisodes.length) return episodes.get('' + episode)

  // if multiple episodes have the same air date, return the one closest to the requested episode number
  return closestEpisodes.reduce((prev, curr) => {
    return Math.abs(Number(curr.episode) - episode) < Math.abs(Number(prev.episode) - episode) ? curr : prev
  })
}

export function makeEpisodeList (media: Media, episodesRes?: EpisodesResponse | null) {
  const count = episodes(media, episodesRes)
  const alSchedule: Record<number, Date | undefined> = {}

  for (const { a: airingAt, e: episode } of dedupeAiring(media)) {
    alSchedule[episode] = new Date(airingAt * 1000)
  }

  if (!alSchedule[1] && isSingleEpisode(media) && media.startDate) {
    alSchedule[1] = new Date(media.startDate.year ?? 0, (media.startDate.month ?? 1) - 1, media.startDate.day ?? 1)
  }

  const episodeList: SingleEpisode[] = []
  const filtered = new Map<string, Episode & { airdatems?: number }>()
  const now = Date.now()
  for (const [key, value] of Object.entries(episodesRes?.episodes ?? {})) {
    filtered.set(key, { ...value, airdatems: value.airdate ? +new Date(value.airdate) : undefined })
  }

  const hasSpecial = !!episodesRes?.specialCount
  const hasCountMatch = episodes(media) === (episodesRes?.episodeCount ?? 0)
  for (let episode = 1; episode <= count; episode++) {
    const airingAt = alSchedule[episode]

    const hasEpisode = episodesRes?.episodes?.[Number(episode)]

    // If there are special episodes AND (no episode data exists OR episode count doesn't match),
    // then we need to validate by matching episodes with air dates
    const needsValidation = !(!hasSpecial || (hasEpisode && hasCountMatch))
    const resolvedEpisode = needsValidation ? episodeByAirDate(airingAt, filtered, episode) : filtered.get('' + episode)
    // handle special cases where anilist reports that 3 episodes aired at the same time because of pre-releases, simply don't allow the same episode to be re-used, but only walk forwards in dates
    // we want to exclude episodes which were previously consumed
    if (needsValidation && resolvedEpisode) {
      for (const [key, value] of filtered.entries()) {
        if (
          (value.anidbEid != null && value.anidbEid === resolvedEpisode.anidbEid) ||
          (value.airdatems != null && value.airdatems < (resolvedEpisode.airdatems ?? now))
        ) {
          filtered.delete(key)
        }
      }
    }

    const { image, summary, overview, rating, title, length, airdate, anidbEid, runtime, tvdbId, absoluteEpisodeNumber } = resolvedEpisode ?? {}
    const res = {
      episode, image, summary: summary ?? overview, rating, title, length, airdate, airingAt, filler: !!fillerEpisodes[media.id]?.includes(episode), anidbEid, runtime, tvdbId, absoluteEpisodeNumber
    }
    episodeList.push(res)
  }
  return episodeList
}

export const extensions = new class Extensions {
  // this is for the most part useless, but some extensions might need it
  createTitles (media: Media) {
    // group and de-duplicate
    const grouped = [...new Set(
      Object.values(media.title ?? {})
        .concat(media.synonyms)
        .filter(name => name != null && name.length > 3) as string[]
    )]
    const titles: string[] = []
    const appendTitle = (title: string) => {
      // replace & with encoded
      // title = title.replace(/&/g, '%26').replace(/\?/g, '%3F').replace(/#/g, '%23')
      titles.push(title)

      // replace Season 2 with S2, else replace 2nd Season with S2, but keep the original title
      const match1 = title.match(/(\d)(?:nd|rd|th) Season/i)
      const match2 = title.match(/Season (\d)/i)

      if (match2) {
        titles.push(title.replace(/Season \d/i, `S${match2[1]}`))
      } else if (match1) {
        titles.push(title.replace(/(\d)(?:nd|rd|th) Season/i, `S${match1[1]}`))
      }
    }
    for (const t of grouped) {
      appendTitle(t)
      if (t.includes('-')) appendTitle(t.replaceAll('-', ''))
    }
    return titles
  }

  async _getQueryOptions (media: Media, episode: number) {
    const aniDBMeta = await this._ALToAniDB(media)
    const { anidb_id: anidbAid, mal_id: malId, themoviedb_id: tmdbId, kitsu_id: kitsuId, thetvdb_id: tvdbId, imdb_id: imdbId } = aniDBMeta?.mappings ?? {}
    const { anidbEid, tvdbId: tvdbEId, absoluteEpisodeNumber } = (anidbAid && makeEpisodeList(media, aniDBMeta)[episode - 1]) || {}
    debug(`AniDB Mapping: ${anidbAid} ${anidbEid}`)

    return {
      anilistId: media.id,
      episodeCount: episodes(media),
      episode,
      anidbAid,
      anidbEid,
      tvdbId,
      tvdbEId,
      malId,
      tmdbId,
      kitsuId,
      imdbId,
      media,
      absoluteEpisodeNumber,
      titles: this.createTitles(media)
    }
  }

  async * torrentResults ({ media, episode, resolution }: { media: Media, episode: number, resolution: keyof typeof videoResolutions }) {
    debug(`Fetching results for ${media.id}:${media.title?.userPreferred} ${episode} ${resolution}`)
    await storage.ready
    const extensions = storage.codeManager.extensions
    if (!extensions.size) {
      debug('No torrent sources configured')
      throw new Error('No torrent sources configured. Add extensions in settings.')
    }

    const movie = isMovie(media)
    const singleEp = isSingleEpisode(media)

    debug(`Fetching sources for ${media.id}:${media.title?.userPreferred} ${episode} ${movie} ${resolution}`)

    const _settings = get(settings)

    const options = {
      ...await this._getQueryOptions(media, episode),
      resolution,
      exclusions: _settings.enableExternal ? [] : exclusions
    }

    const extopts = get(extensionOptions)
    const configs = get(savedConfigs)

    const checkMovie = !singleEp && movie
    const checkBatch = !singleEp && !movie

    debug(`Checking ${extensions.size} extensions for ${media.id}:${media.title?.userPreferred} ${episode} ${resolution} ${checkMovie ? 'movie' : ''} ${checkBatch ? 'batch' : ''}`)

    const parseResults = async (results: StreamedTorrentResult[]) => {
      if (!results.length) return results
      const parseObjects = await anitomyscript(results.map(({ title }) => title))
      parseObjects.forEach((parseObject, index) => {
        results[index]!.parseObject = parseObject
      })
      return results
    }

    const tasks: Array<Promise<{
      results: StreamedTorrentResult[]
      error?: ExtensionError
    }>> = []

    for (const [id, worker] of extensions.entries()) {
      if (!extopts[id]?.enabled || configs[id]?.type !== 'torrent') continue

      const extOptions = extopts[id].options
      const shouldUpdatePeers = configs[id].updatePeers ?? true

      const createTask = (fn: typeof worker.single | typeof worker.movie | typeof worker.batch) =>
        tasks.push(raceWithHandler(
          fn(options, extOptions) as Promise<TorrentResult[]>,

          async value => {
            const vals = navigator.onLine && shouldUpdatePeers && value.length
              ? await raceTimeout(this._updatePeerCounts(value)) ?? value
              : value

            return { results: await parseResults(vals.map(v => ({ ...v, extension: new Set([id]), parseObject: {} as unknown as AnitomyResult }))) }
          },
          error => ({ error: new ExtensionError(error, id), results: [] })
        ))
      createTask(worker.single)
      if (checkMovie) createTask(worker.movie)
      if (checkBatch) createTask(worker.batch)
    }

    tasks.push(raceWithHandler(
      native.library(),
      async value => {
        const entries = value.filter(lib => lib.mediaID === media.id && lib.episode === episode)
        const results = entries.map(entry => ({ accuracy: 'medium' as const, date: new Date(entry.date), downloads: 0, hash: entry.hash, extension: new Set(['local']), leechers: 0, link: entry.hash, seeders: 0, size: entry.size, title: ('name' in entry && typeof entry.name === 'string' && entry.name.length > 0) ? entry.name : entry.hash, type: entry.files > 1 ? 'batch' as const : undefined, parseObject: {} as unknown as AnitomyResult }))
        return { results: await parseResults(results) }
      },
      error => ({ error: new ExtensionError(error, 'local'), results: [] })
    ))

    let totalResults = 0

    while (tasks.length) {
      const { index, payload } = await Promise.race(
        tasks.map((task, index) => task.then(payload => ({ index, payload })))
      )
      tasks.splice(index, 1)
      totalResults += payload.results.length
      debug(`Streaming chunk with ${payload.results.length} results and ${!!payload.error} error`)
      yield payload
    }

    debug(`Finished streaming ${totalResults} results, online ${navigator.onLine}`)
  }

  async nzbQuery (hash: string, media: Media, episode: number, fileInfo: string | string[], name: string) {
    // swallows timeouts, shows actual errors
    await storage.ready

    const extopts = get(extensionOptions)
    const configs = get(savedConfigs)

    const extensions = storage.codeManager.extensions

    const options = await this._getQueryOptions(media, episode)

    const { settled, errors } = await toSettled<ExtensionError, string | undefined>(extensions.entries().map(async ([id, worker]) => {
      if (!extopts[id]?.enabled || configs[id]?.type !== 'nzb') return
      try {
        return await raceTimeout(
          Array.isArray(fileInfo)
            ? worker.batch({ ...options, hash, files: fileInfo, name }, extopts[id].options) as Promise<string | undefined>
            : worker.single({ ...options, hash, file: fileInfo, name }, extopts[id].options) as Promise<string | undefined>
          , 10_000)
      } catch (error) {
        throw new ExtensionError(error as Error, id)
      }
    }))

    if (errors.length) {
      for (const { error, extension } of errors) {
        toast.error(`Error fetching NZB from ${configs[extension]?.name ?? extension}`, { description: error.message, duration: 15_000 })
      }
    }

    return settled.filter((nzb): nzb is string => !!nzb)
  }

  async webSeedQuery (hash: string, media: Media, episode: number, fileInfo: string | string[], name: string) {
    await storage.ready

    const extopts = get(extensionOptions)
    const configs = get(savedConfigs)

    const extensions = storage.codeManager.extensions

    const options = await this._getQueryOptions(media, episode)

    const { settled, errors } = await toSettled<ExtensionError, WebSeedResult | WebSeedResult[] | undefined>(extensions.entries().map(async ([id, worker]) => {
      if (!extopts[id]?.enabled || configs[id]?.type !== 'http') return
      try {
        const promise: Promise<WebSeedResult | WebSeedResult[] | undefined> = Array.isArray(fileInfo)
          ? (worker.batch({ ...options, hash, files: fileInfo, name }, extopts[id].options) as Promise<WebSeedResult[] | undefined>)
          : (worker.single({ ...options, hash, file: fileInfo, name }, extopts[id].options) as Promise<WebSeedResult | undefined>)
        return await raceTimeout(promise, 10_000)
      } catch (error) {
        throw new ExtensionError(error as Error, id)
      }
    }))

    if (errors.length) {
      for (const { error, extension } of errors) {
        toast.error(`Error fetching webseed from ${configs[extension]?.name ?? extension}`, { description: error.message, duration: 15_000 })
      }
    }

    return settled.filter((ws): ws is WebSeedResult => ws !== undefined).flat()
  }

  async subtitlesQuery (media: Media, episode: number) {
    await storage.ready

    const extopts = get(extensionOptions)
    const configs = get(savedConfigs)

    const extensions = storage.codeManager.extensions

    const options = await this._getQueryOptions(media, episode)

    const { settled, errors } = await toSettled<ExtensionError, Array<{ url: string, language: string }> | undefined>(extensions.entries().map(async ([id, worker]) => {
      if (!extopts[id]?.enabled || configs[id]?.type !== 'subtitle') return
      try {
        return await raceTimeout(worker.single(options, extopts[id].options) as Promise<Array<{ url: string, language: string }>>, 10_000)
      } catch (error) {
        throw new ExtensionError(error as Error, id)
      }
    }))

    if (errors.length) {
      for (const { error, extension } of errors) {
        toast.error(`Error fetching subtitles from ${configs[extension]?.name ?? extension}`, { description: error.message, duration: 15_000 })
      }
    }

    return settled.filter((subtitles) => !!subtitles).flat()
  }

  _scrapeCache = new Map<string, { hash: string, complete: string, downloaded: string, incomplete: string }>()

  async _updatePeerCounts <T extends TorrentResult[]> (entries: T): Promise<T> {
    debug(`Updating peer counts for ${entries.length} entries`)

    try {
      const toUpdate = entries.filter(({ hash }) => !this._scrapeCache.has(hash)).map(({ hash }) => hash)
      const updated = await native.updatePeerCounts(toUpdate)
      for (const entry of updated) this._scrapeCache.set(entry.hash, entry)

      debug('Scrape complete')

      debug(`Found ${updated.length} entries: ${JSON.stringify(updated)}`)
    } catch (err) {
      const error = err as Error
      debug('Failed to scrape\n' + error.stack)
    }

    for (const entry of entries) {
      const cache = this._scrapeCache.get(entry.hash)
      if (!cache) continue
      entry.downloads = Number(cache.downloaded) || entry.downloads
      entry.leechers = Number(cache.incomplete) || entry.leechers
      entry.seeders = Number(cache.complete) || entry.seeders
    }
    return entries
  }

  async _ALToAniDB (media: Media) {
    const json = await _episodes(media.id)
    if (json?.mappings?.anidb_id) return json

    const parentID = getParentForSpecial(media)
    if (!parentID) return

    return await _episodes(parentID)
  }

  dedupe <T extends TorrentResult & { extension: Set<string> }> (entries: T[]): T[] {
    const deduped: Record<string, T> = {}
    for (const entry of entries) {
      if (entry.hash in deduped) {
        const dupe = deduped[entry.hash]!
        for (const ext of entry.extension) dupe.extension.add(ext)
        dupe.accuracy = (['high', 'medium', 'low'].indexOf(entry.accuracy) <= ['high', 'medium', 'low'].indexOf(dupe.accuracy)
          ? entry.accuracy
          : dupe.accuracy)
        dupe.title = entry.title.length > dupe.title.length ? entry.title : dupe.title
        dupe.link ??= entry.link
        dupe.id ??= entry.id
        dupe.seeders ||= entry.seeders >= 30000 ? 0 : entry.seeders
        dupe.leechers ||= entry.leechers >= 30000 ? 0 : entry.leechers
        dupe.downloads ||= entry.downloads
        dupe.size ||= entry.size
        dupe.date ||= entry.date
        dupe.type = (['best', 'alt', 'batch'].indexOf(entry.type ?? 'best') <= ['best', 'alt', 'batch'].indexOf(dupe.type ?? 'best')
          ? entry.type
          : dupe.type) ?? entry.type ?? dupe.type
      } else {
        deduped[entry.hash] = entry
      }
    }

    return Object.values(deduped)
  }
}()

async function raceWithHandler<T, U = T, E = Error> (promise: Promise<T>, settled: (res: T) => U, error: (err: Error) => E = e => e as E): Promise<Awaited<U> | E> {
  const timeout = new Promise<never>((resolve, reject) => {
    setTimeout(() => reject(new Error('Timed out after 10 seconds.')), 20_000)
  })

  return await Promise.race([promise, timeout]).then(settled).catch(error)
}

function raceTimeout<T> (promise: Promise<T>, time = 3_000): Promise<T | undefined> {
  const timeout = new Promise<undefined>((resolve, reject) => {
    setTimeout(() => resolve(undefined), time)
  })

  return Promise.race([promise, timeout])
}
