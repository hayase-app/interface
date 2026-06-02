<script lang='ts'>
  import type { ExtensionConfig } from '$lib/modules/extensions'

  import { MANIFEST_VERSION } from '$lib/modules/extensions'
  import { codeToEmoji } from '$lib/utils'

  export let config: ExtensionConfig

  const typeMap: Record<string, string> = {
    nzb: 'NZB',
    torrent: 'Torrent',
    subtitle: 'Subtitle'
  }
</script>

<div class='bg-neutral-950 px-4 py-3 rounded-md flex flex-row space-x-3 justify-between w-full'>
  <div class='flex flex-col space-y-3 flex-1 min-w-0'>
    <div class='flex flex-row space-x-3'>
      <img src={config.icon} alt='ico' class='size-10 rounded-md bg-neutral-900 shrink-0' loading='lazy' decoding='async' />
      <div class='flex flex-col min-w-0'>
        <div class='flex flex-row items-center gap-1 min-w-0'>
          <slot name='leading' />
          <div class='text-md font-bold truncate min-w-0'>{config.name}</div>
        </div>
        <div class='text-xs text-muted-foreground truncate'>{config.id}</div>
      </div>
    </div>
    {#if config.description}
      <div class='text-sm text-muted-foreground line-clamp-2'>{config.description}</div>
    {/if}
    <div class='flex-wrap-balance w-full justify-start gap-2 flex text-neutral-300 text-sm'>
      <div class='rounded px-3 py-0.5 font-bold bg-neutral-900 leading-snug text-nowrap'>{config.version}</div>
      <div class='rounded px-3 py-0.5 font-bold bg-neutral-900 leading-snug text-nowrap'>{typeMap[config.type] ?? config.type}</div>
      <div class='rounded px-3 py-0.5 font-bold bg-neutral-900 leading-snug text-nowrap capitalize'>{config.accuracy} Accuracy</div>
      {#if config.deprecated}
        <div class='rounded px-3 py-0.5 font-bold bg-yellow-800 leading-snug text-nowrap'>Deprecated</div>
      {:else if config.manifestVersion !== MANIFEST_VERSION}
        <div class='rounded px-3 py-0.5 font-bold bg-red-900 leading-snug text-nowrap'>Outdated</div>
      {/if}
      {#if config.ratio}
        <div class='rounded px-3 py-0.5 font-bold bg-neutral-900 leading-snug text-nowrap'>{config.ratio} Ratio</div>
      {/if}
      <div class='rounded px-3 py-0.5 font-bold bg-neutral-900 leading-snug text-nowrap capitalize'>{config.media}</div>
      {#if config.languages}
        <div class='font-twemoji text-xl leading-none content-center line-clamp-1'>
          {#each config.languages as lang, i (i)}
            {codeToEmoji(lang)}
          {/each}
        </div>
      {/if}
    </div>
  </div>
  {#if $$slots.actions}
    <slot name='actions' />
  {/if}
</div>
