import { writable } from 'simple-store-svelte'
import { derived, get, readable } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import { client, type Media } from '../anilist'
import { mappings } from '../anizip'
import native from '../native'
import { simklClientID, simklClientSecret, SUPPORTS } from '../settings'

import type { Entry, FullMediaList, UserFrag } from '../anilist/queries'
import type { ResultOf, VariablesOf } from 'gql.tada'

import { dev } from '$app/environment'
import { arrayEqual } from '$lib/utils'

type ALMediaStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING'
type SimklMediaStatus = 'watching' | 'plan_to_watch' | 'completed' | 'dropped' | 'hold'

const SIMKL_TO_AL_STATUS: Record<SimklMediaStatus, ALMediaStatus> = {
  watching: 'CURRENT',
  plan_to_watch: 'PLANNING',
  completed: 'COMPLETED',
  dropped: 'DROPPED',
  hold: 'PAUSED'
}

const AL_TO_SIMKL_STATUS: Record<ALMediaStatus, SimklMediaStatus> = {
  CURRENT: 'watching',
  PLANNING: 'plan_to_watch',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PAUSED: 'hold',
  REPEATING: 'watching'
}

interface SimklOAuth {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token?: string
  created_at: number
}

interface SimklIds {
  simkl: number
  anilist?: string
  mal?: string
  kitsu?: string
}

interface SimklShow {
  title: string
  year: number
  ids: SimklIds
}

interface SimklAnimeItem {
  status: SimklMediaStatus | null
  watched_episodes_count: number
  total_episodes_count?: number
  user_rating: number | null
  show: SimklShow
}

interface SimklListResponse {
  anime: SimklAnimeItem[]
}

interface SimklSyncShow {
  ids: { anilist: number } | { simkl: number }
  to?: SimklMediaStatus
  watched_episodes?: number
  rating?: number
}

const ENDPOINTS = {
  API_OAUTH: 'https://api.simkl.com/oauth/token',
  API_AUTHORIZE: 'https://simkl.com/oauth/authorize',
  API_USER: 'https://api.simkl.com/users/settings',
  API_SYNC_HISTORY: 'https://api.simkl.com/sync/history',
  API_SYNC_WATCHLIST: 'https://api.simkl.com/sync/watchlist',
  API_SYNC_RATINGS: 'https://api.simkl.com/sync/ratings',
  API_REMOVE: 'https://api.simkl.com/sync/remove-from-list',
  API_ADD: 'https://api.simkl.com/sync/add-to-list',
  API_ALL_ITEMS: 'https://api.simkl.com/sync/all-items/anime/'
} as const

