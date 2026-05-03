registerProcessor('audio-stream-processor', class AudioStreamProcessor extends AudioWorkletProcessor {
  _chunks: Array<{ channelData: Float32Array[], length: number }> = []
  _offset = 0
  _samplesConsumed = 0
  _reportInterval = Math.round(sampleRate * 0.1)
  _ratio = 1 // srcRate / ctxRate — 1 until we know better

  constructor () {
    super()
    this.port.onmessage = ({ data }) => {
      if (data.type === 'push') {
        // accept ratio alongside the first (or every) push — cheap to recompute
        if (data.srcRate && data.srcRate !== sampleRate) {
          this._ratio = data.srcRate / sampleRate
        }
        this._chunks.push({
          channelData: data.channelData,
          length: data.channelData[0].length
        })
      } else if (data.type === 'flush') {
        this._chunks = []
        this._offset = 0
        this._samplesConsumed = 0
      }
    }
  }

  process (_inputs: Float32Array[][], outputs: Float32Array[][], _parameters: Record<string, Float32Array>): boolean {
    try {
      const out = outputs[0]!
      const blockSize = out[0]?.length ?? 128
      let written = 0

      while (written < blockSize && this._chunks.length > 0) {
        const chunk = this._chunks[0]!

        while (written < blockSize) {
          const srcIdx = Math.floor(this._offset)

          // consumed this chunk
          if (srcIdx >= chunk.length - 1) {
            this._chunks.shift()
            this._offset = this._offset - srcIdx // carry over fractional remainder
            break
          }

          const t = this._offset - srcIdx // interpolation weight

          for (let c = 0; c < out.length; c++) {
            const src = chunk.channelData[c] ?? chunk.channelData[0]!
            out[c]![written] = src[srcIdx]! * (1 - t) + src[srcIdx + 1]! * t
          }

          written++
          this._offset += this._ratio
        }
      }

      for (let c = 0; c < out.length; c++) out[c]!.fill(0, written)

      this._samplesConsumed += written

      if (this._samplesConsumed % this._reportInterval < blockSize) {
        this.port.postMessage({ type: 'progress', samplesConsumed: this._samplesConsumed })
      }
    } catch {}

    return true
  }
})
