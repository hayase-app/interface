<script lang='ts'>
  import { getContext } from 'svelte'

  import type { MediaInfo } from './util'

  import { beforeNavigate, goto } from '$app/navigation'
  import EpisodesList from '$lib/components/EpisodesList.svelte'
  import * as Sheet from '$lib/components/ui/sheet'
  import { client, episodes } from '$lib/modules/anilist'
  import { episodes as eps } from '$lib/modules/anizip'
  import { click } from '$lib/modules/navigate'

  export let portal: HTMLElement
  let episodeListOpen = false

  export let mediaInfo: MediaInfo

  const stopProgressBar = getContext<() => void>('stop-progress-bar')
  beforeNavigate(({ cancel }) => {
    if (episodeListOpen) {
      episodeListOpen = false
      cancel()
      stopProgressBar()
    }
  })
</script>

<div class='text-white text-lg font-normal leading-none line-clamp-1 hover:text-neutral-300 hover:underline cursor-pointer text-shadow-lg' use:click={() => goto(`/app/anime/${mediaInfo.media.id}`)}>{mediaInfo.session.title}</div>
<Sheet.Root {portal} bind:open={episodeListOpen}>
  <Sheet.Trigger id='episode-list-button' data-down='#player-seekbar' class='text-[rgba(217,217,217,0.6)] hover:text-neutral-500 text-sm leading-none font-light line-clamp-1 text-left hover:underline bg-transparent text-shadow-lg'>{mediaInfo.session.description} / {episodes(mediaInfo.media)}</Sheet.Trigger>
  <Sheet.Content class='w-full sm:w-[550px] p-3 sm:p-6 max-w-full sm:max-w-full h-full overflow-y-scroll flex flex-col !pb-0 shrink-0 gap-0 bg-black justify-between overflow-x-clip'>
    <div class='contents' on:wheel|stopPropagation>
      {#if mediaInfo.media}
        {#await Promise.all([eps(mediaInfo.media.id), client.single(mediaInfo.media.id)]) then [eps, media]}
          {#if media.data?.Media}
            <EpisodesList {eps} media={media.data.Media} />
          {/if}
        {/await}
      {/if}
    </div>
  </Sheet.Content>
</Sheet.Root>
