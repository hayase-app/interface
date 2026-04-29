import { finalizer } from 'abslink'
import { expose } from 'abslink/w3c'

import { SUPPORTS } from '../settings'

import type { NZBorURLSource, SearchFunction, SearchOptions, TorrentQuery, TorrentSource } from './types'

const _fetch = SUPPORTS.isIOS
  ? (input: RequestInfo | URL, init?: RequestInit) => {
      if (typeof input === 'string') {
        input = input.replace(/^https?:\/\//, 'cors://')
      } else if (input instanceof URL) {
        input = new URL(input.toString().replace(/^https?:\/\//, 'cors://'))
      } else if (input instanceof Request) {
        input = new Request(input.url.replace(/^https?:\/\//, 'cors://'), input)
      }
      return fetch(input, init)
    }
  : fetch

export default expose({
  mod: null as unknown as Promise<(TorrentSource | NZBorURLSource) & { url: string }>,
  construct (code: string) {
    this.mod = this.load(code)
  },

  async load (code: string): Promise<(TorrentSource | NZBorURLSource) & { url: string }> {
    // WARN: unsafe eval
    const url = URL.createObjectURL(new Blob([code], { type: 'application/javascript' }))
    const module = await import(/* @vite-ignore */url)
    URL.revokeObjectURL(url)
    return module.default
  },

  async loaded () {
    await this.mod
  },

  [finalizer] () {
    console.log('destroyed worker', self.name)
    self.close()
  },

  async url () {
    return (await this.mod).url
  },

  async single (query: TorrentQuery, options?: SearchOptions): ReturnType<SearchFunction> {
    const queryWithFetch = { ...query, fetch: _fetch }
    return await ((await this.mod) as TorrentSource).single(queryWithFetch, options)
  },

  async batch (query: TorrentQuery, options?: SearchOptions): ReturnType<SearchFunction> {
    const queryWithFetch = { ...query, fetch: _fetch }
    return await ((await this.mod) as TorrentSource).batch(queryWithFetch, options)
  },

  async movie (query: TorrentQuery, options?: SearchOptions): ReturnType<SearchFunction> {
    const queryWithFetch = { ...query, fetch: _fetch }
    return await ((await this.mod) as TorrentSource).movie(queryWithFetch, options)
  },

  async query (hash: string, options?: SearchOptions) {
    return await ((await this.mod) as NZBorURLSource).query(hash, options, _fetch)
  },

  async test () {
    return await (await this.mod).test()
  }
})
