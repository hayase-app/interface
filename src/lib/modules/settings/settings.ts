import Debug from 'debug'
import { derived } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import native from '../native'

import SUPPORTS from './supports'

import { defaults } from '.'

import { dev } from '$app/environment'
import { derivedDeep, skipFirst } from '$lib/utils'

const _debug = Debug('ui:settings')

export const settings = persisted('settings', defaults, { beforeRead: value => ({ ...defaults, ...value }) })

export const debug = persisted('debug-key', '')

const alID = SUPPORTS.isIOS ? '39545' : dev ? '26159' : '50801'
const malID = 'd93b624a92e431a9b6dfe7a66c0c5bbb'
export const anilistClientID = persisted('anilist-client-id', alID, {
  beforeWrite: v => v || alID,
  beforeRead: v => v || alID
})
export const malClientID = persisted('mal-client-id', malID, {
  beforeWrite: v => v || malID,
  beforeRead: v => v || malID
})

const simklID = ''
export const simklClientID = persisted('simkl-client-id', simklID, {
  beforeWrite: v => v || simklID,
  beforeRead: v => v || simklID
})

const simklSecret = ''
export const simklClientSecret = persisted('simkl-client-secret', simklSecret, {
  beforeWrite: v => v || simklSecret,
  beforeRead: v => v || simklSecret
})

export const nsfw = derived(settings, $settings => ($settings.showHentai ? null : ['Hentai']))

debug.subscribe((value) => {
  Debug.enable(value)
  native.debug(value).catch(e => {
    _debug('failed to set native debug level ' + e.message)
  })
})

settings.subscribe((value) => {
  _debug('settings changed', value)
})

const torrentSettings = derivedDeep(settings, ($settings) => ({
  torrentPersist: $settings.torrentPersist,
  torrentDHT: $settings.torrentDHT,
  torrentStreamedDownload: $settings.torrentStreamedDownload,
  torrentSpeed: $settings.torrentSpeed,
  maxConns: $settings.maxConns,
  torrentPort: $settings.torrentPort,
  dhtPort: $settings.dhtPort,
  torrentPeX: $settings.torrentPeX,
  nzbDomain: $settings.nzbDomain,
  nzbLogin: $settings.nzbLogin,
  nzbPassword: $settings.nzbPassword,
  nzbPort: $settings.nzbPort,
  nzbPoolSize: $settings.nzbPoolSize
}))

const hideToTray = derived(settings, $settings => $settings.hideToTray)
// const idleAnimation = derived(settings, $settings => $settings.idleAnimation)
const uiScale = derived(settings, $settings => $settings.uiScale)
const showDetailsInRPC = derived(settings, $settings => $settings.showDetailsInRPC)
const angle = derived(settings, $settings => $settings.angle)

const dohSettings = derivedDeep(settings, $settings => ({
  enableDoH: $settings.enableDoH,
  doHURL: $settings.doHURL
}))

skipFirst(torrentSettings).subscribe(native.updateSettings)
hideToTray.subscribe(native.setHideToTray)
// idleAnimation.subscribe(native.transparency)
uiScale.subscribe(native.setZoom)
showDetailsInRPC.subscribe(native.toggleDiscordDetails)
angle.subscribe(native.setAngle)
dohSettings.subscribe(({ enableDoH, doHURL }) => {
  if (SUPPORTS.isAndroid) {
    if (enableDoH) native.setDOH('')
  } else {
    native.setDOH(enableDoH ? doHURL : '').catch(e => {
      _debug('failed to set DoH ' + e.message)
      toast.error('Failed to set DoH!', { description: e.message, duration: 15_000 })
    })
  }
})
