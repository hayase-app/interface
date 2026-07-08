<script lang='ts'>
  import Play from 'lucide-svelte/icons/play'
  import Star from 'lucide-svelte/icons/star'

  import Pagination from './Pagination.svelte'
  import { ChevronLeft, ChevronRight } from './icons/animated'
  import { Button } from './ui/button'
  import { Load } from './ui/img'
  import { playEp } from './ui/player/mediahandler.svelte'
  import { Profile } from './ui/profile'

  import type { EpisodesResponse } from '$lib/modules/anizip/types'

  import Logo from '$lib/components/icons/Logo.svelte'
  import { episodes as _episodes, client, notes, type Media } from '$lib/modules/anilist'
  import { list, progress } from '$lib/modules/auth'
  import { makeEpisodeList } from '$lib/modules/extensions'
  import { click, dragScroll } from '$lib/modules/navigate'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { liveAnimeProgress } from '$lib/modules/watchProgress'
  import { breakpoints, cn, since } from '$lib/utils'

  let classList = ''
  export { classList as class }

  export let eps: EpisodesResponse | null
  export let media: Media

  $: episodeCount = _episodes(media, eps)

  $: episodeList = media && makeEpisodeList(media, eps)

  const perPage = 16

  function getPage (page: number, list = episodeList) {
    return list.slice((page - 1) * perPage, page * perPage)
  }

  $: status = list(media)
  $: progressStore = progress(media)

  $: completed = $status === 'COMPLETED'
  $: rewatching = $status === 'REPEATING'
  $: _progress = completed ? 0 : $progressStore ?? 0

  $: currentPage = Math.floor((!completed ? _progress : 0) / perPage) + 1

  function play (episode: number) {
    $playEp(media, episode)
  }

  export let following = client.following(media.id)

  const viewer = client.client.viewer

  $: followerEntries = ($viewer?.viewer?.id && $following?.data?.following?.mediaList?.filter(e => e?.user?.id !== $viewer.viewer?.id)) || []

  $: watchProgress = liveAnimeProgress(media.id)
</script>

