import { queryStore, type OperationResultState, gql as _gql } from '@urql/svelte'
import Debug from 'debug'
import lavenshtein from 'js-levenshtein'
import { derived, get, readable, writable, type Writable } from 'svelte/store'

import { nsfw } from '../settings/settings'

import { Comments, DeleteEntry, DeleteThreadComment, Entry, Following, FollowingMany, type FullMedia, IDMedia, RecrusiveRelations, SaveThreadComment, Schedule, Search, Threads, ToggleFavourite, ToggleLike, UserLists } from './queries'
import urqlClient from './urql-client'
import { currentSeason, currentYear, lastSeason, lastYear, nextSeason, nextYear } from './util'

import type { Media, RelationTreeMedia } from './types'
import type { Edge, Node } from '@xyflow/svelte'
import type { ResultOf, VariablesOf } from 'gql.tada'
import type { AnyVariables, OperationContext, RequestPolicy, TypedDocumentNode } from 'urql'

import { arrayEqual } from '$lib/utils'

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

  userlists = derived<typeof this.client.viewer, OperationResultState<ResultOf<typeof UserLists>>>(this.client.viewer, (store, set) => {
    return queryStore({ client: this.client, query: UserLists, variables: { id: store?.viewer?.id }, context: { requestPolicy: 'cache-and-network' } }).subscribe(set)
  })

  // WARN: these 3 sections are hacky, i use oldvalue to prevent re-running loops, I DO NOT KNOW WHY THE LOOPS HAPPEN!
  continueIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    return this.userlists.subscribe(values => {
      debug('continueIDs: checking for IDs')
      if (!values.data?.MediaListCollection?.lists) return
      const mediaList = values.data.MediaListCollection.lists.reduce<NonNullable<NonNullable<NonNullable<NonNullable<ResultOf<typeof UserLists>['MediaListCollection']>['lists']>[0]>['entries']>>((filtered, list) => {
        return (list?.status === 'CURRENT' || list?.status === 'REPEATING') ? filtered.concat(list.entries) : filtered
      }, [])

      const ids = mediaList.filter(entry => {
        if (entry?.media?.status === 'FINISHED') return true
        const progress = entry?.media?.mediaListEntry?.progress ?? 0
        // +2 is for series that don't have the next airing episode scheduled, but are still some-how airing, AL likes to fuck this up a lot, -1 is because we care about the latest aired available episode, not the next aired episode
        return progress < (entry?.media?.nextAiringEpisode?.episode ?? (progress + 2)) - 1
      }).map(entry => entry?.media?.id) as number[]

      debug('continueIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('continueIDs: updated IDs')
      set(ids)
    })
  })

  sequelIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    return this.userlists.subscribe(values => {
      debug('sequelIDs: checking for IDs')
      if (!values.data?.MediaListCollection?.lists) return
      const mediaList = values.data.MediaListCollection.lists.find(list => list?.status === 'COMPLETED')?.entries
      if (!mediaList) return []

      const ids = [...new Set(mediaList.flatMap(entry => {
        return entry?.media?.relations?.edges?.filter(edge => edge?.relationType === 'SEQUEL')
      }).map(edge => edge?.node?.id))] as number[]

      debug('sequelIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('sequelIDs: updated IDs')
      set(ids)
    })
  })

  planningIDs = readable<number[]>([], set => {
    let oldvalue: number[] = []
    return this.userlists.subscribe(userLists => {
      debug('planningIDs: checking for IDs')
      if (!userLists.data?.MediaListCollection?.lists) return
      const mediaList = userLists.data.MediaListCollection.lists.find(list => list?.status === 'PLANNING')?.entries
      if (!mediaList) return []
      const ids = mediaList.map(entry => entry?.media?.id) as number[]

      debug('planningIDs: found IDs', ids)
      if (arrayEqual(oldvalue, ids)) return
      oldvalue = ids
      debug('planningIDs: updated IDs')
      set(ids)
    })
  })

  search (variables: VariablesOf<typeof Search>, pause?: boolean) {
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

  async malIdsCompound (ids: number[]) {
    if (!ids.length) return {}

    // chunk every 50
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

    const res = await this.client.query<Record<string, { media: Array<{ id: number, idMal: number }>}>>(query, { ids })

    return Object.fromEntries(Object.values(res.data ?? {}).flatMap(({ media }) => media).map(media => [media.idMal, media.id]))
  }

  schedule (ids?: number[], onList: boolean | null = true) {
    return queryStore({ client: this.client, query: Schedule, variables: { ids, onList, seasonCurrent: currentSeason, seasonYearCurrent: currentYear, seasonLast: lastSeason, seasonYearLast: lastYear, seasonNext: nextSeason, seasonYearNext: nextYear, formatNot: onList ? null : 'TV_SHORT', nsfw: get(nsfw) } })
  }

  async toggleFav (id: number) {
    debug('toggleFav: toggling favourite for ID', id)
    return await this.client.mutation(ToggleFavourite, { id })
  }

  async deleteEntry (media: Media) {
    debug('deleteEntry: deleting entry for media', media)
    if (!media.mediaListEntry?.id) return
    return await this.client.mutation(DeleteEntry, { id: media.mediaListEntry.id })
  }

  async entry (variables: VariablesOf<typeof Entry>) {
    debug('entry: updating entry for media', variables)
    return await this.client.mutation(Entry, variables)
  }

  async single (id: number, requestPolicy: RequestPolicy = 'cache-first') {
    debug('single: fetching media with ID', id)
    return await this.client.query(IDMedia, { id }, { requestPolicy })
  }

  following (animeID: number) {
    debug('following: fetching following for anime with ID', animeID)
    return queryStore({ client: this.client, query: Following, variables: { id: animeID } })
  }

  followingMany (animeIDs: number[]) {
    debug('followingMany: fetching following for anime with IDs', animeIDs)
    return queryStore({ client: this.client, query: FollowingMany, variables: { ids: animeIDs } })
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

  _relationsTreeCache = new Map<number, RelationsStore>()

  relationsTree (media: ResultOf<typeof FullMedia>): RelationsStore {
    if (this._relationsTreeCache.has(media.id)) return this._relationsTreeCache.get(media.id)!

    const store: RelationsStore = writable({ nodes: new Map(), edges: new Map() })

    this._generateRelationsTree(store, media)

    return store
  }

  async _generateRelationsTree (store: RelationsStore, media: RelationTreeMedia) {
    const { nodes, edges } = get(store)

    const startMedia = media

    const position = { x: 0, y: 0 }

    const lastEdgeMedia: number[] = []

    const processEdges = (media: RelationTreeMedia) => {
      if (!media) return
      if ('type' in media && media.type !== 'ANIME') return
      if (!nodes.has(media.id)) {
        if (!media.relations) lastEdgeMedia.push(media.id)
        nodes.set(media.id, {
          id: '' + media.id,
          data: { id: media.id, media },
          position
        })
      }

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
        processEdges(node)
      }
    }

    const totalSize = nodes.size + edges.size
    processEdges(startMedia)

    for (const id of nodes.keys()) this._relationsTreeCache.set(id, store)
    if (totalSize !== (nodes.size + edges.size)) store.set({ nodes, edges })

    if (!lastEdgeMedia.length) return
    const res = await this.client.query(RecrusiveRelations, { ids: lastEdgeMedia }, { requestPolicy: 'cache-first' })
    if (res.error) console.error(res.error)

    if (res.data?.Page) {
      for (const media of res.data.Page.media ?? []) {
        await this._generateRelationsTree(store, media)
      }
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
