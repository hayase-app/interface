<script lang='ts'>
  import { onDestroy } from 'svelte'

  import { Avatars } from '../avatar'
  import { Button } from '../button'
  import { BookmarkButton, FavoriteButton, PlayButton } from '../button/extra'
  import { Load } from '../img'
  import { Profile } from '../profile'

  import { bannerSrc } from './banner-image.svelte'

  import { goto } from '$app/navigation'
  import { client, desc, duration, format, getTextColorForRating, season, status, title, type Media } from '$lib/modules/anilist'
  import { episodesCached } from '$lib/modules/anizip'
  import { authAggregator, of } from '$lib/modules/auth'
  import { click } from '$lib/modules/navigate'
  import { colors } from '$lib/utils'
  export let mediaList: Array<Media | null>

  function shuffle <T extends unknown[]> (array: T): T {
    let currentIndex = array.length
    let randomIndex

    while (currentIndex > 0) {
      randomIndex = Math.floor(Math.random() * currentIndex--);

      [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
    }

    return array
  }

  function shuffleAndFilter (media: Array<Media | null>) {
    return shuffle(media).filter(media => media?.bannerImage ?? media?.trailer?.id).slice(0, 5) as Media[]
  }

  const shuffled = shuffleAndFilter(mediaList)

  let current = shuffled[0]

  const initial = bannerSrc.value

  $: if (current) bannerSrc.value = current

  onDestroy(() => {
    bannerSrc.value = initial
  })

  function currentIndex () {
    return current ? shuffled.indexOf(current) : 0
  }

  function schedule (index: number) {
    return setTimeout(() => {
      current = shuffled[index % shuffled.length]
      timeout = schedule(index + 1)
    }, 15000)
  }

  let timeout = schedule(currentIndex() + 1)

  function setCurrent (media: Media) {
    if (current === media) return
    clearTimeout(timeout)
    current = media
    timeout = schedule(currentIndex() + 1)
  }
  function tabindex (node: HTMLElement) {
    node.tabIndex = -1
  }

  $: ({ r, g, b } = colors(current?.coverImage?.color ?? undefined))

  const ids = mediaList.map(m => m?.id).filter(e => e) as number[]
  const following = client.followingMany(ids)

  $: filtered = $following.data?.Page?.mediaList?.filter(ml => ml?.user?.id !== authAggregator.id()) ?? []

  $: usersForCurrent = filtered.filter(f => f?.media?.id === current?.id)
</script>

{#if current}
  {#if usersForCurrent.length}
    <div class='md:pt-14 md:pl-10 p-4 flex space-x-2'>
      <Avatars>
        {#each usersForCurrent as ml, i (ml?.user?.id ?? i)}
          {#if ml?.user}
            <Profile user={ml.user} class='inline-block size-8 fade-in' />
          {/if}
        {/each}
      </Avatars>
      <div class='flex flex-col justify-between leading-none font-medium fade-in'>
        <div class='text-muted-foreground text-xs'>
          {usersForCurrent[0]?.user?.name ?? ''}
        </div>
        <div class='text-sm'>
          Also Watched This Series
        </div>
      </div>
    </div>
  {/if}
  <div class='lg:pl-5 pb-2 grid grid-cols-1 lg:grid-cols-2 mt-auto w-full max-h-full' style:--custom={current.coverImage?.color ?? '#fff'} style:--red={r} style:--green={g} style:--blue={b}>
    <div class='w-full flex flex-col items-center text-center lg:items-start lg:text-left gap-4'>
      <a class='text-white font-black text-3xl lg:text-4xl line-clamp-2 w-[900px] max-w-[85%] leading-tight text-balance fade-in hover:text-neutral-300 hover:underline cursor-pointer text-shadow-lg' href='/app/anime/{current.id}'>
        {#await episodesCached(current.id)}
          {title(current)}
        {:then metadata}
          {@const src = metadata?.images?.find(i => i.coverType === 'Clearlogo')?.url}
          {#if src}
            <a class='w-full flex justify-center lg:justify-start'>
              <Load {src} alt={title(current)} class='drop-shadow-lg w-[30rem]' />
            </a>
          {:else}
            {title(current)}
          {/if}
        {/await}
      </a>
      <div class='hidden sm:block gap-2 items-center lg:self-start flex-nowrap max-w-full lg:place-content-start font-bold'>
        <div class='rounded px-3.5 !text-custom h-7 text-nowrap bg-primary/10 text-sm inline-flex items-center'>
          {of(current) ?? duration(current) ?? 'N/A'}
        </div>
        <Button class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/10 select:!bg-primary/15 font-bold' on:click={() => goto('/app/search', { state: { search: { format: [current?.format ?? null] } } })}>
          {format(current)}
        </Button>
        <Button class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/10 select:!bg-primary/15 font-bold' on:click={() => goto('/app/search', { state: { search: { status: [current?.status ?? null] } } })}>
          {status(current)}
        </Button>
        {#if season(current)}
          <Button class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/10 select:!bg-primary/15 font-bold capitalize' on:click={() => goto('/app/search', { state: { search: { season: current?.season ?? null, seasonYear: current?.seasonYear ?? null } } })}>
            {season(current)}
          </Button>
        {/if}
        {#if current.averageScore}
          <Button class='select:!text-primary h-7 text-nowrap bg-primary/10 select:!bg-primary/15 font-bold {getTextColorForRating(current.averageScore)}' on:click={() => goto('/app/search', { state: { search: { sort: ['SCORE_DESC'] } } })}>
            {current.averageScore}%
          </Button>
        {/if}
      </div>
      <div class='flex flex-row w-[280px] max-w-full'>
        <PlayButton media={current} size='default' class='grow bg-custom select:!bg-custom-600 text-contrast mr-2' />
        <FavoriteButton media={current} class='ml-2 select:!text-custom' variant='ghost' size='icon' />
        <BookmarkButton media={current} class='ml-2 select:!text-custom' variant='ghost' size='icon' />
      </div>
    </div>
    <div class='flex flex-col self-end lg:items-end items-center lg:pr-5 w-full min-w-0'>
      <div class='text-white/70 line-clamp-2 lg:line-clamp-3 text-balance max-w-[90%] lg:max-w-[75%] text-xs lg:text-sm text-center lg:text-right fade-in pt-3 text-shadow-lg'>
        {desc(current)}
      </div>
      <div class='hidden lg:flex gap-2 items-center lg:self-end pt-4 flex-nowrap max-w-full lg:place-content-end'>
        {#each current.genres ?? [] as genre (genre)}
          <Button variant='ghost' class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/10 select:!bg-primary/15 font-bold' on:click={() => goto('/app/search', { state: { search: { genre: [genre] } } })}>
            {genre}
          </Button>
        {/each}
      </div>
    </div>
  </div>
  <div class='flex w-full justify-center flex-nowrap overflow-clip' style:--custom={current.coverImage?.color ?? '#fff'}>
    {#each shuffled as media (media.id)}
      {@const active = current === media}
      <div class='pt-2 pb-4' class:cursor-pointer={!active} use:click={() => setCurrent(media)} use:tabindex>
        <div class='bg-white/20 mr-2 progress-badge overflow-clip rounded' class:active style='height: 4px;' style:width={active ? '3rem' : '1.5rem'}>
          <div class='progress-content h-full transform-gpu w-full' class:bg-custom={active} />
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  .progress-badge {
    transition: width .7s ease;
  }
  .progress-badge.active .progress-content {
    animation: fill 15s linear;
  }

  @keyframes fill {
    from {
      transform: translate3d(-100%, var(--tw-translate-y), 0);
    }
    to {
      transform: translate3d(0%, var(--tw-translate-y), 0);
    }
  }
  .details span + span::before {
    content: '•';
    padding: 0 .5rem;
    font-size: .6rem;
    align-self: center;
    white-space: normal;
    color: #737373 !important;
  }
</style>
