class AudioStreamProcessor extends AudioWorkletProcessor {
  _chunks: Array<{ channelData: Float32Array[], length: number }> = []
  _offset = 0
  _samplesConsumed = 0
  _reportInterval = Math.round(sampleRate * 0.1) // report every ~100ms
  constructor () {
    super()

    this.port.onmessage = ({ data }) => {
      if (data.type === 'push') {
        this._chunks.push({ channelData: data.channelData, length: data.channelData[0].length })
      } else if (data.type === 'flush') {
        this._chunks = []
        this._offset = 0
        this._samplesConsumed = 0
      }
    }
  }

  process (_inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array>): boolean {
    const out = outputs[0]!
    const blockSize = out[0]?.length ?? 128
    let written = 0

    while (written < blockSize && this._chunks.length > 0) {
      const chunk = this._chunks[0]!
      const available = chunk.length - this._offset
      const n = Math.min(available, blockSize - written)

      for (let c = 0; c < out.length; c++) {
        const src = chunk.channelData[c] ?? chunk.channelData[0]!
        out[c]!.set(src.subarray(this._offset, this._offset + n), written)
      }

      written += n
      this._offset += n

      if (this._offset >= chunk.length) {
        this._chunks.shift()
        this._offset = 0
      }
    }

    for (let c = 0; c < out.length; c++) out[c]!.fill(0, written)

    this._samplesConsumed += written

    if (this._samplesConsumed % this._reportInterval < blockSize) {
      this.port.postMessage({ type: 'progress', samplesConsumed: this._samplesConsumed })
    }

    return true
  }
}

registerProcessor('audio-stream-processor', AudioStreamProcessor)
