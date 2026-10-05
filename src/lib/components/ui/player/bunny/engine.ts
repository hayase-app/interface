// Media playback engine built on mediabunny and the WebCodecs API.
//
// The engine is the orchestrator. It owns the input, the track selection, the
// state machine and the public API. Audio decode and the clock live in
// AudioOutput. Video decode and presentation live in VideoPipeline. Seek and
// play/pause coordinate both through an epoch counter, so stale async work
// stops itself.

import {
  ALL_FORMATS,
  Input,
  UrlSource,
  VideoSampleSink,
  type InputAudioTrack,
  type InputVideoTrack
} from 'mediabunny'

import AudioOutput from './audioOutput'
import VideoPipeline from './videoPipeline'
import ScreenWakeLock from './wakeLock'

import type { EventDetail } from '$lib/modules/target'

import TypedEventTarget from '$lib/modules/target'
import { clamp } from '$lib/utils'

const READY_AHEAD_SECONDS = 0.25

export type PlayerState = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'seeking' | 'ended' | 'error'

export interface TrackInfo {
  id: string
  kind: 'audio' | 'video'
  label: string
  language: string
  selected: boolean
}

export interface EngineEventMap {
  loadedmetadata: CustomEvent<{ duration: number, videoWidth: number, videoHeight: number }>
  loadeddata: Event
  timeupdate: CustomEvent<{ time: number }>
  durationchange: CustomEvent<{ duration: number }>
  buffered: CustomEvent<{ start: number, end: number }>
  readystatechange: CustomEvent<{ readyState: number }>
  statechange: CustomEvent<{ state: PlayerState }>
  tracks: CustomEvent<{ audio: TrackInfo[], video: TrackInfo[] }>
  frame: CustomEvent<{ timestamp: number, clock: number }>
  stats: CustomEvent<{ bufferedFrames: number, underruns: number, active: boolean }>
  ended: Event
  error: CustomEvent<{ error: Error }>
}

export type EngineEventKey = keyof EngineEventMap
export type EngineEventDetail<K extends EngineEventKey> = EventDetail<EngineEventMap, K>

function trackLabel (track: InputAudioTrack | InputVideoTrack) {
  const name = track.name?.trim()
  if (name) return name
  const codec = track.codec?.toUpperCase() ?? track.type.toUpperCase()
  return `${codec} ${track.number}`
}

let codecsPromise: Promise<void> | undefined

function registerCodecs () {
  codecsPromise ??= import('./extra-codecs').then(({ registerCombinedDecoder }) => registerCombinedDecoder())
  return codecsPromise
}

export default class MediaEngine extends TypedEventTarget<EngineEventMap> {
  canvas
  duration = 0
  videoWidth = 0
  videoHeight = 0
  readyState = 0
  paused = true
  ended = false
  bufferedEnd = 0

  audio = new AudioOutput()
  video

  _state: PlayerState = 'idle'
  _epoch = 0
  _destroyed = false
  _preferredAudioLanguage = 'jpn'
  _wakeLock = new ScreenWakeLock()

  _input?: Input
  _videoTrack?: InputVideoTrack
  _audioTrack?: InputAudioTrack
  _videoTracks: InputVideoTrack[] = []
  _audioTracks: InputAudioTrack[] = []

  constructor (canvas: HTMLCanvasElement) {
    super()
    this.canvas = canvas
    this.video = new VideoPipeline(canvas, () => this.audio.time)
    this._bindPipelines()
  }

  get currentTime () {
    return this.audio.time
  }

  get playing () {
    return !this.paused && !this.ended && this._state !== 'idle' && this._state !== 'loading'
  }

  get playerState () {
    return this._state
  }

  _bindPipelines () {
    this.audio.addEventListener('progress', (event) => {
      const { bufferedFrames, underruns, active } = event.detail
      const end = Math.min(this.duration, this.audio.time + bufferedFrames / this.audio.inputRate)
      this.bufferedEnd = end
      this._emit('buffered', { start: 0, end })
      this._emit('stats', { bufferedFrames, underruns, active })
      this._updateReadyState()
    })
    this.audio.addEventListener('error', (event) => {
      this._emit('error', { error: event.detail.error })
    })
    this.video.addEventListener('tick', (event) => {
      this._emit('timeupdate', { time: event.detail.time })
      this._checkEnded(event.detail.time)
      this._updateReadyState()
    })
    this.video.addEventListener('frame', (event) => {
      this._emit('frame', event.detail)
      this._updateReadyState()
    })
    this.video.addEventListener('error', (event) => {
      this._fail(event.detail.error)
    })
  }

