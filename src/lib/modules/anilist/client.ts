import { queryStore, type OperationResultState, gql as _gql } from '@urql/svelte'
import Debug from 'debug'
import lavenshtein from 'js-levenshtein'
import { derived, get, writable, type Writable } from 'svelte/store'

import { nsfw } from '../settings/settings'

import { AnimePage, Comments, DeleteEntry, DeleteThreadComment, Entry, Following, FollowingMany, type FullMedia, type FullMediaList, IDMedia, IDTitle, RecrusiveRelations, SaveThreadComment, Schedule, Search, Threads, ToggleFavourite, ToggleLike, UpdateUser, User, UserLists } from './queries'
import urqlClient from './urql-client'
import { seasonsForDate, removeDiacritics } from './util'

import type { Media, RelationTreeMedia } from './types'
import type { Edge, Node } from '@xyflow/svelte'
import type { ResultOf, VariablesOf } from 'gql.tada'
import type { AnyVariables, OperationContext, RequestPolicy, TypedDocumentNode } from 'urql'

import { derivedArray } from '$lib/utils'

const debug = Debug('ui:anilist')

function getDistanceFromTitle (media: Media & {lavenshtein?: number}, name: string) {
  const titles = Object.values(media.title ?? {}).filter(v => v).map(title => lavenshtein(title?.toLowerCase() ?? '', name.toLowerCase()))
  const synonyms = (media.synonyms ?? []).filter(v => v).map(title => lavenshtein(title?.toLowerCase() ?? '', name.toLowerCase()) + 2)
  const distances = [...titles, ...synonyms]
  const min = distances.reduce((prev, curr) => prev < curr ? prev : curr)
  media.lavenshtein = min
  return media as Media & {lavenshtein: number}
}

class AnilistClient {
  client: typeof urqlClient = urqlClient
  constructor () {
    // hacky but prevents query from re-running
    // the debug logging is added after an empty useless subscription, don't delete this subscription!
    this.userlists.subscribe(ids => {
      debug('userlists: ', ids?.data?.MediaListCollection?.lists?.find(list => list?.status === 'CURRENT')?.entries?.map(entry => entry?.media?.id) ?? [])
    })
    this.continueIDs.subscribe(ids => {
      debug('continueIDs: ', ids)
    })
  }

  viewerID = derived(this.client.viewer, (store) => store?.viewer?.id)

  userlists = derived<typeof this.viewerID, OperationResultState<ResultOf<typeof UserLists>> | undefined>(this.viewerID, (id, set) => {
    if (!id) return
    return queryStore({ client: this.client, query: UserLists, variables: { id }, context: { requestPolicy: 'cache-and-network' } }).subscribe(set)
  })

  medialists = derived(this.userlists, $userlists => {
    const map = new Map<number, ResultOf<typeof FullMediaList>>()
    for (const list of $userlists?.data?.MediaListCollection?.lists ?? []) {
      for (const entry of list?.entries ?? []) {
        if (entry?.mediaId) map.set(entry.mediaId, entry)
      }
    }
    return map
  })

  continueIDs = derivedArray(this.userlists, $userLists => {
    debug('continueIDs: checking for IDs')
    const mediaList = $userLists?.data?.MediaListCollection?.lists?.reduce((filtered: NonNullable<typeof list>['entries'], list) => {
      return (list?.status === 'CURRENT' || list?.status === 'REPEATING') ? filtered!.concat(list.entries) : filtered
    }, [])
    if (!mediaList?.length) return []

    const ids = mediaList.filter(entry => {
      if (!entry?.mediaId) return false
      if (entry.media?.status === 'FINISHED') return true
      const progress = entry.progress ?? 0
      // +2 is for series that don't have the next airing episode scheduled, but are still some-how airing, AL likes to fuck this up a lot, -1 is because we care about the latest aired available episode, not the next aired episode
      return progress < (entry.media?.nextAiringEpisode?.episode ?? (progress + 2)) - 1
    }).map(entry => entry!.mediaId)

    debug('continueIDs: found IDs', ids)

    return ids
  })

  sequelIDs = derivedArray(this.userlists, $userLists => {
    debug('sequelIDs: checking for IDs')
    const mediaList = $userLists?.data?.MediaListCollection?.lists?.find(list => list?.status === 'COMPLETED')?.entries
    if (!mediaList) return []

    const ids = [...new Set(mediaList.flatMap(entry => {
      return entry?.media?.relations?.edges?.filter(edge => edge?.relationType === 'SEQUEL')
    }).map(edge => edge?.node?.id))] as number[]

    debug('sequelIDs: found IDs', ids)
    return ids
  })

