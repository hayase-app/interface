import { derived } from 'svelte/store'

import { episodes, type Media } from '../anilist'

import { authAggregator } from '.'

export function progress (media: { id: number }) {
  return derived(authAggregator.mediaListEntry(media.id), $e => $e?.progress)
}

export function fav (media: Pick<Media, 'isFavourite' | 'id'>): boolean {
  return !!authAggregator.isFavourite(media)
}

export function list (media: { id: number }) {
  return derived(authAggregator.mediaListEntry(media.id), $e => $e?.status)
}

export function lists (media: { id: number }) {
  return derived(authAggregator.mediaListEntry(media.id), $e => $e?.customLists as Array<{ enabled: boolean, name: string }> | undefined)
}

export function repeat (media: { id: number }) {
  return derived(authAggregator.mediaListEntry(media.id), $e => $e?.repeat)
}

export function score (media: { id: number }) {
  return derived(authAggregator.mediaListEntry(media.id), $e => $e?.score)
}

export function entry (media: { id: number }) {
  return derived(authAggregator.mediaListEntry(media.id), $e => $e)
}

export function of (media: Pick<Media, 'aired' | 'notaired' | 'episodes' | 'id'>, eps?: { episodeCount?: number | null } | null) {
  return derived(progress(media), $prog => {
    const count = episodes(media, eps ?? { episodeCount: $prog })
    if (count === 1 || !count) return

    if (!$prog || $prog === count) return `${count} Episodes`

    return `${$prog} / ${count} Episodes`
  })
}
