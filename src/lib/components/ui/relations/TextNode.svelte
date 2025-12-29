<script lang='ts'>
  import { Handle, Position } from '@xyflow/svelte'

  import { format, status, type RelationTreeMedia } from '$lib/modules/anilist'
  import { cn } from '$lib/utils'

  export let data: { media: RelationTreeMedia, id: number, current?: boolean }
  export let targetPosition: Position = Position.Left
  export let sourcePosition: Position = Position.Right

  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  $$restProps
</script>

<a class={cn('node w-[150px] text-xs text-center border bg-[#111] rounded-sm cursor-pointer block font-semibold transition-colors overflow-clip', data.current ? 'border-custom text-custom' : 'border-[#111] text-white')} href='/app/anime/{data.id}'>
  <div class='relative'>
    <Handle type='target' position={targetPosition} />
    {#if data.media}
      {@const media = data.media}
      {@const episodes = media.episodes}
      <div class='font-bold p-2.5 pb-2 bg-[#1e1e1e]'>
        {media.title?.userPreferred ?? 'TBA'}
      </div>
      <div class='flex justify-between text-[8.5px] leading-none px-2 py-1.5'>
        <div>
          {format(media)}
        </div>
        <div>
          {#if episodes}
            {episodes} Episodes
          {:else}
            {status(media)}
          {/if}
        </div>
      </div>
    {/if}
    <Handle type='source' position={sourcePosition} />
  </div>
</a>

<style>
  .node {
    --xy-handle-background-color: none;
    --xy-handle-border-color: none;
  }
</style>
