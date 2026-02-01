import { writable } from 'simple-store-svelte'

import type { Media } from './modules/anilist'

export const COMMITS_URL = 'https://api.github.com/repos/hayase-app/interface/commits'
export const WEB_URL = 'https://hayase.watch'
export const SETUP_VERSION = 3

export const searchStore = writable<{episode: number, media: Media} | undefined>(undefined)