  planningIDs = derivedArray(this.userlists, $userLists => {
    debug('planningIDs: checking for IDs')
    const mediaList = $userLists?.data?.MediaListCollection?.lists?.find(list => list?.status === 'PLANNING')?.entries
    if (!mediaList) return []
    const ids = mediaList.map(entry => entry?.mediaId).filter((id): id is number => !!id)
    debug('planningIDs: found IDs', ids)
    return ids
  })

  search (variables: VariablesOf<typeof Search>, pause?: boolean) {
    if (variables.search) variables.search = removeDiacritics(variables.search)
    return queryStore({ client: this.client, query: Search, variables: { ...variables, nsfw: get(nsfw) }, pause })
  }

  async searchCompound (flattenedTitles: Array<{key: string, title: string, year?: string, isAdult: boolean}>) {
    if (!flattenedTitles.length) return []
    debug('searchCompound: searching for', flattenedTitles)
    // isAdult doesn't need an extra variable, as the title is the same regardless of type, so we re-use the same variable for adult and non-adult requests

    const requestVariables = flattenedTitles.reduce<Record<`v${number}`, string>>((obj, { title, isAdult }, i) => {
      if (isAdult && i !== 0) return obj
      obj[`v${i}`] = title
      return obj
    }, {})

    const queryVariables = flattenedTitles.reduce<string[]>((arr, { isAdult }, i) => {
      if (isAdult && i !== 0) return arr
      arr.push(`$v${i}: String`)
      return arr
    }, []).join(', ')
    const fragmentQueries = flattenedTitles.map(({ year, isAdult }, i) => /* js */`
    v${i}: Page(perPage: 10) {
      media(type: ANIME, search: $v${(isAdult && i !== 0) ? i - 1 : i}, status_in: [RELEASING, FINISHED], isAdult: ${!!isAdult} ${year ? `, seasonYear: ${year}` : ''}) {
        ...med
      }
    }`).join(',')

    const query = _gql/* gql */`
    query(${queryVariables}) {
      ${fragmentQueries}
    }
    
    fragment med on Media {
      id,
      title {
        romaji,
        english,
        native
      },
      startDate {
        year,
        month,
        day
      },
      synonyms
    }`

    const res = await this.client.query<Record<string, {media: Media[]}>>(query, requestVariables)

    debug('searchCompound: received response', res)

    if (!res.data) return []

    const searchResults: Record<string, number> = {}
    for (const [variableName, { media }] of Object.entries(res.data)) {
      if (!media.length) continue
      const titleObject = flattenedTitles[Number(variableName.slice(1))]!
      if (searchResults[titleObject.key]) continue
      searchResults[titleObject.key] = media.map(media => getDistanceFromTitle(media, titleObject.title)).reduce((prev, curr) => {
        if (prev.lavenshtein === curr.lavenshtein) {
          // tie breaker: earlier release date wins
          // if no release date on one side, the other wins
          const prevDate = prev.startDate?.year ? new Date(prev.startDate.year, prev.startDate.month ?? 1, prev.startDate.day ?? 1) : null
          const currDate = curr.startDate?.year ? new Date(curr.startDate.year, curr.startDate.month ?? 1, curr.startDate.day ?? 1) : null
          if (prevDate || currDate) {
            return (prevDate ?? new Date()) <= (currDate ?? new Date()) ? prev : curr
          }
        }
        return prev.lavenshtein <= curr.lavenshtein ? prev : curr
      }).id
    }

    const ids = Object.values(searchResults)
    debug('searchCompound: found IDs', ids)
    const search = await this.client.query(Search, { ids, perPage: 50 })
    debug('searchCompound: search query result', search)
    if (!search.data?.Page?.media) return []
    return Object.entries(searchResults).map(([filename, id]) => [filename, search.data!.Page!.media!.find(media => media?.id === id)]) as Array<[string, Media | undefined]>
  }

