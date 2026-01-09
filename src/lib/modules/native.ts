import SUPPORTS from './settings/supports'

import type { AuthResponse, Native, TorrentInfo } from 'native'

import { sleep } from '$lib/utils'

const rnd = (range = 100) => Math.floor(Math.random() * range)

const dummyFiles = [
  {
    name: 'AmebkuUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUUU.webm',
    hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    type: 'video/webm',
    size: 1234567890,
    path: '/Amebku.webm',
    url: 'http://localhost:7344/test3.mkv',
    id: 0
  }
// {
//   name: 'My Happy Marriage Season 2.mkv',
//   hash: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
//   type: 'video/mkv',
//   size: 1234567890,
//   path: '/video.mkv',
//   url: '/video.mkv',
//   id: 1
// }
]
// function makeRandomPeer (): PeerInfo {
//   const ip = `${rnd(256)}.${rnd(256)}.${rnd(256)}.${rnd(256)}:${rnd(65536)}`
//   return {
//     ip,
//     seeder: Math.random() < 0.5,
//     client: ['qBittorrent 4.5.4', 'WebTorrent 1.0.0', 'Transmission 3.00', 'Deluge 2.1.1', 'μTorrent 3.5.5', 'Vuze 5.7.7.0', 'Azureus 5.7.6.0'].sort(() => Math.random() - 0.5)[0]!,
//     progress: Math.random(),
//     size: {
//       downloaded: rnd(1000000),
//       uploaded: rnd(1000000)
//     },
//     speed: {
//       down: rnd(1000),
//       up: rnd(1000)
//     },
//     time: rnd(1000),
//     flags: (['encrypted', 'utp', 'incoming', 'outgoing'] as const).filter(() => Math.random() < 0.5).slice(0, 3)
//   }
// }
// const dummyPeerInfo: PeerInfo[] = []
// for (let i = 0; i < 100; i++) {
//   dummyPeerInfo.push(makeRandomPeer())
// }

function makeAuth<T> (popup: Window | null, callback: (data: { hash: string, search: string }) => T | undefined) {
  return new Promise<T>((resolve, reject) => {
    if (!popup) return reject(new Error('Failed to open popup'))
    const destroy = (err: Error) => {
      channel.close()
      clearTimeout(timeout)
      reject(err)
      popup.close()
    }
    const timeout = setTimeout(() => destroy(new Error('Authentication timed out')), 5 * 60 * 1000) // 5 minutes
    const channel = new BroadcastChannel('hayase-auth')
    channel.onmessage = ({ data }) => {
      const res = callback(data)
      if (!res) return
      resolve(res)
      destroy(new Error('Authentication succeeded'))
    }
  })
}

export default Object.assign<Native, Partial<Native>>({
  authAL: (url: string) => {
    return makeAuth(
      open(url, 'authframe', SUPPORTS.isAndroid ? 'popup' : 'popup,width=382,height=582'),
      ({ hash }) => {
        if (hash.startsWith('#access_token=')) {
          return Object.fromEntries(new URLSearchParams(hash.replace('#', '?')).entries()) as unknown as AuthResponse
        }
      }
    )
  },
  authMAL: (url: string) => {
    return makeAuth(
      open(url, 'authframe', SUPPORTS.isAndroid ? 'popup' : 'popup,width=382,height=582'),
      ({ search }) => {
        if (search.startsWith('?code=')) {
          return Object.fromEntries(new URLSearchParams(search).entries()) as unknown as { code: string, state: string }
        }
      }
    )
  },
  restart: async () => location.reload(),
  openURL: async (url: string) => { open(url) },
  selectPlayer: async () => 'mpv',
  selectDownload: async () => '/tmp/webtorrent',
  share: (...args) => navigator.share(...args),
  setAngle: async () => undefined,
  getLogs: async () => '',
  getDeviceInfo: async () => ({}),
  openUIDevtools: async () => undefined,
  openTorrentDevtools: async () => undefined,
  minimise: async () => undefined,
  maximise: async () => undefined,
  focus: async () => undefined,
  close: async () => undefined,
  checkUpdate: async () => undefined,
  updateAndRestart: async () => undefined,
  updateReady: () => sleep(rnd(10_000)),
  toggleDiscordDetails: async () => undefined,
  setMediaSession: async (metadata) => { navigator.mediaSession.metadata = new MediaMetadata({ title: metadata.title, artist: metadata.description, artwork: [{ src: metadata.image }] }) },
  setPositionState: async e => navigator.mediaSession.setPositionState(e),
  setPlayBackState: async e => { navigator.mediaSession.playbackState = e },
  setActionHandler: async (...args) => navigator.mediaSession.setActionHandler(...args as [action: MediaSessionAction, handler: MediaSessionActionHandler | null]),
  checkAvailableSpace: () => new Promise(resolve => setTimeout(() => resolve(Math.floor(Math.random() * (1e10 - 1e8 + 1) + 1e8)), 1000)),
  checkIncomingConnections: () => new Promise(resolve => setTimeout(() => resolve(false), 1000)),
  updatePeerCounts: async () => [],
  isApp: false,
  playTorrent: async () => dummyFiles,
  rescanTorrents: async () => undefined,
  deleteTorrents: async () => undefined,
  library: async () => [],
  attachments: async () => [],
  tracks: async () => [],
  subtitles: async () => undefined,
  chapters: async () => [
    { start: 5 * 1000, end: 15 * 1000, text: 'OP' },
    { start: 1.0 * 60 * 1000, end: 1.2 * 60 * 1000, text: 'Chapter 1' },
    { start: 1.4 * 60 * 1000, end: 88 * 1000, text: 'Chapter 2 ' }
  ],
  version: async () => 'v6.4.4',
  updateSettings: async () => undefined,
  setDOH: async () => undefined,
  cachedTorrents: async () => [],
  spawnPlayer: async () => undefined,
  setHideToTray: async () => undefined,
  setExperimentalGPU: async () => undefined,
  transparency: async () => undefined,
  setZoom: async () => undefined,
  navigate: async () => undefined,
  downloadProgress: async () => undefined,
  updateProgress: async () => undefined,
  createNZB: async () => undefined,
  torrentInfo: async (): Promise<TorrentInfo> => ({
    name: '',
    progress: 0,
    size: { total: 0, downloaded: 0, uploaded: 0 },
    speed: { down: 0, up: 0 },
    time: { remaining: 0, elapsed: 0 },
    peers: { seeders: 0, leechers: 0, wires: 0 },
    pieces: { total: 0, size: 0 },
    hash: ''
  }),
  fileInfo: async () => [],
  peerInfo: async () => [],
  protocolStatus: async () => ({
    dht: false,
    lsd: false,
    pex: false,
    nat: false,
    forwarding: false,
    persisting: false,
    streaming: false
  }),
  defaultTransparency: () => false,
  errors: async () => undefined,
  debug: async () => undefined,
  profile: async () => undefined,
  updateToNewEndpoint: async () => undefined
  // @ts-expect-error idk
}, globalThis.native as Partial<Native>)