  get _trackList () {
    return [...this._videoTracks, ...this._audioTracks]
  }

  _setState (state: PlayerState) {
    if (this._state === state) return
    this._state = state
    this._emit('statechange', { state })
    this._updateReadyState()
  }

  _setReadyState (readyState: number) {
    if (this.readyState === readyState) return
    this.readyState = readyState
    this._emit('readystatechange', { readyState })
  }

  // Mirrors HTMLMediaElement.readyState from the buffer depth. 0 = no source,
  // 1 = no current frame, 2 = current data only (buffering), 3 = future data.
  _updateReadyState () {
    let next = 0
    if (this._videoTrack && this._state !== 'idle' && this._state !== 'loading') {
      if (!this.video.hasFrame) {
        next = 1
      } else if (this._audioTrack) {
        const ahead = this.audio.bufferedFrames / this.audio.inputRate
        next = ahead > READY_AHEAD_SECONDS ? 3 : 2
      } else {
        next = this.video.hasNextFrame ? 3 : this.video.drained ? 2 : 1
      }
    }
    this._setReadyState(next)
  }

  _fail (error: Error) {
    console.error('MediaEngine error:', error)
    this._setState('error')
    this._emit('error', { error })
  }

  _publishTracks () {
    const toInfo = <T extends InputAudioTrack | InputVideoTrack>(tracks: T[], kind: TrackInfo['kind'], selected?: T): TrackInfo[] =>
      tracks.map(track => ({
        id: track.id.toString(),
        kind,
        label: trackLabel(track),
        language: track.languageCode === 'und' ? '' : track.languageCode,
        selected: track === selected
      }))

    this._emit('tracks', {
      audio: toInfo(this._audioTracks, 'audio', this._audioTrack),
      video: toInfo(this._videoTracks, 'video', this._videoTrack)
    })
  }

  async load (src: string) {
    this._reset()
    this._setState('loading')
    this._setReadyState(0)

    await registerCodecs()
    if (this._destroyed) return

    const input = this._input = new Input({ source: new UrlSource(src), formats: ALL_FORMATS })
    const [videoTracks, audioTracks] = await Promise.all([input.getVideoTracks(), input.getAudioTracks()])
    if (this._destroyed) return

    if (!videoTracks.length) throw new Error('This file has no video track.')

    this._videoTracks = videoTracks
    this._audioTracks = audioTracks
    this._videoTrack = videoTracks[0]!
    if (!await this._videoTrack.canDecode()) throw new Error('This video track cannot be decoded in this environment.')
    this._audioTrack = await this._pickAudio()

    this.video.setSink(new VideoSampleSink(this._videoTrack))

    this.videoWidth = this._videoTrack.displayWidth
    this.videoHeight = this._videoTrack.displayHeight
    this.canvas.width = this.videoWidth
    this.canvas.height = this.videoHeight

    const metadataDuration = await input.getDurationFromMetadata(this._trackList, { skipLiveWait: true })
    const computed = metadataDuration ?? await input.computeDuration(this._trackList, { skipLiveWait: true })
    if (this._destroyed) return
    this.duration = computed ?? 0
    this.audio.setDuration(this.duration)
    this._emit('durationchange', { duration: this.duration })

    await this.audio.setup(this._audioTrack)
    if (this._destroyed) return

    this._publishTracks()
    await this.seekTo(0)
    if (this._destroyed) return

    this._setState('ready')
    this._emit('loadedmetadata', { duration: this.duration, videoWidth: this.videoWidth, videoHeight: this.videoHeight })
    this._emitSimple('loadeddata')
  }

  async _pickAudio () {
    if (!this._audioTracks.length) return
    const ordered = [
      ...this._audioTracks.filter(track => track.languageCode === this._preferredAudioLanguage),
      ...this._audioTracks.filter(track => track.languageCode === 'jpn' || track.languageCode === 'ja'),
      ...this._audioTracks
    ]
    for (const track of ordered) {
      try {
        if (await track.canDecode()) return track
      } catch {}
    }
    return this._audioTracks[0]
  }

