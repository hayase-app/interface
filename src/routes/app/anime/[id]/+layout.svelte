<script lang='ts'>
  // import Bell from 'lucide-svelte/icons/bell'
  import Check from 'lucide-svelte/icons/check'
  import Maximize2 from 'lucide-svelte/icons/maximize-2'
  import Share2 from 'lucide-svelte/icons/share-2'

  import type { LayoutData } from './$types'

  import { goto } from '$app/navigation'
  import EntryEditor from '$lib/components/EntryEditor.svelte'
  import Anilist from '$lib/components/icons/Anilist.svelte'
  import MyAnimeList from '$lib/components/icons/MyAnimeList.svelte'
  import SquiggleArrow from '$lib/components/icons/SquiggleArrow.svelte'
  import { Clapperboard } from '$lib/components/icons/animated'
  import { bannerSrc, hideBanner } from '$lib/components/ui/banner'
  import { Button } from '$lib/components/ui/button'
  import { PlayButton, BookmarkButton, FavoriteButton, TransitionButton } from '$lib/components/ui/button/extra'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Load } from '$lib/components/ui/img'
  import { Profile } from '$lib/components/ui/profile'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import { cover, desc, duration, format, season, status, title, getBGColorForRating, client, episodes } from '$lib/modules/anilist'
  import { minutes } from '$lib/modules/anilist/trailer'
  import { list, of } from '$lib/modules/auth'
  import native from '$lib/modules/native'
  import { dragScroll } from '$lib/modules/navigate'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { breakpoints, cn, colors } from '$lib/utils'

  export let data: LayoutData

  $: anime = data.anime
  $: info = data.info
  $: media = $info.data?.Media ?? $anime.Media!

  $: trailerId = media.trailer?.id
  $: trailerMinutes = minutes(trailerId)
  $: count = episodes(media)
  $: trailerIsMedia = (count === 1 || !count) && media.duration && $trailerMinutes === media.duration
  let open = false

  $: bannerSrc.value = media
  hideBanner.value = false

  function share () {
    native.share({
      title: `Watch on Hayase - ${media.title?.romaji ?? ''}`,
      text: desc(media),
      url: `https://hayase.watch/anime/${media.id}`
    })
  }

  function handleScroll (e: Event) {
    const target = e.target as HTMLDivElement
    hideBanner.value = target.scrollTop > 100
  }

  const viewer = client.client.viewer

  $: followerEntries = ($viewer?.viewer?.id && $info.data?.following?.mediaList?.filter(e => e?.user?.id !== $viewer.viewer?.id)) || []

  $: nativeTitle = media.title?.native ?? media.title?.romaji ?? ''
  $: romajiTitle = media.title?.romaji ?? media.title?.native ?? ''

  $: ({ r, g, b } = colors(media.coverImage?.color ?? undefined))

  $: spoiler = $settings.hideSpoilers && ['CURRENT', 'PLANNING'].includes(list(media)!)
  $: underPoweredSpoiler = spoiler && SUPPORTS.isUnderPowered

  interface Tag {
    id?: number | null
    rank?: number | null
  }
  function sortTags (a?: Tag | null, b?: Tag | null) {
    if ((b?.rank ?? 0) > (a?.rank ?? 0)) return 1
    if ((b?.rank ?? 0) < (a?.rank ?? 0)) return -1
    return (a?.id ?? 0) - (b?.id ?? 0)
  }
</script>

