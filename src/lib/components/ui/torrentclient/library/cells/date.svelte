<script lang='ts'>
  import ClockFading from '@lucide/svelte/icons/clock-fading'

  import * as Tooltip from '#lib/components/ui/tooltip'
  import { cn } from '#lib/utils'

  export let value: number

  const day = 24 * 60 * 60 * 1000 // milliseconds in a day

  $: date = new Date(value)

  $: moreThan30Days = date.getTime() < Date.now() - 30 * day
  $: moreThan21Days = date.getTime() < Date.now() - 21 * day
</script>

{#if moreThan30Days || moreThan21Days}
  <Tooltip.Root>
    <Tooltip.Trigger class={cn('text-sm flex items-center gap-1', moreThan30Days && '!text-red-400', moreThan21Days && 'text-yellow-200')}>
      <ClockFading class='w-4 h-4' />{value ? date.toLocaleDateString() : '?'}
    </Tooltip.Trigger>
    <Tooltip.Content class='whitespace-pre-wrap'>
      {moreThan30Days ? 'Played more than 30 days ago.\nCached metadata might have expired.\nPlay this torrent again to refresh.' : 'Played more than 21 days ago.\nCached metadata might soon expire.'}
    </Tooltip.Content>
  </Tooltip.Root>
{:else}
  <div class={cn('text-sm', moreThan30Days && '!text-red-400', moreThan21Days && 'text-yellow-200')}>{value ? date.toLocaleDateString() : '?'}</div>
{/if}
