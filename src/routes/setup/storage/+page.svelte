<script lang='ts'>
  import { toast } from 'svelte-sonner'

  import Footer, { type Checks } from '../Footer.svelte'
  import Progress from '../Progress.svelte'

  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import { SingleCombo } from '$lib/components/ui/combobox'
  import { Input } from '$lib/components/ui/input'
  import { Switch } from '$lib/components/ui/switch'
  import native from '$lib/modules/native'
  import { dragScroll } from '$lib/modules/navigate'
  import { SUPPORTS, settings } from '$lib/modules/settings'
  import { fastPrettyBytes } from '$lib/utils'

  async function selectDownloadFolder (type?: string) {
    try {
      $settings.torrentPath = await native.selectDownload(type as 'cache' | 'internal' | 'sdcard' | undefined)
    } catch (error) {
      toast.error('Failed to select download folder. Please try again.', {
        description: error instanceof Error ? error.message : 'Unknown error occurred.'
      })
    }
  }

  const androidDirectories = {
    cache: 'Cache',
    internal: 'Internal Storage',
    sdcard: 'SD Card'
  } as const

  async function checkSpaceRequirements (_path: string): Checks['promise'] {
    const space = await native.checkAvailableSpace()
    if (space < 1e9) return { status: 'error', text: `${fastPrettyBytes(space)} available, 1GB is the recommended minimum.` }
    if (space < 5e9) return { status: 'warning', text: `${fastPrettyBytes(space)} available, 5GB is the recommended amount.` }
    return { status: 'success', text: `${fastPrettyBytes(space)} available.` }
  }
  let space: Checks
  $: space = { promise: checkSpaceRequirements($settings.torrentPath), title: 'Storage Space', pending: 'Checking available storage space...' }
</script>

<Progress />

<div class='space-y-3 lg:max-w-4xl pt-5 h-full overflow-y-auto' use:dragScroll>
  <SettingCard class='bg-transparent' let:id title='Torrent Download Location' description={`Path to the folder used to store torrents. By default this is the OS's TEMP/TMP cache folder, which might lose data when your OS tries to reclaim storage.${SUPPORTS.isAndroid ? '\n\nSD Card saves to the Cards Download folder. If SD Card is not available torrents will automatically be saved to the Phone\'s Downloads folder' : ''}`}>
    <div class='flex'>
      <Input type='url' bind:value={$settings.torrentPath} readonly {id} placeholder='/tmp/webtorrent' class='sm:w-60 bg-background rounded-r-none pointer-events-none' />
      {#if !SUPPORTS.isAndroid}
        <Button class='rounded-l-none font-bold' on:click={() => selectDownloadFolder()} variant='secondary'>Select Folder</Button>
      {:else}
        <SingleCombo bind:value={$settings.androidStorageType} items={androidDirectories} class='w-32 shrink-0 border-input border rounded-l-none ' onSelected={selectDownloadFolder} />
      {/if}
    </div>
  </SettingCard>
  <SettingCard class='bg-transparent' let:id title='Persist Files' description="Keeps torrents files instead of deleting them after a new torrent is played. This doesn't seed the files, only keeps them on your drive. This will quickly fill up your storage.">
    <Switch {id} bind:checked={$settings.torrentPersist} />
  </SettingCard>
</div>

<Footer checks={[space]} />
