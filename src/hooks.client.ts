import type { HandleClientError } from '@sveltejs/kit'

import SUPPORTS from '$lib/modules/settings/supports'

// this is for MAL, for they don't support hash routing, so we auth to the root and then redirect to the authorize page with the data in search params
export const init = () => {
  if (location.pathname === '/' && location.search.startsWith('?code')) history.replaceState(null, '', '/#/authorize' + location.search)
}

if (SUPPORTS.isIOS) {
  let customFS: Element | undefined

  Object.defineProperty(document, 'fullscreenElement', {
    get: () => customFS,
    configurable: true,
    enumerable: true
  })

  Element.prototype.requestFullscreen = function (opts) {
    if (document.fullscreenElement === this) return Promise.resolve()
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    customFS = this
    this.classList.add('custom-fullscreen')
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  }

  Document.prototype.exitFullscreen = function () {
    if (!customFS) return Promise.resolve()
    customFS.classList.remove('custom-fullscreen')
    customFS = undefined
    document.dispatchEvent(new Event('fullscreenchange'))
    return Promise.resolve()
  }
}

if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function <T> () {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((_resolve, _reject) => {
      resolve = _resolve
      reject = _reject
    })
    return { promise, resolve, reject }
  }
}

if (typeof Object.groupBy === 'undefined') {
  Object.groupBy = <T, K extends string | number | symbol>(arr: T[], callback: (item: T, index: number) => K) => {
    return [...arr].reduce<Partial<Record<K, T[]>>>((acc: Partial<Record<K, T[]>>, currentValue, index) => {
      const key = callback(currentValue, index)
      acc[key] ??= []
      acc[key]!.push(currentValue)
      return acc
    }, {})
  }
}

if (!Array.prototype.at) {
  // eslint-disable-next-line no-extend-native
  Array.prototype.at = function <T> (this: T[], index: number): T | undefined {
    const len = this.length
    const relativeIndex = Math.trunc(index) || 0
    const k = relativeIndex >= 0 ? relativeIndex : len + relativeIndex
    if (k < 0 || k >= len) return undefined
    return this[k]
  }
}
// randomUUID
if (typeof crypto.randomUUID === 'undefined') {
  crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    }) as `${string}-${string}-${string}-${string}-${string}`
  }
}

export const handleError: HandleClientError = async ({ error, event, status, message }) => {
  if (error instanceof Error) {
    return error
  }
  return {
    status,
    message
  }
}
