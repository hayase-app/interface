// AudioWorklet that plays decoded PCM with a click-free gain envelope.
//
// The main thread pushes contiguous PCM chunks. The worklet is the master
// clock: it reports the media time of the samples it has emitted.
//
// Rate 1 uses a direct copy. Other rates use WSOLA time-stretching adapted
// from Vanilagy's gist:
// https://gist.github.com/Vanilagy/05f7901f4c4398356657e3a86c7aee05

const FRAME_SIZE = 1024
const HOP = FRAME_SIZE / 2
const TOLERANCE = 512
const RAMP_SECONDS = 0.008
const REPORT_EVERY = 2
const COMPACT_AT = 8192

interface Chunk {
  data: Float32Array[]
  length: number
}

interface IncomingMessage {
  type: string
  streamId?: number
  anchorMedia?: number
  rate?: number
  value?: number
  channelData?: Float32Array[]
}

class PcmScheduler extends AudioWorkletProcessor {
  _chunks: Chunk[] = []
  _baseFrame = 0
  _received = 0

  _readAbs = 0
  _ana = 0
  _emitted = 0
  _anchorMedia = 0
  _inputRate = sampleRate
  _step = 1
  _mode: 'direct' | 'wsola' = 'direct'

  _shouldPlay = false
  _gain = 0
  _target = 0
  _ramp = 1 / Math.max(1, RAMP_SECONDS * sampleRate)

  _ola: Float32Array[] = []
  _olaLen = 0
  _olaRead = 0
  _window = new Float32Array(FRAME_SIZE)

  _reportCounter = 0
  _underruns = 0
  _streamId = 0

  constructor () {
    super()

    for (let i = 0; i < FRAME_SIZE; i++) {
      this._window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / FRAME_SIZE)
    }

