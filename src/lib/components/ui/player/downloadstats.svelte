<script lang='ts'>
  import ChevronDown from 'lucide-svelte/icons/chevron-down'
  import ChevronUp from 'lucide-svelte/icons/chevron-up'
  import Users from 'lucide-svelte/icons/users'

  import { settings } from '$lib/modules/settings'
  import { server } from '$lib/modules/torrent'
  import { fastPrettyBits } from '$lib/utils'

  const torrentstats = server.stats

  export let immersed: boolean
</script>

{#if !$settings.minimalPlayerUI}
  <div class='absolute top-0 flex w-full pointer-events-none justify-center gap-4 pt-3 items-center font-bold text-lg transition-opacity gradient-to-bottom delay-150 text-shadow-lg' class:opacity-0={immersed}>
    <div class='flex justify-center items-center gap-2'>
      <Users size={18} class='drop-shadow' />
      {$torrentstats.peers.seeders}
    </div>
    <div class='flex justify-center items-center gap-2'>
      <ChevronDown size={18} class='drop-shadow' />
      {fastPrettyBits($torrentstats.speed.down * 8)}/s
    </div>
    <div class='flex justify-center items-center gap-2'>
      <ChevronUp size={18} class='drop-shadow' />
      {fastPrettyBits($torrentstats.speed.up * 8)}/s
    </div>
  </div>
{/if}
