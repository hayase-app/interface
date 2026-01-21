import { toast } from 'svelte-sonner'

import type { Media } from '$lib/modules/anilist'
import type { ResolvedFile } from './resolver'
import type Subtitles from './subtitles'
import type { Track } from '../../../../app'
import type { SessionMetadata } from 'native'

export interface Chapter {
  start: number
  end: number
  text: string
}

export interface MediaInfo {
  file: ResolvedFile
  media: Media
  episode: number
  session: SessionMetadata
}

export function getChapterTitle (time: number, chapters: Chapter[]): string | false {
  for (const { start, end, text } of chapters) {
    if (end > time) return start <= time && text
  }
  return false
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

export async function getChaptersAniSkip (idMal: number, episode: number, duration: number): Promise<Chapter[]> {
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

export function sanitizeChapters (chapters: Chapter[], length: number): Chapter[] {
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

export function normalizeTracks (_tracks: Track[]) {
  const tracks = [..._tracks]
  const hasEng = tracks.some(track => track.language === 'eng' || track.language === 'en')
  const lang = tracks.map(({ id, language, label, enabled, selected }) => {
    return {
      enabled: enabled ?? selected,
      id,
      language: language || (!hasEng ? 'eng' : 'unk'),
      label: label || 'Default'
    }
  })
  return lang.reduce<Record<string, typeof lang>>((acc, track) => {
    acc[track.language] ??= []
    acc[track.language]!.push(track)
    return acc
  }, {})
}

export function normalizeSubs (_tracks?: Record<number | string, { meta: { language?: string, type: string, header: string, number: string, name?: string } }>) {
  if (!_tracks) return {}
  const hasEng = Object.values(_tracks).some(({ meta }) => meta.language === 'eng' || meta.language === 'en')
  const lang = Object.values(_tracks).map(({ meta }) => ({
    language: meta.language ?? (!hasEng ? 'eng' : 'unk'),
    number: meta.number,
    name: meta.name ?? meta.language ?? (!hasEng ? 'eng' : 'unk')
  }))
  return lang.reduce<Record<string, typeof lang>>((acc, track) => {
    acc[track.language] ??= []
    acc[track.language]!.push(track)
    return acc
  }, {})
}

export async function screenshot (video: HTMLVideoElement, subtitles?: Subtitles) {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) return
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  context.drawImage(video, 0, 0)
  if (subtitles?.jassub) {
    await subtitles.jassub.resize(true, video.videoWidth, video.videoHeight)
    context.drawImage(subtitles.jassub._canvas, 0, 0, canvas.width, canvas.height)
    subtitles.jassub.resize(true)
  }
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png', 1))
  canvas.remove()
  function download () {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'screenshot.png'
    a.click()
    URL.revokeObjectURL(url)
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    toast.success('Saved screenshot to clipboard', {
      description: 'Click here to download it as a PNG file instead.',
      action: {
        label: 'Download',
        onClick: download
      }
    })
  } catch (error) {
    toast.error('Failed to copy screenshot to clipboard. Downloading instead.')
    download()
  }
}

const skippableChaptersRx: Array<[string, RegExp]> = [
  ['Opening', /^op$|opening$|^ncop|^opening /mi],
  ['Ending', /^ed$|ending$|^nced|^ending /mi],
  ['Recap', /recap/mi]
]
export function isChapterSkippable ({ text }: Chapter) {
  for (const [name, regex] of skippableChaptersRx) {
    if (regex.test(text)) return name
  }
  return null
}

export function findChapter (time: number, chapters: Chapter[]) {
  return chapters.find(({ start, end }) => time >= start && time <= end)
}