    this.port.onmessage = ({ data }: MessageEvent<IncomingMessage>) => this._onMessage(data)
  }

  _onMessage (data: IncomingMessage) {
    switch (data.type) {
      case 'push':
        if (data.streamId !== this._streamId || !data.channelData) return
        this._push(data.channelData)
        break
      case 'flush':
        this._flush(data.anchorMedia ?? 0, data.streamId ?? 0, data.rate)
        break
      case 'play':
        this._shouldPlay = true
        this._target = 1
        break
      case 'pause':
        this._shouldPlay = false
        this._target = 0
        break
      case 'gain':
        this._target = data.value ?? 0
        break
      case 'rate':
        this._setRate(data.rate ?? 1)
        break
    }
  }

  _push (channelData: Float32Array[]) {
    const first = channelData[0]
    if (!first?.length) return
    this._chunks.push({ data: channelData, length: first.length })
    this._received += first.length
  }

  _flush (anchorMedia: number, streamId: number, rate?: number) {
    this._chunks = []
    this._baseFrame = 0
    this._received = 0
    this._readAbs = 0
    this._ana = 0
    this._emitted = 0
    this._anchorMedia = anchorMedia
    this._ola = []
    this._olaLen = 0
    this._olaRead = 0
    this._streamId = streamId
    this._gain = 0
    this._target = this._shouldPlay ? 1 : 0
    this._underruns = 0
    if (typeof rate === 'number') this._setMode(rate)
  }

  _setMode (rate: number) {
    const next = Math.max(0.01, rate)
    if (next === this._step) return
    this._anchorMedia = this._currentMedia()
    this._emitted = 0
    if (this._mode === 'direct' && next !== 1) this._ana = this._readAbs
    if (this._mode === 'wsola' && next === 1) this._readAbs = this._ana
    this._step = next
    this._mode = next === 1 ? 'direct' : 'wsola'
  }

  _setRate (rate: number) {
    this._setMode(rate)
  }

  _currentMedia () {
    return this._anchorMedia + (this._emitted * this._step) / this._inputRate
  }

  _channel (chunk: Chunk, c: number) {
    return chunk.data[c] ?? chunk.data[0]!
  }

  _readRange (start: number, count: number, channels: number) {
    const result: Float32Array[] = []
    for (let c = 0; c < channels; c++) result.push(new Float32Array(count))

    let local = start - this._baseFrame
    let written = 0
    if (local < 0) {
      written = -local
      local = 0
    }

    let ci = 0
    while (ci < this._chunks.length && local >= this._chunks[ci]!.length) {
      local -= this._chunks[ci]!.length
      ci++
    }
    if (written >= count) return result
    if (ci >= this._chunks.length) return

    let pos = local
    while (written < count && ci < this._chunks.length) {
      const chunk = this._chunks[ci]!
      const take = Math.min(chunk.length - pos, count - written)
      for (let c = 0; c < channels; c++) {
        result[c]!.set(this._channel(chunk, c).subarray(pos, pos + take), written)
      }
      written += take
      pos += take
      if (pos >= chunk.length) {
        pos = 0
        ci++
      }
    }

    if (written < count) return
    return result
  }

  _ensureOla (length: number, channels: number) {
    if (!this._ola.length) {
      this._ola = []
      for (let c = 0; c < channels; c++) this._ola.push(new Float32Array(0))
    }
    for (let c = 0; c < channels; c++) {
      const current = this._ola[c]!
      if (current.length >= length) continue
      const grown = new Float32Array(Math.max(length, current.length * 2 + HOP))
      grown.set(current)
      this._ola[c] = grown
    }
  }

  _synthesize (channels: number) {
    const searchLength = FRAME_SIZE + 2 * TOLERANCE
    const searchStart = this._ana - TOLERANCE
    if (this._received < this._ana + TOLERANCE + FRAME_SIZE) return false

    const search = this._readRange(searchStart, searchLength, channels)
    if (!search) return false

    const frameStart = Math.max(0, this._olaLen - HOP)
    const overlap = this._olaLen >= HOP ? HOP : 0
    const centerInBuf = TOLERANCE
    let bestK = 0

    if (overlap > 0) {
      let normOld = 0
      for (let c = 0; c < channels; c++) {
        const old = this._ola[c]!
        for (let j = 0; j < overlap; j++) {
          const v = old[frameStart + j]!
          normOld += v * v
        }
      }
      const sqrtNormOld = Math.sqrt(normOld)

      const minK = Math.max(-TOLERANCE, -centerInBuf)
      const maxK = Math.min(TOLERANCE, searchLength - centerInBuf - FRAME_SIZE)

      let bestCorr = -Infinity
      let prevCorr = -Infinity
      const minStep = 1
      const maxStep = 16

      for (let k = minK; k <= maxK;) {
        let dot = 0
        let normNew = 0
        for (let c = 0; c < channels; c++) {
          const old = this._ola[c]!
          const candidate = search[c]!
          for (let j = 0; j < overlap; j++) {
            const ov = old[frameStart + j]!
            const nv = candidate[centerInBuf + k + j]!
            dot += ov * nv
            normNew += nv * nv
          }
        }
        const corr = dot / (sqrtNormOld * Math.sqrt(normNew) || 1e-10)
        if (corr > bestCorr) {
          bestCorr = corr
          bestK = k
        }
        const gradient = prevCorr !== -Infinity ? Math.abs(corr - prevCorr) : 0
        prevCorr = corr
        const stepSize = Math.max(minStep, Math.min(maxStep, Math.floor(maxStep * Math.exp(-gradient * 3))))
        k += stepSize
      }

      const fineRange = 8
      for (let k = bestK - fineRange; k <= bestK + fineRange; k++) {
        if (k < minK || k > maxK) continue
        let dot = 0
        let normNew = 0
        for (let c = 0; c < channels; c++) {
          const old = this._ola[c]!
          const candidate = search[c]!
          for (let j = 0; j < overlap; j++) {
            const ov = old[frameStart + j]!
            const nv = candidate[centerInBuf + k + j]!
            dot += ov * nv
            normNew += nv * nv
          }
        }
        const corr = dot / (sqrtNormOld * Math.sqrt(normNew) || 1e-10)
        if (corr > bestCorr) {
          bestCorr = corr
          bestK = k
        }
      }
    }

    const frameOffset = centerInBuf + bestK
    const targetLength = frameStart + FRAME_SIZE
    this._ensureOla(targetLength, channels)

    for (let c = 0; c < channels; c++) {
      const dst = this._ola[c]!
      const src = search[c]!
      const window = this._window
      for (let j = 0; j < FRAME_SIZE; j++) {
        dst[frameStart + j] = dst[frameStart + j]! + src[frameOffset + j]! * window[j]!
      }
    }

    this._olaLen = targetLength
    this._ana += HOP * this._step
    this._trim()
    return true
  }

  _trim () {
    const keepFrom = this._ana - TOLERANCE
    while (this._chunks.length && this._baseFrame + this._chunks[0]!.length <= keepFrom) {
      this._baseFrame += this._chunks[0]!.length
      this._chunks.shift()
    }
  }

  _compactOla () {
    if (this._olaRead < COMPACT_AT) return
    const keep = this._olaLen - this._olaRead
    for (let c = 0; c < this._ola.length; c++) {
      const channel = this._ola[c]!
      channel.copyWithin(0, this._olaRead, this._olaLen)
      channel.fill(0, keep, this._olaLen)
    }
    this._olaLen = keep
    this._olaRead = 0
  }

  _fillDirect (out: Float32Array[], blockSize: number) {
    const channels = out.length
    let produced = 0

    while (produced < blockSize && this._chunks.length) {
      const local = this._readAbs - this._baseFrame
      let skip = local
      let ci = 0
      while (ci < this._chunks.length && skip >= this._chunks[ci]!.length) {
        skip -= this._chunks[ci]!.length
        ci++
      }
      if (ci >= this._chunks.length) break

      const chunk = this._chunks[ci]!
      const take = Math.min(chunk.length - skip, blockSize - produced)
      for (let c = 0; c < channels; c++) {
        out[c]!.set(this._channel(chunk, c).subarray(skip, skip + take), produced)
      }

      produced += take
      this._readAbs += take
      if (skip + take >= chunk.length) {
        this._baseFrame += chunk.length
        this._chunks.shift()
      }
    }

    for (let c = 0; c < channels; c++) out[c]!.fill(0, produced)
    return produced
  }

  _fillWsola (out: Float32Array[], blockSize: number) {
    const channels = out.length

    // Only the region before the next frame start is fully overlap-added. Keep
    // one synthesis hop of latency, so a new frame never starts behind the read
    // cursor. Otherwise the overlap-add is incomplete and the output modulates.
    while (this._olaLen - HOP - this._olaRead < blockSize) {
      if (!this._synthesize(channels)) break
    }

    const available = Math.max(0, this._olaLen - HOP - this._olaRead)
    const take = Math.min(available, blockSize)
    for (let c = 0; c < channels; c++) {
      const src = this._ola[c] ?? this._ola[0]
      if (src && take > 0) out[c]!.set(src.subarray(this._olaRead, this._olaRead + take), 0)
      out[c]!.fill(0, take)
    }

    this._olaRead += take
    this._compactOla()
    return take
  }

  _report () {
    if (++this._reportCounter < REPORT_EVERY) return
    this._reportCounter = 0
    const cursor = this._mode === 'direct' ? this._readAbs : this._ana
    this.port.postMessage({
      type: 'progress',
      mediaTime: this._currentMedia(),
      bufferedFrames: Math.max(0, this._received - cursor),
      active: this._shouldPlay || this._gain > 1e-4,
      underruns: this._underruns
    })
  }

  process (_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0]
    if (!out?.length || !out[0]) return true

    const blockSize = out[0].length
    const active = this._shouldPlay || this._gain > 1e-4
    let produced = 0

    if (active) {
      produced = this._mode === 'direct' ? this._fillDirect(out, blockSize) : this._fillWsola(out, blockSize)
    } else {
      for (let c = 0; c < out.length; c++) out[c]!.fill(0)
    }

    let gain = this._gain
    const target = this._target
    const ramp = this._ramp
    for (let i = 0; i < blockSize; i++) {
      if (gain < target) gain = Math.min(target, gain + ramp)
      else if (gain > target) gain = Math.max(target, gain - ramp)
      for (let c = 0; c < out.length; c++) out[c]![i] = out[c]![i]! * gain
    }
    this._gain = gain

    if (active) {
      this._emitted += produced
      if (produced < blockSize) this._underruns++
    }

    this._report()
    return true
  }
}

registerProcessor('pcm-scheduler', PcmScheduler)
