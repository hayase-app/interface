<script lang='ts'>
  import { onDestroy } from 'svelte'

  import { Button } from '../button'
  import { BookmarkButton, FavoriteButton, PlayButton } from '../button/extra'

  import { bannerSrc } from './banner-image.svelte'

  import { goto } from '$app/navigation'
  import { desc, duration, format, getTextColorForRating, season, status, title, type Media } from '$lib/modules/anilist'
  import { of } from '$lib/modules/auth'
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

  // TODO: this assertion is incorrect!
  let current = shuffled[0]!

  const initial = bannerSrc.value

  $: bannerSrc.value = current

  onDestroy(() => {
    bannerSrc.value = initial
  })

  function currentIndex () {
    return shuffled.indexOf(current)
  }

  function schedule (index: number) {
    return setTimeout(() => {
      current = shuffled[index % shuffled.length]!
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

  $: ({ r, g, b } = colors(current.coverImage?.color ?? undefined))
</script>

<div class='md:pl-5 pb-2 grid grid-cols-1 md:grid-cols-2 mt-auto w-full max-h-full' style:--custom={current.coverImage?.color ?? '#fff'} style:--red={r} style:--green={g} style:--blue={b}>
  <div class='w-full flex flex-col items-center text-center md:items-start md:text-left'>
    <a class='text-white font-black text-3xl md:text-4xl line-clamp-2 w-[900px] max-w-[85%] leading-tight text-balance fade-in hover:text-neutral-300 hover:underline cursor-pointer' href='/app/anime/{current.id}'>
      {title(current)}
    </a>
    <div class='flex gap-2 items-center md:self-start pt-4 flex-nowrap overflow-clip max-w-full md:place-content-start py-4 font-bold'>
      <div class='rounded px-3.5 !text-custom h-7 text-nowrap bg-primary/5 text-sm inline-flex items-center'>
        {of(current) ?? duration(current) ?? 'N/A'}
      </div>
      <Button class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/5 font-bold' on:click={() => goto('/app/search', { state: { search: { format: [current.format] } } })}>
        {format(current)}
      </Button>
      <Button class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/5 font-bold' on:click={() => goto('/app/search', { state: { search: { status: [current.status] } } })}>
        {status(current)}
      </Button>
      {#if season(current)}
        <Button class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/5 font-bold capitalize' on:click={() => goto('/app/search', { state: { search: { season: current.season, seasonYear: current.seasonYear } } })}>
          {season(current)}
        </Button>
      {/if}
      {#if current.averageScore}
        <Button class='select:!text-primary h-7 text-nowrap bg-primary/5 font-bold {getTextColorForRating(current.averageScore)}' on:click={() => goto('/app/search', { state: { search: { sort: ['SCORE_DESC'] } } })}>
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
  <div class='flex flex-col self-end md:items-end items-center md:pr-5 w-full min-w-0'>
    <div class='text-muted-foreground/80 line-clamp-2 md:line-clamp-3 text-balance max-w-[90%] md:max-w-[75%] text-xs md:text-sm text-center md:text-right fade-in pt-3'>
      {desc(current)}
    </div>
    <div class='hidden md:flex gap-2 items-center md:self-end pt-4 flex-nowrap overflow-clip max-w-full md:place-content-end'>
      {#each current.genres ?? [] as genre (genre)}
        <Button variant='ghost' class='!text-custom select:!text-primary h-7 text-nowrap bg-primary/5 font-bold' on:click={() => goto('/app/search', { state: { search: { genre: [genre] } } })}>
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
      <div class='bg-neutral-800 mr-2 progress-badge overflow-clip rounded' class:active style='height: 4px;' style:width={active ? '3rem' : '1.5rem'}>
        <div class='progress-content h-full transform-gpu w-full' class:bg-custom={active} />
      </div>
    </div>
  {/each}
</div>

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
  .fade-in {
    animation: fade-in ease .8s;
  }
</style>