<div class='min-w-0 -ml-14 pl-14 grow items-center flex flex-col h-full overflow-y-auto pb-10' use:dragScroll on:scroll={handleScroll} style:--custom={media.coverImage?.color ?? '#fff'} style:--red={r} style:--green={g} style:--blue={b}>
  <div class='gap-4 md:gap-6 w-full pt-4 md:pt-32 flex flex-col items-center justify-center max-w-[1600px] 2xs:px-3 xl:px-14'>
    <div class='flex flex-col md:flex-row w-full items-center md:items-end gap-5 pt-12'>
      <Dialog.Root portal='#root'>
        <Dialog.Trigger class='shrink-0 w-[180px] h-[256px] rounded overflow-hidden relative group focus-visible:ring-1 focus-visible:ring-ring select:scale-[1.02] transition-transform duration-200'>
          <div class='absolute flex-center size-full bg-background group-select:bg-opacity-50 bg-opacity-0 duration-300 text-foreground transition-all ease-out'>
            <Maximize2 class='size-10 scale-75 opacity-0 group-select:opacity-100 group-select:scale-100 duration-300 transition-all ease-out' />
          </div>
          <Load src={cover(media)} color={media.coverImage?.color} class='size-full object-cover' />
        </Dialog.Trigger>
        <Dialog.Content class='flex justify-center p-0 overflow-clip'>
          <Load src={cover(media)} color={media.coverImage?.color} class='size-full object-cover' />
        </Dialog.Content>
      </Dialog.Root>
      <div class='flex flex-col gap-4 items-center md:items-start justify-end w-full'>
        <div class='flex flex-col gap-1.5 text-center md:text-start w-full'>
          <h2 class='line-clamp-1 text-base md:text-lg font-light text-muted-foreground select-all'>{media.title?.romaji?.toLowerCase().trim() === title(media).toLowerCase().trim() ? nativeTitle : romajiTitle}</h2>
          <h1 class='font-black text-3xl md:text-4xl line-clamp-2 text-foreground select-all'>{title(media)}</h1>
          <div class='flex-wrap w-full justify-start md:pt-1 gap-2 hidden md:flex'>
            <div class='rounded px-3.5 font-bold bg-custom text-contrast'>
              {of(media) ?? duration(media) ?? 'N/A'}
            </div>
            <Button class='rounded px-3.5 font-bold bg-custom select:!bg-custom-600 text-contrast h-6 py-0 text-base' on:click={() => goto('/#/app/search', { state: { search: { format: [media.format] } } })}>
              {format(media)}
            </Button>
            <Button class='rounded px-3.5 font-bold bg-custom select:!bg-custom-600 text-contrast h-6 py-0 text-base' on:click={() => goto('/#/app/search', { state: { search: { status: [media.status] } } })}>
              {status(media)}
            </Button>
            {#if season(media)}
              <Button class='rounded px-3.5 font-bold bg-custom select:!bg-custom-600 text-contrast h-6 py-0 text-base capitalize' on:click={() => goto('/#/app/search', { state: { search: { season: media.season, seasonYear: media.seasonYear } } })}>
                {season(media)}
              </Button>
            {/if}
            {#if media.averageScore && !underPoweredSpoiler}
              <Button class={cn('rounded px-3.5 font-bold text-contrast h-6 py-0 text-base', getBGColorForRating(spoiler ? 100 : media.averageScore))} on:click={() => goto('/#/app/search', { state: { search: { sort: ['SCORE_DESC'] } } })}>
                <span class={cn(spoiler && 'blur-[3px]')}>
                  {spoiler ? 50 : media.averageScore}%
                </span>
              </Button>
            {/if}
          </div>
          <div class='md:block hidden relative pb-6 md:pt-2 md:pb-0'>
            <div class='line-clamp-4 md:text-start text-center text-sm md:text-md leading-2 font-light antialiased whitespace-pre-wrap text-muted-foreground'>{desc(media)}</div>
          </div>
        </div>
      </div>
    </div>
    <div class='flex gap-2 items-center justify-center md:justify-start md:self-start w-full overflow-x-clip [&>*]:flex-shrink-0'>
      <div class='flex md:mr-3 w-full min-[380px]:w-[180px] !shrink'>
        <PlayButton size='default' {media} class='rounded-r-none w-full bg-custom select:!bg-custom-600 text-contrast' />
        {#key media}
          <EntryEditor {media} />
        {/key}
      </div>
      <FavoriteButton {media} variant='secondary' size='icon' class='min-[380px]:-order-1 md:order-none select:!text-custom' />
      <BookmarkButton {media} variant='secondary' size='icon' class='min-[380px]:-order-2 md:order-none select:!text-custom' />
      <TransitionButton size='icon' variant='secondary' on:click={share} class='hidden min-[380px]:flex select:!text-custom'>
        <div slot='base'>
          <Share2 class='size-4' />
        </div>
        <div slot='transition'>
          <Check class='size-4' />
        </div>
      </TransitionButton>
      {#if trailerId}
        <Dialog.Root portal='#root' bind:open>
          <Dialog.Trigger let:builder asChild>
            {#if trailerIsMedia}
              <Tooltip.Root open={true}>
                <Tooltip.Trigger let:builder={builder2} tabindex={-1}>
                  <Button builders={[builder, builder2]} size='icon' variant='secondary' class='hidden min-[380px]:flex select:!text-custom animated-icon'>
                    <Clapperboard class='size-4' />
                  </Button>
                </Tooltip.Trigger>
                <Tooltip.Content side='bottom' align={$breakpoints.md ? 'start' : 'end'} class='hidden min-[380px]:flex bg-transparent items-center p-0 backdrop-fade-[1.5px] md:pe-4 md:ps-0 ps-4 text-center flex-row-reverse md:flex-row'>
                  <SquiggleArrow class='h-14 w-20 rotate-[230deg] md:rotate-[130deg] md:me-2 md:ms-0 ms-2 -scale-x-100 md:scale-x-100' />
                  <span class='text-foreground text-base font-excalifont rotate-3 md:-rotate-3'>Also available<br />on YouTube!</span>
                </Tooltip.Content>
              </Tooltip.Root>
            {:else}
              <Button size='icon' variant='secondary' class='hidden min-[380px]:flex select:!text-custom animated-icon' builders={[builder]}>
                <Clapperboard class='size-4' />
              </Button>
            {/if}
          </Dialog.Trigger>
          <Dialog.Content class='flex justify-center max-h-[80%] h-full max-w-max'>
            <iframe credentialless class='h-full max-w-full aspect-video max-h-full rounded' src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&cc_lang_pref=ja&rel=0`} frameborder='0' allow='autoplay' allowfullscreen title={media.title?.userPreferred ?? ''} />
          </Dialog.Content>
        </Dialog.Root>
      {/if}
      <Button size='icon' variant='secondary' class='hidden md:flex' on:click={() => native.openURL(`https://anilist.co/anime/${media.id}`)}>
        <Anilist class='size-4' />
      </Button>
      {#if media.idMal}
        <Button size='icon' variant='secondary' class='hidden md:flex' on:click={() => native.openURL(`https://myanimelist.net/anime/${media.idMal}`)}>
          <MyAnimeList class='size-4 flex-center' />
        </Button>
      {/if}
      <!-- <Button size='icon' variant='secondary' disabled>
        <Bell class='size-4' />
      </Button> -->
      <div class='-space-x-1 md:ml-3 hidden md:flex'>
        {#each followerEntries as followerEntry, i (followerEntry?.user?.id ?? i)}
          {#if followerEntry?.user}
            <Profile user={followerEntry.user} />
          {/if}
        {/each}
      </div>
    </div>
    <div class='flex gap-2 items-center justify-start self-start w-full overflow-x-auto' use:dragScroll>
      {#each media.genres ?? [] as genre (genre)}
        <Button variant='secondary' class='select:!text-custom h-7 text-nowrap' on:click={() => goto('/#/app/search', { state: { search: { genre: [genre] } } })}>
          {genre}
        </Button>
      {/each}
      {#each media.tags?.sort(sortTags) ?? [] as tag, i (tag?.id ?? i)}
        {@const spoiler = !!tag?.isMediaSpoiler || !!tag?.isGeneralSpoiler}
        {@const underPoweredSpoiler = spoiler && SUPPORTS.isUnderPowered}
        {@const hide = tag?.isAdult && !$settings.showHentai}
        {#if !hide && tag}
          <Button variant='secondary' class={cn(
            'select:!text-custom h-7 text-nowrap bg-secondary/40 text-muted-foreground shadow-sm border-2 border-dashed border-secondary',
            underPoweredSpoiler && 'text-transparent select:text-muted-foreground'
          )} on:click={() => goto('/#/app/search', { state: { search: { tag: [tag.name] } } })}>
            <span class={cn(spoiler && !underPoweredSpoiler && 'blur-[6px] select:blur-0 transition-[filter]')}>
              {tag.name}
            </span>
          </Button>
        {/if}
      {/each}
    </div>
    <slot />
  </div>
</div>
