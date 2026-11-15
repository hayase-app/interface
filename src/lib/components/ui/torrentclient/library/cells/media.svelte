<script lang='ts'>
  import { client } from '#lib/modules/anilist'

  export let mediaID: number
  export let episode: number | undefined
  export let name: string

  $: query = client.singleCard(mediaID)
</script>

{#if $query.fetching && !$query.data}
  <div class='flex items-center gap-3 min-w-0 w-full'>
    <div class='h-12 w-8 shrink-0 rounded bg-muted animate-pulse' />
    <div class='flex flex-col gap-1.5 min-w-0'>
      <div class='h-3.5 w-40 max-w-full bg-muted animate-pulse rounded' />
      <div class='h-3 w-24 bg-muted animate-pulse rounded' />
    </div>
  </div>
{:else if $query.data?.Media}
  <div class='flex items-center gap-3 min-w-0 w-full'>
    {#if $query.data.Media.coverImage?.medium}
      <img src={$query.data.Media.coverImage.medium} alt='' class='h-12 w-8 shrink-0 rounded object-cover' decoding='async' loading='lazy' />
    {/if}
    <div class='min-w-0'>
      <div class='truncate font-medium'>{$query.data.Media.title?.userPreferred ?? 'TBA'}</div>
      <div class='text-xs text-muted-foreground'>Episode {episode ?? '?'}</div>
      <div class='truncate text-xs text-muted-foreground/70' title={name}>{name}</div>
    </div>
  </div>
{:else}
  <div class='font-mono text-xs text-wrap break-all' title={name}>{name}</div>
{/if}
