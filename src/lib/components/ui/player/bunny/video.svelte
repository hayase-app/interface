<svelte:options accessors={true} />

<script lang='ts' context='module'>
  import { canDecodeAudio } from 'mediabunny'

  import { SUPPORTS } from '$lib/modules/settings'

  let loadPromise: Promise<void> | null = null

  async function loadCodecs () {
    const [ac3, flac] = await Promise.all([
      canDecodeAudio('ac3'),
      canDecodeAudio('flac')
    // canDecodeAudio('aac'),
    ])

    if (!ac3) await import('@mediabunny/ac3').then(({ registerAc3Decoder }) => registerAc3Decoder())
    if (!flac || SUPPORTS.isIOS) await import('./flac').then(({ registerFlacDecoder }) => registerFlacDecoder())
  }
</script>

<script lang='ts'>
  import { AudioBufferSink, type VideoSample, VideoSampleSink, Input, type InputTrack, type WrappedAudioBuffer, ALL_FORMATS, UrlSource } from 'mediabunny'
  import { createEventDispatcher } from 'svelte'

  import Subs from '../subtitles'

  import audioWorkletUrl from './audioWorklet.ts?worker&url'

  import type { Track } from '../../../../../app'
  import type { ResolvedFile } from '../resolver'
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

  async function * bufferAhead<T> (source: AsyncIterable<T>, bufferSize: number): AsyncGenerator<T> {
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
      await Promise.allSettled(pending)
    }
  }

  function clamp (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) {
    return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min)) || 0
  }

  export let src = ''
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
  export let otherFiles: TorrentFile[] = []

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
  let videoSink: VideoSampleSink | undefined

  let audioBufferIterator: AsyncGenerator<WrappedAudioBuffer, void, unknown> | null = null
  let videoFrameIterator: AsyncGenerator<VideoSample, void, unknown> | null = null
  let nextFrame: VideoSample | null = null

  let audioCtx: AudioContext | null = null
  let gain: GainNode | null = null

  let audioContextStartTime: number | null = null
  let playbackTimeAtStart = clamp(currentTime)

  let rafHandle = 0

  let canvas: HTMLCanvasElement
  let context: CanvasRenderingContext2D | null | undefined
  let asyncId = 0

  let firstTimeStamp = 0

  $: canvasSource = canvas

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

    samplesSent = 0
    samplesConsumed = 0
    workletNode?.port.postMessage({ type: 'flush' })
  }

  let workletNode: AudioWorkletNode | undefined
  let samplesSent = 0
  let samplesConsumed = 0

  function getBackendPlaybackTime () {
    if (!audioCtx) return 0

    if (!paused) {
      const baseLatency = audioCtx.baseLatency
      // const outputLatency = audioCtx.outputLatency
      const contextStart = audioContextStartTime ?? audioCtx.currentTime

      return clamp(playbackTimeAtStart + clamp(audioCtx.currentTime - contextStart - baseLatency), 0, duration)
    }

    return playbackTimeAtStart
  }

  async function waitForBackendAudioHeadroom () {
    await new Promise<void>((resolve) => {
      const id = setInterval(() => {
        const bufferedSeconds = (samplesSent - samplesConsumed) / audioCtx!.sampleRate
        if (bufferedSeconds < 2) {
          clearInterval(id)
          resolve()
        }
      }, 100)
    })
  }

  function presentBackendFrame (frame: VideoSample) {
    presentedFrames += 1
    context!.drawImage(frame.toCanvasImageSource(), 0, 0)
    nextFrame = null
    frame.close()

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

    asyncId++

    const currentAsyncId = asyncId

    try {
      await videoFrameIterator?.return()
      videoFrameIterator = nextFrame = null
    } catch {}

    if (asyncId !== currentAsyncId) return safeTime

    const iterator = videoFrameIterator = bufferAhead(videoSink.samples(time), 3)

    const firstResult = await iterator.next()
    if (firstResult.done || asyncId !== currentAsyncId) return safeTime

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

    const tracks = [...playbackVideoTracks, ...playbackAudioTracks]

    selectedAudioId ??= (playbackAudioTracks.find(track => track.languageCode === $settings.audioLanguage) ?? playbackAudioTracks.find(track => track.languageCode === 'jpn'))?.id.toString()

    audioTracks = playbackAudioTracks.map(t => new DummyTrack(t))
    videoTracks = playbackVideoTracks.map(t => new DummyTrack(t))

    const selectedVideo = playbackVideoTracks.find(track => `${track.id}` === selectedVideoId) ?? playbackVideoTracks[0]!
    const selectedAudio = playbackAudioTracks.find(track => `${track.id}` === selectedAudioId) ?? playbackAudioTracks[0]

    const sampleRate = await selectedAudio?.getSampleRate()

    if (!audioCtx || !gain || (audioCtx.sampleRate !== sampleRate)) {
      await audioCtx?.close()
      audioCtx = new AudioContext({ sampleRate })
      gain = audioCtx.createGain()
      gain.connect(audioCtx.destination)
      await audioCtx.audioWorklet.addModule(audioWorkletUrl)

      workletNode = new AudioWorkletNode(audioCtx, 'audio-stream-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [await selectedAudio?.getNumberOfChannels() ?? 2]
      })

      workletNode.port.onmessage = ({ data }) => {
        if (data.type === 'progress') samplesConsumed = data.samplesConsumed
      }

      workletNode.connect(gain)
    }

    videoSink = new VideoSampleSink(selectedVideo)
    audioSink = selectedAudio && new AudioBufferSink(selectedAudio)

    videoWidth = await selectedVideo.getDisplayWidth()
    videoHeight = await selectedVideo.getDisplayHeight()

    playbackTimeAtStart = clamp(currentTime, firstTimeStamp)
    firstTimeStamp = clamp(await input.getFirstTimestamp(tracks))

    duration = await input.getDurationFromMetadata(tracks, { skipLiveWait: true }) ?? await input.computeDuration(tracks, { skipLiveWait: true })
    setCurrentTime(clamp(startTime, 0, duration))

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
        const currentAsyncId = asyncId

        try {
          while (true) {
            const nextResult = await videoFrameIterator.next()
            if (nextResult.done) return

            if (asyncId !== currentAsyncId) return

            const candidate = nextResult.value
            const playbackTime = getBackendPlaybackTime()
            if (candidate.timestamp <= playbackTime) {
              presentBackendFrame(candidate)
              if (readyState === 1) await audioCtx?.suspend()
              readyState = 1
            } else {
              if (audioCtx?.state === 'suspended') await audioCtx.resume()
              nextFrame = candidate
              readyState = 3
              return
            }
          }
        } catch (error) {
          if (asyncId !== currentAsyncId) return

          seekBackendTo(getBackendPlaybackTime())
        }
      }
    }

    if (!rafHandle) loop()

    for await (const { buffer } of audioBufferIterator) {
      if (paused) break

      const frames = buffer.length
      const channelData = Array.from({ length: buffer.numberOfChannels }, (_, c) => {
        const arr = new Float32Array(frames)
        buffer.copyFromChannel(arr, c)
        return arr
      })

      const data = { type: 'push', channelData, srcRate: buffer.sampleRate } as const

      if (SUPPORTS.isIOS) {
        workletNode!.port.postMessage(data)
      } else {
        workletNode!.port.postMessage(data, channelData.map(a => a.buffer))
      }

      samplesSent += frames

      const bufferedSeconds = (samplesSent - samplesConsumed) / audioCtx.sampleRate
      if (bufferedSeconds >= 2) await waitForBackendAudioHeadroom()
    }
  }

  export function pause () {
    if (lastSyncPaused) return
    playbackTimeAtStart = getBackendPlaybackTime()
    paused = lastSyncPaused = true
    stopLoop()

    setCurrentTime()

    audioBufferIterator?.return()
    audioBufferIterator = null
  }

  async function seekBackendTo (time: number) {
    const wasPaused = paused
    pause()
    const currentAsyncId = asyncId + 1
    readyState = 1
    const newTime = await startBackendVideoIterator(time)
    if (asyncId !== currentAsyncId) return
    playbackTimeAtStart = newTime
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
      await loadPromise
      playbackTimeAtStart = clamp(currentTime)
      setCurrentTime()

      await rebuildBackendPipeline(playbackTimeAtStart, true)
    } catch (error) {
      handleBackendError(error as Error)
    }
  }

  function setupBackend (canvas: HTMLCanvasElement, src: string) {
    context = canvas.getContext('2d', { desynchronized: true, alpha: false })

    loadPromise ??= loadCodecs()

    if (!context) handleBackendError(new Error('2D canvas context is unavailable for MediaBunny playback.'))
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

  $: target = clamp(currentTime, firstTimeStamp, duration || 0)
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
  width={videoWidth}
  height={videoHeight}
/>
<canvas class='size-full object-contain pointer-events-none absolute inset-0' use:createSubs />
