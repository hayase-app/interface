/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

export interface PacketInfo {
  encodedData: ArrayBuffer
  samples: number
}

export type WorkerCommand = {
  type: 'init'
  data: {
    numberOfChannels: number
    sampleRate: number
    bitsPerSample: 16 | 24
  }
} | {
  type: 'encode'
  data: {
    ctx: number
    audioData: ArrayBuffer
    numSamples: number
  }
} | {
  type: 'flush'
  data: {
    ctx: number
  }
} | {
  type: 'init-decoder'
  data: Record<string, never>
} | {
  type: 'decode'
  data: {
    ctx: number
    encodedData: ArrayBuffer
  }
} | {
  type: 'flush-decoder'
  data: {
    ctx: number
  }
} | {
  type: 'close-decoder'
  data: {
    ctx: number
  }
}

export type WorkerResponseData = {
  type: 'init'
  ctx: number
  header: ArrayBuffer
} | {
  type: 'encode'
  packets: PacketInfo[]
} | {
  type: 'flush'
  packets: PacketInfo[]
} | {
  type: 'init-decoder'
  ctx: number
} | {
  type: 'decode'
  pcmData: ArrayBuffer
  channels: number
  sampleRate: number
  bitsPerSample: number
} | {
  type: 'flush-decoder'
} | {
  type: 'close-decoder'
}

export type WorkerResponse = {
  id: number
} & ({
  success: true
  data: WorkerResponseData
} | {
  success: false
  error: unknown
})

export function assert (x: unknown): asserts x {
  if (!x) {
    throw new Error('Assertion failed.')
  }
}
