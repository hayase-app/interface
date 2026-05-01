/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import createModule from './flac.js'

import type { PacketInfo, WorkerCommand, WorkerResponse, WorkerResponseData } from './shared'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExtendedEmscriptenModule = any

let module: ExtendedEmscriptenModule
let modulePromise: Promise<ExtendedEmscriptenModule> | null = null

// Encoder functions
let initEncoderFn: (channels: number, sampleRate: number, bitsPerSample: number) => number
let getEncodeInputPtr: (ctx: number, size: number) => number
let sendSamplesFn: (ctx: number, numSamples: number) => number
let getOutputData: (ctx: number) => number
let getFrameCount: (ctx: number) => number
let getFrameSize: (ctx: number, index: number) => number
let getFrameSamples: (ctx: number, index: number) => number
let getHeaderData: (ctx: number) => number
let getHeaderSize: (ctx: number) => number
let finishEncoderFn: (ctx: number) => number

// Decoder functions
let initDecoderFn: () => number
let configureDecodePacketFn: (ctx: number, size: number) => number
let decodePacketFn: (ctx: number, size: number) => number
let getPcmDataFn: (ctx: number) => number
let getPcmSizeFn: (ctx: number) => number
let getDecodedChannelsFn: (ctx: number) => number
let getDecodedSampleRateFn: (ctx: number) => number
let getDecodedBitsPerSampleFn: (ctx: number) => number
// sampleCount no longer needed from the bridge
let getDecodeErrorFn: (ctx: number) => number
let flushDecoderFn: (ctx: number) => void
let closeDecoderFn: (ctx: number) => void

const ensureModule = async () => {
  if (!module) {
    if (modulePromise) {
      return await modulePromise
    }

    modulePromise = createModule() as Promise<ExtendedEmscriptenModule>
    module = await modulePromise
    modulePromise = null

    // Encoder functions
    initEncoderFn = module.cwrap('init_encoder', 'number', ['number', 'number', 'number'])
    getEncodeInputPtr = module.cwrap('get_encode_input_ptr', 'number', ['number', 'number'])
    sendSamplesFn = module.cwrap('send_samples', 'number', ['number', 'number'])
    getOutputData = module.cwrap('get_output_data', 'number', ['number'])
    getFrameCount = module.cwrap('get_frame_count', 'number', ['number'])
    getFrameSize = module.cwrap('get_frame_size', 'number', ['number', 'number'])
    getFrameSamples = module.cwrap('get_frame_samples', 'number', ['number', 'number'])
    getHeaderData = module.cwrap('get_header_data', 'number', ['number'])
    getHeaderSize = module.cwrap('get_header_size', 'number', ['number'])
    finishEncoderFn = module.cwrap('finish_encoder', 'number', ['number'])

    // Decoder functions
    initDecoderFn = module.cwrap('init_decoder', 'number', [])
    configureDecodePacketFn = module.cwrap('configure_decode_packet', 'number', ['number', 'number'])
    decodePacketFn = module.cwrap('decode_packet', 'number', ['number', 'number'])
    getPcmDataFn = module.cwrap('get_pcm_data', 'number', ['number'])
    getPcmSizeFn = module.cwrap('get_pcm_size', 'number', ['number'])
    getDecodedChannelsFn = module.cwrap('get_decoded_channels', 'number', ['number'])
    getDecodedSampleRateFn = module.cwrap('get_decoded_sample_rate', 'number', ['number'])
    getDecodedBitsPerSampleFn = module.cwrap('get_decoded_bits_per_sample', 'number', ['number'])
    // no-op: bridge no longer exposes sample count
    getDecodeErrorFn = module.cwrap('get_decode_error', 'number', ['number'])
    flushDecoderFn = module.cwrap('flush_decoder', 'void', ['number'])
    closeDecoderFn = module.cwrap('close_decoder', 'void', ['number'])
  }
}

const initEncoder = async (numberOfChannels: number, sampleRate: number, bitsPerSample: 16 | 24) => {
  await ensureModule()

  const ctx = initEncoderFn(numberOfChannels, sampleRate, bitsPerSample)
  if (ctx === 0) {
    throw new Error('Failed to initialize FLAC encoder.')
  }

  const headerPtr = getHeaderData(ctx)
  const headerSize = getHeaderSize(ctx)
  const header = module.HEAPU8.slice(headerPtr, headerPtr + headerSize).buffer

  return { ctx, header }
}

const readPackets = (ctx: number) => {
  const packets: PacketInfo[] = []
  const frameCount = getFrameCount(ctx)
  const outputPtr = getOutputData(ctx)

  let offset = 0
  for (let i = 0; i < frameCount; i++) {
    const size = getFrameSize(ctx, i)
    const samples = getFrameSamples(ctx, i)
    const encodedData = module.HEAPU8.slice(outputPtr + offset, outputPtr + offset + size).buffer
    packets.push({ encodedData, samples })
    offset += size
  }

  return packets
}

