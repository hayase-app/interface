// See https://kit.svelte.dev/docs/types#app
import type { Search } from '$lib/modules/anilist/queries'
import type { VariablesOf } from 'gql.tada'
import type { CompositionEventHandler } from 'svelte/elements'

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

  // declare module '*.svelte' {
  //   export default SvelteComponentTyped
  // }
}

export {}
