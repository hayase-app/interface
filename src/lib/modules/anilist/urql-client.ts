import { authExchange } from '@urql/exchange-auth'
import { offlineExchange } from '@urql/exchange-graphcache'
import { Client, fetchExchange } from '@urql/svelte'
import Bottleneck from 'bottleneck'
import Debug from 'debug'
import { writable } from 'simple-store-svelte'
import { get } from 'svelte/store'
import { toast } from 'svelte-sonner'

import { anilistClientID } from '../settings'

import gql from './gql'
import { CommentFrag, UpdateUser, type Entry, FullMedia, FullMediaList, ThreadFrag, type ToggleFavourite, UserLists, Viewer } from './queries'
import { refocusExchange } from './refocus'
import schema from './schema.json' with { type: 'json' }
import { makeDefaultStorage } from './storage'

import type { ResultOf } from 'gql.tada'

import native from '$lib/modules/native'
import { safeLocalStorage, sleep } from '$lib/utils'

const debug = Debug('ui:urql')

interface ViewerData { viewer: ResultOf<typeof Viewer>['Viewer'], token: string, expires: string }

class FetchError extends Error {
  res

  constructor (res: Response, message?: string, opts?: ErrorOptions) {
    super(message, opts)
    this.res = res
  }
}

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export const storagePromise = Promise.withResolvers<void>()
export const storage = makeDefaultStorage({
  idbName: 'anilist-cache-v1',
  onCacheHydrated: () => storagePromise.resolve(),
  maxAge: 14 // The maximum age of the persisted data in days
})

indexedDB.deleteDatabase('graphcache-v3') // old version

debug('Loading urql client')
storagePromise.promise.finally(() => {
  debug('Graphcache storage initialized')
})

