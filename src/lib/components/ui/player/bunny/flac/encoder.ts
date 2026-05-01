/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {
  CustomAudioEncoder,
  type AudioCodec,
  type AudioSample,
  EncodedPacket,
  registerEncoder
} from 'mediabunny'

import { sendCommand, refWorker, unrefWorker } from './worker-client'

import type { PacketInfo } from './shared'

const FLAC_SAMPLE_RATES = [
  8000, 16000, 22050, 24000, 32000, 44100, 48000, 88200, 96000, 176400, 192000
]

class FlacEncoder extends CustomAudioEncoder {
  private ctx: number | null = null
  private chunkMetadata: EncodedAudioChunkMetadata = {}
  private description: Uint8Array | null = null
  private nextTimestampInSamples: number | null = null

  static override supports (codec: AudioCodec, config: AudioEncoderConfig): boolean {
    return codec === 'flac' &&
      config.numberOfChannels >= 1 &&
      config.numberOfChannels <= 8 &&
      FLAC_SAMPLE_RATES.includes(config.sampleRate)
  }

  async init () {
    await refWorker()
  }

  private resetInternalState () {
    this.nextTimestampInSamples = null

    this.chunkMetadata = {
      decoderConfig: {
        codec: 'flac',
        numberOfChannels: this.config.numberOfChannels,
        sampleRate: this.config.sampleRate,
        description: this.description!
      }
    }
  }

  async encode (audioSample: AudioSample) {
    if (this.ctx === null) {
      // This is the first sample, let's do some init

      let bitsPerSample: 16 | 24
      switch (audioSample.format) {
        case 'u8':
        case 'u8-planar':
        case 's16':
        case 's16-planar':
          bitsPerSample = 16
          break
        case 's32':
        case 's32-planar':
        case 'f32':
        case 'f32-planar':
          bitsPerSample = 24
          break
        default:
          assertNever(audioSample.format)
          assert(false)
      }

      const result = await sendCommand({
        type: 'init',
        data: {
          numberOfChannels: this.config.numberOfChannels,
          sampleRate: this.config.sampleRate,
          bitsPerSample
        }
      })

      this.ctx = result.ctx
      this.description = new Uint8Array(result.header)
      this.resetInternalState()
    }

    this.nextTimestampInSamples ??= Math.round(audioSample.timestamp * this.config.sampleRate)

    const totalBytes = audioSample.allocationSize({ format: 's32', planeIndex: 0 })
    const audioData = new ArrayBuffer(totalBytes)
    audioSample.copyTo(audioData, { format: 's32', planeIndex: 0 })

    const result = await sendCommand({
      type: 'encode',
      data: {
        ctx: this.ctx,
        audioData,
        numSamples: audioSample.numberOfFrames
      }
    }, [audioData])

    this.emitPackets(result.packets)
  }

  async flush () {
    if (this.ctx === null) {
      return
    }

    const result = await sendCommand({ type: 'flush', data: { ctx: this.ctx } })
    this.emitPackets(result.packets)

    this.resetInternalState()
  }

  async close () {
    await unrefWorker()
  }

  private emitPackets (packets: PacketInfo[]) {
    assert(this.nextTimestampInSamples !== null)

    for (const p of packets) {
      const data = new Uint8Array(p.encodedData)

      const packet = new EncodedPacket(
        data,
        'key',
        this.nextTimestampInSamples / this.config.sampleRate,
        p.samples / this.config.sampleRate
      )
      this.nextTimestampInSamples += p.samples

      this.onPacket(
        packet,
        this.chunkMetadata
      )

      this.chunkMetadata = {}
    }
  }
}

/**
 * Registers the FLAC encoder, which Mediabunny will then use automatically when applicable. Make sure to call this
 * function before starting any encoding task. The FLAC encoder will automatically determine the output bit depth
 * (16 or 24) based on the sample format of incoming `AudioSample` instances.
 *
 * Preferably, wrap the call in a condition to avoid overriding any native FLAC encoder:
 *
 * ```ts
 * import { canEncodeAudio } from 'mediabunny';
 * import { registerFlacEncoder } from '@mediabunny/flac-encoder';
 *
 * if (!(await canEncodeAudio('flac'))) {
 *     registerFlacEncoder();
 * }
 * ```
 *
 * @group \@mediabunny/flac-encoder
 * @public
 */
export const registerFlacEncoder = () => {
  registerEncoder(FlacEncoder)
}

function assert (x: unknown): asserts x {
  if (!x) {
    throw new Error('Assertion failed.')
  }
}

export const assertNever = (x: never) => {
  // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
  throw new Error(`Unexpected value: ${x}`)
}
