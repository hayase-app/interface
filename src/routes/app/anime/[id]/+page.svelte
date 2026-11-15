<script lang='ts'>
  import { SvelteFlowProvider } from '@xyflow/svelte'

  import type { PageData } from './$types'

  import EpisodesList from '#lib/components/EpisodesList.svelte'
  import Recommendation from '#lib/components/ui/cards/recommendation.svelte'
  import { Threads } from '#lib/components/ui/forums'
  import { Relations } from '#lib/components/ui/relations'
  import * as Tabs from '#lib/components/ui/tabs'
  import { Themes } from '#lib/components/ui/themes'
  import '@xyflow/svelte/dist/style.css'
  import { dragScroll } from '#lib/modules/navigate'
  import { cn } from '#lib/utils'

  export let data: PageData

  $: anime = data.anime

  $: info = data.info

  $: media = $info.data?.Media ?? $anime.Media!

  let expanded = false

  $: mediaId = media.id

  $: eps = data.eps

  let value: string
</script>

<Tabs.Root bind:value class='w-full' activateOnFocus={false} orientation='horizontal'>
  <div class='flex justify-start overflow-x-auto' use:dragScroll>
    <Tabs.List orientation='horizontal'>
      <Tabs.Trigger value='episodes' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Episodes</Tabs.Trigger>
      <Tabs.Trigger value='relations' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Relations</Tabs.Trigger>
      <Tabs.Trigger value='threads' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Threads</Tabs.Trigger>
      <Tabs.Trigger value='themes' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Themes</Tabs.Trigger>
      <Tabs.Trigger value='recommendations' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Recommendations</Tabs.Trigger>
    </Tabs.List>
  </div>
  <Tabs.Content value='episodes' tabindex={-1}>
    <EpisodesList {media} {eps} following={info} class='overflow-y-visible' />
  </Tabs.Content>
  <Tabs.Content value='relations' tabindex={-1}>
    {#if value === 'relations'}
      <div class={cn('border border-border rounded overflow-clip mt-3 transition-[height]', expanded ? 'h-[80vh]' : 'h-72')}>
        <SvelteFlowProvider>
          <Relations {media} bind:expanded />
        </SvelteFlowProvider>
      </div>
    {/if}
  </Tabs.Content>
  <Tabs.Content value='threads' tabindex={-1}>
    {#key mediaId}
      {#if value === 'threads'}
        <Threads {media} initial={info} />
      {/if}
    {/key}
  </Tabs.Content>
  <Tabs.Content value='themes' tabindex={-1}>
    {#key mediaId}
      {#if value === 'themes'}
        <Themes {media} />
      {/if}
    {/key}
  </Tabs.Content>
  <Tabs.Content value='recommendations' tabindex={-1}>
    {#key mediaId}
      {#if value === 'recommendations'}
        <div class='pointer-events-auto grid justify-center grid-cols-[repeat(auto-fill,minmax(184px,max-content))]'>
          <Recommendation query={info} />
        </div>
      {/if}
    {/key}
  </Tabs.Content>
</Tabs.Root>