export default new class SimklSync {
  auth = persisted<SimklOAuth | undefined>('simklAuth', undefined)
  viewer = persisted<ResultOf<typeof UserFrag> | undefined>('simklViewer', undefined)
  userlist = writable(new Map<number, ResultOf<typeof FullMediaList>>())
  simklToAL: Record<string, string> = {}
  ALToSimkl: Record<string, string> = {}

  continueIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    const sub = this.userlist.subscribe(entries => {
      if (!entries.size) return

      const ids: number[] = []

      for (const [alId, entry] of entries) {
        if (entry.status === 'REPEATING' || entry.status === 'CURRENT') {
          ids.push(alId)
        }
      }

      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      set(ids)
    })
    return sub
  })

  planningIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    const sub = this.userlist.subscribe(entries => {
      if (!entries.size) return

      const ids: number[] = []

      for (const [alId, entry] of entries) {
        if (entry.status === 'PLANNING') {
          ids.push(alId)
        }
      }

      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      set(ids)
    })
    return sub
  })

  constructor () {
    this.auth.subscribe((auth) => {
      if (auth) this._user()
    })
  }

  async _request<T = object> (url: string | URL, method: string, body?: string): Promise<T | { error: string }> {
    let auth = get(this.auth)
    try {
      if (auth) {
        const expiresAt = (auth.created_at + auth.expires_in) * 1000

        if (expiresAt < Date.now() - 1000 * 60 * 5) {
          auth = await this._refresh(auth)
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'simkl-api-key': get(simklClientID)
      }

      if (auth) {
        headers.Authorization = `Bearer ${auth.access_token}`
      }

      const res = await fetch(url, {
        method,
        headers,
        body
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      if (method === 'DELETE') return undefined as T

      return await res.json() as T
    } catch (error) {
      const err = error as Error

      toast.error('Simkl Error', { description: err.message, duration: 15_000 })
      console.error(err)

      return { error: err.message }
    }
  }

  async _get<T> (target: string): Promise<T | { error: string }> {
    return await this._request<T>(target, 'GET')
  }

  async _post<T> (url: string, body?: string): Promise<T | { error: string }> {
    return await this._request<T>(url, 'POST', body)
  }

  async _oauthRequest<T> (body: object): Promise<T | { error: string }> {
    try {
      const res = await fetch(ENDPOINTS.API_OAUTH, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(`HTTP ${res.status}: ${errorText}`)
      }

      return await res.json() as T
    } catch (error) {
      const err = error as Error

      toast.error('Simkl Error', { description: err.message, duration: 15_000 })
      console.error(err)

      return { error: err.message }
    }
  }

  async _refresh (auth?: SimklOAuth) {
    if (!auth?.refresh_token) return auth

    const data = await this._oauthRequest<SimklOAuth>({
      grant_type: 'refresh_token',
      refresh_token: auth.refresh_token,
      client_id: get(simklClientID),
      client_secret: get(simklClientSecret) || undefined
    })

    if ('access_token' in data) {
      data.created_at = Math.floor(Date.now() / 1000)

      this.auth.set(data)

      return data
    }

    return auth
  }

  async login () {
    const clientID = get(simklClientID)
    const clientSecret = get(simklClientSecret)

    if (!clientID || !clientSecret) {
      toast.error('Simkl Sync', { description: 'Simkl Client ID and Client Secret must be configured in Simkl settings.' })

      return
    }

    const state = crypto.randomUUID().replaceAll('-', '')
    const redirect = SUPPORTS.isIOS ? 'hayase://authorize/' : dev ? 'http://localhost:7344/authorize' : 'https://hayase.app/authorize'

    const { code } = await native.authMAL(`${ENDPOINTS.API_AUTHORIZE}?response_type=code&client_id=${clientID}&state=${state}&redirect_uri=${redirect}`)

    const data = await this._oauthRequest<SimklOAuth>({
      code,
      client_id: clientID,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code'
    })

    if ('access_token' in data) {
      this.auth.set({
        ...data,
        created_at: Math.floor(Date.now() / 1000)
      })
    }
  }

  logout () {
    localStorage.removeItem('simklViewer')
    localStorage.removeItem('simklAuth')
    native.restart()
  }

  async _user () {
    const res = await this._get<Record<string, unknown> | null>(ENDPOINTS.API_USER)

    if (!res || 'error' in res) return

    const u = res.user as Record<string, unknown> | undefined
    const account = res.account as Record<string, unknown> | undefined
    const id = typeof account?.id === 'number' ? account.id : undefined

    if (!id) return

    this.viewer.set({
      id,
      name: typeof u?.name === 'string' ? u.name : '',
      about: '',
      avatar: {
        large: typeof u?.avatar === 'string' ? u.avatar : null
      },
      bannerImage: null,
      createdAt: 0,
      isFollowing: false,
      isFollower: false,
      donatorBadge: null,
      options: null,
      statistics: null
    })

    await this._loadUserList()
  }

  async _loadUserList () {
    const list = await this._get<SimklListResponse | null>(ENDPOINTS.API_ALL_ITEMS)

    if (!list || 'error' in list || !list.anime) return

    const entryMap = new Map<number, ResultOf<typeof FullMediaList>>()

    for (const item of list.anime) {
      const anilistId = item.show.ids.anilist

      if (!anilistId) continue

      const alIdNum = Number(anilistId)
      const simklIdNum = item.show.ids.simkl

      this.simklToAL[simklIdNum] = anilistId
      this.ALToSimkl[anilistId] = simklIdNum.toString()

      entryMap.set(alIdNum, {
        id: alIdNum,
        mediaId: alIdNum,
        status: item.status ? SIMKL_TO_AL_STATUS[item.status] : null,
        progress: item.watched_episodes_count ?? 0,
        score: item.user_rating ?? 0,
        repeat: 0,
        customLists: null
      })
    }
    this.userlist.set(entryMap)
  }

  hasAuth = derived(this.viewer, (viewer) => {
    return viewer !== undefined && !!viewer.id
  })

  id () {
    return get(this.viewer)?.id
  }

  profile (): ResultOf<typeof UserFrag> | undefined {
    return get(this.viewer)
  }

  // QUERIES/MUTATIONS

  schedule (onList: boolean | null = true, date: Date) {
    const ids = [...this.userlist.value.keys()]

    return client.schedule(onList && ids.length ? ids : undefined, undefined, date)
  }

  async _getSimklId (alId: number) {
    const cached = this.ALToSimkl[alId.toString()]
    if (cached) return cached
    const res = await mappings(alId) as Record<string, unknown> | null
    const simklId = res?.simkl_id as string | number | undefined
    if (!simklId) return
    this.ALToSimkl[alId.toString()] = simklId.toString()
    return simklId.toString()
  }

  async toggleFav (id: number) {
    // Simkl doesn't have a concept of favourites
  }

  isFav (alId: number) {
    return false
  }

  async deleteEntry (media: Media) {
    const alId = media.id
    const simklEntry = this.userlist.value.get(alId)

    if (!simklEntry) return

    const res = await this._post<object>(ENDPOINTS.API_REMOVE, JSON.stringify({
      shows: [{ ids: { anilist: alId } }]
    }))

    if (res && 'error' in res) return

    this.userlist.update(map => {
      map.delete(alId)
      return map
    })
  }

  async entry (variables: VariablesOf<typeof Entry>) {
    const targetMediaId = variables.id
    const status = AL_TO_SIMKL_STATUS[variables.status!]

    const show: SimklSyncShow = { ids: { anilist: targetMediaId }, to: status }

    if (variables.progress) show.watched_episodes = variables.progress
    if (variables.score) show.rating = variables.score

    const res = await this._post<object>(ENDPOINTS.API_ADD, JSON.stringify({ shows: [show] }))

    if (!res || 'error' in res) return

    const existing = this.userlist.value.get(targetMediaId)

    this.userlist.update(map => {
      map.set(targetMediaId, {
        id: targetMediaId,
        mediaId: targetMediaId,
        status: variables.status ?? existing?.status ?? null,
        progress: variables.progress ?? existing?.progress ?? 0,
        score: variables.score ?? existing?.score ?? 0,
        repeat: variables.repeat ?? existing?.repeat ?? 0,
        customLists: null
      })
      return map
    })
  }
}()
