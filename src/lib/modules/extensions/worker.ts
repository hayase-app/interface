import { finalizer } from 'abslink'
import { expose } from 'abslink/w3c'

import type { NZBorURLSource, SearchFunction, TorrentSource } from './types'

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
    console.log('destroyed worker')
    self.close()
  },

  async url () {
    return (await this.mod).url
  },

  async single (...args: Parameters<SearchFunction>): ReturnType<SearchFunction> {
    return await ((await this.mod) as TorrentSource).single(...args)
  },

  async batch (...args: Parameters<SearchFunction>): ReturnType<SearchFunction> {
    return await ((await this.mod) as TorrentSource).batch(...args)
  },

  async movie (...args: Parameters<SearchFunction>): ReturnType<SearchFunction> {
    return await ((await this.mod) as TorrentSource).movie(...args)
  },

  async query (...args: Parameters<NZBorURLSource['query']>) {
    return await ((await this.mod) as NZBorURLSource).query(...args)
  },

  async test () {
    return await (await this.mod).test()
  }
})
