import { writable } from 'simple-store-svelte'

import type { AnimeThemesResponse } from '$lib/modules/animethemes/types'
import type { MediaInfo } from './util.ts'

import { themes } from '$lib/modules/animethemes'
import native from '$lib/modules/native'

export interface Chapter {
  start: number
  end: number
  text: string
  skippable?: boolean
  autoskippable?: boolean
  skiptype?: string
}

interface Interval {
  startTime: number
  endTime: number
}

interface Result {
  interval: Interval
  skipType: string
  skipId: string
  episodeLength: number
}

interface AniSkip {
  found: boolean
  results: Result[]
  message: string
  statusCode: number
}

const SKIPPABLE_CHAPTER_RX_MAP = {
  Opening: /^op$|opening$|^ncop|^opening /mi,
  Ending: /^ed$|ending$|^nced|^ending /mi,
  Intro: /^intro$/mi,
  Outro: /^outro$/mi,
  Credits: /^credits$/mi,
  Preview: /^preview$/mi,
  Recap: /recap/mi
} as const

const AUTO_SKIPPABLE_CHAPTERS_ORDER = {
  op: ['Opening', 'Intro'],
  ed: ['Ending', 'Outro', 'Credits']
} as const

export default class Chapters {
  nativeChapters
  mediaInfo
  isFirstOccurence

  chapters = writable<Chapter[]>([])
  constructor (mediaInfo: MediaInfo) {
    this.nativeChapters = native.chapters(mediaInfo.file.hash, mediaInfo.file.id)
    this.mediaInfo = mediaInfo
    this.isFirstOccurence = this.getFirstOccurences(themes(mediaInfo.media.id))
  }

  async loadChapters (safeduration: number) {
    try {
      const nativeChapters = await this.nativeChapters
      if (nativeChapters.length) {
        this.chapters.value = await this.processChapters(sanitizeChapters(nativeChapters, safeduration))
      }
    } catch (error) {
      console.warn('Failed to load native chapters:', error)
      if (!this.mediaInfo.media.idMal) return
      const aniSkipChapters = await getChaptersAniSkip(this.mediaInfo.media.idMal, this.mediaInfo.episode, safeduration)
      if (!aniSkipChapters.length) return
      this.chapters.value = await this.processChapters(sanitizeChapters(aniSkipChapters, safeduration))
    }
  }

  // if an opening shows up for the first time for this episode, we dont want to skip!
  async getFirstOccurences (promise: Promise<AnimeThemesResponse | null>) {
    const res = await promise
    if (!res?.anime?.[0]?.animethemes) return { op: this.mediaInfo.episode === 1, ed: this.mediaInfo.episode === 1 }
    const occurences = { op: false, ed: false }
    for (const anime of res.anime) {
      for (const theme of anime.animethemes ?? []) {
        for (const entry of theme.animethemeentries ?? []) {
          if (!entry.episodes) continue
          const [first] = entry.episodes.split('-')
          if (first && parseInt(first) === this.mediaInfo.episode) {
            if (theme.type === 'OP') occurences.op = true
            else if (theme.type === 'ED') occurences.ed = true
          }
        }
      }
    }

    return occurences
  }

  async processChapters (chapters: Chapter[]) {
    if (!chapters.length) return chapters

    for (const [skiptype, regex] of Object.entries(SKIPPABLE_CHAPTER_RX_MAP)) {
      for (const chapter of chapters) {
        if (regex.test(chapter.text)) {
          chapter.skiptype = skiptype
          chapter.skippable = true
        }
      }
    }

    const { op, ed } = await this.isFirstOccurence
    if (op && ed) return chapters

    // iterate in order of importance, if a chapter is skippable, mark it as autoskippable
    // but make sure to only mark one chapter as autoskippable if there are multiple of the same type (eg multiple openings)
    // we dont want to skip all of them if its not the first occurence
    const toSkip: Array<keyof typeof SKIPPABLE_CHAPTER_RX_MAP> = []
    if (!ed) toSkip.push(...AUTO_SKIPPABLE_CHAPTERS_ORDER.ed)
    if (!op) toSkip.push(...AUTO_SKIPPABLE_CHAPTERS_ORDER.op)
    // eslint-disable-next-line no-labels
    chapterslabel: for (const type of toSkip) {
      const regex = SKIPPABLE_CHAPTER_RX_MAP[type]
      for (const chapter of chapters) {
        if (!chapter.skippable) continue
        const length = chapterLength(chapter)
        if (length < 60 || length > 120) continue

        if (regex.test(chapter.text)) {
          chapter.autoskippable = true
          // eslint-disable-next-line no-labels
          continue chapterslabel
        }
      }
    }

    return chapters
  }
}

