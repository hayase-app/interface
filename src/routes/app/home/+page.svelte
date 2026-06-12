<script lang='ts' context='module'>
  import { derived } from 'svelte/store'

  import type { Search } from '$lib/modules/anilist/queries'
  import type { VariablesOf } from 'gql.tada'
  // import type { Readable } from 'simple-store-svelte'

  import { client, currentSeason, currentYear } from '$lib/modules/anilist'
  import { authAggregator } from '$lib/modules/auth'

  interface Section {
    title: string
    variables: VariablesOf<typeof Search>
  }

  const sections: Section[] = [
    { title: 'Popular This Season', variables: { sort: ['POPULARITY_DESC'], season: currentSeason, seasonYear: currentYear } },
    { title: 'Trending Now', variables: { sort: ['TRENDING_DESC'] } },
    { title: 'All Time Popular', variables: { sort: ['POPULARITY_DESC'] } },
    { title: 'Romance', variables: { sort: ['TRENDING_DESC'], genre: ['Romance'] } },
    { title: 'Action', variables: { sort: ['TRENDING_DESC'], genre: ['Action'] } },
    { title: 'Adventure', variables: { sort: ['TRENDING_DESC'], genre: ['Adventure'] } },
    { title: 'Fantasy', variables: { sort: ['TRENDING_DESC'], genre: ['Fantasy'] } }
  ]

  const sectionsQueries = sections.map(({ title, variables }) => {
    const query = client.search(variables, true)
    query.subscribe(() => undefined) // this is hacky as shit, but prevents query from re-running
    return { title, query, variables }
  })

  interface SectionQuery {
    title: string
    query: ReturnType<typeof client.search>
    variables: VariablesOf<typeof Search>
  }

  const sequelSectionQuery = derived(authAggregator.sequelIDs, (sequelIDs, set: (value: SectionQuery | null) => void) => {
    if (!sequelIDs) return set(null)

    const query = client.search({ ids: sequelIDs, status: ['FINISHED', 'RELEASING'], onList: false }, true)
    set({ title: 'Sequels You Missed', query, variables: { ids: sequelIDs, status: ['FINISHED', 'RELEASING'], onList: false } })

    return query.subscribe(() => undefined)
  })

  const planningSectionQuery = derived(authAggregator.planningIDs, (planningIDs, set: (value: SectionQuery | null) => void) => {
    if (!planningIDs) return set(null)

    const query = client.search({ ids: planningIDs, status: ['FINISHED', 'RELEASING'], sort: ['START_DATE_DESC'] }, true)
    set({ title: 'Your List', query, variables: { ids: planningIDs, status: ['FINISHED', 'RELEASING'], sort: ['START_DATE_DESC'] } })

    return query.subscribe(() => undefined)
  })

  const continueSectionQuery = derived(authAggregator.continueIDs, (continueIDs, set: (value: SectionQuery | null) => void) => {
    if (!continueIDs) return set(null)

    const query = derived(client.search({ ids: continueIDs.slice(0, 50), sort: ['UPDATED_AT_DESC'] }, false), value => {
      value.data?.Page?.media?.sort((a, b) => continueIDs.indexOf(a?.id ?? 0) - continueIDs.indexOf(b?.id ?? 0))
      return value
    }) as ReturnType<typeof client.search>
    set({ title: 'Continue Watching', query, variables: { ids: continueIDs, sort: ['UPDATED_AT_DESC'] } })

    return query.subscribe(() => undefined)
  })

  const sectionQueries = derived(
    [continueSectionQuery, planningSectionQuery, sequelSectionQuery],
    ([continueSection, planningSection, sequelSection]) => [
      ...[continueSection, planningSection, sequelSection].filter((section) => section !== null),
      ...sectionsQueries
    ]
  )
  sectionQueries.subscribe(() => undefined)
</script>

<script lang='ts'>
  import { onDestroy } from 'svelte'

  import { goto } from '$app/navigation'
  import { Banner, hideBanner } from '$lib/components/ui/banner'
  import { QueryCard } from '$lib/components/ui/cards'
  import { click, dragScroll } from '$lib/modules/navigate'

  function handleScroll (e: Event) {
    const target = e.target as HTMLDivElement
    hideBanner.value = target.scrollTop > 100
  }

  hideBanner.value = false

  function search (variables: VariablesOf<typeof Search>) {
    goto('/#/app/search', { state: { search: variables } })
  }

  onDestroy(() => {
    for (const { query } of $sectionQueries) {
      query.pause?.()
    }
  })
</script>

<div class='grow h-full min-w-0 -ml-14 pl-14 overflow-y-scroll' use:dragScroll on:scroll={handleScroll}>
  <Banner />
  {#each $sectionQueries as { title, query, variables }, i (i)}
    <div class='flex px-4 pt-5 items-end cursor-pointer text-muted-foreground relative z-[1]'>
      <div class='font-semibold text-lg leading-none select:text-foreground' use:click={() => search(variables)}>{title}</div>
      <div class='ml-auto text-xs select:text-foreground' use:click={() => search(variables)}>View More</div>
    </div>
    <div class='flex overflow-x-scroll select:-ml-14 select:pl-14 select:-mt-40 select:pt-40 -mb-5 pb-5 relative group' use:dragScroll>
      <QueryCard {query} />
    </div>
  {/each}
</div>