export default new class URQLClient extends Client {
  limiter = new Bottleneck({
    reservoir: 90,
    reservoirRefreshAmount: 90,
    reservoirRefreshInterval: 60 * 1000,
    maxConcurrent: 3,
    minTime: 200
  })

  rateLimitPromise: Promise<void> | null = null

  handleRequest = this.limiter.wrap<Response, RequestInfo | URL, RequestInit | undefined>(async (req: RequestInfo | URL, opts?: RequestInit) => {
    await this.rateLimitPromise
    // await sleep(1000)
    const res = await fetch(req, opts)
    if (!res.ok && (res.status === 429 || res.status === 500)) {
      debug('Rate limit exceeded', res)
      throw new FetchError(res)
    }
    return res
  })

  async token () {
    debug('Requesting Anilist token')
    const res = await native.authAL(`https://anilist.co/api/v2/oauth/authorize?client_id=${get(anilistClientID)}&response_type=token`)
    const token = res.access_token
    const expires = '' + (Date.now() + (parseInt(res.expires_in) * 1000))
    this.viewer.value = { viewer: this.viewer.value?.viewer ?? null, token, expires }
    return { token, expires }
  }

  async auth (oauth = this.token()) {
    debug('Authenticating Anilist')
    const { token, expires } = await oauth
    const viewerRes = await this.query(Viewer, {}, { fetchOptions: { headers: { Authorization: `Bearer ${token}` } } })
    if (!viewerRes.data?.Viewer) throw new Error('Failed to fetch viewer data')

    this.viewer.value = { viewer: viewerRes.data.Viewer, token, expires }
    localStorage.setItem('ALViewer', JSON.stringify(this.viewer.value))
    debug('Anilist viewer data', this.viewer.value.viewer)

    const lists = viewerRes.data.Viewer.mediaListOptions?.animeList?.customLists ?? []
    if (!lists.includes('Watched using Hayase')) {
      await this.mutation(UpdateUser, { lists: [...lists, 'Watched using Hayase'] })
    }
  }

  async logout () {
    debug('Logging out from Anilist')
    await storage.clear()
    localStorage.removeItem('ALViewer')
    native.restart()
  }

  setRateLimit (sec: number) {
    debug('Setting rate limit', sec)
    toast.error('Anilist Error', { description: 'Rate limit exceeded, retrying in ' + Math.round(sec / 1000) + ' seconds.' })
    this.rateLimitPromise ??= sleep(sec).then(() => { this.rateLimitPromise = null })
    return sec
  }

  viewer = writable<ViewerData | undefined>(safeLocalStorage('ALViewer'))

  constructor () {
    super({
      url: 'https://graphql.anilist.co',
      preferGetMethod: false,
      // fetch: dev ? fetch : (req: RequestInfo | URL, opts?: RequestInit) => this.handleRequest(req, opts),
      fetch: (req: RequestInfo | URL, opts?: RequestInit) => this.handleRequest(req, opts),
      exchanges: [
        refocusExchange(60_000),
        offlineExchange({
          schema,
          storage,
          updates: {
            Mutation: {
              ToggleFavourite (result: ResultOf<typeof ToggleFavourite>, args, cache) {
                debug('cache update ToggleFavourite', result, args)
                if (!result.ToggleFavourite?.anime?.nodes) return result
                const id = args.animeId as number

                // we check if exists, because AL always returns false for isFavourite, so we need to check if it exists in the list
                const exists = result.ToggleFavourite.anime.nodes.find(n => n?.id === id)

                cache.writeFragment(gql('fragment Med on Media {id, isFavourite}'), { id, isFavourite: !!exists })
              },
              DeleteMediaListEntry: (_, { id }, cache) => {
                debug('cache update DeleteMediaListEntry', id)
                cache.writeFragment(FullMediaList, { id: id as number, progress: null, repeat: null, status: null, customLists: null, score: null })
                cache.updateQuery({ query: UserLists, variables: { id: this.viewer.value?.viewer?.id } }, data => {
                  debug('cache update DeleteMediaListEntry, UserLists', data)
                  if (!data?.MediaListCollection?.lists) return data
                  const oldLists = data.MediaListCollection.lists

                  data.MediaListCollection.lists = oldLists.map(list => {
                    if (!list?.entries) return list
                    return {
                      ...list,
                      entries: list.entries.filter(entry => entry?.media?.mediaListEntry?.id !== id)
                    }
                  })

                  return data
                })
              },
              SaveMediaListEntry: (result: ResultOf<typeof Entry>, { mediaId }, cache) => {
                debug('cache update SaveMediaListEntry', result, mediaId)
                const media = gql('fragment Med on Media {id, mediaListEntry {status, progress, repeat, score, customLists }}')

                const entry = result.SaveMediaListEntry

                if (entry?.customLists) entry.customLists = (entry.customLists as string[]).map(name => ({ enabled: true, name }))
                debug('SaveMediaListEntry entry', entry)
                cache.writeFragment(media, {
                  id: mediaId as number,
                  mediaListEntry: entry ?? null
                })
                cache.updateQuery({ query: UserLists, variables: { id: this.viewer.value?.viewer?.id } }, data => {
                  debug('cache update SaveMediaListEntry, UserLists', data)
                  if (!data?.MediaListCollection?.lists) return data
                  const oldLists = data.MediaListCollection.lists
                  const oldEntry = oldLists.flatMap(list => list?.entries).find(entry => entry?.media?.id === mediaId) ?? { id: -1, media: cache.readFragment(FullMedia, { id: mediaId as number, __typename: 'Media' }) }
                  if (!oldEntry.media) return data
                  debug('oldEntry', oldEntry)

                  const lists = oldLists.map(list => {
                    if (!list?.entries) return list
                    return {
                      ...list,
                      entries: list.entries.filter(entry => entry?.media?.id !== mediaId)
                    }
                  })
                  debug('lists', lists)

                  const status = result.SaveMediaListEntry?.status ?? oldEntry.media.mediaListEntry?.status ?? 'PLANNING' as const

                  const fallback: NonNullable<typeof oldLists[0]> = { status, entries: [] }
                  let targetList = lists.find(list => list?.status === status)
                  if (!targetList) {
                    lists.push(fallback)
                    targetList = fallback
                  }
                  debug('targetList', targetList)
                  targetList.entries ??= []
                  targetList.entries.push(oldEntry)
                  return { ...data, MediaListCollection: { ...data.MediaListCollection, lists } }
                })
              },
              SaveThreadComment: (_result, args, cache, _info) => {
                debug('cache update SaveThreadComment', args)
                if (_info.variables.rootCommentId) {
                  const id = _info.variables.rootCommentId as number
                  cache.invalidate({
                    __typename: 'ThreadComment',
                    id
                  })
                } else {
                  cache.invalidate('ThreadComment')
                }
              },
              DeleteThreadComment: (_result, args, cache, _info) => {
                debug('cache update DeleteThreadComment', args)
                const id = (_info.variables.rootCommentId ?? args.id) as number
                cache.invalidate({
                  __typename: 'ThreadComment',
                  id
                })
              }
            }
          },
          resolvers: {
            Query: {
              Media: (parent, { id }) => ({ __typename: 'Media', id }),
              Thread: (parent, { id }) => ({ __typename: 'Thread', id })
            }
          },
          optimistic: {
            ToggleFavourite ({ animeId }, cache, info) {
              debug('optimistic ToggleFavourite', animeId)
              const id = animeId as number
              const media = cache.readFragment(FullMedia, { id, __typename: 'Media' })
              info.partial = true

              const nodes = media?.isFavourite ? [] : [{ id, __typename: 'Media' }]
              return {
                anime: {
                  nodes,
                  __typename: 'MediaConnection'
                },
                __typename: 'Favourites'
              }
            },
            DeleteMediaListEntry () {
              debug('optimistic DeleteMediaListEntry')
              return { deleted: true, __typename: 'Deleted' }
            },
            SaveMediaListEntry (args, cache, info) {
              debug('optimistic SaveMediaListEntry', args)
              const id = args.mediaId as number
              const media = cache.readFragment(FullMedia, { id, __typename: 'Media' })
              if (!media) return null
              info.partial = true
              debug('optimistic SaveMediaListEntry media', media)

              return {
                status: 'PLANNING' as const,
                progress: 0,
                repeat: 0,
                score: 0,
                id: -1,
                ...media.mediaListEntry,
                customLists: (args.customLists as string[]).map(name => ({ enabled: true, name })),
                ...args,
                media,
                __typename: 'MediaList'
              }
            },
            ToggleLikeV2 ({ id, type }, cache, info) {
              debug('optimistic ToggleLikeV2', id, type)
              const threadOrCommentId = id as number
              const likable = type as 'THREAD' | 'THREAD_COMMENT' | 'ACTIVITY' | 'ACTIVITY_REPLY'

              const typename = likable === 'THREAD' ? 'Thread' : 'ThreadComment'

              const likableUnion = cache.readFragment(likable === 'THREAD' ? ThreadFrag : CommentFrag, { id: threadOrCommentId, __typename: typename })

              if (!likableUnion) return null
              debug('optimistic ToggleLikeV2 likableUnion', likableUnion)

              return {
                id: threadOrCommentId,
                isLiked: !likableUnion.isLiked,
                likeCount: likableUnion.likeCount + (likableUnion.isLiked ? -1 : 1),
                __typename: typename
              }
            }
          },
          keys: {
            FuzzyDate: () => null,
            PageInfo: () => null,
            Page: () => null,
            MediaTitle: () => null,
            MediaCoverImage: () => null,
            AiringSchedule: () => null,
            MediaListCollection: e => (e.user as {id: string | null}).id,
            MediaListGroup: e => e.status as string | null,
            UserAvatar: () => null,
            UserOptions: () => null,
            UserStatisticTypes: () => null,
            UserGenreStatistic: () => null,
            UserStatistics: () => null,
            MediaListOptions: () => null,
            MediaListTypeOptions: () => null
          }
        }),
        authExchange(async utils => {
          return {
            addAuthToOperation: (operation) => {
              if (!this.viewer.value) return operation
              return utils.appendHeaders(operation, {
                Authorization: `Bearer ${this.viewer.value.token}`
              })
            },
            didAuthError (error, _operation) {
              return error.graphQLErrors.some(e => e.message === 'Invalid token')
            },
            refreshAuth: async () => {
              const oauth = this.token()
              this.auth(oauth) // TODO: this should be awaited, but it utils doesnt expose query, only mutation, so need to wait for it to be added
              await oauth
            },
            willAuthError: () => {
              if (!this.viewer.value?.expires) return false
              return parseInt(this.viewer.value.expires) < Date.now()
            }
          }
        }),
        fetchExchange
      ],
      requestPolicy: 'cache-and-network'
    })

    this.limiter.on('failed', async (error: FetchError | Error, jobInfo) => {
      debug('Bottleneck onfailed', error, jobInfo.options, jobInfo.retryCount, jobInfo.args[0], jobInfo.args[1]?.body)
      // urql has some weird bug that first error is always an AbortError ???
      if (error.name === 'AbortError') return undefined
      if (jobInfo.retryCount > 8) return undefined

      if (error.message === 'Failed to fetch') return this.setRateLimit(60000)
      if (!(error instanceof FetchError)) return 0
      if (error.res.status === 500) return 1000

      const delay = (parseInt(error.res.headers.get('retry-after') ?? '60') + 1) * 1000

      debug('Setting rate limit for', error.res.status, delay)

      return this.setRateLimit(delay)
    })
  }
}()