<Pagination count={episodeCount} {perPage} bind:currentPage let:pages let:hasNext let:hasPrev let:range let:setPage siblingCount={1}>
  <div class={cn('overflow-y-auto pt-3 -ml-14 pl-14 -mr-3 pr-3 -mb-3 pb-3', classList)} use:dragScroll>
    <div class='grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(500px,1fr))] place-items-center gap-x-4 gap-y-7 justify-center align-middle'>
      {#each getPage(currentPage, episodeList) as { episode, image, title, summary, airingAt, airdate, filler, length, rating, runtime } (episode)}
        {@const watched = _progress >= episode && !completed}
        {@const target = _progress + 1 === episode}
        {@const spoiler = !watched && !completed && !rewatching && !target && $settings.hideSpoilers}
        {@const underPoweredSpoiler = spoiler && SUPPORTS.isUnderPowered}
        <div class={!target ? 'px-3 w-full' : 'contents'}>
          <div use:click={() => play(episode)}
            class={cn(
              'select:scale-[1.05] select:shadow-lg scale-100 transition-[transform,box-shadow] duration-200 shrink-0 ease-out focus-visible:ring-ring focus-visible:ring-1 rounded-md bg-muted text-secondary-foreground select:bg-accent flex w-full max-h-28 cursor-pointer relative overflow-hidden group',
              target && 'ring-custom ring-1',
              filler && '!ring-yellow-400 ring-1'
            )}>
            {#if image}
              <div class='max-w-52 w-1/2 shrink-0 relative overflow-clip'>
                <div class={cn('size-full', watched && 'opacity-20')}>
                  {#if !underPoweredSpoiler}
                    <Load src={image} class={cn('object-cover size-full', spoiler && 'blur-[6px]')} />
                  {/if}
                </div>
                {#if underPoweredSpoiler}
                  <Logo class='absolute size-8 text-muted-foreground inset-0 m-auto' />
                {/if}
                {#if length ?? runtime ?? media.duration}
                  <div class='absolute bottom-1 left-1 bg-accent/80 text-secondary-foreground text-[9.6px] px-1 py-0.5 rounded'>
                    {length ?? runtime ?? media.duration}m
                  </div>
                {/if}
                {#if rating && !underPoweredSpoiler}
                  <div class={cn('absolute bottom-1 right-1 bg-accent/80 text-secondary-foreground text-[9.6px] px-1 py-0.5 rounded flex', spoiler && 'blur-[3px]')}>
                    <Star class='size-2.5 mt-0.5 mr-1 text-yellow-400' fill='currentColor' />
                    {spoiler ? '5.00' : rating}
                  </div>
                {/if}
                <div class='absolute flex items-center justify-center size-full bg-background group-select:bg-opacity-50 bg-opacity-0 duration-200 text-foreground transition-[background] ease-out top-0'>
                  <Play class='size-6 scale-75 opacity-0 group-select:opacity-100 group-select:scale-100 duration-200 transition-[transform,opacity] ease-out' fill='currentColor' />
                </div>
              </div>
            {/if}
            <div class='flex-grow py-3 px-4 flex flex-col'>
              <div class='font-bold mb-2 line-clamp-1 shrink-0 text-[12.8px]'>
                {episode}. {title?.en ?? 'Episode ' + episode}
              </div>
              {#if watched || completed}
                <div class='mb-2 h-0.5 overflow-hidden w-full bg-custom shrink-0' />
              {:else if $watchProgress?.episode === episode}
                <div class='w-full bg-accent mb-2'>
                  <div class='h-0.5 overflow-hidden bg-custom shrink-0' style:width={$watchProgress.progress + '%'} />
                </div>
              {/if}
              <div class='text-[9.6px] text-muted-foreground overflow-hidden {spoiler && !underPoweredSpoiler && 'blur-[6px]'}'>
                {#if underPoweredSpoiler}
                  <div class='flex flex-col gap-2 pt-1'>
                    <div class='bg-primary/5 size-full rounded h-1.5 w-60' />
                    <div class='bg-primary/5 size-full rounded h-1.5 w-48' />
                    <div class='bg-primary/5 size-full rounded h-1.5 w-24' />
                  </div>
                {:else}
                  {notes(summary ?? '')}
                {/if}
              </div>
              <div class='flex w-full justify-between mt-auto'>
                {#if airingAt ?? airdate}
                  <div class='text-[9.6px] pt-2'>
                    {since(new Date(airingAt ?? airdate ?? 0))}
                  </div>
                {/if}
                <div class='-space-x-1 ml-auto inline-flex pt-1 pr-0.5'>
                  {#each followerEntries.filter(e => e?.progress === episode) as followerEntry, i (followerEntry?.user?.id ?? i)}
                    {#if followerEntry?.user}
                      <Profile user={followerEntry.user} class='ring-2 ring-muted size-4 bg-background' />
                    {/if}
                  {/each}
                </div>
              </div>
              {#if filler}
                <div class='rounded-tl bg-yellow-400 py-1 px-2 text-primary-foreground absolute bottom-0 right-0 text-[9.6px] font-bold'>Filler</div>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  </div>
  <div class='flex flex-row items-center justify-between w-full py-3'>
    <p class='text-center text-[13px] text-muted-foreground hidden md:block'>
      Showing <span class='font-bold'>{range.start + 1}</span> to <span class='font-bold'>{range.end}</span> of <span class='font-bold'>{episodeCount}</span> episodes
    </p>
    <div class='w-full md:w-auto gap-2 flex items-center'>
      <Button size={$breakpoints.xs ? 'icon' : 'icon-sm'} variant='ghost' class='animated-icon flex-shrink-0' on:click={() => setPage(currentPage - 1)} disabled={!hasPrev}>
        <ChevronLeft class='size-4' />
      </Button>
      <!-- {#if $breakpoints.md} -->
      <div class='w-full flex gap-2 justify-center'>
        {#each pages as { page, type } (page)}
          {#if type === 'ellipsis'}
            <span class='{$breakpoints.xs ? 'size-9' : 'size-[1.6rem]'} text-center'>...</span>
          {:else}
            <Button size={$breakpoints.xs ? 'icon' : 'icon-sm'} variant={page === currentPage ? 'outline' : 'ghost'} on:click={() => setPage(page)}>
              {page}
            </Button>
          {/if}
        {/each}
      </div>
      <!-- {:else}
        <p class='text-center text-[13px] text-muted-foreground w-full block md:hidden'>
          Showing <span class='font-bold'>{range.start + 1}</span> to <span class='font-bold'>{range.end}</span> of <span class='font-bold'>{episodeCount}</span> episodes
        </p>
      {/if} -->
      <Button size={$breakpoints.xs ? 'icon' : 'icon-sm'} variant='ghost' class='animated-icon flex-shrink-0' on:click={() => setPage(currentPage + 1)} disabled={!hasNext}>
        <ChevronRight class='size-4' />
      </Button>
    </div>
  </div>
  <p class='text-center text-[13px] text-muted-foreground md:hidden block pt-2'>
    Showing <span class='font-bold'>{range.start + 1}</span> to <span class='font-bold'>{range.end}</span> of <span class='font-bold'>{episodeCount}</span> episodes
  </p>
</Pagination>
