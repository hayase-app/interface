import { authExchange } from '@urql/exchange-auth'
import { Client, fetchExchange } from '@urql/svelte'
// import Bottleneck from 'bottleneck'
import Debug from 'debug'
import { writable } from 'simple-store-svelte'
import { get } from 'svelte/store'
import { pipe, tap } from 'wonka'

import { anilistClientID } from '../settings'

import { makeDefaultStorage } from './exchanges/defaultstorage.ts'
import { cacheOnErrorExchange } from './exchanges/error.ts'
import { offlineExchange } from './exchanges/offline.ts'
import { refocusExchange } from './exchanges/refocus.ts'
import { retryExchange } from './exchanges/retry.ts'
import gql from './gql'
import { CommentFrag, UpdateUser, type Entry, FullMedia, ThreadFrag, type ToggleFavourite, UserLists, Viewer } from './queries'
import schema from './schema.json' with { type: 'json' }

import type { CombinedError } from '@urql/core'
import type { ResultOf } from 'gql.tada'

import native from '#lib/modules/native'
import { safeLocalStorage } from '#lib/utils'

const debug = Debug('ui:urql')

interface ViewerData { viewer: ResultOf<typeof Viewer>['Viewer'], token: string, expires: string }

// eslint-disable-next-line @typescript-eslint/no-invalid-void-type
export const storagePromise = Promise.withResolvers<void>()
export const storage = makeDefaultStorage({
  idbName: 'anilist-cache-v2',
  onCacheHydrated: () => storagePromise.resolve(),
  maxAge: 21 // The maximum age of the persisted data in days
})

indexedDB.deleteDatabase('anilist-cache-v1') // old version

debug('Loading urql client')
storagePromise.promise.finally(() => debug('Graphcache storage initialized'))

let purgeScheduled = false
function purgeStaleEntries () {
  if (purgeScheduled) return
  purgeScheduled = true

  const run = () => {
    if (navigator.onLine) storage.purgeStaleEntries().catch(error => debug('Failed to purge stale cache entries', error))
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 120_000 })
  } else {
    setTimeout(run, 5_000)
  }
}

export default new class URQLClient extends Client {
  // limiter = new Bottleneck({
  //   reservoir: Infinity,
  //   reservoirRefreshAmount: Infinity,
  //   reservoirRefreshInterval: 60_000,
  //   maxConcurrent: 10,
  //   minTime: 100
  // })

  error = writable<CombinedError | undefined>(undefined)

  // handleRequest = this.limiter.wrap<Response, RequestInfo | URL, RequestInit | undefined>(fetch)

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
      this.viewer.value = { viewer: (await this.mutation(UpdateUser, { lists: [...lists, 'Watched using Hayase'] })).data!.UpdateUser!, token, expires }
    }
  }

  async logout () {
    debug('Logging out from Anilist')
    await storage.clear()
    localStorage.removeItem('ALViewer')
    native.restart()
  }

  viewer = writable<ViewerData | undefined>(safeLocalStorage('ALViewer'))

  constructor () {
    super({
      url: 'https://graphql.anilist.co',
      preferGetMethod: false,
      // fetch: (req: RequestInfo | URL, opts?: RequestInit) => this.handleRequest(req, opts),
      exchanges: [
        refocusExchange({ minimumTime: 60_000 }),
        cacheOnErrorExchange(),
        retryExchange({
          initialDelayMs: 100,
          maxDelayMs: 60_000,
          randomDelay: false,
          maxNumberAttempts: Infinity,
          retryIf: e => {
            if (e.graphQLErrors[0]?.originalError?.message === 'validation') return false
            return true
          }
        }),
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
                cache.updateQuery({ query: UserLists, variables: { id: this.viewer.value?.viewer?.id } }, data => {
                  debug('cache update DeleteMediaListEntry, UserLists', data)
                  if (!data?.MediaListCollection?.lists) return data
                  data.MediaListCollection.lists = data.MediaListCollection.lists.map(list => {
                    if (!list?.entries) return list
                    return {
                      ...list,
                      entries: list.entries.filter(entry => entry?.id !== id)
                    }
                  })
                  return data
                })
              },
              SaveMediaListEntry: (result: ResultOf<typeof Entry>, _args, cache) => {
                debug('cache update SaveMediaListEntry', result)
                const entry = result.SaveMediaListEntry
                debug('SaveMediaListEntry entry', entry)
                const mediaId = entry?.mediaId ?? _args.mediaId as number
                if (!mediaId || !entry) return
                cache.updateQuery({ query: UserLists, variables: { id: this.viewer.value?.viewer?.id } }, data => {
                  debug('cache update SaveMediaListEntry, UserLists', data)
                  if (!data?.MediaListCollection?.lists) return data

                  const status =
                    result.SaveMediaListEntry?.status ??
                    data.MediaListCollection.lists.find(l => l?.status && l.entries?.find(e => e?.media?.id === mediaId))?.status ??
                    'PLANNING'
                  debug('status', status)

                  const lists = data.MediaListCollection.lists
                  if (!lists.some(l => l?.status === status)) {
                    // @ts-expect-error a new list needs a typename, or graphcache cannot write it and drops the entry
                    lists.push({ status, entries: [], __typename: 'MediaListGroup' })
                  }

                  for (const list of lists) {
                    if (!list) continue
                    // remove old
                    list.entries = list.entries?.filter(entry => entry?.mediaId !== mediaId) ?? []
                    // @ts-expect-error gql infer types, add new
                    if (list.status === status) list.entries.unshift({ ...entry, __typename: 'MediaList', media: { id: mediaId, __typename: 'Media' } })
                  }
                  debug('lists', lists)

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
              MediaList: (parent, { id }) => ({ __typename: 'MediaList', id }),
              Thread: (parent, { id }) => ({ __typename: 'Thread', id }),
              ThreadComment: (parent, { id }) => ({ __typename: 'ThreadComment', id })
            },
            Media: {
              // isFavourite is non-null, so a partially cached Media makes the whole query read fail
              isFavourite: (parent, _args, cache, info) => cache.resolve(info.parentKey, 'isFavourite') ?? false
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
            SaveMediaListEntry (args, _cache, info) {
              debug('optimistic SaveMediaListEntry', args)
              info.partial = true

              return {
                id: Math.random() * -1e9 | 0,
                // TODO: I think customlists are wrong
                ...args,
                customLists: (args.customLists as string[])?.map(name => ({ enabled: true, name })),
                media: { id: args.mediaId, __typename: 'Media' },
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

              info.partial = true

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
            MediaListTypeOptions: () => null,
            MediaTag: () => null
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
        ({ forward }) => ops$ => pipe(
          ops$,
          forward,
          tap(({ data, error, stale }) => {
            // only a fresh, successful response proves the API can give the data back, an offline session must keep the entries it cannot download again
            if (data && !error && !stale && navigator.onLine) purgeStaleEntries()

            this.error.set(error)
          })
        ),
        fetchExchange
      ],
      requestPolicy: 'cache-and-network'
    })
  }
}()
