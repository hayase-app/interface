// Video decode and presentation.
//
// The pipeline reads frames from a VideoSampleSink and presents them against a
// clock supplied by the caller. Frames that are due are drawn to the canvas.
// Frames that are late are dropped. All decode work is guarded by a generation
// counter, so a stale iterator stops itself after a seek.

import { closeIterator } from './helpers'

import type { VideoSample, VideoSampleSink } from 'mediabunny'

import TypedEventTarget from '$lib/modules/target'

const VIDEO_TOLERANCE = 0.004
const VIDEO_DROP_SECONDS = 0.08
// On a slow device the iterator may never catch up, so every frame is late.
// After this many consecutive drops, present one anyway to keep the picture
// moving instead of freezing on the last frame.
const MAX_CONSECUTIVE_DROPS = 5

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
  _nextFrame?: VideoSample
  hasFrame = false
  _fetching = false
  _gen = 0
  _playing = false
  _rafId = 0
  _dropsSincePresent = 0

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
    return !!this._nextFrame
  }

  setSink (sink?: VideoSampleSink) {
    this._sink = sink
  }

  async seek (time: number) {
    const gen = ++this._gen
    this._fetching = false
    if (this._nextFrame) {
      this._nextFrame.close()
      this._nextFrame = undefined
    }
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
    const first = await iterator.next()
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
    this._ensureFrame(gen)
  }

  _note (sample: VideoSample) {
    const end = sample.timestamp + sample.duration
    if (Number.isFinite(end)) this.mediaEnd = Math.max(this.mediaEnd, end)
  }

  async _ensureFrame (gen: number) {
    if (this._fetching || !this._iter) return
    this._fetching = true
    const iterator = this._iter

    try {
      const result = await iterator.next()
      if (gen !== this._gen || this._destroyed) {
        if (!result.done) result.value.close()
        return
      }
      if (result.done) {
        this.drained = true
        this._nextFrame = undefined
        return
      }
      this._note(result.value)
      this._nextFrame = result.value
    } catch (error) {
      if (gen === this._gen) this._emit('error', { error: error as Error })
    } finally {
      this._fetching = false
    }
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

    if (!this._nextFrame) {
      this._ensureFrame(this._gen)
    } else {
      while (this._nextFrame && this._nextFrame.timestamp <= clock + VIDEO_TOLERANCE) {
        const frame = this._nextFrame
        this._nextFrame = undefined
        const late = frame.timestamp < clock - VIDEO_DROP_SECONDS
        if (late && this._iter && this._dropsSincePresent < MAX_CONSECUTIVE_DROPS) {
          this._dropsSincePresent++
          frame.close()
        } else {
          this._dropsSincePresent = 0
          this._present(frame, clock)
        }
        this._ensureFrame(this._gen)
        if (!this._nextFrame) break
      }
    }

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
    this._fetching = false
    if (this._nextFrame) {
      this._nextFrame.close()
      this._nextFrame = undefined
    }
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
