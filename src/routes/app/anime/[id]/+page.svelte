<script lang='ts'>
  import { SvelteFlowProvider } from '@xyflow/svelte'

  import type { PageData } from './$types'

  import EpisodesList from '$lib/components/EpisodesList.svelte'
  import { Threads } from '$lib/components/ui/forums'
  import { Relations } from '$lib/components/ui/relations'
  import * as Tabs from '$lib/components/ui/tabs'
  import { Themes } from '$lib/components/ui/themes'
  import { authAggregator } from '$lib/modules/auth'
  import '@xyflow/svelte/dist/style.css'
  import { breakpoints, cn } from '$lib/utils'

  export let data: PageData

  $: anime = data.anime

  $: media = $anime.Media!

  let expanded = false

  $: mediaId = media.id
  $: following = authAggregator.following(mediaId)

  $: eps = data.eps

  let value: string
</script>

<Tabs.Root bind:value class='w-full' activateOnFocus={false} orientation={$breakpoints.xs ? 'horizontal' : 'vertical'}>
  <div class='flex justify-center md:justify-start'>
    <Tabs.List orientation={$breakpoints.xs ? 'horizontal' : 'vertical'}>
      <Tabs.Trigger value='episodes' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Episodes</Tabs.Trigger>
      <Tabs.Trigger value='relations' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Relations</Tabs.Trigger>
      <Tabs.Trigger value='threads' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Threads</Tabs.Trigger>
      <Tabs.Trigger value='themes' tabindex={0} class='px-8 data-[state=active]:bg-custom data-[state=active]:text-contrast data-[state=active]:font-bold'>Themes</Tabs.Trigger>
    </Tabs.List>
  </div>
  <Tabs.Content value='episodes' tabindex={-1}>
    <EpisodesList {media} {eps} {following} />
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
        <Threads {media} />
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
</Tabs.Root>
