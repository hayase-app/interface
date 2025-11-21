import Debug from 'debug'
import { get } from 'svelte/store'
import { toast } from 'svelte-sonner'

import { dedupeAiring, episodes, isMovie, type Media, getParentForSpecial, isSingleEpisode } from '../anilist'
import { episodes as _episodes } from '../anizip'
import native from '../native'
import { settings, type videoResolutions } from '../settings'

import { storage } from './storage'

import type { EpisodesResponse, Titles, Episode } from '../anizip/types'
import type { AnitomyResult } from 'anitomyscript'
import type { TorrentResult } from 'hayase-extensions'

import { dev } from '$app/environment'
import { options as extensionOptions, saved } from '$lib/modules/extensions'
import { anitomyscript } from '$lib/utils'

const exclusions = ['DTS', 'TrueHD']

const video = document.createElement('video')

if (!dev && !video.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"')) {
  exclusions.push('HEVC', 'x265', 'H.265')
}
if (!dev && !video.canPlayType('audio/mp4; codecs="ac-3"')) {
  exclusions.push('AC3', 'AC-3')
}
if (!('audioTracks' in HTMLVideoElement.prototype)) {
  exclusions.push('DUAL AUDIO', 'Dual Audio')
  exclusions.push('MULTI AUDIO', 'Multi Audio')
}
video.remove()
const debug = Debug('ui:extensions')

export let fillerEpisodes: Record<number, number[] | undefined> = {}

