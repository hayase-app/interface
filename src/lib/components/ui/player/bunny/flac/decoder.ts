/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  CustomAudioDecoder,
  type AudioCodec,
  AudioSample,
  type EncodedPacket,
  registerDecoder
} from 'mediabunny'

import { sendCommand, refWorker, unrefWorker } from './worker-client'

class FlacDecoder extends CustomAudioDecoder {
  private ctx = 0
  private description: Uint8Array | null = null
  private headerProcessed = false

  static override supports (codec: AudioCodec): boolean {
    return codec === 'flac'
  }

  async init () {
    await refWorker()

    const result = await sendCommand({
      type: 'init-decoder',
      data: {}
    })
    this.ctx = result.ctx

    const description = this.config.description as ArrayBuffer | Uint8Array | undefined
    if (description) {
      if (description instanceof ArrayBuffer) {
        this.description = new Uint8Array(description)
      } else {
        this.description = new Uint8Array(
          description.buffer,
          description.byteOffset,
          description.byteLength
        )
      }
    }
  }

  async decode (packet: EncodedPacket) {
    const encodedData = packet.data.slice().buffer

    // If we have a description (FLAC header), we need to prepend it to the first frame
    let dataToSend = encodedData
    if (!this.headerProcessed && this.description) {
      // Create a new buffer with description + frame
      const combined = new Uint8Array(this.description.length + encodedData.byteLength)
      combined.set(this.description, 0)
      combined.set(new Uint8Array(encodedData), this.description.length)
      dataToSend = combined.buffer
      this.headerProcessed = true
    }

    const result = await sendCommand({
      type: 'decode',
      data: { ctx: this.ctx, encodedData: dataToSend }
    }, [dataToSend])

    // Map bits per sample to audio sample format
    let format: AudioSampleFormat
    if (result.bitsPerSample === 16) {
      format = 's16'
    } else if (result.bitsPerSample === 24) {
      format = 's32'
    } else {
      throw new Error(`Unsupported bits per sample: ${result.bitsPerSample}`)
    }

    const timestampSamples = Math.round(packet.timestamp * result.sampleRate)
    const sample = new AudioSample({
      data: result.pcmData,
      format,
      numberOfChannels: result.channels,
      sampleRate: result.sampleRate,
      timestamp: timestampSamples / result.sampleRate
    })
    this.onSample(sample)
  }

  async flush () {
    await sendCommand({ type: 'flush-decoder', data: { ctx: this.ctx } })
  }

  async close () {
    sendCommand({ type: 'close-decoder', data: { ctx: this.ctx } })
    await unrefWorker()
  }
}

/**
 * Registers the FLAC decoder, which Mediabunny will then use automatically when applicable. Make sure to call
 * this function before starting any decoding task.
 *
 * Preferably, wrap the call in a condition to avoid overriding any native FLAC decoder:
 *
 * ```ts
 * import { canDecodeAudio } from 'mediabunny';
 * import { registerFlacDecoder } from '@mediabunny/flac-encoder';
 *
 * if (!(await canDecodeAudio('flac'))) {
 *     registerFlacDecoder();
 * }
 * ```
 *
 * @group \@mediabunny/flac-encoder
 * @public
 */
export const registerFlacDecoder = () => {
  registerDecoder(FlacDecoder)
}
