/*!
 * Copyright (c) 2026-present, Vanilagy and contributors
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import CreateWorker from './codec.worker?worker'
import { assert, type WorkerCommand, type WorkerResponse, type WorkerResponseData } from './shared'

let workerPromise: Promise<Worker> | null
let nextMessageId = 0
interface PendingMessage { resolve: (value: WorkerResponseData) => void, reject: (reason?: unknown) => void }
const pendingMessages = new Map<number, PendingMessage>()

let refCount = 0
let keepAliveInterval: ReturnType<typeof setInterval> | null = null

export const refWorker = async () => {
  refCount++
  if (refCount === 1) {
    keepAliveInterval = setInterval(() => {}, 2 ** 31 - 1)
    await ensureWorker()
  }
}

export const unrefWorker = async () => {
  refCount--
  if (refCount === 0) {
    if (keepAliveInterval !== null) {
      clearInterval(keepAliveInterval)
      keepAliveInterval = null
    }

    const worker = await workerPromise
    if (worker) {
      worker.terminate()
      workerPromise = null
    }
  }
}

export const sendCommand = async <T extends string>(
  command: WorkerCommand & { type: T },
  transferables: Transferable[] = []
) => {
  const worker = await ensureWorker()

  return await new Promise<WorkerResponseData & { type: T }>((resolve, reject) => {
    const id = nextMessageId++
    pendingMessages.set(id, {
      resolve: resolve as (value: WorkerResponseData) => void,
      reject
    })

    worker.postMessage({ id, command }, transferables)
  })
}

const ensureWorker = () => {
  workerPromise ??= (async () => {
    const worker = new CreateWorker()

    const onMessage = (data: WorkerResponse) => {
      const pending = pendingMessages.get(data.id)
      assert(pending !== undefined)

      pendingMessages.delete(data.id)
      if (data.success) {
        pending.resolve(data.data)
      } else {
        pending.reject(data.error)
      }
    }

    worker.addEventListener('message', event => onMessage(event.data as WorkerResponse))

    return worker
  })()
  return workerPromise
}
