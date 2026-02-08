import { finalizer } from 'abslink'
import { expose } from 'abslink/w3c'

import type { NZBorURLSource, SearchFunction, SearchOptions, TorrentQuery, TorrentSource } from './types'

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
    const queryWithFetch = { ...query, fetch }
    return await ((await this.mod) as TorrentSource).single(queryWithFetch, options)
  },

  async batch (query: TorrentQuery, options?: SearchOptions): ReturnType<SearchFunction> {
    const queryWithFetch = { ...query, fetch }
    return await ((await this.mod) as TorrentSource).batch(queryWithFetch, options)
  },

  async movie (query: TorrentQuery, options?: SearchOptions): ReturnType<SearchFunction> {
    const queryWithFetch = { ...query, fetch }
    return await ((await this.mod) as TorrentSource).movie(queryWithFetch, options)
  },

  async query (hash: string, options?: SearchOptions) {
    return await ((await this.mod) as NZBorURLSource).query(hash, options, fetch)
  },

  async test () {
    return await (await this.mod).test()
  }
})
