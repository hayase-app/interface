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
  import { episodes as _episodes, notes, type Media } from '$lib/modules/anilist'
  import { authAggregator, list, progress } from '$lib/modules/auth'
  import { makeEpisodeList } from '$lib/modules/extensions'
  import { click, dragScroll } from '$lib/modules/navigate'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { liveAnimeProgress } from '$lib/modules/watchProgress'
  import { breakpoints, cn, since } from '$lib/utils'

  export let eps: EpisodesResponse | null
  export let media: Media

  $: episodeCount = _episodes(media) ?? eps?.episodeCount ?? 0

  $: episodeList = media && makeEpisodeList(media, eps)

  const perPage = 16

  function getPage (page: number, list = episodeList) {
    return list.slice((page - 1) * perPage, page * perPage)
  }

  $: completed = list(media) === 'COMPLETED'
  $: _progress = completed ? 0 : progress(media) ?? 0

  $: currentPage = Math.floor((!completed ? _progress : 0) / perPage) + 1

  function play (episode: number) {
    $playEp(media, episode)
  }

  export let following = authAggregator.following(media.id)

  $: followerEntries = $following?.data?.Page?.mediaList?.filter(e => e?.user?.id !== authAggregator.id()) ?? []

  $: watchProgress = liveAnimeProgress(media.id)
</script>

<Pagination count={episodeCount} {perPage} bind:currentPage let:pages let:hasNext let:hasPrev let:range let:setPage siblingCount={1}>
  <div class='overflow-y-auto pt-3 -ml-14 pl-14 -mr-3 pr-3 pointer-events-none -mb-3 pb-3' use:dragScroll>
    <div class='grid grid-cols-1 sm:grid-cols-[repeat(auto-fit,minmax(500px,1fr))] place-items-center gap-x-4 gap-y-7 justify-center align-middle pointer-events-auto'>
      {#each getPage(currentPage, episodeList) as { episode, image, title, summary, airingAt, airdate, filler, length, rating, runtime } (episode)}
        {@const watched = _progress >= episode && !completed}
        {@const target = _progress + 1 === episode}
        {@const spoiler = !watched && !target && $settings.hideSpoilers}
        <div class={!target ? 'px-3 w-full' : 'contents'}>
          <div use:click={() => play(episode)}
            class={cn(
              'select:scale-[1.05] select:shadow-lg scale-100 transition-[transform,box-shadow] duration-200 shrink-0 ease-out focus-visible:ring-ring focus-visible:ring-1 rounded-md bg-neutral-950 text-secondary-foreground select:bg-neutral-900 flex w-full max-h-28 cursor-pointer relative overflow-hidden group',
              target && 'ring-custom ring-1',
              filler && '!ring-yellow-400 ring-1'
            )}>
            {#if image}
              <div class='w-52 shrink-0 relative overflow-clip'>
                <Load src={image} class={cn('object-cover h-full w-full', watched && 'opacity-20', spoiler && (SUPPORTS.isUnderPowered ? 'hidden' : 'blur-[6px]'))} />
                {#if spoiler && SUPPORTS.isUnderPowered}
                  <Logo class='absolute size-8 text-neutral-600 inset-0 m-auto' />
                {/if}
                {#if length ?? runtime ?? media.duration}
                  <div class='absolute bottom-1 left-1 bg-neutral-900/80 text-secondary-foreground text-[9.6px] px-1 py-0.5 rounded'>
                    {length ?? runtime ?? media.duration}m
                  </div>
                {/if}
                {#if rating}
                  <div class='absolute bottom-1 right-1 bg-neutral-900/80 text-secondary-foreground text-[9.6px] px-1 py-0.5 rounded flex'>
                    <Star class='size-2.5 mt-0.5 mr-1 text-yellow-400' fill='currentColor' />
                    {rating}
                  </div>
                {/if}
                <div class='absolute flex items-center justify-center w-full h-full bg-black group-select:bg-opacity-50 bg-opacity-0 duration-200 text-white transition-[background] ease-out top-0'>
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
                <div class='w-full bg-neutral-800 mb-2'>
                  <div class='h-0.5 overflow-hidden bg-custom shrink-0' style:width={$watchProgress.progress + '%'} />
                </div>
              {/if}
              <div class='text-[9.6px] text-muted-foreground overflow-hidden {spoiler && !SUPPORTS.isUnderPowered && 'blur-[6px]'}'>
                {#if spoiler && SUPPORTS.isUnderPowered}
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
                      <Profile user={followerEntry.user} class='ring-2 ring-neutral-950 size-4 bg-neutral-950' />
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
      <Button size='icon' variant='ghost' class='animated-icon' on:click={() => setPage(currentPage - 1)} disabled={!hasPrev}>
        <ChevronLeft class='size-4' />
      </Button>
      {#if $breakpoints.md}
        {#each pages as { page, type } (page)}
          {#if type === 'ellipsis'}
            <span class='h-9 w-9 text-center'>...</span>
          {:else}
            <Button size='icon' variant={page === currentPage ? 'outline' : 'ghost'} on:click={() => setPage(page)}>
              {page}
            </Button>
          {/if}
        {/each}
      {:else}
        <p class='text-center text-[13px] text-muted-foreground w-full block md:hidden'>
          Showing <span class='font-bold'>{range.start + 1}</span> to <span class='font-bold'>{range.end}</span> of <span class='font-bold'>{episodeCount}</span> episodes
        </p>
      {/if}
      <Button size='icon' variant='ghost' class='animated-icon' on:click={() => setPage(currentPage + 1)} disabled={!hasNext}>
        <ChevronRight class='size-4' />
      </Button>
    </div>
  </div>
</Pagination>