  async play () {
    if (this._destroyed) return
    if (this._state === 'ended') {
      await this.seekTo(0)
      if (this._destroyed) return
    }

    this.paused = false
    this.ended = false

    // Put a frame on screen before the audio clock starts, so playback never
    // begins ahead of the decoder.
    if (!this.video.hasFrame) {
      await this.video.seek(this.currentTime)
      if (this._destroyed) return
    }

    this.video.start()
    this._setState('playing')
    await this.audio.play()
    if (this._destroyed) return
    this._wakeLock.request()
  }

  pause () {
    if (this._destroyed) return
    this.paused = true
    this.audio.pause()
    this.video.stop()
    this._wakeLock.release()
    this._setState('paused')
    this._emit('timeupdate', { time: this.audio.time })
  }

  async seekTo (time: number) {
    if (this._destroyed) return
    const epoch = ++this._epoch
    this.ended = false

    const target = clamp(time, 0, this.duration || time)

    await this.audio.seek(target)
    if (epoch !== this._epoch || this._destroyed) return

    this._emit('timeupdate', { time: target })
    this._emit('buffered', { start: 0, end: target })

    await this.video.seek(target)
    if (epoch !== this._epoch || this._destroyed) return

    this._updateReadyState()
    this._setState(this.paused ? 'paused' : 'playing')
    // Resume the clock only after the frame at the new position is presented.
    if (!this.paused) this.audio.resumeOutput()
  }

  _checkEnded (clock: number) {
    if (this.ended || this.duration <= 0) return
    // Both streams must be fully decoded. This detects the true end even when
    // the container metadata reports a longer duration than the content.
    if (!this.audio.drained || !this.video.drained || this.video.hasNextFrame) return

    const end = Math.max(this.audio.mediaEnd, this.video.mediaEnd, clock)
    if (clock < end - 0.15) return

    if (end < this.duration) {
      this.duration = end
      this.audio.setDuration(end)
      this._emit('durationchange', { duration: end })
    }

    this.ended = true
    this.paused = true
    this.audio.pause()
    this.video.stop()
    this._wakeLock.release()
    this._emit('timeupdate', { time: this.duration })
    this._setState('ended')
    this._emitSimple('ended')
  }

  async setAudioTrack (id: string) {
    const track = this._audioTracks.find(track => track.id.toString() === id)
    if (!track || track === this._audioTrack) return
    if (!await track.canDecode()) {
      this._emit('error', { error: new Error('This audio track cannot be decoded in this environment.') })
      return
    }

    this._audioTrack = track
    this.audio.setTrack(track)
    this._publishTracks()

    if (await this.audio.needsRebuild(track)) {
      await this.audio.rebuild(track)
      this.audio.setDuration(this.duration)
    }
    await this.seekTo(this.currentTime)
  }

  async setVideoTrack (id: string) {
    const track = this._videoTracks.find(track => track.id.toString() === id)
    if (!track || track === this._videoTrack) return
    if (!await track.canDecode()) {
      this._emit('error', { error: new Error('This video track cannot be decoded in this environment.') })
      return
    }

    this._videoTrack = track
    this.video.setSink(new VideoSampleSink(track))
    this.videoWidth = track.displayWidth
    this.videoHeight = track.displayHeight
    this.canvas.width = this.videoWidth
    this.canvas.height = this.videoHeight
    this._publishTracks()
    await this.seekTo(this.currentTime)
  }

  _clearSource () {
    this._input?.dispose()
    this._input = undefined
    this._videoTrack = undefined
    this._audioTrack = undefined
    this._videoTracks = []
    this._audioTracks = []
    this.duration = 0
    this.audio.setDuration(0)
    this._setReadyState(0)
    this.paused = true
    this.ended = false
    this.bufferedEnd = 0
  }

  _reset () {
    this.audio.reset()
    this.video.reset()
    this._clearSource()
  }

  destroy () {
    if (this._destroyed) return
    this._destroyed = true
    this._epoch++
    this._wakeLock.destroy()
    this.audio.destroy()
    this.video.destroy()
    this._clearSource()
  }
}
