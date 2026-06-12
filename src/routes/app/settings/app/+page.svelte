<script lang='ts'>
  import { toast } from 'svelte-sonner'

  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import { SingleCombo } from '$lib/components/ui/combobox'
  import { Switch } from '$lib/components/ui/switch'
  import urqlClient, { storage } from '$lib/modules/anilist/urql-client'
  import native from '$lib/modules/native'
  import { settings, SUPPORTS, debug } from '$lib/modules/settings'
  import { readFile, saveFile } from '$lib/utils'

  const debugOpts = {
    '': 'None',
    '*': 'All',
    'torrent:*,webtorrent:*,simple-peer,bittorrent-protocol,bittorrent-dht,bittorrent-lsd,torrent-discovery,bittorrent-tracker:*,ut_metadata,nat-pmp,nat-api': 'Torrent',
    'ui:*': 'Interface'
  }

  async function copyLogs () {
    try {
      await saveFile(await native.getLogs(), 'hayase-logs', 'ansi')
      toast.success('Copied to clipboard', {
        description: 'Copied log contents to clipboard'
      })
    } catch (error) {
      const err = error as Error
      toast.error('Failed to copy logs!', {
        description: err.message,
        duration: 15_000
      })
    }
  }

  async function importSettings () {
    try {
      $settings = await readFile()
      native.restart()
    } catch (error) {
      toast.error('Failed to import settings', {
        description: 'Failed to import settings from file, make sure the selected file is valid JSON.'
      })
    }
  }
  async function exportSettings () {
    try {
      await saveFile($settings, 'hayase-settings')
    } catch (error) {
      toast.error('Failed to export settings', {
        description: 'Failed to export settings to file.'
      })
    }
  }
  async function reset () {
    localStorage.clear()
    await storage.clear()
    native.restart()
  }
  async function useInternalALAPI () {
    try {
      await urqlClient.token()
      await native.unsafeUseInternalALAPI()
    } catch (error) {
      const err = error as Error
      toast.error('Failed to use Internal API', {
        description: err.message || 'Failed to use internal API.'
      })
    }
  }
</script>

<div class='font-weight-bold text-xl font-bold'>App Settings</div>
{#if !SUPPORTS.isAndroid && !SUPPORTS.isIOS}
  <SettingCard let:id title='Hide App To Tray' description='Makes the app hide to tray instead of closing when you close the window. This is useful if you want to keep the torrent client open in the background to seed/leech.'>
    <Switch {id} bind:checked={$settings.hideToTray} />
  </SettingCard>
{/if}
<div class='grid grid-cols-1 gap-3 md:grid-cols-3'>
  <Button on:click={importSettings} class='font-bold'>
    Import Settings From File
  </Button>
  <Button on:click={exportSettings} class='font-bold'>
    Export Settings To File
  </Button>
  <Button on:click={reset} variant='destructive' class='font-bold'>
    Reset EVERYTHING To Default
  </Button>
</div>

<div class='font-weight-bold text-xl font-bold'>Debug Settings</div>
<SettingCard title='Logging Levels' description='Enable logging of specific parts of the app. These logs are saved to %appdata$/Hayase/logs/main.log or ~/config/Hayase/logs/main.log.'>
  <SingleCombo bind:value={$debug} items={debugOpts} class='w-32 shrink-0 border-input border' />
</SettingCard>

<SettingCard title='Debug page' description='Go to the debug page to access additional debugging features.'>
  <Button href='/#/app/debug' class='btn btn-primary font-bold'>Go to Debug Page</Button>
</SettingCard>

{#if !SUPPORTS.isAndroid && !SUPPORTS.isIOS}
  <SettingCard title='Log Output' description='Save debug logs to a file. Once you enable a logging level you can use this to quickly copy the created logs to clipboard instead of navigating to the log file in directories.'>
    <Button on:click={copyLogs} class='btn btn-primary font-bold'>Copy To Clipboard</Button>
  </SettingCard>

  <SettingCard title='Open UI Devtools' description="Open devtools for the UI process, this allows to inspect media playback information, rendering performance and more. DO NOT PASTE ANY CODE IN THERE, YOU'RE LIKELY BEING SCAMMED IF SOMEONE TELLS YOU TO!">
    <Button on:click={native.openUIDevtools} class='btn btn-primary font-bold'>Open Devtools</Button>
  </SettingCard>

  <SettingCard title='Use Internal AniList API' description={"THIS IS VERY UNSAFE AND LIKELY BANNABLE!!!\nDO NOT USE THIS UNLESS YOU KNOW WHAT YOU'RE DOING.\n\nForces the app to use AniList's internal API instead of the public GraphQL API for the current session only. Can be used to debug issues such as CGNAT induced rate limits. This can cause issues in the UI, sync and other parts of the app."}>
    <Button on:click={useInternalALAPI} class='btn btn-primary font-bold'>Use Internal API</Button>
  </SettingCard>
{/if}
