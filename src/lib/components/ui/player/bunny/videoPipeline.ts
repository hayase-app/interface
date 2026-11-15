// Video decode and presentation.
//
// The pipeline reads frames from a VideoSampleSink and presents them against a
// clock supplied by the caller. Frames that are due are drawn to the canvas.
// Frames that are late are dropped. The iterator runs a few frames ahead, so a
// slow decode does not stall presentation. All decode work is guarded by a
// generation counter, so a stale iterator stops itself after a seek.

import { closeIterator } from './helpers'

import type { VideoSample, VideoSampleSink } from 'mediabunny'

import TypedEventTarget from '#lib/modules/target'

const VIDEO_TOLERANCE = 0.004
const VIDEO_DROP_SECONDS = 0.08
// On a slow device the iterator may never catch up, so every frame is late.
// After this many consecutive drops, present one anyway to keep the picture
// moving instead of freezing on the last frame.
const MAX_CONSECUTIVE_DROPS = 5
// Keep a small queue of decoded frames, so presentation can catch up after a
// late decode or a seek.
const PREFETCH_FRAMES = 6
// A decoder can reject a decode while it tears down after a seek. A new
// iterator usually succeeds, so retry before the error reaches the engine.
const DECODE_RETRY_LIMIT = 5
const DECODE_RETRY_DELAY_MS = 100
const DECODE_RETRY_WINDOW_MS = 5000

export interface VideoPipelineEventMap {
  tick: CustomEvent<{ time: number }>
  frame: CustomEvent<{ timestamp: number, clock: number }>
  error: CustomEvent<{ error: Error }>
}

export default class VideoPipeline extends TypedEventTarget<VideoPipelineEventMap> {
  canvas: HTMLCanvasElement
  drained = false
  mediaEnd = 0
  presentedFrames = 0

  _destroyed = false
  _context?: CanvasRenderingContext2D
  _getClock: () => number
  _sink?: VideoSampleSink
  _iter?: AsyncIterator<VideoSample>
  _frames: VideoSample[] = []
  hasFrame = false
  _fetchGen = -1
  _gen = 0
  _playing = false
  _rafId = 0
  _dropsSincePresent = 0
  _retries = 0
  _lastErrorAt = 0
  _retryTimer = 0

  _frameCallbacks = new Map<number, VideoFrameRequestCallback>()
  _frameHandle = 0

  _frameMeta: VideoFrameCallbackMetadata = {
    mediaTime: 0,
    presentedFrames: 0,
    processingDuration: 0,
    expectedDisplayTime: 0,
    presentationTime: 0,
    width: 0,
    height: 0
  }

  constructor (canvas: HTMLCanvasElement, getClock: () => number) {
    super()
    this.canvas = canvas
    this._context = canvas.getContext('2d', { alpha: false, desynchronized: true }) ?? undefined
    this._getClock = getClock
  }

  get hasNextFrame () {
    return this._frames.length > 0
  }

  setSink (sink?: VideoSampleSink) {
    this._sink = sink
  }

  async seek (time: number) {
    this._retries = 0
    this._cancelRetry()
    await this._seek(time)
  }

  async _seek (time: number) {
    const gen = ++this._gen
    this._closeFrames()
    try {
      await closeIterator(this._iter)
    } catch {}
    this._iter = undefined
    this.drained = false
    this.mediaEnd = 0
    this._dropsSincePresent = 0
    this.hasFrame = false

    if (!this._sink) {
      this.drained = true
      return
    }

    const iterator = this._sink.samples(time)
    this._iter = iterator
    let first: IteratorResult<VideoSample>
    try {
      first = await iterator.next()
    } catch (error) {
      // A disposed input rejects a decode that is still pending. Stay quiet
      // when this seek is already stale, otherwise recover the pipeline.
      if (gen === this._gen && !this._destroyed) this._handleDecodeError(error as Error, gen)
      return
    }
    if (gen !== this._gen || this._destroyed) {
      if (!first.done) first.value.close()
      return
    }
    if (first.done) {
      this.drained = true
      return
    }
    this._note(first.value)
    this._present(first.value, time)
    this._ensureFrames(gen)
  }

  _note (sample: VideoSample) {
    const end = sample.timestamp + sample.duration
    if (Number.isFinite(end)) this.mediaEnd = Math.max(this.mediaEnd, end)
  }

  async _ensureFrames (gen: number) {
    if (this._fetchGen === gen) return
    const iterator = this._iter
    if (!iterator || this.drained || this._frames.length >= PREFETCH_FRAMES) return

    this._fetchGen = gen
    try {
      while (
        gen === this._gen && !this._destroyed &&
        this._frames.length < PREFETCH_FRAMES
      ) {
        const result = await iterator.next()
        if (gen !== this._gen || this._destroyed) {
          if (!result.done) result.value.close()
          return
        }
        if (result.done) {
          this.drained = true
          return
        }
        this._note(result.value)
        this._frames.push(result.value)
      }
    } catch (error) {
      if (gen === this._gen) this._handleDecodeError(error as Error, gen)
    } finally {
      if (this._fetchGen === gen) this._fetchGen = -1
    }
  }

