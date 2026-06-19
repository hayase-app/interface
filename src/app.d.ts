// See https://kit.svelte.dev/docs/types#app
import type { Search } from '$lib/modules/anilist/queries'
import type { ClassValue as ClsxClassValue } from 'clsx'
import type { VariablesOf } from 'gql.tada'
import type { CompositionEventHandler } from 'svelte/elements'

declare module 'tailwind-merge' {
  // Make ClassNameValue compatible with clsx's ClassValue
  export type ClassNameValue = ClsxClassValue
}

export interface Track {
  selected: boolean
  enabled: boolean
  id: string
  kind: string
  label: string
  language: string
}

declare global {

  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}

    interface PageState {
      search?: VariablesOf<typeof Search>
      image?: File | string
    }
    // interface Platform {}
  }

  interface HTMLMediaElement {
    videoTracks?: Track[]
    audioTracks?: Track[]
  }

  interface ScreenOrientation {
    lock: (orientation: 'any' | 'natural' | 'landscape' | 'portrait' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary') => Promise<void>
  }

  interface Navigator {
    userAgentData?: {
      getHighEntropyValues?: (keys: string[]) => Promise<Record<string, string>>
    }
  }

  declare namespace svelteHTML {
    interface HTMLAttributes<T> {
      'on:navigate'?: CompositionEventHandler<T>
      credentialless?: boolean
    }
  }

  // Presentation API type definitions per W3C Presentation API spec
  // https://www.w3.org/TR/presentation-api/
  type PresentationConnectionState =
    'connecting' |
    'connected' |
    'closed' |
    'terminated'

  type PresentationConnectionCloseReason =
    'error' |
    'closed' |
    'wentaway'

  interface PresentationConnectionEventMap {
    connect: Event
    close: PresentationConnectionCloseEvent
    terminate: Event
    message: MessageEvent
  }

  interface PresentationConnection extends EventTarget {
    readonly id: string
    readonly url: string
    readonly state: PresentationConnectionState
    close: () => void
    terminate: () => void
    onconnect: ((this: PresentationConnection, ev: Event) => unknown) | null
    onclose: ((this: PresentationConnection, ev: PresentationConnectionCloseEvent) => unknown) | null
    onterminate: ((this: PresentationConnection, ev: Event) => unknown) | null
    binaryType: BinaryType
    onmessage: ((this: PresentationConnection, ev: MessageEvent) => unknown) | null
    send: {
      (message: string): void
      (data: Blob): void
      (data: ArrayBuffer): void
      (data: ArrayBufferView): void
    }
    addEventListener: {
      <K extends keyof PresentationConnectionEventMap>(type: K, listener: (this: PresentationConnection, ev: PresentationConnectionEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void
    }
    removeEventListener: {
      <K extends keyof PresentationConnectionEventMap>(type: K, listener: (this: PresentationConnection, ev: PresentationConnectionEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void
    }
  }
  declare const PresentationConnection: {
    prototype: PresentationConnection
    new(): PresentationConnection
  }

  interface PresentationConnectionCloseEvent extends Event {
    readonly reason: PresentationConnectionCloseReason
    readonly message: string
  }

  interface PresentationConnectionAvailableEvent extends Event {
    readonly connection: PresentationConnection
  }

  interface PresentationRequestEventMap {
    connectionavailable: PresentationConnectionAvailableEvent
  }

  interface PresentationRequest extends EventTarget {
    start: () => Promise<PresentationConnection>
    reconnect: (presentationId: string) => Promise<PresentationConnection>
    getAvailability: () => Promise<PresentationAvailability>
    onconnectionavailable: ((this: PresentationRequest, ev: PresentationConnectionAvailableEvent) => unknown) | null
    addEventListener: {
      <K extends keyof PresentationRequestEventMap>(type: K, listener: (this: PresentationRequest, ev: PresentationRequestEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void
    }
    removeEventListener: {
      <K extends keyof PresentationRequestEventMap>(type: K, listener: (this: PresentationRequest, ev: PresentationRequestEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void
    }
  }
  declare const PresentationRequest: {
    prototype: PresentationRequest
    new(url: string): PresentationRequest
    new(urls: string[]): PresentationRequest
  }

  interface PresentationAvailabilityEventMap {
    change: Event
  }

  interface PresentationAvailability extends EventTarget {
    readonly value: boolean
    onchange: ((this: PresentationAvailability, ev: Event) => unknown) | null
    addEventListener: {
      <K extends keyof PresentationAvailabilityEventMap>(type: K, listener: (this: PresentationAvailability, ev: PresentationAvailabilityEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void
    }
    removeEventListener: {
      <K extends keyof PresentationAvailabilityEventMap>(type: K, listener: (this: PresentationAvailability, ev: PresentationAvailabilityEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void
    }
  }

  interface PresentationReceiver {
    readonly connectionList: Promise<PresentationConnectionList>
  }

  interface PresentationConnectionListEventMap {
    connectionavailable: PresentationConnectionAvailableEvent
  }

  interface PresentationConnectionList extends EventTarget {
    readonly connections: readonly PresentationConnection[]
    onconnectionavailable: ((this: PresentationConnectionList, ev: PresentationConnectionAvailableEvent) => unknown) | null
    addEventListener: {
      <K extends keyof PresentationConnectionListEventMap>(type: K, listener: (this: PresentationConnectionList, ev: PresentationConnectionListEventMap[K]) => unknown, options?: boolean | AddEventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void
    }
    removeEventListener: {
      <K extends keyof PresentationConnectionListEventMap>(type: K, listener: (this: PresentationConnectionList, ev: PresentationConnectionListEventMap[K]) => unknown, options?: boolean | EventListenerOptions): void
      (type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void
    }
  }

  interface Presentation {
    defaultRequest: PresentationRequest | null
    readonly receiver: PresentationReceiver | null
  }

  interface Navigator {
    readonly presentation: Presentation
  }

  // declare module '*.svelte' {
  //   export default SvelteComponentTyped
  // }
}

export {}
