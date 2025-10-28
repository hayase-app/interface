import Debug from 'debug'
import { writable } from 'simple-store-svelte'
import { derived, get, readable } from 'svelte/store'
import { persisted } from 'svelte-persisted-store'
import { toast } from 'svelte-sonner'

import { client, type Media } from '../anilist'
import { mappings, mappingsByMalId } from '../anizip'
import native from '../native'
import { malClientID, SUPPORTS } from '../settings'

import type { Entry, FullMediaList, UserFrag } from '../anilist/queries'
import type { ResultOf, VariablesOf } from 'gql.tada'

import { dev } from '$app/environment'
import { arrayEqual } from '$lib/utils'

const debug = Debug('ui:mal')

type ALMediaStatus = 'CURRENT' | 'PLANNING' | 'COMPLETED' | 'DROPPED' | 'PAUSED' | 'REPEATING'

const MAL_TO_AL_STATUS: Record<MALMediaStatus, ALMediaStatus> = {
  watching: 'CURRENT',
  plan_to_watch: 'PLANNING',
  completed: 'COMPLETED',
  dropped: 'DROPPED',
  on_hold: 'PAUSED'
}

const AL_TO_MAL_STATUS: Record<ALMediaStatus, MALMediaStatus> = {
  CURRENT: 'watching',
  PLANNING: 'plan_to_watch',
  COMPLETED: 'completed',
  DROPPED: 'dropped',
  PAUSED: 'on_hold',
  REPEATING: 'watching'
}

type MALMediaStatus = 'watching' | 'completed' | 'on_hold' | 'dropped' | 'plan_to_watch'

interface MALOAuth {
  token_type: string
  expires_in: number
  access_token: string
  refresh_token: string
  created_at: number
}

interface MALUser {
  id: number
  name: string
  picture?: string
  gender?: string
  joined_at: string
  anime_statistics?: {
    num_items: number
    num_episodes: number
    num_days: number
  }
}

interface MALListUpdate {
  status: MALMediaStatus
  num_watched_episodes?: number
  score?: number
  num_times_rewatched?: number
  is_rewatching?: boolean
  rewatch_value?: number
}

interface MALStatus {
  status: MALMediaStatus
  score: number
  num_episodes_watched: number
  is_rewatching: boolean
  updated_at: string
  start_date?: string
  finish_date?: string
  num_times_rewatched: number
}

interface MALAnimeListItem {
  node: {
    id: number
    title: string
    main_picture?: {
      medium: string
      large: string
    }
    num_episodes: number
    status: string
    my_list_status: MALStatus
  }
}

const ENDPOINTS = {
  API_BASE: 'https://api.myanimelist.net/v2',
  API_OAUTH: 'https://myanimelist.net/v1/oauth2/token',
  API_AUTHORIZE: 'https://myanimelist.net/v1/oauth2/authorize',
  API_USER: 'https://api.myanimelist.net/v2/users/@me',
  API_ANIME_LIST: 'https://api.myanimelist.net/v2/users/@me/animelist',
  API_ANIME: 'https://api.myanimelist.net/v2/anime'
} as const