  // A rejected decode is usually a teaser of too many decoder instances while
  // a previous iterator tears down. Abandon the iterator and try again from
  // the current clock. Only a run of failures reaches the engine.
  _handleDecodeError (error: Error, gen: number) {
    if (gen !== this._gen || this._destroyed) return

    const now = performance.now()
    if (now - this._lastErrorAt > DECODE_RETRY_WINDOW_MS) this._retries = 0
    this._lastErrorAt = now

    if (this._retries >= DECODE_RETRY_LIMIT) {
      this._emit('error', { error })
      return
    }

    const delay = DECODE_RETRY_DELAY_MS * 2 ** this._retries
    this._retries++
    console.warn('Video decode failed, retrying from the current time.', error)

    // Invalidate the broken iterator before the retry starts.
    this._gen++
    const retryGen = this._gen
    this.drained = false
    this._closeFrames()
    const iterator = this._iter
    this._iter = undefined
    closeIterator(iterator)

    this._cancelRetry()
    this._retryTimer = window.setTimeout(() => {
      this._retryTimer = 0
      if (this._destroyed || retryGen !== this._gen) return
      this._seek(this._getClock()).catch(() => {})
    }, delay)
  }

  _cancelRetry () {
    if (!this._retryTimer) return
    clearTimeout(this._retryTimer)
    this._retryTimer = 0
  }

  _closeFrames () {
    for (const frame of this._frames) frame.close()
    this._frames = []
  }

  _present (frame: VideoSample, clock: number) {
    const timestamp = frame.timestamp
    if (this._context) {
      frame.draw(this._context, 0, 0, this.canvas.width, this.canvas.height)
    }
    frame.close()
    this.hasFrame = true
    this.presentedFrames++

    const now = performance.now()
    this._frameMeta.mediaTime = timestamp
    this._frameMeta.presentedFrames = this.presentedFrames
    this._frameMeta.expectedDisplayTime = now
    this._frameMeta.presentationTime = now
    this._frameMeta.width = this.canvas.width
    this._frameMeta.height = this.canvas.height

    if (this._frameCallbacks.size) {
      for (const callback of this._frameCallbacks.values()) callback(now, this._frameMeta)
      this._frameCallbacks.clear()
    }

    this._emit('frame', { timestamp, clock })
  }

  start () {
    this._playing = true
    if (this._rafId || this._destroyed) return
    const tick = () => {
      if (this._destroyed) return
      this._rafId = requestAnimationFrame(tick)
      this._renderTick()
    }
    this._rafId = requestAnimationFrame(tick)
  }

  stop () {
    this._playing = false
    if (!this._rafId) return
    cancelAnimationFrame(this._rafId)
    this._rafId = 0
  }

  _renderTick () {
    if (!this._playing) return
    const clock = this._getClock()

    while (this._frames.length && this._frames[0]!.timestamp <= clock + VIDEO_TOLERANCE) {
      const frame = this._frames.shift()!
      const late = frame.timestamp < clock - VIDEO_DROP_SECONDS
      if (late && this._iter && this._dropsSincePresent < MAX_CONSECUTIVE_DROPS) {
        this._dropsSincePresent++
        frame.close()
      } else {
        this._dropsSincePresent = 0
        this._present(frame, clock)
      }
    }
    this._ensureFrames(this._gen)

    this._emit('tick', { time: clock })
  }

  requestVideoFrameCallback (callback: VideoFrameRequestCallback) {
    const handle = ++this._frameHandle
    this._frameCallbacks.set(handle, callback)
    return handle
  }

  cancelVideoFrameCallback (handle: number) {
    this._frameCallbacks.delete(handle)
  }

  getVideoPlaybackQuality () {
    return {
      creationTime: performance.now(),
      totalVideoFrames: this.presentedFrames,
      droppedVideoFrames: 0,
      corruptedVideoFrames: 0
    }
  }

  reset () {
    this._gen++
    this.stop()
    this._cancelRetry()
    this._fetchGen = -1
    this._retries = 0
    this._lastErrorAt = 0
    this._closeFrames()
    if (this._iter) {
      const iterator = this._iter
      this._iter = undefined
      closeIterator(iterator)
    }
    this._sink = undefined
    this.drained = false
    this.mediaEnd = 0
    this.hasFrame = false
    this.presentedFrames = 0
    this._dropsSincePresent = 0
  }

  destroy () {
    if (this._destroyed) return
    this._destroyed = true
    this.reset()
  }
}
