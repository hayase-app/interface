<svelte:options accessors={true} />

<script lang='ts'>
  import { registerAc3Decoder } from '@mediabunny/ac3'
  import { AudioBufferSink, CanvasSink, Input, type InputTrack, type WrappedAudioBuffer, type WrappedCanvas, ALL_FORMATS, UrlSource } from 'mediabunny'
  import { createEventDispatcher } from 'svelte'

  import Subs from './subtitles'

  import type { ResolvedFile } from './resolver'
  import type { Track } from '../../../../app'
  import type { TorrentFile } from 'native'
  import type { SvelteMediaTimeRange } from 'svelte/elements'

  import { settings } from '$lib/modules/settings'

  class DummyTrack implements Track {
    kind
    id
    language
    label

    constructor (track: InputTrack) {
      const { id, type, languageCode } = track
      this.id = `${id}`
      this.language = (!languageCode || languageCode === 'und') ? '' : languageCode
      this.label = track.name?.trim() || `${track.codec?.toUpperCase() || track.type} ${track.number}`
      this.kind = type
    }

    get selected () {
      return (this.kind === 'video' ? selectedVideoId : selectedAudioId) === this.id
    }

    set selected (value: boolean) {
      // can't un-select track, so this always has to be true
      if (!value || this.selected) return
      if (this.kind === 'video') {
        selectedVideoId = this.id
      } else {
        selectedAudioId = this.id
      }
      rebuildBackendPipeline(getBackendPlaybackTime())
    }

    get enabled () {
      return this.selected
    }

    set enabled (value: boolean) {
      this.selected = value
    }
  }

  async function * bufferAhead<T> (
    source: AsyncIterable<T>,
    bufferSize: number
  ): AsyncGenerator<T> {
    const iter = source[Symbol.asyncIterator]()
    const pending: Array<Promise<IteratorResult<T>>> = []
    let done = false

    const enqueue = () => {
      if (!done) pending.push(iter.next())
    }

    for (let i = 0; i < bufferSize; i++) enqueue()

    try {
      while (pending.length > 0) {
        const result = await pending.shift()!
        if (result.done) { done = true; break }
        enqueue()
        yield result.value
      }
    } finally {
      done = true
      await iter.return?.()
      // Drain in-flight promises so they don't float after cancellation.
      // Errors are suppressed — the source is being torn down regardless.
      await Promise.allSettled(pending)
    }
  }

  function clamp (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
  }

  export let src = ''
  export let immersed = false
  export let isMiniplayer = false
  export let fitWidth = false
  export let holdToFF: ((node: HTMLElement, type: 'pointer') => { destroy: () => void })

  export let videoWidth = 0
  export let videoHeight = 0
  export let currentTime = 0
  export let duration = 1
  export let ended = false
  export let paused = true
  export let muted = false
  export let readyState = 0
  export let buffered: SvelteMediaTimeRange[] = []
  export let playbackRate = 1
  export let volume = 1
  export let clientWidth = 0
  export let clientHeight = 0
  export let subtitles: Subs | undefined

  export let audioTracks: Track[] = []
  export let videoTracks: Track[] = []

  export let canvasSource: CanvasImageSource
  export let current: ResolvedFile
  export let otherFiles: TorrentFile[]

  $: ended = duration > 0 && currentTime >= duration

  $: if (ended) {
    paused = true
  }

  $: buffered = [{ start: 0, end: Math.min(duration, currentTime + 5) }]

  const dispatch = createEventDispatcher<{
    loadeddata: undefined
    loadedmetadata: undefined
    timeupdate: undefined
    fallback: Error
  }>()

  let lastSyncPaused = paused
  let lastObservedCurrentTime = currentTime

  let presentedFrames = 0
  const frameCallbacks = new Map<number, VideoFrameRequestCallback>()

  const input = new Input({
    source: new UrlSource(src),
    formats: ALL_FORMATS
  })

  let selectedAudioId: string | undefined
  let selectedVideoId: string | undefined

  let audioSink: AudioBufferSink | undefined
  let videoSink: CanvasSink | undefined

  let audioBufferIterator: AsyncGenerator<WrappedAudioBuffer, void, unknown> | null = null
  let videoFrameIterator: AsyncGenerator<WrappedCanvas, void, unknown> | null = null
  let nextFrame: WrappedCanvas | null = null

  let audioCtx: AudioContext | null = null
  let gain: GainNode | null = null
  const audioNodeQueue = new Set<AudioBufferSourceNode>()

  let audioContextStartTime: number | null = null
  let playbackTimeAtStart = clamp(currentTime)

  let rafHandle = 0

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D | null | undefined

  $: canvasSource = canvas

  const bufferAheadCount = Math.min((Number($settings.playerSeek) + 0.5) * 24, 40)

  function setCurrentTime (nextCurrentTime: number = playbackTimeAtStart) {
    currentTime = nextCurrentTime
    lastObservedCurrentTime = nextCurrentTime
  }

  $: if (gain) {
    gain.gain.value = muted ? 0 : clamp(volume, 0, 1)
  }

  function stopLoop () {
    cancelAnimationFrame(rafHandle)
    rafHandle = 0

    for (const node of audioNodeQueue) {
      try {
        node.stop()
      } catch {}
    }

    audioNodeQueue.clear()
  }

  function getBackendPlaybackTime () {
    if (!audioCtx) return 0

    // const baseLatency = audioCtx.baseLatency
    // const outputLatency = audioCtx.outputLatency
    const contextStart = audioContextStartTime ?? audioCtx.currentTime

    return clamp(playbackTimeAtStart + clamp(audioCtx.currentTime - contextStart), 0, duration)
  }

  async function waitForBackendAudioHeadroom (timestamp: number) {
    while (timestamp - getBackendPlaybackTime() >= 1) {
      if (paused) return
      await new Promise(resolve => setTimeout(resolve, clamp(timestamp - getBackendPlaybackTime() - 0.5, 100)))
    }
  }

  function presentBackendFrame (frame: WrappedCanvas) {
    presentedFrames += 1
    context!.drawImage(frame.canvas, 0, 0)

    if (!frameCallbacks.size) return

    const now = performance.now()
    const metadata = {
      mediaTime: clamp(frame.timestamp, 0),
      presentedFrames,
      processingDuration: 0,
      expectedDisplayTime: now,
      presentationTime: now,
      width: videoWidth,
      height: videoHeight
    }

    for (const callback of frameCallbacks.values()) {
      callback(now, metadata)
    }
    frameCallbacks.clear()
  }

  async function startBackendVideoIterator (time: number) {
    const safeTime = clamp(time, 0, duration || time)
    if (!videoSink) {
      nextFrame = null
      return safeTime
    }

    try {
      await videoFrameIterator?.return()
      videoFrameIterator = nextFrame = null
    } catch {}

    const iterator = videoFrameIterator = bufferAhead(videoSink.canvases(time), bufferAheadCount)

    const firstResult = await iterator.next()
    if (firstResult.done) return safeTime

    readyState = 2

    const firstFrame = firstResult.value
    presentBackendFrame(firstFrame)

    const secondResult = await iterator.next()

    nextFrame = secondResult.done ? null : secondResult.value

    readyState = 3

    return clamp(firstFrame.timestamp, 0, duration || firstFrame.timestamp)
  }

  async function rebuildBackendPipeline (startTime: number, initial = false) {
    readyState = 0
    await clearIterators()

    // const playbackVideoTracks = await filterAsync(await input.getVideoTracks(), track => track.canDecode())
    const playbackVideoTracks = await input.getVideoTracks()
    if (!playbackVideoTracks.length) {
      handleBackendError(new Error('No playable video tracks found.'))
      return
    }
    // const playbackAudioTracks = await filterAsync(await input.getAudioTracks(), track => track.canDecode())
    const playbackAudioTracks = await input.getAudioTracks()

    selectedAudioId ??= (playbackAudioTracks.find(track => track.languageCode === $settings.audioLanguage) ?? playbackAudioTracks.find(track => track.languageCode === 'jpn'))?.id.toString()

    audioTracks = playbackAudioTracks.map(t => new DummyTrack(t))
    videoTracks = playbackVideoTracks.map(t => new DummyTrack(t))

    const selectedVideo = playbackVideoTracks.find(track => `${track.id}` === selectedVideoId) ?? playbackVideoTracks[0]!
    const selectedAudio = playbackAudioTracks.find(track => `${track.id}` === selectedAudioId) ?? playbackAudioTracks[0]

    if (!audioCtx || !gain || (selectedAudio && audioCtx.sampleRate !== selectedAudio.sampleRate)) {
      audioCtx = new AudioContext({ sampleRate: selectedAudio?.sampleRate, latencyHint: 'playback' })
      gain = audioCtx.createGain()
      gain.connect(audioCtx.destination)
    }

    videoSink = new CanvasSink(selectedVideo, { poolSize: bufferAheadCount + 1, fit: 'contain' })
    audioSink = selectedAudio && new AudioBufferSink(selectedAudio)

    playbackTimeAtStart = clamp(currentTime)

    videoWidth = canvas.width = selectedVideo.displayWidth
    videoHeight = canvas.height = selectedVideo.displayHeight

    duration = await input.computeDuration()
    setCurrentTime(clamp(startTime, 0, duration || 0))

    if (initial) dispatch('loadedmetadata')
    readyState = 1

    if (!paused) await play()

    if (initial) dispatch('loadeddata')
  }

  export async function play () {
    if (!audioCtx) return
    if (!lastSyncPaused) return
    paused = lastSyncPaused = false

    if (ended || !videoFrameIterator) {
      setCurrentTime(await startBackendVideoIterator(ended ? 0 : currentTime))
    }

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    audioContextStartTime = audioCtx.currentTime
    playbackTimeAtStart = currentTime

    audioBufferIterator = audioSink!.buffers(currentTime)

    const loop = async () => {
      rafHandle = requestAnimationFrame(loop)

      const playbackTime = getBackendPlaybackTime()
      const timeChanged = Math.abs(currentTime - playbackTime) > 0.001

      if (timeChanged) {
        setCurrentTime(playbackTime)
        dispatch('timeupdate')
      }
      if (nextFrame && nextFrame.timestamp <= playbackTime) {
        const frameToPresent = nextFrame
        nextFrame = null
        presentBackendFrame(frameToPresent)

        if (!videoFrameIterator) return

        for (;;) {
          const nextResult = await videoFrameIterator.next()
          if (nextResult.done) return

          const candidate = nextResult.value
          const playbackTime = getBackendPlaybackTime()
          if (candidate.timestamp <= playbackTime) {
            presentBackendFrame(candidate)
          } else {
            nextFrame = candidate
            return
          }
        }
      }
    }

    if (!rafHandle) loop()

    for await (const { buffer, timestamp } of audioBufferIterator) {
      if (paused) break

      const node = audioCtx.createBufferSource()
      node.buffer = buffer
      node.connect(gain!)
      // node.playbackRate.value = playbackRate

      const startTimestamp = audioContextStartTime + (timestamp - playbackTimeAtStart)
      if (startTimestamp >= audioCtx.currentTime) {
        node.start(startTimestamp)
      } else {
        node.start(audioCtx.currentTime, audioCtx.currentTime - startTimestamp)
      }

      audioNodeQueue.add(node)
      node.onended = () => audioNodeQueue.delete(node)

      if (timestamp - getBackendPlaybackTime() >= 1) await waitForBackendAudioHeadroom(timestamp)
    }
  }

  export function pause () {
    if (lastSyncPaused) return
    paused = lastSyncPaused = true
    stopLoop()

    playbackTimeAtStart = getBackendPlaybackTime()
    setCurrentTime()

    audioBufferIterator?.return()
    audioBufferIterator = null
  }

  async function seekBackendTo (time: number) {
    const wasPaused = paused
    pause()

    readyState = 1
    playbackTimeAtStart = await startBackendVideoIterator(time)
    setCurrentTime()

    if (!wasPaused && !ended && paused) {
      await play()
    }
  }

  async function clearIterators () {
    stopLoop()

    const currentAudioIterator = audioBufferIterator
    const currentVideoIterator = videoFrameIterator

    audioBufferIterator = null
    videoFrameIterator = null
    nextFrame = null

    await Promise.allSettled([currentAudioIterator?.return(), currentVideoIterator?.return()])
  }

  async function destroy () {
    audioCtx?.close()
    audioCtx = null
    gain = null

    audioContextStartTime = null
    audioSink = undefined
    videoSink = undefined
    input.dispose()

    audioTracks = []
    videoTracks = []
    selectedAudioId = undefined
    selectedVideoId = undefined

    await clearIterators()
  }

  function handleBackendError (error: Error) {
    console.error('MediaBunny playback failed, falling back to native video:', error)
    destroy()
    dispatch('fallback', error)
  }

  export async function load () {
    try {
      playbackTimeAtStart = clamp(currentTime)
      setCurrentTime()

      await rebuildBackendPipeline(playbackTimeAtStart, true)
    } catch (error) {
      handleBackendError(error as Error)
    }
  }

  function setupBackend (canvas: HTMLCanvasElement, src: string) {
    context = canvas.getContext('2d', { desynchronized: true, alpha: false })
    if (!context) handleBackendError(new Error('2D canvas context is unavailable for MediaBunny playback.'))
    registerAc3Decoder()
    load()
    return {
      destroy,
      update (src: string) {
        if (src) {
          load()
        } else {
          destroy()
        }
      }
    }
  }

  $: target = clamp(currentTime, 0, duration || 0)
  $: if (Math.abs(target - lastObservedCurrentTime) > 0.001) {
    lastObservedCurrentTime = target
    seekBackendTo(target).catch(handleBackendError)
  }

  let sentinel: WakeLockSentinel | undefined

  async function lock () {
    sentinel = await navigator.wakeLock?.request?.('screen')
  }
  function unlock () {
    sentinel?.release()
  }
  $: if (paused) {
    unlock()
  } else {
    lock()
  }

  $: if (paused !== lastSyncPaused) {
    if (paused) {
      pause()
    } else {
      play()
    }
  }

  // $: if (playbackRate) {
  //   for (const node of audioNodeQueue) {
  //     node.playbackRate.value = playbackRate
  //   }
  // }

  export function requestVideoFrameCallback (callback: VideoFrameRequestCallback) {
    const now = performance.now()
    frameCallbacks.set(now, callback)
    return now
  }

  export function cancelVideoFrameCallback (handle: number) {
    frameCallbacks.delete(handle)
  }

  export function getVideoPlaybackQuality (): VideoPlaybackQuality {
    return {
      creationTime: performance.now(),
      totalVideoFrames: presentedFrames,
      droppedVideoFrames: 0,
      corruptedVideoFrames: 0
    }
  }

  function createSubs (canvas: HTMLCanvasElement) {
    subtitles = new Subs(undefined, otherFiles, current, canvas)

    const loop = async (_: number, meta: VideoFrameCallbackMetadata) => {
      if (!subtitles) return

      await subtitles.jassub?.ready
      subtitles.jassub?.manualRender(meta)

      handle = requestVideoFrameCallback(loop)
    }

    let handle = requestVideoFrameCallback(loop)

    return {
      destroy () {
        subtitles?.destroy()
        cancelVideoFrameCallback(handle)
      }
    }
  }
</script>

<canvas
  use:holdToFF={'pointer'}
  bind:this={canvas}
  bind:clientWidth
  bind:clientHeight
  on:click
  on:dblclick
  on:pointermove
  use:setupBackend={src}
  {...$$restProps}
/>
<canvas class='size-full object-contain pointer-events-none absolute inset-0' use:createSubs />
