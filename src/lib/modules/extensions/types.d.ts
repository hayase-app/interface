/* eslint-disable @typescript-eslint/no-explicit-any */
export type Accuracy = 'high' | 'medium' | 'low'

type CountryCodes = 'ALL' | 'AD' | 'AE' | 'AF' | 'AG' | 'AI' | 'AL' | 'AM' | 'AO' | 'AQ' | 'AR' | 'AS' | 'AT' | 'AU' | 'AW' | 'AX' | 'AZ' | 'BA' | 'BB' | 'BD' | 'BE' | 'BF' | 'BG' | 'BH' | 'BI' | 'BJ' | 'BL' | 'BM' | 'BN' | 'BO' | 'BQ' | 'BR' | 'BS' | 'BT' | 'BV' | 'BW' | 'BY' | 'BZ' | 'CA' | 'CC' | 'CD' | 'CF' | 'CG' | 'CH' | 'CI' | 'CK' | 'CL' | 'CM' | 'CN' | 'CO' | 'CR' | 'CU' | 'CV' | 'CW' | 'CX' | 'CY' | 'CZ' | 'DE' | 'DJ' | 'DK' | 'DM' | 'DO' | 'DZ' | 'EC' | 'EE' | 'EG' | 'EH' | 'ER' | 'ES' | 'ET' | 'FI' | 'FJ' | 'FK' | 'FM' | 'FO' | 'FR' | 'GA' | 'GB' | 'GD' | 'GE' | 'GF' | 'GG' | 'GH' | 'GI' | 'GL' | 'GM' | 'GN' | 'GP' | 'GQ' | 'GR' | 'GS' | 'GT' | 'GU' | 'GW' | 'GY' | 'HK' | 'HM' | 'HN' | 'HR' | 'HT'

export interface ExtensionConfig {
  name: string
  version: string
  description: string
  id: string
  type: 'torrent' | 'nzb' | 'url'
  accuracy: Accuracy
  ratio?: 'perma' | number
  icon: string // URL to the icon
  media: 'sub' | 'dub' | 'both'
  languages: CountryCodes[] // languages for sub/dub, this doesn't include the languages of the source itself, aka raw sub impiles you can turn it off and just get raw in japanese
  update?: string // URL to the config file, can be prefixed with 'gh:' to fetch from GitHub, e.g. 'gh:username/repo' or 'npm:' to fetch from npm, e.g. 'npm:package-name', or a straight url
  code: string // URL to the extension code, can be prefixed with 'gh:' to fetch from GitHub, e.g. 'gh:username/repo' or 'npm:' to fetch from npm, e.g. 'npm:package-name', a straight url, or file: for inline code
  options?: Record<string, {
      type: 'string' | 'number' | 'boolean'
      description: string
      default: any
    }>
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

export interface TorrentQuery {
  anilistId: number // anilist anime id
  anidbAid?: number // anidb anime id
  anidbEid?: number // anidb episode id
  titles: string[] // list of titles and alternative titles
  episode?: number
  episodeCount?: number // total episode count for the series
  resolution: '2160' | '1080' | '720' | '540' | '480' | ''
  exclusions: string[] // list of keywords to exclude from searches
  type?: 'sub' | 'dub'
}

export type SearchFunction = (query: TorrentQuery, options?: Record<string, {
    type: 'string' | 'number' | 'boolean'
    description: string
    default: any
  }>) => Promise<TorrentResult[]>

export class TorrentSource {
  test: () => Promise<boolean>
  single: SearchFunction
  batch: SearchFunction
  movie: SearchFunction
}

export class NZBorURLSource {
  test: () => Promise<boolean>
  query: (hash: string, options?: Record<string, {
      type: 'string' | 'number' | 'boolean'
      description: string
      default: any
    }>) => Promise<string> // accepts btih hash, return URL to NZB or DDL
}
