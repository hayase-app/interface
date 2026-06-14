/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * The WASM binary embedded in the generated .js file is derived from FFmpeg
 * (https://ffmpeg.org) and is licensed under the GNU Lesser General Public
 * License v2.1 or later. Source and build instructions:
 * https://github.com/ThaUnknown/mediabunny/tree/main/packages
 */

import {
  CustomAudioDecoder,
  type AudioCodec,
  AudioSample,
  type EncodedPacket,
  registerDecoder
} from 'mediabunny'

import { sendCommand, refWorker, unrefWorker } from './worker-client'

class CombinedDecoder extends CustomAudioDecoder {
  private ctx = 0

  static override supports (codec: AudioCodec, config: AudioDecoderConfig): boolean {
    if (codec === 'opus') {
      return config.numberOfChannels > 2
    }

    return codec === 'dts' ||
      codec === 'truehd' ||
      codec === 'ac3' ||
      codec === 'eac3' ||
      codec === 'vorbis'
  }

  async init () {
    await refWorker()

    const desc = this.config.description
    let extradata: ArrayBuffer | undefined
    if (desc) {
      const view = ArrayBuffer.isView(desc)
        ? new Uint8Array(desc.buffer, desc.byteOffset, desc.byteLength)
        : new Uint8Array(desc)
      extradata = view.buffer as ArrayBuffer
    }

    const result = await sendCommand({
      type: 'init-decoder',
      data: { codec: this.codec, extradata }
    }, extradata ? [extradata] : undefined)

    this.ctx = result.ctx
  }

  async decode (packet: EncodedPacket) {
    const encodedData = packet.data.slice().buffer
    const timestamp = Math.round(packet.timestamp * this.config.sampleRate)

    const result = await sendCommand({
      type: 'decode',
      data: { ctx: this.ctx, encodedData, timestamp }
    }, [encodedData])

    const sample = new AudioSample({
      data: result.pcmData,
      format: result.format,
      numberOfChannels: result.channels,
      sampleRate: result.sampleRate,
      timestamp: result.pts / result.sampleRate
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

export const registerCombinedDecoder = () => registerDecoder(CombinedDecoder)
