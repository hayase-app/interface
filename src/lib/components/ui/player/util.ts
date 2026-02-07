import { toast } from 'svelte-sonner'

import type { Media } from '$lib/modules/anilist'
import type { ResolvedFile } from './resolver'
import type Subtitles from './subtitles'
import type { Track } from '../../../../app'
import type { SessionMetadata } from 'native'

export interface MediaInfo {
  file: ResolvedFile
  media: Media
  episode: number
  session: SessionMetadata
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