  async malIdsCompound (malids: number[]) {
    if (!malids.length) return {}

    const result: Record<number, number> = {}

    for (let k = 0; k < malids.length; k += 3500) {
      const ids = malids.slice(k, k + 3500)
      let fragmentQueries = ''

      for (let i = 0; i < ids.length; i += 50) {
        fragmentQueries += /* gql */`
          v${i}: Page(perPage: 50, page: ${Math.floor(i / 50) + 1}) {
            media(idMal_in: $ids, type: ANIME) {
              ...med
            }
          },
        `
      }

      const query = _gql/* gql */`
        query($ids: [Int]) {
          ${fragmentQueries}
        }
        
        fragment med on Media {
          id,
          idMal
        }`

      const res = await this.client.query<Record<string, { media: Array<{ id: number, idMal: number }> }>>(query, { ids })

      for (const { idMal, id } of Object.values(res.data ?? {}).flatMap(({ media }) => media)) {
        result[idMal] = id
      }
    }

    return result
  }

  schedule (ids?: number[], onList: boolean | null = true, date = new Date()) {
    const { current, year, last, lastYear, next, nextYear } = seasonsForDate(date)
    return queryStore({ client: this.client, query: Schedule, variables: { ids, onList, seasonCurrent: current, seasonYearCurrent: year, seasonLast: last, seasonYearLast: lastYear, seasonNext: next, seasonYearNext: nextYear, formatNot: onList ? null : 'TV_SHORT', nsfw: get(nsfw) } })
  }

  async toggleFav (id: number) {
    debug('toggleFav: toggling favourite for ID', id)
    return await this.client.mutation(ToggleFavourite, { id })
  }

  async deleteEntry (id?: number) {
    debug('deleteEntry: deleting entry with ID', id)
    if (!id || (id <= 0 && navigator.onLine)) return
    return await this.client.mutation(DeleteEntry, { id })
  }

  async entry (variables: VariablesOf<typeof Entry>) {
    debug('entry: updating entry for media', variables)
    return await this.client.mutation(Entry, variables)
  }

  user (id: number, pause?: boolean) {
    debug('user: fetching user with ID', id)
    return queryStore({ client: this.client, query: User, variables: { id }, pause })
  }

  async single (id: number, requestPolicy: RequestPolicy = 'cache-first') {
    debug('single: fetching media with ID', id)
    return await this.client.query(IDMedia, { id }, { requestPolicy })
  }

  singleTitle (id: number, requestPolicy: RequestPolicy = 'cache-first') {
    debug('singleTitle: fetching media title with ID', id)
    return queryStore({ client: this.client, query: IDTitle, variables: { id }, context: { requestPolicy } })
  }

  following (animeID: number) {
    debug('following: fetching following for anime with ID', animeID)
    if (!this.client.viewer.value?.viewer?.id) return
    return queryStore({ client: this.client, query: Following, variables: { id: animeID } })
  }

  followingMany (animeIDs: number[], requestPolicy: RequestPolicy = 'cache-and-network') {
    debug('followingMany: fetching following for anime with IDs', animeIDs)
    if (!this.client.viewer.value?.viewer?.id) return
    return queryStore({ client: this.client, query: FollowingMany, variables: { ids: animeIDs }, context: { requestPolicy } })
  }

  threads (animeID: number, page = 1) {
    debug('threads: fetching threads for anime with ID', animeID, 'on page', page)
    return queryStore({ client: this.client, query: Threads, variables: { id: animeID, page, perPage: 16 } })
  }

  comments (threadId: number, page = 1) {
    debug('comments: fetching comments for thread with ID', threadId, 'on page', page)
    return queryStore({ client: this.client, query: Comments, variables: { threadId, page } })
  }

  async toggleLike (id: number, type: 'THREAD' | 'THREAD_COMMENT' | 'ACTIVITY' | 'ACTIVITY_REPLY', wasLiked: boolean) {
    debug('toggleLike: toggling like for ID', id, 'type', type, 'wasLiked', wasLiked)
    return await this.client.mutation(ToggleLike, { id, type, wasLiked })
  }

  async comment (variables: VariablesOf<typeof SaveThreadComment> & { rootCommentId?: number }) {
    debug('comment: saving comment for thread', variables)
    return await this.client.mutation(SaveThreadComment, variables)
  }

  async deleteComment (id: number, rootCommentId: number) {
    debug('deleteComment: deleting comment with ID', id, 'rootCommentId', rootCommentId)
    return await this.client.mutation(DeleteThreadComment, { id, rootCommentId })
  }

