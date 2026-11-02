/* eslint-disable @typescript-eslint/no-explicit-any */
export type Accuracy = 'high' | 'medium' | 'low'

type CountryCodes = 'ALL' | 'AD' | 'AE' | 'AF' | 'AG' | 'AI' | 'AL' | 'AM' | 'AO' | 'AQ' | 'AR' | 'AS' | 'AT' | 'AU' | 'AW' | 'AX' | 'AZ' | 'BA' | 'BB' | 'BD' | 'BE' | 'BF' | 'BG' | 'BH' | 'BI' | 'BJ' | 'BL' | 'BM' | 'BN' | 'BO' | 'BQ' | 'BR' | 'BS' | 'BT' | 'BV' | 'BW' | 'BY' | 'BZ' | 'CA' | 'CC' | 'CD' | 'CF' | 'CG' | 'CH' | 'CI' | 'CK' | 'CL' | 'CM' | 'CN' | 'CO' | 'CR' | 'CU' | 'CV' | 'CW' | 'CX' | 'CY' | 'CZ' | 'DE' | 'DJ' | 'DK' | 'DM' | 'DO' | 'DZ' | 'EC' | 'EE' | 'EG' | 'EH' | 'ER' | 'ES' | 'ET' | 'FI' | 'FJ' | 'FK' | 'FM' | 'FO' | 'FR' | 'GA' | 'GB' | 'GD' | 'GE' | 'GF' | 'GG' | 'GH' | 'GI' | 'GL' | 'GM' | 'GN' | 'GP' | 'GQ' | 'GR' | 'GS' | 'GT' | 'GU' | 'GW' | 'GY' | 'HK' | 'HM' | 'HN' | 'HR' | 'HT'

export type SearchOptions = Record<string, {
  type: 'string' | 'number' | 'boolean' | 'select'
  description: string
  values?: any[]
  default: any
}>

export interface ExtensionConfig {
  manifestVersion: number
  deprecated: boolean
  name: string
  version: string
  description: string
  id: string
  type: 'torrent' | 'nzb' | 'subtitle' | 'http'
  accuracy: Accuracy
  ratio?: 'perma' | number
  icon: string // URL to the icon
  media: 'sub' | 'dub' | 'both'
  url?: string // URL to enable CORS on the extension's API
  languages: CountryCodes[] // languages for sub/dub, this doesn't include the languages of the source itself, aka raw sub impiles you can turn it off and just get raw in japanese
  update?: string // URL to the config file, can be prefixed with 'gh:' to fetch from GitHub, e.g. 'gh:username/repo' or 'npm:' to fetch from npm, e.g. 'npm:package-name', or a straight url
  code: string // URL to the extension code, can be prefixed with 'gh:' to fetch from GitHub, e.g. 'gh:username/repo' or 'npm:' to fetch from npm, e.g. 'npm:package-name', a straight url, or file: for inline code
  options?: SearchOptions
  updatePeers?: false // whether to update the peer counts for torrents returned by this extension, this is only applicable for torrent sources and will be ignored for nzb and url sources
  rateLimit?: number
}

export interface TorrentResult {
  title: string // torrent title
  link: string // link to .torrent file, or magnet link
  id?: number
  seeders: number
  leechers: number
  downloads: number
  accuracy: Accuracy
  hash: string // info hash
  size: number // size in bytes
  date: Date // date the torrent was uploaded
  type?: 'batch' | 'best' | 'alt'
}

export interface AnimeQuery {
  media: any // anilist Media object
  anilistId: number // anilist anime id
  anidbAid?: number // anidb anime id
  anidbEid?: number // anidb episode id
  tvdbId?: number // thetvdb anime id
  tvdbEId?: number // thetvdb episode id
  imdbId?: string // imdb id
  tmdbId?: string // tmdb anime id
  titles: string[] // list of titles and alternative titles
  episode: number
  episodeCount?: number // total episode count for the series
  absoluteEpisodeNumber?: number
  resolution: '2160' | '1080' | '720' | '540' | '480' | ''
  exclusions: string[] // list of keywords to exclude from searches, this might be unsupported codecs (e.g., "x265"), sources (e.g., "web-dl"), or other keywords (e.g., "uncensored")
}

export type AnimeQueryWithFetch = AnimeQuery & { fetch: typeof fetch }

export type NZBQuery<T> = {
  hash: string
  name: string
} & Omit<AnimeQuery, 'resolution' | 'exclusions'> & T

export type NZBQueryWithFetch<T> = NZBQuery<T> & { fetch: typeof fetch }

export type SearchFunction = (query: AnimeQueryWithFetch, options?: Record<string, number | string | boolean>) => Promise<TorrentResult[]>
export type NZBFunction<T> = (query: NZBQueryWithFetch<T>, options?: Record<string, number | string | boolean>) => Promise<string | undefined>

export interface WebSeedFile {
  name: string
  index?: number
}

export interface WebSeedResult {
  url: string
  authorization?: string
  index?: number
  rateLimit?: number
}

export type WebSeedQuery<T> = {
  hash: string
  name: string
} & Omit<AnimeQuery, 'resolution' | 'exclusions'> & T

export type WebSeedQueryWithFetch<T> = WebSeedQuery<T> & { fetch: typeof fetch }

export class TorrentSource {
  test: () => Promise<boolean>
  single: SearchFunction
  batch: SearchFunction
  movie: SearchFunction
}

export class NZBSource {
  test: () => Promise<boolean>
  single: NZBFunction<{file: string}>
  batch: NZBFunction<{files: string[]}>
}

export class WebSeedSource {
  test: () => Promise<boolean>
  single: (query: WebSeedQueryWithFetch<{file: WebSeedFile}>, options?: Record<string, number | string | boolean>) => Promise<WebSeedResult | undefined>
  batch: (query: WebSeedQueryWithFetch<{files: WebSeedFile[]}>, options?: Record<string, number | string | boolean>) => Promise<WebSeedResult[] | undefined>
}

export interface SubtitleResult {
  url: string // direct URL to the subtitle file
  language: string // track language, e.g. 'pol', used for grouping in the menu and for auto-select. without `name` or `format` it's also the file name, as before
  name?: string // track name shown in the menu, e.g. 'Full Subtitles [Group]', defaults to `language`
  format?: 'ass' | 'ssa' | 'srt' | 'vtt' | 'sub' | 'txt' // subtitle format, defaults to the extension of `language`, then of the URL path
}

export class SubtitleSource {
  test: () => Promise<boolean>
  single: (query: Omit<AnimeQueryWithFetch, 'resolution' | 'exclusions'>, options?: Record<string, number | string | boolean>) => Promise<SubtitleResult[]>
}
