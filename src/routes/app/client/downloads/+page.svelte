<script lang='ts'>
  import HoldToConfirm from '#lib/components/ui/button/hold-to-confirm.svelte'
  import { TorrentsTable } from '#lib/components/ui/torrentclient'
  import { settings } from '#lib/modules/settings'

  const warnings = [
    'High CPU and memory usage. This can cause lag on lower-end devices.',
    'High network and bandwidth usage. This can slow down your connection.',
    'Torrents keep downloading in the background until you remove them.'
  ]
</script>

{#if $settings.backgroundDownloads}
  <TorrentsTable />
{:else}
  <div class='p-5 flex flex-col gap-4'>
    <h3 class='text-lg font-bold'>Enabling Background Downloads</h3>
    <ul class='list-disc space-y-1 pl-5 text-sm text-muted-foreground'>
      {#each warnings as warning (warning)}
        <li>{warning}</li>
      {/each}
    </ul>
    <HoldToConfirm
      label='I understand and wish to proceed'
      hint='Hold to accept'
      onconfirm={() => { $settings.backgroundDownloads = true }} />
  </div>
{/if}
