<svelte:options accessors={true} />

<script context='module' lang='ts'>
  export interface TrackAdapter {
    id: string
    kind: 'audio' | 'video'
    label: string
    language: string
    selected: boolean
    enabled: boolean
  }
</script>

<script lang='ts'>
  import { createEventDispatcher } from 'svelte'

  import Subs from '../subtitles'

  import MediaEngine, { type EngineEventKey, type EngineEventMap, type PlayerState, type TrackInfo } from './engine'

  import type PictureInPicture from '../pip'
  import type { MediaInfo } from '../util'
  import type { TorrentFile } from 'native'
  import type { SvelteMediaTimeRange } from 'svelte/elements'

  import { customDoubleClick } from '$lib/modules/navigate'
  import { cn } from '$lib/utils'

  export let src = ''
  export let current: MediaInfo | undefined = undefined
  export let otherFiles: TorrentFile[] = []
  export let pip: PictureInPicture | undefined = undefined
  export let holdToFF: ((node: HTMLElement, type: 'pointer') => { destroy: () => void }) | undefined = undefined
  export let immersed = false
  export let isMiniplayer = false
  export let fitWidth = false
  export let autoplay = false

  export let currentTime = 0
  export let duration = 0
  export let ended = false
  export let paused = true
  export let muted = false
  export let volume = 1
  export let playbackRate = 1
  export let readyState = 0
  export let buffered: SvelteMediaTimeRange[] = []
  export let videoWidth = 0
  export let videoHeight = 0
  export let clientWidth = 0
  export let clientHeight = 0
  export let canvasSource: CanvasImageSource | undefined = undefined
  export let subtitles: Subs | undefined = undefined
  export let audioTracks: TrackAdapter[] = []
  export let videoTracks: TrackAdapter[] = []

  const dispatch = createEventDispatcher<{
    loadeddata: undefined
    loadedmetadata: undefined
    timeupdate: undefined
    fallback: Error
    click: MouseEvent
    dblclick: MouseEvent
    stats: { bufferedFrames: number, underruns: number, active: boolean }
    frame: { timestamp: number, clock: number }
  }>()

  const noopHold = (_node: HTMLElement, _type: 'pointer') => ({ destroy () {} })
  function holdAction (node: HTMLElement, type: 'pointer') {
    return (holdToFF ?? noopHold)(node, type)
  }

  let subtitleCanvas: HTMLCanvasElement
  let engine: MediaEngine
  let loadedSrc = ''
  let lastObservedTime = 0
  let lastObservedPaused = true
  let selectedAudioId = ''
  let selectedVideoId = ''

  // A track behaves like an HTMLMediaElement track: set enabled/selected and
  // the engine switches to it. Reading it reflects the current selection.
  function makeTrack (info: TrackInfo, kind: 'audio' | 'video'): TrackAdapter {
    const currentId = () => (kind === 'audio' ? selectedAudioId : selectedVideoId)
    const select = (value: boolean) => {
      if (!value) return
      if (kind === 'audio') engine?.setAudioTrack(info.id)
      else engine?.setVideoTrack(info.id)
    }
    return {
      id: info.id,
      kind,
      label: info.label,
      language: info.language,
      get selected () { return currentId() === info.id },
      set selected (value: boolean) { select(value) },
      get enabled () { return currentId() === info.id },
      set enabled (value: boolean) { select(value) }
    }
  }

  function setTracks (audio: TrackInfo[], video: TrackInfo[]) {
    selectedAudioId = audio.find(track => track.selected)?.id ?? ''
    selectedVideoId = video.find(track => track.selected)?.id ?? ''
    audioTracks = audio.map(info => makeTrack(info, 'audio'))
    videoTracks = video.map(info => makeTrack(info, 'video'))
  }

  async function load (source = src) {
    if (!engine || !source) return
    loadedSrc = source
    try {
      await engine.load(source)
      if (autoplay || !paused) await engine.play()
    } catch (error) {
      dispatch('fallback', error as Error)
    }
  }

  function setupSubtitles () {
    if (!current || !subtitleCanvas) return
    subtitles?.destroy()
    subtitles = new Subs(undefined, otherFiles, current, subtitleCanvas)

    const loop = async (_now: number, meta: VideoFrameCallbackMetadata) => {
      if (!subtitles) return
      await subtitles.jassub?.ready
      subtitles.jassub?.manualRender(meta)
      engine.video.requestVideoFrameCallback(loop)
    }
    engine.video.requestVideoFrameCallback(loop)
  }

  export const play = () => engine?.play()
  export const pause = () => engine?.pause()
  export { load }
  export const seekTo = (time: number) => engine?.seekTo(time)

  export function requestVideoFrameCallback (callback: VideoFrameRequestCallback) {
    return engine.video.requestVideoFrameCallback(callback)
  }

  export function cancelVideoFrameCallback (handle: number) {
    engine.video.cancelVideoFrameCallback(handle)
  }

  export function getVideoPlaybackQuality () {
    return engine.video.getVideoPlaybackQuality()
  }

  function onEngine<K extends EngineEventKey> (type: K, handler: (event: EngineEventMap[K]) => void) {
    engine.addEventListener(type, handler)
    return () => engine.removeEventListener(type, handler)
  }

  function bindEngine () {
    onEngine('loadedmetadata', (event) => {
      duration = event.detail.duration
      videoWidth = event.detail.videoWidth
      videoHeight = event.detail.videoHeight
      dispatch('loadedmetadata')
    })
    onEngine('readystatechange', (event) => {
      readyState = event.detail.readyState
    })
    onEngine('loadeddata', () => {
      setupSubtitles()
      dispatch('loadeddata')
    })
    onEngine('durationchange', (event) => {
      duration = event.detail.duration
    })
    onEngine('timeupdate', (event) => {
      lastObservedTime = event.detail.time
      currentTime = event.detail.time
      dispatch('timeupdate')
    })
    onEngine('buffered', (event) => {
      const { start, end } = event.detail
      buffered = Number.isFinite(end) ? [{ start, end }] : []
    })
    onEngine('statechange', (event) => {
      const state: PlayerState = event.detail.state
      ended = state === 'ended'
      paused = state !== 'playing'
      lastObservedPaused = paused
    })
    onEngine('tracks', (event) => {
      setTracks(event.detail.audio, event.detail.video)
    })
    onEngine('stats', (event) => {
      dispatch('stats', event.detail)
    })
    onEngine('frame', (event) => {
      dispatch('frame', event.detail)
    })
    onEngine('ended', () => {
      ended = true
      paused = true
      lastObservedPaused = true
    })
    onEngine('error', (event) => {
      dispatch('fallback', event.detail.error)
    })
  }

  $: if (engine && src && src !== loadedSrc) load(src)
  $: if (engine && Math.abs(currentTime - lastObservedTime) > 0.25) {
    lastObservedTime = currentTime
    engine.seekTo(currentTime)
  }
  $: if (engine && paused !== lastObservedPaused) {
    lastObservedPaused = paused
    if (paused) engine.pause()
    else engine.play()
  }
  $: engine?.audio.setVolume(volume)
  $: engine?.audio.setMuted(muted)
  $: engine?.audio.setRate(playbackRate)

  function mount (canvas: HTMLCanvasElement) {
    engine = new MediaEngine(canvas)
    canvasSource = canvas
    bindEngine()

    return {
      destroy: () => {
        subtitles?.destroy()
        engine.destroy()
      }
    }
  }
</script>

<canvas
  use:mount
  use:customDoubleClick={{ double: (e) => dispatch('dblclick', e), single: (e) => dispatch('click', e), condition: !isMiniplayer }}
  use:holdAction={'pointer'}
  bind:clientWidth
  bind:clientHeight
  on:pointermove
  on:contextmenu
  {...$$restProps}
  class={cn('size-full touch-none object-contain', immersed && 'cursor-none', isMiniplayer && 'cursor-pointer', fitWidth && 'object-cover', $$restProps.class)}
/>
<canvas bind:this={subtitleCanvas} class='size-full object-contain pointer-events-none absolute inset-0' />
