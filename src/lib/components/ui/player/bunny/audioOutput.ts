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
// A decoder can reject a decode while it tears down after a seek. Retry the
// pump before audio is dropped, and never fail the engine for an audio error.
const PUMP_RETRY_LIMIT = 5
const PUMP_RETRY_DELAY_MS = 100
const PUMP_RETRY_WINDOW_MS = 5000

interface WorkletMessage {
  type?: string
  mediaTime?: number
  contextTime?: number
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
  // The engine closes this gate while a seek has not presented its video frame.
  canResume?: () => boolean
  // The fallback clock advances only while a frame can be presented.
  canAdvance?: () => boolean
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
  _highWaterFrames = AUDIO_BUFFER_SECONDS * 48000
  _lowWaterFrames = AUDIO_LOW_WATER_SECONDS * 48000
  _waiters: Array<() => void> = []
  _iter?: AsyncIterator<WrappedAudioBuffer>

  _pumpRetries = 0
  _lastPumpErrorAt = 0
  _pumpRetryTimer = 0

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
    const elapsed = Math.max(0, performance.now() - this._clockPerf)
    return clamp(this._clockMedia + (elapsed / 1000) * this.rate, 0, this._duration || Infinity)
  }

  _noAudioTime () {
    if (!this.playing || !(this.canAdvance?.() ?? true)) return this._anchorMedia
    return clamp(this._anchorMedia + ((performance.now() - this._anchorPerf) / 1000) * this.rate, 0, this._duration || Infinity)
  }

  _baseLatency () {
    return this._audioCtx?.baseLatency ?? 0
  }

  _effectiveVolume () {
    return this.muted ? 0 : clamp(this.volume, 0, 1)
  }

  // The buffer depth is measured in media frames. At a high rate the worklet
  // consumes them faster, so the depth must grow to keep the same play time.
  _updateWatermarks () {
    const scale = Math.max(this.rate, 0.5)
    this._highWaterFrames = AUDIO_BUFFER_SECONDS * scale * this.inputRate
    this._lowWaterFrames = AUDIO_LOW_WATER_SECONDS * scale * this.inputRate
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
    this._cancelPumpRetry()
    this._teardownAudio()
    this._track = track
    const sampleRate = track ? await track.getSampleRate() : 48000
    const channels = track ? await track.getNumberOfChannels() : 2
    this.inputRate = sampleRate
    this._updateWatermarks()

    const ctx = this._audioCtx = new AudioContext({ sampleRate })
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

    const active = data.active ?? false
    const ctx = this._audioCtx
    let mediaTime = (data.mediaTime ?? 0) - this._baseLatency()
    // Anchor to the worklet send time, not the message arrival time. A busy
    // main thread can delay a message, and arrival time would then move the
    // clock backwards.
    if (active && ctx && typeof data.contextTime === 'number') {
      mediaTime += Math.max(0, ctx.currentTime - data.contextTime) * this.rate
    }
    this._syncClock(mediaTime, active)

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

  // Snap the clock on a seek or a pause. During playback, hold the clock while
  // the worklet catches up instead of moving it backwards. A backward jump
  // makes the video wait for frames that it has already drawn.
  _syncClock (mediaTime: number, active: boolean) {
    const next = clamp(mediaTime, 0, this._duration || Infinity)
    if (!this.playing || !active || !this._clockActive) {
      this._setClock(next, active)
      return
    }

    const current = this.time
    if (next >= current) {
      this._setClock(next, active)
      return
    }

    const hold = Math.max(0, current - next) / this.rate
    this._clockMedia = current
    this._clockPerf = performance.now() + hold * 1000
    this._clockActive = active
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
        this._handlePumpError(error as Error, gen, streamId)
      } finally {
        if (this._iter === iterator) this._iter = undefined
      }
    }

    run()
  }

  // A rejected decode is usually caused by decoder churn after a seek. Retry
  // from the current time. If every retry fails, keep the video running on
  // the fallback clock and drop audio. Do not fail the engine.
  _handlePumpError (error: Error, gen: number, streamId: number) {
    if (gen !== this._gen || streamId !== this._streamId || this._destroyed) return

    const now = performance.now()
    if (now - this._lastPumpErrorAt > PUMP_RETRY_WINDOW_MS) this._pumpRetries = 0
    this._lastPumpErrorAt = now

    if (this._pumpRetries >= PUMP_RETRY_LIMIT) {
      const playhead = this.time
      console.error('Audio decode failed, continuing without audio.', error)
      this.exhausted = true
      this.drained = true
      this._anchorMedia = playhead
      this._anchorPerf = performance.now()
      this._workletNode?.port.postMessage({ type: 'pause' })
      this._wakeWaiters()
      return
    }

    const delay = PUMP_RETRY_DELAY_MS * 2 ** this._pumpRetries
    this._pumpRetries++
    console.warn('Audio decode failed, retrying from the current time.', error)
    this._wakeWaiters()

    this._cancelPumpRetry()
    this._pumpRetryTimer = setTimeout(() => {
      this._pumpRetryTimer = 0
      // A seek started after the failure. Its own pump replaces this retry.
      if (this._destroyed || this._streamId !== streamId) return
      this._retrySeek(this.time).catch(() => {})
    }, delay)
  }

  // The retry seek stops the worklet. Resume it, or the clock stays frozen
  // and the video pipeline stops with it. Wait for an active seek to present
  // its video frame before output starts.
  async _retrySeek (time: number) {
    const resumed = await this._seek(time)
    if (resumed && this.playing && (this.canResume?.() ?? true)) await this.resumeOutput()
  }

  _cancelPumpRetry () {
    if (!this._pumpRetryTimer) return
    clearTimeout(this._pumpRetryTimer)
    this._pumpRetryTimer = 0
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
    try {
      this._workletNode?.port.postMessage({ type: 'push', channelData, streamId }, channelData.map(data => data.buffer))
    } catch {
      // The worklet may be gone during teardown.
    }
  }

  // Resume the context under a user gesture without starting output. A seek
  // in flight starts output when the video frame is ready.
  async prime () {
    if (this._destroyed) return
    this.playing = true
    try {
      await this._audioCtx?.resume()
    } catch {}
  }

  async play () {
    await this.prime()
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
        this.bufferedFrames < this._lowWaterFrames && !this.drained &&
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
    this._pumpRetries = 0
    this._cancelPumpRetry()
    await this._seek(time)
  }

  async _seek (time: number) {
    if (this._destroyed) return false
    const seq = ++this._seekSeq
    this._streamId++
    this.drained = false
    this.exhausted = false
    this.mediaEnd = 0

    if (this.playing && this._workletNode) {
      this._workletNode.port.postMessage({ type: 'gain', value: 0 })
      await sleep(SEEK_FADE_MS)
      if (seq !== this._seekSeq || this._destroyed) return false
    }

    this._workletNode?.port.postMessage({ type: 'pause' })
    this._workletNode?.port.postMessage({ type: 'flush', anchorMedia: time, streamId: this._streamId, rate: this.rate })
    this.bufferedFrames = 0
    this._gen++
    this._wakeWaiters()
    this._closeIterator()
    this._setClock(time)

    this._startPump(time)
    return true
  }

  setRate (rate: number) {
    const next = clamp(rate, 0.1, 16)
    if (next === this.rate) return
    const now = this.time
    this.rate = next
    this._workletNode?.port.postMessage({ type: 'rate', rate: next })
    this._anchorMedia = now
    this._anchorPerf = performance.now()
    this._setClock(now, this._clockActive)
    this._updateWatermarks()
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
    this._cancelPumpRetry()
    this._pumpRetries = 0
    this._lastPumpErrorAt = 0
    this._wakeWaiters()
    this._closeIterator()
    this._teardownAudio()
    this._track = undefined
    this.playing = false
    this.drained = false
    this.exhausted = false
    this.bufferedFrames = 0
    this.mediaEnd = 0
    this._setClock(0)
  }

  destroy () {
    if (this._destroyed) return
    this._destroyed = true
    this.reset()
  }
}
