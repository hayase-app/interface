// Audio output and master clock.
//
// The worklet is the clock. It consumes decoded PCM at the sound card rate and
// reports the media time of the samples it emitted. The video pipeline follows
// this clock. All decode work is guarded by a seek sequence, so a stale pump
// stops itself after a seek.

import { AudioBufferSink, type InputAudioTrack, type WrappedAudioBuffer } from 'mediabunny'

import { closeIterator } from './helpers'
import processorUrl from './pcmScheduler.worklet.ts?worker&url'

import TypedEventTarget from '$lib/modules/target'
import { clamp, sleep } from '$lib/utils'

const AUDIO_BUFFER_SECONDS = 3
const AUDIO_LOW_WATER_SECONDS = 0.5
const SEEK_FADE_MS = 12

interface WorkletMessage {
  type?: string
  mediaTime?: number
  bufferedFrames?: number
  active?: boolean
  underruns?: number
}

export interface AudioProgress {
  bufferedFrames: number
  underruns: number
  active: boolean
}

export interface AudioOutputEventMap {
  progress: CustomEvent<AudioProgress>
  error: CustomEvent<{ error: Error }>
}

export default class AudioOutput extends TypedEventTarget<AudioOutputEventMap> {
  rate = 1
  volume = 1
  muted = false
  playing = false
  inputRate = 48000
  bufferedFrames = 0
  mediaEnd = 0
  drained = false
  exhausted = false

  _destroyed = false
  _duration = 0
  _track?: InputAudioTrack

  _audioCtx?: AudioContext
  _workletNode?: AudioWorkletNode
  _gainNode?: GainNode

  _seekSeq = 0
  _streamId = 0
  _gen = 0
  _pushedFrames = 0
  _highWaterFrames = AUDIO_BUFFER_SECONDS * 48000
  _lowWaterFrames = AUDIO_LOW_WATER_SECONDS * 48000
  _waiters: Array<() => void> = []
  _iter?: AsyncIterator<WrappedAudioBuffer>

  _clockMedia = 0
  _clockPerf = 0
  _clockActive = false
  _anchorMedia = 0
  _anchorPerf = 0

  setDuration (duration: number) {
    this._duration = duration
  }

  get time () {
    if (!this._track || this.exhausted) return this._noAudioTime()
    if (!this.playing || !this._clockActive) return this._clockMedia
    return clamp(this._clockMedia + ((performance.now() - this._clockPerf) / 1000) * this.rate, 0, this._duration || Infinity)
  }

  _noAudioTime () {
    if (!this.playing) return this._anchorMedia
    return clamp(this._anchorMedia + ((performance.now() - this._anchorPerf) / 1000) * this.rate, 0, this._duration || Infinity)
  }

  _outputLatency () {
    const ctx = this._audioCtx
    if (!ctx) return 0
    return ctx.outputLatency || ctx.baseLatency || 0
  }

  _effectiveVolume () {
    return this.muted ? 0 : clamp(this.volume, 0, 1)
  }

  // Move the clock and anchor to a media time. A fresh anchor stops the
  // derived time from drifting across a seek, a pause or a rate change.
  _setClock (mediaTime: number, active = false) {
    const now = performance.now()
    this._clockMedia = mediaTime
    this._clockPerf = now
    this._clockActive = active
    this._anchorMedia = mediaTime
    this._anchorPerf = now
  }

  _closeIterator () {
    closeIterator(this._iter)
    this._iter = undefined
  }

  // Tear down the audio graph. The worklet message handler and the connections
  // are removed first, so no progress fires after teardown.
  _teardownAudio () {
    if (this._workletNode) {
      this._workletNode.port.onmessage = null
      this._workletNode.disconnect()
      this._workletNode = undefined
    }
    this._gainNode?.disconnect()
    this._gainNode = undefined
    this._audioCtx?.close()
    this._audioCtx = undefined
  }

