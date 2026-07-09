import Debug from 'debug'
import parseTorrent from 'parse-torrent'
import { writable } from 'simple-store-svelte'
import { derived, get } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import client from '../auth/client'
import { extensions } from '../extensions'
import native from '../native'
import { settings, SUPPORTS } from '../settings'
import { w2globby } from '../w2g/lobby'

import type { Media } from '../anilist'
import type { TorrentFile, TorrentInfo } from 'native'

import { fastPrettyBytes } from '$lib/utils'

const debug = Debug('ui:torrent-client')

const defaultTorrentInfo: TorrentInfo = {
  name: '',
  progress: 0,
  size: { total: 0, downloaded: 0, uploaded: 0 },
  speed: { down: 0, up: 0 },
  time: { remaining: 0, elapsed: 0 },
  peers: { seeders: 0, leechers: 0, wires: 0 },
  pieces: { total: 0, size: 0 },
  hash: ''
}

const defaultProtocolStatus = { dht: false, lsd: false, pex: false, nat: false, forwarding: false, persisting: false, streaming: false }

export const server = new class ServerClient {
  last = persisted<{ media: Media, id: string, episode: number } | null>('last-torrent', null)
  active = writable<Promise<{ media: Media, id: string, episode: number, files: TorrentFile[] } | null>>()
  downloaded = writable(new Set<string>())

  stats = this._timedSafeStore(defaultTorrentInfo, native.torrentInfo, SUPPORTS.isUnderPowered ? 3000 : 200)

  protocol = this._timedSafeStore(defaultProtocolStatus, native.protocolStatus)

  peers = this._timedSafeStore([], native.peerInfo)

  files = this._timedSafeStore([], native.fileInfo)

  trackers = derived(this._timedSafeStore({}, native.trackers, 120_000), ($trackers) => Object.entries($trackers).map(([announce, trackers]) => ({ announce, ...trackers })))

  library = this._timedSafeStore([], native.library, 120_000, true)

  _timedSafeStore<T> (defaultData: T, fn: (id: string) => Promise<T>, duration = SUPPORTS.isUnderPowered ? 15000 : 5000, skipActive = false) {
    return writable<T>(defaultData, set => {
      let listener = 0

      const update = async () => {
        try {
          if (skipActive) {
            set(await fn(''))
          } else {
            const id = (await get(this.active))?.id
            if (id) set(await fn(id))
          }
        } catch (error) {
          console.warn(error)
        }
        listener = setTimeout(update, duration)
      }

      update()
      return () => clearTimeout(listener)
    })
  }

  constructor () {
    const last = get(this.last)
    if (last) {
      this.playHash(last.id, last.media, last.episode)
      debug('restored last torrent', last.id, last.media.title?.userPreferred, last.episode)
    }

    this.stats.subscribe((stats) => {
      native.downloadProgress(stats.progress)
    })

    this.cachedTorrents()
  }

  async updateLibrary () {
    const library = await native.library()
    this.downloaded.value = new Set(library.map(({ hash }) => hash))
    this.library.value = library
  }

  async cachedTorrents () {
    debug('fetching cached torrents')
    this.downloaded.value = new Set(await native.cachedTorrents())
  }

  playHash (infoHash: string, media: Media, episode: number, torrent: string | ArrayBufferView = infoHash) {
    if (!media || !infoHash) return
    debug('playing torrent', infoHash, media.id, episode)
    this.last.set({ id: infoHash, media, episode })
    client.setInitialState(media, episode)
    this.active.value = this._loadTorrent(infoHash, torrent, media, episode)
    w2globby.value?.mediaChange({ episode, mediaId: media.id, torrent: infoHash })
    return this.active.value
  }

  async playIdentifier (identifier: ArrayBufferView | string, media: Media, episode: number) {
    if (!media || !identifier) return
    debug('playing torrent file', identifier, media.id, episode)
    const { infoHash } = await (parseTorrent(identifier) as Promise<{ infoHash: string }>)
    return await this.playHash(infoHash, media, episode, identifier)
  }

  async _loadTorrent (infoHash: string, torrent: string | ArrayBufferView, media: Media, episode: number) {
    const result = { id: infoHash, media, episode, files: await native.playTorrent(torrent, media.id, episode) }
    debug('torrent play result', result)

    if (get(this.last)?.id === infoHash) this.last.set({ id: infoHash, media, episode })
    this.downloaded.value.add(infoHash)

    this._addNZBs(infoHash, media, episode, result.files.map(({ name }) => name))
    this._addHTTPWebSeeds(infoHash, media, episode, result.files.map(({ name }) => name))

    native.checkAvailableSpace().then(space => {
      if (space < 1e9) {
        toast.error('Low disk space', { description: `${fastPrettyBytes(space)} available, 1GB is the recommended minimum. Consider freeing up some space otherwise issues may occur.`, duration: 15_000 })
      }
    })

    return result
  }

  async _addNZBs (hash: string, media: Media, episode: number, fileInfo: string | string[]) {
    const set = get(settings)
    if (!set.nzbDomain || !set.nzbLogin || !set.nzbPassword || !set.nzbPort || !set.nzbPoolSize) return

    const { name, progress } = await native.torrentInfo(hash)

    if (progress === 1) return

    for (const nzb of await extensions.nzbQuery(hash, media, episode, fileInfo, name)) {
      try {
        await native.createNZB(hash, nzb)
      } catch (e) {
        toast.error('Failed to add NZB', { description: (e as Error).message, duration: 15_000 })
      }
    }
  }

  async _addHTTPWebSeeds (hash: string, media: Media, episode: number, fileInfo: string | string[], fileIndex?: number) {
    const { name, progress } = await native.torrentInfo(hash)

    if (progress === 1) return

    for (const webseed of await extensions.webSeedQuery(hash, media, episode, fileInfo, name)) {
      try {
        await native.createHTTPWebSeed(hash, webseed.url, webseed.authorization, fileIndex)
      } catch (e) {
        toast.error('Failed to add HTTP webseed', { description: (e as Error).message, duration: 15_000 })
      }
    }
  }
}()

if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => {
    get(server.library)
  }, { timeout: 120_000 })
}
