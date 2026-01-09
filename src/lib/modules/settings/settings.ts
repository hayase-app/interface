import Debug from 'debug'
import { derived, type Readable } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'

import native from '../native'

import SUPPORTS from './supports'

import { defaults } from '.'

import { dev } from '$app/environment'

const _debug = Debug('ui:settings')

export const settings = persisted('settings', defaults, { beforeRead: value => ({ ...defaults, ...value }) })

export const debug = persisted('debug-key', '')

const alID = dev ? '26159' : '3461'
const malID = 'd93b624a92e431a9b6dfe7a66c0c5bbb'
export const anilistClientID = persisted('anilist-client-id', alID, {
  beforeWrite: v => v || alID,
  beforeRead: v => v || alID
})
export const malClientID = persisted('mal-client-id', malID, {
  beforeWrite: v => v || malID,
  beforeRead: v => v || malID
})

export const nsfw = derived(settings, $settings => ($settings.showHentai ? null : ['Hentai']) as ['Hentai'] | null)

debug.subscribe((value) => {
  native.debug(value)
  Debug.enable(value)
})

settings.subscribe((value) => {
  _debug('settings changed', value)
})

function derivedDeep<T, U> (store: Readable<T>, fn: (value: T) => U) {
  let previousValue: U

  return derived<Readable<T>, U>(store, (value: T, set) => {
    const newValue = fn(value)

    if (!(JSON.stringify(previousValue) === JSON.stringify(newValue))) {
      previousValue = newValue
      set(newValue)
    }
  })
}

const torrentSettings = derivedDeep(settings, ($settings) => ({
  torrentPersist: $settings.torrentPersist,
  torrentDHT: $settings.torrentDHT,
  torrentStreamedDownload: $settings.torrentStreamedDownload,
  torrentSpeed: $settings.torrentSpeed,
  maxConns: $settings.maxConns,
  torrentPort: $settings.torrentPort,
  dhtPort: $settings.dhtPort,
  torrentPeX: $settings.torrentPeX
}))

const hideToTray = derived(settings, $settings => $settings.hideToTray)
const idleAnimation = derived(settings, $settings => $settings.idleAnimation)
const uiScale = derived(settings, $settings => $settings.uiScale)
const showDetailsInRPC = derived(settings, $settings => $settings.showDetailsInRPC)
const angle = derived(settings, $settings => $settings.angle)
const unsafeWebGPU = derived(settings, $settings => $settings.unsafeWebGPU)

const dohSettings = derivedDeep(settings, $settings => ({
  enableDoH: $settings.enableDoH,
  doHURL: $settings.doHURL
}))

torrentSettings.subscribe(native.updateSettings)
hideToTray.subscribe(native.setHideToTray)
idleAnimation.subscribe(native.transparency)
uiScale.subscribe(native.setZoom)
showDetailsInRPC.subscribe(native.toggleDiscordDetails)
angle.subscribe(native.setAngle)
unsafeWebGPU.subscribe(native.setExperimentalGPU)
dohSettings.subscribe(({ enableDoH, doHURL }) => {
  if (SUPPORTS.isAndroid) {
    if (enableDoH) native.setDOH('')
  } else {
    native.setDOH(enableDoH ? doHURL : '')
  }
})