  async setup (track?: InputAudioTrack) {
    this._teardownAudio()
    this._track = track
    const sampleRate = track ? await track.getSampleRate() : 48000
    const channels = track ? await track.getNumberOfChannels() : 2
    this.inputRate = sampleRate
    this._highWaterFrames = AUDIO_BUFFER_SECONDS * sampleRate
    this._lowWaterFrames = AUDIO_LOW_WATER_SECONDS * sampleRate

    const ctx = this._audioCtx = new AudioContext({ sampleRate, latencyHint: 'playback' })
    const gain = this._gainNode = ctx.createGain()
    gain.gain.value = this._effectiveVolume()
    gain.connect(ctx.destination)

    await ctx.audioWorklet.addModule(processorUrl)
    if (this._destroyed) {
      this._teardownAudio()
      return
    }

    const node = this._workletNode = new AudioWorkletNode(ctx, 'pcm-scheduler', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [channels]
    })
    node.port.onmessage = ({ data }: MessageEvent<WorkletMessage>) => this._onWorkletMessage(data)
    node.connect(gain)
    node.port.postMessage({ type: 'rate', rate: this.rate })
  }

  async rebuild (track?: InputAudioTrack) {
    await this.setup(track)
  }

  setTrack (track?: InputAudioTrack) {
    this._track = track
  }

  // The worklet output must match the track channel count and the context
  // sample rate. A mismatch needs a new context.
  async needsRebuild (track?: InputAudioTrack) {
    if (!track) return false
    const sampleRate = await track.getSampleRate()
    const channels = await track.getNumberOfChannels()
    return sampleRate !== this.inputRate || channels !== (this._workletNode?.channelCount ?? channels)
  }

  _onWorkletMessage (data: WorkletMessage) {
    if (data.type !== 'progress') return
    this.bufferedFrames = data.bufferedFrames ?? 0
    this._clockMedia = clamp((data.mediaTime ?? 0) - this._outputLatency(), 0, this._duration || Infinity)
    this._clockPerf = performance.now()
    this._clockActive = data.active ?? false

    if (this.drained && this.bufferedFrames <= 0 && this._clockActive && !this.exhausted) {
      this.exhausted = true
      this._anchorMedia = this._clockMedia
      this._anchorPerf = performance.now()
      this._workletNode?.port.postMessage({ type: 'pause' })
    }

    this._emit('progress', {
      bufferedFrames: this.bufferedFrames,
      underruns: data.underruns ?? 0,
      active: this._clockActive
    })
    this._wakeWaiters()
  }

  _wakeWaiters () {
    if (!this._waiters.length) return
    const waiters = this._waiters
    this._waiters = []
    for (const resolve of waiters) resolve()
  }

  _waitForBuffer () {
    return new Promise<void>(resolve => { this._waiters.push(resolve) })
  }

  _startPump (startTime: number) {
    const track = this._track
    if (!track) {
      this.drained = true
      return
    }

    this._gen++
    const gen = this._gen
    const streamId = this._streamId

    // Each pump reads from its own sink. A stale generator on a shared sink
    // would corrupt the decode pipeline after a seek.
    const sink = new AudioBufferSink(track)

    const run = async () => {
      let iterator: AsyncGenerator<WrappedAudioBuffer> | undefined
      try {
        iterator = sink.buffers(startTime)
        this._iter = iterator
        for await (const wrapped of iterator) {
          if (gen !== this._gen || streamId !== this._streamId || this._destroyed) break
          this.mediaEnd = Math.max(this.mediaEnd, wrapped.timestamp + wrapped.duration)
          this._push(wrapped.buffer, streamId)
          while (this.bufferedFrames > this._highWaterFrames && gen === this._gen && streamId === this._streamId) {
            await this._waitForBuffer()
          }
        }
        if (gen === this._gen && streamId === this._streamId) {
          this.drained = true
          this._wakeWaiters()
        }
      } catch (error) {
        if (gen !== this._gen || streamId !== this._streamId) return
        // Audio is optional. Keep the video running with the fallback clock.
        this.exhausted = true
        this.drained = true
        this._anchorMedia = this._clockMedia
        this._anchorPerf = performance.now()
        this._workletNode?.port.postMessage({ type: 'pause' })
        this._wakeWaiters()
        this._emit('error', { error: error as Error })
      } finally {
        if (this._iter === iterator) this._iter = undefined
      }
    }

    run()
  }

  _push (buffer: AudioBuffer, streamId: number) {
    const channels = buffer.numberOfChannels
    const frames = buffer.length
    const channelData: Float32Array[] = []
    for (let c = 0; c < channels; c++) {
      const data = new Float32Array(frames)
      buffer.copyFromChannel(data, c)
      channelData.push(data)
    }
    this._pushedFrames += frames
    try {
      this._workletNode?.port.postMessage({ type: 'push', channelData, streamId }, channelData.map(data => data.buffer))
    } catch {
      // The worklet may be gone during teardown.
    }
  }

  async play () {
    if (this._destroyed) return
    this.playing = true
    try {
      await this._audioCtx?.resume()
    } catch {}
    if (this._destroyed) return
    this.resumeOutput()
  }

  // Start audible output. Wait for a low-water mark first, so a fresh seek
  // does not drain the worklet before the decoder delivers data.
  async resumeOutput () {
    const gen = this._gen
    const streamId = this._streamId
    if (this._track) {
      while (
        (
          (this.bufferedFrames < this._lowWaterFrames && !this.drained) ||
          (this.drained && this.bufferedFrames < this._pushedFrames)
        ) &&
        gen === this._gen && streamId === this._streamId &&
        !this._destroyed && this.playing
      ) {
        await this._waitForBuffer()
      }
    }
    if (gen !== this._gen || streamId !== this._streamId || this._destroyed || !this.playing) return

    this._workletNode?.port.postMessage({ type: 'play' })
    this._setClock(this._clockMedia, true)
  }

  pause () {
    const now = this.time
    this.playing = false
    this._setClock(now)
    this._workletNode?.port.postMessage({ type: 'pause' })
  }

  async seek (time: number) {
    if (this._destroyed) return
    const seq = ++this._seekSeq
    this._streamId++
    this.drained = false
    this.exhausted = false
    this.mediaEnd = 0

    if (this.playing && this._workletNode) {
      this._workletNode.port.postMessage({ type: 'gain', value: 0 })
      await sleep(SEEK_FADE_MS)
      if (seq !== this._seekSeq || this._destroyed) return
    }

    this._workletNode?.port.postMessage({ type: 'pause' })
    this._workletNode?.port.postMessage({ type: 'flush', anchorMedia: time, streamId: this._streamId, rate: this.rate })
    this.bufferedFrames = 0
    this._pushedFrames = 0
    this._gen++
    this._wakeWaiters()
    this._closeIterator()
    this._setClock(time)

    this._startPump(time)
  }

  setRate (rate: number) {
    const next = clamp(rate, 0.1, 16)
    if (next === this.rate) return
    const now = this.time
    this.rate = next
    this._workletNode?.port.postMessage({ type: 'rate', rate: next })
    this._anchorMedia = now
    this._anchorPerf = performance.now()
    this._clockPerf = performance.now()
  }

  setVolume (volume: number) {
    this.volume = clamp(volume, 0, 1)
    this._applyGain()
  }

  setMuted (muted: boolean) {
    this.muted = muted
    this._applyGain()
  }

  _applyGain () {
    const ctx = this._audioCtx
    const gain = this._gainNode
    if (!ctx || !gain) return
    gain.gain.setTargetAtTime(this._effectiveVolume(), ctx.currentTime, 0.01)
  }

  reset () {
    this._gen++
    this._seekSeq++
    this._wakeWaiters()
    this._closeIterator()
    this._teardownAudio()
    this._track = undefined
    this.playing = false
    this.drained = false
    this.exhausted = false
    this.bufferedFrames = 0
    this._pushedFrames = 0
    this.mediaEnd = 0
    this._setClock(0)
  }

  destroy () {
    if (this._destroyed) return
    this._destroyed = true
    this.reset()
  }
}