const encode = (ctx: number, audioData: ArrayBuffer, numSamples: number) => {
  const audioBytes = new Uint8Array(audioData)

  const inputPtr = getEncodeInputPtr(ctx, audioBytes.length)
  if (inputPtr === 0) {
    throw new Error('Failed to allocate encoder input buffer.')
  }
  module.HEAPU8.set(audioBytes, inputPtr)

  const ret = sendSamplesFn(ctx, numSamples)
  if (ret < 0) {
    throw new Error(`Encode failed with error code ${ret}.`)
  }

  return readPackets(ctx)
}

const flush = (ctx: number) => {
  const ret = finishEncoderFn(ctx)
  if (ret < 0) {
    throw new Error('Flush failed.')
  }

  return readPackets(ctx)
}

const initDecoder = async () => {
  await ensureModule()

  const ctx = initDecoderFn()
  if (ctx === 0) {
    throw new Error('Failed to initialize FLAC decoder.')
  }

  return { ctx }
}

const decode = (ctx: number, encodedData: ArrayBuffer) => {
  const encodedBytes = new Uint8Array(encodedData)

  // Allocate buffer in WASM memory
  const bufPtr = configureDecodePacketFn(ctx, encodedBytes.length)
  if (bufPtr === 0) {
    throw new Error('Failed to allocate decoder buffer.')
  }

  // Copy encoded data to WASM memory
  module.HEAPU8.set(encodedBytes, bufPtr)

  // Decode the packet
  const ret = decodePacketFn(ctx, encodedBytes.length)
  if (ret < 0) {
    const error = getDecodeErrorFn(ctx)
    throw new Error(`Decode failed with error code ${ret} (decoder error: ${error}).`)
  }

  // Get PCM data
  const pcmPtr = getPcmDataFn(ctx)
  const pcmSize = getPcmSizeFn(ctx)
  const channels = getDecodedChannelsFn(ctx)
  const sampleRate = getDecodedSampleRateFn(ctx)
  const bitsPerSample = getDecodedBitsPerSampleFn(ctx)
  // bridge no longer provides sample count; it's not required by caller
  const pcmData = module.HEAPU8.slice(pcmPtr, pcmPtr + pcmSize).buffer

  return {
    pcmData,
    channels,
    sampleRate,
    bitsPerSample
  }
}

const onMessage = (data: { id: number, command: WorkerCommand }) => {
  const { id, command } = data

  const handleCommand = async (): Promise<void> => {
    try {
      let result: WorkerResponseData
      const transferables: Transferable[] = []

      switch (command.type) {
        case 'init': {
          const { ctx, header } = await initEncoder(
            command.data.numberOfChannels,
            command.data.sampleRate,
            command.data.bitsPerSample
          )
          result = { type: command.type, ctx, header }
          transferables.push(header)
        } break

        case 'encode': {
          const packets = encode(
            command.data.ctx,
            command.data.audioData,
            command.data.numSamples
          )
          for (const p of packets) {
            transferables.push(p.encodedData)
          }
          result = { type: command.type, packets }
        } break

        case 'flush': {
          const packets = flush(command.data.ctx)
          for (const p of packets) {
            transferables.push(p.encodedData)
          }
          result = { type: command.type, packets }
        } break

        case 'init-decoder': {
          const { ctx } = await initDecoder()
          result = { type: command.type, ctx }
        } break

        case 'decode': {
          const decoded = decode(
            command.data.ctx,
            command.data.encodedData
          )
          result = {
            type: command.type,
            pcmData: decoded.pcmData,
            channels: decoded.channels,
            sampleRate: decoded.sampleRate,
            bitsPerSample: decoded.bitsPerSample
          }
          transferables.push(result.pcmData)
        } break

        case 'flush-decoder':
          flushDecoderFn(command.data.ctx)
          result = { type: command.type }
          break

        case 'close-decoder':
          closeDecoderFn(command.data.ctx)
          result = { type: command.type }
          break
      }

      const response: WorkerResponse = {
        id,
        success: true,
        data: result
      }
      sendMessage(response, transferables)
    } catch (error: unknown) {
      const response: WorkerResponse = {
        id,
        success: false,
        error
      }
      sendMessage(response)
    }
  }

  handleCommand()
}

const sendMessage = (data: unknown, transfer: Transferable[] = []) => self.postMessage(data, { transfer })

self.addEventListener('message', event => onMessage(event.data as { id: number, command: WorkerCommand }))