export function findChapter (time: number, chapters: Chapter[]) {
  return chapters.find(({ start, end }) => time >= start && time <= end)
}

export function chapterLength (chapter: Chapter) {
  return chapter.end - chapter.start
}

async function getChaptersAniSkip (idMal: number, episode: number, duration: number): Promise<Chapter[]> {
  const resAccurate = await fetch(`https://api.aniskip.com/v2/skip-times/${idMal}/${episode}/?episodeLength=${duration}&types=op&types=ed&types=recap`)
  const jsonAccurate = await resAccurate.json() as AniSkip

  const resRough = await fetch(`https://api.aniskip.com/v2/skip-times/${idMal}/${episode}/?episodeLength=0&types=op&types=ed&types=recap`)
  const jsonRough = await resRough.json() as AniSkip

  const map: Record<string, Result> = {}
  for (const result of [...jsonAccurate.results, ...jsonRough.results]) {
    if (!(result.skipType in map)) map[result.skipType] = result
  }

  const results = Object.values(map)
  if (!results.length) return []

  const chapters = results.map(result => {
    const diff = duration - result.episodeLength
    return {
      start: Math.max(0, (result.interval.startTime + diff) * 1000),
      end: Math.min(duration * 1000, Math.max(0, (result.interval.endTime + diff) * 1000)),
      text: result.skipType.toUpperCase()
    }
  })
  const ed = chapters.find(({ text }) => text === 'ED')
  const recap = chapters.find(({ text }) => text === 'RECAP')
  if (recap) recap.text = 'Recap'

  chapters.sort((a, b) => a.start - b.start)
  if ((chapters[0]!.start | 0) !== 0) {
    chapters.unshift({ start: 0, end: chapters[0]!.start, text: chapters[0]!.text === 'OP' ? 'Intro' : 'Episode' })
  }
  if (ed) {
    if ((ed.end | 0) + 5000 - duration * 1000 < 0) {
      chapters.push({ start: ed.end, end: duration * 1000, text: 'Preview' })
    }
  } else if ((chapters[chapters.length - 1]!.end | 0) + 5000 - duration * 1000 < 0) {
    chapters.push({
      start: chapters[chapters.length - 1]!.end,
      end: duration * 1000,
      text: 'Episode'
    })
  }

  for (let i = 0, len = chapters.length - 2; i <= len; ++i) {
    const current = chapters[i]
    const next = chapters[i + 1]
    if ((current!.end | 0) !== (next!.start | 0)) {
      chapters.push({
        start: current!.end,
        end: next!.start,
        text: 'Episode'
      })
    }
  }

  chapters.sort((a, b) => a.start - b.start)

  return chapters
}

function sanitizeChapters (chapters: Chapter[], length: number): Chapter[] {
  if (length <= 0) {
    return []
  }

  const sanitizedChapters: Chapter[] = []
  let currentTime = 0

  const sortedChapters = chapters.map(chapter => {
    const end = Math.max(0, Math.min(length, chapter.end / 1000))
    const start = Math.min(Math.max(0, chapter.start / 1000), end)
    return { start, end, text: chapter.text }
  }).sort((a, b) => a.start - b.start)

  for (const chapter of sortedChapters) {
    // Handle Missing Segment Before Chapter
    if (chapter.start > currentTime) {
      sanitizedChapters.push({
        start: currentTime,
        end: chapter.start,
        text: sanitizedChapters.length === 0 ? '' : 'Episode'
      })
    }

    sanitizedChapters.push(chapter)
    currentTime = chapter.end
  }

  // Handle Missing Segment After Last Chapter
  if (currentTime < length) {
    sanitizedChapters.push({
      start: currentTime,
      end: length,
      text: ''
    })
  }

  return sanitizedChapters
}

export function getChapterTitle (time: number, chapters: Chapter[]): string | false {
  for (const { start, end, text } of chapters) {
    if (end > time) return start <= time && text
  }
  return false
}