  animePage (id: number) {
    debug('animePage: fetching anime page for ID', id)
    return queryStore({ client: this.client, query: AnimePage, variables: { id }, context: { requestPolicy: 'cache-and-network' } })
  }

  async updateUser (vars: VariablesOf<typeof UpdateUser>) {
    const res = await client.client.mutation(UpdateUser, vars)
    if (!res.data?.UpdateUser || !this.client.viewer.value) return
    this.client.viewer.value = { ...this.client.viewer.value, viewer: res.data.UpdateUser }
  }

  _relationsTreeCache = new Map<number, RelationsStore>()

  relationsTree (media: ResultOf<typeof FullMedia>): RelationsStore {
    if (this._relationsTreeCache.has(media.id)) return this._relationsTreeCache.get(media.id)!

    const store: RelationsStore = writable({ nodes: new Map(), edges: new Map() })

    this._generateRelationsTree(store, media)

    return store
  }

  async _generateRelationsTree (store: RelationsStore, media: RelationTreeMedia, reload = false) {
    const { nodes, edges } = get(store)

    const startMedia = media

    const position = { x: 0, y: 0 }

    const lastEdgeMedia = new Set<number>()

    const processEdges = (media: RelationTreeMedia, depth = 0) => {
      if (!media) return
      if ('type' in media && media.type !== 'ANIME') return
      if (!nodes.has(media.id)) {
        if (depth >= 2) lastEdgeMedia.add(media.id)
        nodes.set(media.id, {
          id: '' + media.id,
          data: { id: media.id, media },
          position
        })
      }

      if (depth >= 2) return

      for (const edge of media.relations?.edges ?? []) {
        if (!edge?.node) continue
        const { node, relationType } = edge
        if (node.type !== 'ANIME' || relationType === 'CHARACTER') continue
        const edgeName = [node.id, media.id].sort((a, b) => a - b).join('-')
        const exisingEdge = edges.get(edgeName)
        if (exisingEdge) {
          // parent is a very broad term, and realistically shouldnt be used if there are other more specific relations available
          // such as summary, side story, alternative etc
          if (exisingEdge.label === 'PARENT') {
            edges.delete(edgeName)
          } else {
            continue
          }
        }
        const isPrequel = relationType === 'PREQUEL'
        edges.set(edgeName, {
          id: 'e' + edgeName,
          source: '' + (isPrequel ? node.id : media.id),
          target: '' + (isPrequel ? media.id : node.id),
          data: { ids: [media.id, node.id] },
          animated: true,
          label: isPrequel ? 'SEQUEL' : relationType?.replaceAll('_', ' ') ?? ''
        })

        // @ts-expect-error yeah recursive, last node has different types since it doesnt have relations
        processEdges(node, depth + 1)
      }
    }

    const processMedia = (media: Array<typeof startMedia>) => {
      const totalSize = nodes.size + edges.size
      for (const m of media) processEdges(m)

      for (const id of nodes.keys()) this._relationsTreeCache.set(id, store)
      if (totalSize !== (nodes.size + edges.size)) store.set({ nodes, edges })
    }
    processMedia([startMedia])

    while (lastEdgeMedia.size) {
      const res = await this.client.query(RecrusiveRelations, { ids: [...lastEdgeMedia] }, { requestPolicy: reload ? 'network-only' : 'cache-first' })
      if (res.error) console.error(res.error)
      if (!res.data?.Page?.media?.length) break

      lastEdgeMedia.clear()
      processMedia(res.data.Page.media)
    }
  }
}

type RelationsStore = Writable<{ nodes: Map<number, Node>, edges: Map<string, Edge> }>

// sveltekit/vite does the funny and evaluates at compile, this is a hack to fix development mode
const client = (typeof indexedDB !== 'undefined' && new AnilistClient()) as AnilistClient

export default client

export function asyncStore<Result, Variables = AnyVariables> (query: TypedDocumentNode<Result, Variables>, variables: AnyVariables, context?: Partial<OperationContext>): Promise<Writable<Result>> {
  return new Promise((resolve, reject) => {
    const store = writable<Result>(undefined, () => () => subscription.unsubscribe())

    const subscription = client.client.query(query, variables, context).subscribe(value => {
      if (value.error) {
        reject(value.error)
      } else if (value.data) {
        store.set(value.data)
        resolve(store)
      }
    })
  })
}