fetch('https://raw.githubusercontent.com/ThaUnknown/filler-scrape/master/filler.json').then(async res => {
  fillerEpisodes = await res.json()
})

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
  const count = episodes(media) ?? episodesRes?.episodeCount ?? 0
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
  const hasCountMatch = (episodes(media) ?? 0) === (episodesRes?.episodeCount ?? 0)
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

    const { image, summary, overview, rating, title, length, airdate, anidbEid, runtime } = resolvedEpisode ?? {}
    const res = {
      episode, image, summary: summary ?? overview, rating, title, length, airdate, airingAt, filler: !!fillerEpisodes[media.id]?.includes(episode), anidbEid, runtime
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

  async getResultsFromExtensions ({ media, episode, resolution }: { media: Media, episode: number, resolution: keyof typeof videoResolutions }) {
    debug(`Fetching results for ${media.id}:${media.title?.userPreferred} ${episode} ${resolution}`)
    await storage.modules
    const workers = storage.workers
    if (!Object.values(workers).length) {
      debug('No torrent sources configured')
      throw new Error('No torrent sources configured. Add extensions in settings.')
    }

    const movie = isMovie(media)
    const singleEp = isSingleEpisode(media)

    debug(`Fetching sources for ${media.id}:${media.title?.userPreferred} ${episode} ${movie} ${resolution}`)

    const aniDBMeta = await this.ALToAniDB(media)
    const anidbAid = aniDBMeta?.mappings?.anidb_id
    const anidbEid = anidbAid && (await this.ALtoAniDBEpisode({ media, episode }, aniDBMeta))?.anidbEid
    debug(`AniDB Mapping: ${anidbAid} ${anidbEid}`)

    const options = {
      anilistId: media.id,
      episodeCount: episodes(media) ?? undefined,
      episode,
      anidbAid,
      anidbEid,
      titles: this.createTitles(media),
      resolution,
      exclusions: get(settings).enableExternal ? [] : exclusions
    }

    const results: Array<TorrentResult & { parseObject: AnitomyResult, extension: Set<string> }> = []
    const errors: Array<{ error: Error, extension: string }> = []

    const extopts = get(extensionOptions)
    const configs = get(saved)

    const checkMovie = !singleEp && movie
    const checkBatch = !singleEp && !movie

    debug(`Checking ${Object.keys(workers).length} extensions for ${media.id}:${media.title?.userPreferred} ${episode} ${resolution} ${checkMovie ? 'movie' : ''} ${checkBatch ? 'batch' : ''}`)

    for (const [id, worker] of Object.entries(workers)) {
      const thisExtOpts = extopts[id]!
      if (!thisExtOpts.enabled) continue
      if (configs[id]!.type !== 'torrent') continue
      try {
        const promises: Array<Promise<TorrentResult[]>> = []
        promises.push(worker.single(options, thisExtOpts.options))
        if (checkMovie) promises.push(worker.movie(options, thisExtOpts.options))
        if (checkBatch) promises.push(worker.batch(options, thisExtOpts.options))

        for (const result of await Promise.allSettled(promises)) {
          if (result.status === 'fulfilled') {
            results.push(...result.value.map(v => ({ ...v, extension: new Set([id]), parseObject: {} as unknown as AnitomyResult })))
          } else {
            console.error(result.reason, id)
            errors.push({ error: result.reason as unknown as Error, extension: id })
          }
        }
      } catch (error) {
        errors.push({ error: error as Error, extension: id })
      }
    }

    if (!navigator.onLine) {
      const library = await native.library()
      const entry = library.find(lib => lib.mediaID === media.id && lib.episode === episode)
      if (entry) {
        results.push({ accuracy: 'medium', date: new Date(entry.date), downloads: 0, hash: entry.hash, extension: new Set(['local']), leechers: 0, link: entry.hash, seeders: 0, size: entry.size, title: entry.name ?? entry.hash, type: entry.files > 1 ? 'batch' : undefined, parseObject: {} as unknown as AnitomyResult })
      }
    }

    debug(`Found ${results.length} results, online ${navigator.onLine}`)

    const deduped = this.dedupe(results)

    if (!deduped.length) return { results: [], errors }

    const parseObjects = await anitomyscript(deduped.map(({ title }) => title))
    parseObjects.forEach((parseObject, index) => {
      deduped[index]!.parseObject = parseObject
    })

    return { results: navigator.onLine ? await this.updatePeerCounts(deduped) : deduped, errors }
  }

  async getNZBResultsFromExtensions (hash: string) {
    await storage.modules
    const workers = storage.workers
    const results: Array<{ nzb: string, options: Record<string, string> }> = []
    const errors: Array<{ error: Error, extension: string }> = []

    const extopts = get(extensionOptions)
    const configs = get(saved)

    for (const [id, worker] of Object.entries(workers)) {
      const thisExtOpts = extopts[id]!
      if (!thisExtOpts.enabled) continue
      if (!thisExtOpts.options.username || !thisExtOpts.options.password || !thisExtOpts.options.domain || !thisExtOpts.options.port || !thisExtOpts.options.poolSize) continue
      if (configs[id]!.type !== 'nzb') continue
      try {
        const nzb = await worker.query(hash, thisExtOpts.options)
        if (!nzb) continue
        results.push({ nzb, options: thisExtOpts.options })
      } catch (error) {
        errors.push({ error: error as Error, extension: id })
      }
    }

    if (errors.length) {
      for (const { error, extension } of errors) {
        toast.error(`Error fetching NZB from ${configs[extension]?.name ?? extension}`, { description: error.message })
      }
    }

    return results
  }

  async updatePeerCounts <T extends TorrentResult[]> (entries: T): Promise<T> {
    debug(`Updating peer counts for ${entries.length} entries`)

    try {
      const updated = await native.updatePeerCounts(entries.map(({ hash }) => hash))
      debug('Scrape complete')
      for (const { hash, complete, downloaded, incomplete } of updated) {
        const found = entries.find(mapped => mapped.hash === hash)
        if (!found) continue
        found.downloads = Number(downloaded)
        found.leechers = Number(incomplete)
        found.seeders = Number(complete)
      }

      debug(`Found ${updated.length} entries: ${JSON.stringify(updated)}`)
    } catch (err) {
      const error = err as Error
      debug('Failed to scrape\n' + error.stack)
    }
    return entries
  }

  async ALToAniDB (media: Media) {
    const json = await _episodes(media.id)
    if (json?.mappings?.anidb_id) return json

    const parentID = getParentForSpecial(media)
    if (!parentID) return

    return await _episodes(parentID)
  }

  async ALtoAniDBEpisode ({ media, episode }: {media: Media, episode: number}, episodesRes: EpisodesResponse) {
    return makeEpisodeList(media, episodesRes)[episode - 1] ?? undefined
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
        dupe.type ??= entry.type === 'best' ? 'best' : entry.type === 'alt' ? 'alt' : entry.type
      } else {
        deduped[entry.hash] = entry
      }
    }

    return Object.values(deduped)
  }
}()
