import { proxy, wrap } from 'abslink'
import { arr2text, base2arr, concat, randomBytes, text2arr } from 'uint8-util'

import native from './native'

import type { Native } from 'native'

import { goto } from '$app/navigation'

interface TorrentClient {
  checkAvailableSpace: Native['checkAvailableSpace']
  checkIncomingConnections: Native['checkIncomingConnections']
  scrape: (hashes: string[]) => ReturnType<Native['updatePeerCounts']>
  playTorrent: (id: string | ArrayBufferView, mediaID: number, episode: number, sessionID: string, background?: boolean) => ReturnType<Native['addTorrent']>
  rescanTorrents: Native['rescanTorrents']
  deleteTorrents: Native['deleteTorrents']
  removeBackgroundTorrents: Native['removeBackgroundTorrents']
  library: Native['library']
  attachments: {
    attachments: Native['attachments']
    tracks: Native['tracks']
    subtitle: Native['subtitles']
    chapters: Native['chapters']
  }
  errors: Native['errors']
  torrentInfo: Native['torrentInfo']
  peerInfo: Native['peerInfo']
  fileInfo: Native['fileInfo']
  trackers: Native['trackers']
  protocolStatus: Native['protocolStatus']
  cached: Native['cachedTorrents']
  activeTorrents: Native['activeTorrents']
  createNZBWebSeed: Native['createNZB']
  createHTTPWebSeed: Native['createHTTPWebSeed']
  listenDisplay: Native['getDisplays']
  playDisplay: Native['castPlay']
  closeDisplay: Native['castClose']
}

export const HOSTNAME = 'hayase.local'

export default async function connect (key: string, domain: string) {
  const session = crypto.randomUUID()

  const source = new EventSource(new URL('/events/' + session, domain))
  const messageURL = new URL('/message/' + session, domain)

  const secret = await crypto.subtle.importKey('raw', text2arr(key), 'HKDF', false, ['deriveKey'])
  const channelKey = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: text2arr(session), info: text2arr(HOSTNAME) },
    secret,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )

  const listeners = new Set<(data: unknown) => void>()

  source.onmessage = async event => {
    try {
      const message = base2arr(event.data as string)
      const data = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: message.subarray(0, 12) }, channelKey, message.subarray(12))
      for (const listener of listeners) listener(JSON.parse(arr2text(data)))
    } catch (error) {
      console.error(error)
    }
  }

  await new Promise<void>((resolve, reject) => {
    source.onopen = () => resolve()
    source.onerror = () => { if (source.readyState === EventSource.CLOSED) reject(new Error('The event stream closed.')) }
  })

  const torrent = wrap<TorrentClient>({
    on: (_event, listener) => listeners.add(listener),
    off: (_event, listener) => listeners.delete(listener),
    postMessage: async message => {
      try {
        const iv = randomBytes(12)
        const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, channelKey, text2arr(JSON.stringify(message)))
        await fetch(messageURL, { method: 'POST', body: concat([iv, new Uint8Array(data)]) })
      } catch (error) {
        console.error(error)
      }
    }
  })

  const torrentNative: Partial<Native> = {
    checkAvailableSpace: torrent.checkAvailableSpace,
    updatePeerCounts: torrent.scrape,
    addTorrent: async (id, mediaID, episode, background) => {
      const files = await torrent.playTorrent(id, mediaID, episode, session, background)
      return files.map(file => {
        const { pathname, search } = new URL(file.url)
        return { ...file, url: new URL(`/webtorrent/${session}${pathname.replace(/^\/webtorrent/, '')}${search}`, domain).toString() }
      })
    },
    rescanTorrents: torrent.rescanTorrents,
    deleteTorrents: torrent.deleteTorrents,
    removeBackgroundTorrents: torrent.removeBackgroundTorrents,
    library: torrent.library,
    attachments: async (hash, id) => {
      const files = await torrent.attachments.attachments(hash, id)
      return files.map(file => {
        const { pathname } = new URL(file.url)
        return { ...file, url: new URL(`/attachments/${session}${pathname}`, domain).toString() }
      })
    },
    tracks: torrent.attachments.tracks,
    subtitles: (hash, id, cb) => torrent.attachments.subtitle(hash, id, proxy(cb)),
    errors: cb => torrent.errors(proxy(cb)),
    chapters: torrent.attachments.chapters,
    torrentInfo: torrent.torrentInfo,
    peerInfo: torrent.peerInfo,
    fileInfo: torrent.fileInfo,
    trackers: torrent.trackers,
    protocolStatus: torrent.protocolStatus,
    cachedTorrents: torrent.cached,
    activeTorrents: torrent.activeTorrents,
    createNZB: torrent.createNZBWebSeed,
    createHTTPWebSeed: torrent.createHTTPWebSeed,
    isApp: 'browser'
  }

  // Cast discovery runs on the host network, so only a local connection gets it.
  if (new URL(domain).hostname !== HOSTNAME) {
    torrentNative.getDisplays = cb => torrent.listenDisplay(proxy(cb))
    torrentNative.castPlay = torrent.playDisplay
    torrentNative.castClose = torrent.closeDisplay
  }

  Object.assign(native, torrentNative)

  await goto('/#/', { replaceState: true })
}

export const REMOTE_HOSTS_KEY = 'hayase-remote-hosts'

export interface SavedHostInfo {
  name: string
  key: string
  external: string
}

export interface LocalHostInfo {
  name: string
  key: string
  external?: string
}

export interface RemoteHostInfo {
  name: string
  external: string
}

export type HostInfo = LocalHostInfo | RemoteHostInfo