export default new class MALSync {
  auth = persisted<MALOAuth | undefined>('malAuth', undefined)
  viewer = persisted<ResultOf<typeof UserFrag> | undefined>('malViewer', undefined)
  userlist = writable<Record<string, ResultOf<typeof FullMediaList>>>({}) // al id to al mapped mal entry
  malToAL: Record<string, string> = {}
  ALToMal: Record<string, string> = {}

  continueIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    const sub = this.userlist.subscribe(values => {
      debug('continueIDs: checking for IDs')
      const entries = Object.entries(values)
      if (!entries.length) return []

      const ids: number[] = []

      for (const [alId, entry] of entries) {
        if (entry.status === 'REPEATING' || entry.status === 'CURRENT') {
          ids.push(Number(alId))
        }
      }

      debug('continueIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('continueIDs: setting new IDs', ids)
      set(ids)
    })
    return sub
  })

  planningIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    const sub = this.userlist.subscribe(values => {
      debug('planningIDs: checking for IDs')
      const entries = Object.entries(values)
      if (!entries.length) return []

      const ids: number[] = []

      for (const [alId, entry] of entries) {
        if (entry.status === 'PLANNING') {
          ids.push(Number(alId))
        }
      }

      debug('planningIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('planningIDs: setting new IDs', ids)
      set(ids)
    })
    return sub
  })

  constructor () {
    this.auth.subscribe((auth) => {
      if (auth) this._user()
    })
  }

  async _request<T = object> (url: string | URL, method: string, body?: URLSearchParams): Promise<T | { error: string }> {
    const auth = get(this.auth)
    try {
      if (auth) {
        const expiresAt = (auth.created_at + auth.expires_in) * 1000

        if (expiresAt < Date.now() - 1000 * 60 * 5 && !body?.get('refresh_token')) { // 5 minutes before expiry
          await this._refresh()
        }
      }

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded'
      }

      if (auth) {
        headers.Authorization = `Bearer ${auth.access_token}`
      }
      // if android append body to the URL
      if (SUPPORTS.isAndroid && body) {
        if (url instanceof URL) {
          url.search = body.toString()
        } else {
          url += '?' + body.toString()
        }
        body = undefined
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
      toast.error('MAL Error', { description: err.message })
      console.error(err)

      return {
        error: err.message
      }
    }
  }

  async _get<T> (target: string, params: Record<string, unknown> = {}): Promise<T | { error: string }> {
    const url = new URL(target)

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.append(key, String(value))
    }

    return await this._request<T>(url, 'GET')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _post <T> (url: string, body?: Record<string, any>): Promise<T | { error: string }> {
    return await this._request<T>(url, 'POST', new URLSearchParams(body))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _patch<T> (url: string, body: Record<string, any>): Promise<T | { error: string }> {
    return await this._request<T>(url, 'PATCH', new URLSearchParams(body))
  }

  async _delete<T> (url: string): Promise<T | { error: string }> {
    return await this._request<T>(url, 'DELETE')
  }

  async _refresh () {
    debug('Refreshing MAL token')
    const auth = get(this.auth)
    if (!auth?.refresh_token) return

    const data = await this._post<MALOAuth>(
      ENDPOINTS.API_OAUTH,
      {
        client_id: get(malClientID),
        grant_type: 'refresh_token',
        refresh_token: auth.refresh_token
      }
    )

    if ('access_token' in data) {
      this.auth.set({
        ...data,
        created_at: Math.floor(Date.now() / 1000)
      })
    }
  }

  async login () {
    debug('Logging in to MAL')
    const clientID = get(malClientID)
    const state = crypto.randomUUID().replaceAll('-', '')
    const challenge = (crypto.randomUUID() + crypto.randomUUID()).replaceAll('-', '')

    const redirect = dev ? 'http://localhost:7344/authorize' : 'https://hayase.app/authorize'

    const { code } = await native.authMAL(`${ENDPOINTS.API_AUTHORIZE}?response_type=code&client_id=${clientID}&state=${state}&code_challenge=${challenge}&code_challenge_method=plain&redirect_uri=${redirect}`)

    const data = await this._post<MALOAuth>(
      ENDPOINTS.API_OAUTH,
      {
        client_id: clientID,
        grant_type: 'authorization_code',
        code,
        code_verifier: challenge,
        redirect_uri: redirect
      }
    )

    if ('access_token' in data) {
      this.auth.set({
        ...data,
        created_at: Math.floor(Date.now() / 1000)
      })
    }
  }

  logout () {
    localStorage.removeItem('malViewer')
    localStorage.removeItem('malAuth')
    native.restart()
  }

  async _user () {
    debug('Fetching MAL user data')
    const res = await this._get<MALUser>(ENDPOINTS.API_USER, {
      fields: 'anime_statistics'
    })

    if ('error' in res) return

    debug('MAL user data fetched successfully', res)

    this.viewer.set({
      id: res.id,
      name: res.name,
      about: '',
      avatar: {
        large: res.picture ?? null
      },
      bannerImage: null,
      createdAt: +new Date(res.joined_at),
      isFollowing: false,
      isFollower: false,
      donatorBadge: null,
      options: null,
      statistics: {
        anime: {
          count: res.anime_statistics?.num_items ?? 0,
          minutesWatched: res.anime_statistics?.num_days ?? 0 * 24 * 60, // Convert days to minutes
          episodesWatched: res.anime_statistics?.num_episodes ?? 0,
          genres: null
        }
      }
    })

    await this._loadUserList()
  }

  async _loadUserList () {
    debug('Loading MAL user list')
    const entryMap: Record<string, ResultOf<typeof FullMediaList>> = {}

    let hasNextPage = true
    let page = 0

    let data: MALAnimeListItem[] = []

    while (hasNextPage) {
      const res = await this._get<{ data: MALAnimeListItem[] }>(ENDPOINTS.API_ANIME_LIST, {
        sort: 'list_updated_at',
        fields: 'node.my_list_status',
        nsfw: true,
        limit: 1000,
        offset: page * 1000
      })

      if ('error' in res) break

      hasNextPage = res.data.length === 1000
      page++

      data = data.concat(res.data)
    }

    const ids = data.map(item => item.node.id)

    debug('MAL user list loaded with', data.length, 'entries and IDs:', ids)

    const malToAl = await client.malIdsCompound(ids)
    for (const item of data) {
      const malId = item.node.id
      const alId = malToAl[malId] ?? await this._getAlId(malId)

      if (!alId) continue

      this.malToAL[malId] = alId.toString()
      this.ALToMal[alId] = malId.toString()

      entryMap[alId] = this._malEntryToAl(item.node.my_list_status, item.node.id)
    }

    debug('MAL user list entries mapped to AL IDs:', Object.keys(entryMap))

    this.userlist.set(entryMap)
  }

  _malEntryToAl (item: MALStatus, id: number): ResultOf<typeof FullMediaList> {
    return {
      id,
      status: item.is_rewatching ? 'REPEATING' : MAL_TO_AL_STATUS[item.status],
      progress: item.num_episodes_watched,
      score: item.score,
      repeat: item.num_times_rewatched,
      customLists: null
    }
  }

  async _getMalId (alId: number): Promise<string | undefined> {
    const malId = this.ALToMal[alId]
    if (malId) return malId

    const res = await mappings(alId)
    if (!res?.mal_id) return

    this.ALToMal[alId] = res.mal_id.toString()
    return res.mal_id.toString()
  }

  async _getAlId (malId: number): Promise<string | undefined> {
    const alId = this.malToAL[malId]
    if (alId) return alId

    const res = await mappingsByMalId(malId)
    if (!res?.anilist_id) return

    this.malToAL[malId] = res.anilist_id.toString()
    return res.anilist_id.toString()
  }

  hasAuth = derived(this.viewer, (viewer) => {
    return viewer !== undefined && !!viewer.id
  })

  id () {
    return get(this.viewer)?.id
  }

  profile (): ResultOf<typeof UserFrag> | undefined {
    debug('Fetching MAL user profile')
    return get(this.viewer)
  }

  // QUERIES/MUTATIONS

  schedule (onList: boolean | null = true) {
    const ids = Object.keys(this.userlist.value).map(id => parseInt(id))
    debug('Fetching MAL schedule with IDs:', ids)
    return client.schedule(onList && ids.length ? ids : undefined)
  }

  async toggleFav (id: number) {
    // MAL doesn't have a public favorites API endpoint
  }

  async deleteEntry (media: Media) {
    debug('Deleting MAL entry for media ID', media.id)
    const malId = media.idMal ?? await this._getMalId(media.id)
    if (!malId) return

    const res = await this._delete<undefined>(`${ENDPOINTS.API_ANIME}/${malId}/my_list_status`)

    if (res && 'error' in res) return

    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete this.userlist.value[media.id]
  }

  following (id: number) {
    return null // MAL doesn't support following functionality
  }

  async entry (variables: VariablesOf<typeof Entry>) {
    debug('Updating MAL entry for media ID', variables.id, 'with variables', variables)
    const targetMediaId = variables.id
    const malId = (await client.single(targetMediaId)).data?.Media?.idMal ?? await this._getMalId(targetMediaId)

    if (!malId) {
      toast.error('MAL Sync', {
        description: 'Could not find MAL ID for this media.'
      })
      return
    }

    const body: MALListUpdate = {
      status: AL_TO_MAL_STATUS[variables.status!],
      is_rewatching: variables.status === 'REPEATING'
    }

    if (variables.progress) body.num_watched_episodes = variables.progress
    if (variables.score) body.score = variables.score / 10
    if (variables.repeat) body.num_times_rewatched = variables.repeat

    const res = await this._patch<MALStatus>(`${ENDPOINTS.API_ANIME}/${malId}/my_list_status`, body)

    if ('error' in res) return

    this.userlist.value[targetMediaId] = this._malEntryToAl(res, targetMediaId)
  }
}()
