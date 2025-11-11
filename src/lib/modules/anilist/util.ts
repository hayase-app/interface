import type { ScheduleMedia } from './queries'
import type { Media, MediaEdge } from './types'
import type { ResultOf } from 'gql.tada'

export function banner (media: Pick<Media, 'trailer' | 'bannerImage' | 'coverImage'>): string | undefined {
  if (media.bannerImage) return media.bannerImage
  if (media.trailer?.id) return `https://i.ytimg.com/vi/${media.trailer.id}/maxresdefault.jpg`
  return media.coverImage?.extraLarge as string | undefined
}

export const STATUS_LABELS = {
  CURRENT: 'Watching',
  PLANNING: 'Plan to Watch',
  COMPLETED: 'Completed',
  PAUSED: 'Paused',
  DROPPED: 'Dropped',
  REPEATING: 'Re-Watching'
}

export function cover (media: Pick<Media, 'trailer' | 'bannerImage' | 'coverImage'>): string | undefined {
  return media.coverImage?.extraLarge ?? banner(media)
}

export function coverMedium (media: Pick<Media, 'trailer' | 'bannerImage' | 'coverImage'>): string | undefined {
  return media.coverImage?.medium?.replace('/small/', '/medium/') ?? banner(media)
}

export function coverSmall (media: Pick<Media, 'trailer' | 'bannerImage' | 'coverImage'>): string | undefined {
  return media.coverImage?.medium ?? banner(media)
}

export function title (media: Pick<Media, 'title'>): string {
  return media.title?.userPreferred ?? 'TBA'
}

export function getParentForSpecial (media: Media) {
  if (!['SPECIAL', 'OVA', 'ONA'].some(format => media.format === format)) return false
  const animeRelations = (media.relations?.edges?.filter(edge => edge?.node?.type === 'ANIME') ?? []) as MediaEdge[]

  return getRelation(animeRelations, 'PARENT') ?? getRelation(animeRelations, 'PREQUEL') ?? getRelation(animeRelations, 'SEQUEL')
}

export function getRelation (list: MediaEdge[], type: MediaEdge['relationType']) {
  return list.find(edge => edge.relationType === type)?.node?.id
}

const STATUS_MAP = {
  RELEASING: 'Releasing',
  NOT_YET_RELEASED: 'Not Yet Released',
  FINISHED: 'Finished',
  CANCELLED: 'Cancelled',
  HIATUS: 'Hiatus'
}

export function status (media: Pick<Media, 'status'>): string {
  if (media.status != null) return STATUS_MAP[media.status]

  return 'N/A'
}

const RELATION_MAP = {
  ADAPTATION: 'Adaptation',
  PREQUEL: 'Prequel',
  SEQUEL: 'Sequel',
  PARENT: 'Parent',
  SIDE_STORY: 'Side Story',
  CHARACTER: 'Character',
  SUMMARY: 'Summary',
  ALTERNATIVE: 'Alternative',
  SPIN_OFF: 'Spin Off',
  OTHER: 'Other',
  SOURCE: 'Source',
  COMPILATION: 'Compilation',
  CONTAINS: 'Contains'
}

export function relation (relation: 'ADAPTATION' | 'PREQUEL' | 'SEQUEL' | 'PARENT' | 'SIDE_STORY' | 'CHARACTER' | 'SUMMARY' | 'ALTERNATIVE' | 'SPIN_OFF' | 'OTHER' | 'SOURCE' | 'COMPILATION' | 'CONTAINS' | null) {
  if (!relation) return 'N/A'
  return RELATION_MAP[relation]
}

const FORMAT_MAP = {
  TV: 'TV Series',
  TV_SHORT: 'TV Short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  MANGA: 'Manga',
  NOVEL: 'Novel',
  ONE_SHOT: 'One Shot'
}

export function format (media: Pick<Media, 'format'>): string {
  if (media.format != null) return FORMAT_MAP[media.format]

  return 'N/A'
}

export function episodes (media: Pick<Media, 'aired' | 'notaired' | 'episodes' | 'mediaListEntry' | 'id'>): number | undefined {
  if (media.episodes) return media.episodes

  const upcoming = media.aired?.n?.[media.aired.n.length - 1]?.e ?? 0
  const past = media.notaired?.n?.[media.notaired.n.length - 1]?.e ?? 0
  const progress = media.mediaListEntry?.progress ?? 0

  return Math.max(upcoming, past, progress)
}

export function season (media: Pick<Media, 'season' | 'seasonYear'>) {
  return [media.season?.toLowerCase(), media.seasonYear].filter(s => s).join(' ')
}

export function duration (media: Pick<Media, 'duration'>) {
  if (!media.duration) return
  return `${media.duration} Minute${media.duration > 1 ? 's' : ''}`
}

export function desc (media: Pick<Media, 'description'>) {
  return notes(media.description?.replace(/<[^>]+>/g, '').replace(/\n+/g, '\n') ?? 'No description available.')
}

export function notes (string: string) {
  return string.replace(/\n?\(?Source: [^)]+\)?\n?/m, '').replace(/\n?Notes?:[ |\n][^\n]+\n?/m, '')
}

export function isMovie (media: Pick<Media, 'format' | 'title' | 'synonyms' | 'duration' | 'episodes'>) {
  if (media.format === 'MOVIE') return true
  if ([...Object.values(media.title ?? {}), ...media.synonyms ?? []].some(title => title?.toLowerCase().includes('movie'))) return true
  // if (!getParentForSpecial(media)) return true // this is good for checking movies, but false positives with normal TV shows
  return (media.duration ?? 0) > 80 && media.episodes === 1
}

export function isSingleEpisode (media: Pick<Media, 'format' | 'title' | 'synonyms' | 'duration' | 'episodes'>) {
  return media.episodes === 1 || (isMovie(media) && !media.episodes)
}

const date = new Date()
export const currentSeason = ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor((date.getMonth() / 12) * 4) % 4] as 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export const currentYear = date.getFullYear()
export const nextSeason = ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(((date.getMonth() + 3) / 12) * 4) % 4] as 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export const nextYear = date.getFullYear() + (nextSeason === 'WINTER' ? 1 : 0)
export const lastSeason = ['WINTER', 'SPRING', 'SUMMER', 'FALL'].at(Math.floor(((date.getMonth() - 3) / 12) * 4) % 4) as 'WINTER' | 'SPRING' | 'SUMMER' | 'FALL'
export const lastYear = date.getFullYear() - (lastSeason === 'FALL' ? 1 : 0)

export function dedupeAiring (media: ResultOf<typeof ScheduleMedia>) {
  return [...media.aired?.n ?? [], ...media.notaired?.n ?? []].filter((v, i, a) => v != null && a.findIndex(s => s?.e === v.e) === i) as Array<{ a: number, e: number }>
}

export function getBGColorForRating (rating: number) {
  if (rating >= 75) return 'bg-green-700 select:bg-green-800'
  if (rating >= 65) return 'bg-orange-400 select:bg-orange-500'
  return 'bg-red-400 select:bg-red-500'
}

export function getTextColorForRating (rating: number) {
  if (rating >= 75) return 'text-green-700'
  if (rating >= 65) return 'text-orange-400'
  return 'text-red-500'
}
