import { pipe, tap } from 'wonka'

import type { Exchange, Operation } from '@urql/core'

/** Input parameters for the {@link refocusExchange}. */
export interface RefocusExchangeOpts {
  /** The minimum time in milliseconds that the window must stay hidden before a refocus reexecutes queries.
   *
   * @defaultValue `0`
   */
  minimumTime?: number
}

/** Reexecutes active queries when the window becomes visible again.
 *
 * @remarks
 * Every query keeps its own request policy. The client default is `cache-and-network`, so those queries refresh.
 * A `cache-first` query reads the cache again. A `cache-only` query never reaches the network.
 */
export const refocusExchange = (opts: RefocusExchangeOpts = {}): Exchange => ({ client, forward }) => {
  const { minimumTime = 0 } = opts

  if (typeof window === 'undefined') return forward

  const active = new Map<number, Operation>()
  let hiddenAt = 0

  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') {
      hiddenAt = Date.now()
      return
    }
    if (Date.now() - hiddenAt < minimumTime) return

    for (const operation of active.values()) {
      // a cache-only re-read returns the same cache. do not spend work on it.
      if (operation.context.requestPolicy === 'cache-only') continue
      client.reexecuteOperation(operation)
    }
  })

  return operations$ => pipe(
    operations$,
    tap(operation => {
      if (operation.kind === 'query') active.set(operation.key, operation)
      else if (operation.kind === 'teardown') active.delete(operation.key)
    }),
    forward
  )
}
