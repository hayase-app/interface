<script lang='ts'>
  import { toast } from 'svelte-sonner'

  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import { SingleCombo } from '$lib/components/ui/combobox'
  import { Switch } from '$lib/components/ui/switch'
  import { storage } from '$lib/modules/anilist/urql-client'
  import native from '$lib/modules/native'
  import { settings, SUPPORTS, debug } from '$lib/modules/settings'

  const debugOpts = {
    '': 'None',
    '*': 'All',
    'torrent:*,webtorrent:*,simple-peer,bittorrent-protocol,bittorrent-dht,bittorrent-lsd,torrent-discovery,bittorrent-tracker:*,ut_metadata,nat-pmp,nat-api': 'Torrent',
    'ui:*': 'Interface'
  }

  async function copyLogs () {
    try {
      const logs = await native.getLogs()
      navigator.clipboard.writeText(logs)
      toast.success('Copied to clipboard', {
        description: 'Copied log contents to clipboard',
        duration: 5000
      })
    } catch (error) {
      const err = error as Error
      toast.error('Failed to copy logs!', {
        description: err.message
      })
    }
  }

  async function copyDevice () {
    try {
      const device = await native.getDeviceInfo() as object
      const info = {
        ...device,
        appInfo: {
          userAgent: await navigator.userAgentData?.getHighEntropyValues?.(['architecture', 'platform', 'platformVersion']),
          support: SUPPORTS,
          settings: $settings
        }
      }
      navigator.clipboard.writeText(JSON.stringify(info, null, 2))
      toast.success('Copied to clipboard', {
        description: 'Copied device info to clipboard',
        duration: 5000
      })
    } catch (error) {
      const err = error as Error
      toast.error('Failed to copy device info!', {
        description: err.message
      })
    }
  }

  async function importSettings () {
    try {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'application/json'
      input.click()
      await new Promise((resolve) => {
        input.onchange = () => resolve(null)
      })
      if (!input.files || input.files.length === 0) return
      const file = input.files[0]!
      const text = await file.text()
      const imported = JSON.parse(text)
      $settings = imported
      native.restart()
    } catch (error) {
      toast.error('Failed to import settings', {
        description: 'Failed to import settings from file, make sure the selected file is valid JSON.',
        duration: 5000
      })
    }
  }
  function exportSettings () {
    try {
      const url = URL.createObjectURL(new Blob([JSON.stringify($settings)], { type: 'application/json' }))
      const a = document.createElement('a')
      a.href = url
      a.download = 'hayase-settings.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Successfully exported settings', {
        description: 'Downloaded settings to file.',
        duration: 5000
      })
    } catch (error) {
      toast.error('Failed to export settings', {
        description: 'Failed to export settings to file.',
        duration: 5000
      })
    }
  }
  async function reset () {
    localStorage.clear()
    await storage.clear()
    native.restart()
  }
</script>

<div class='font-weight-bold text-xl font-bold'>App Settings</div>
{#if !SUPPORTS.isAndroid}
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

<SettingCard title='App and Device Info' description='Copy app and device debug info and capabilities, such as GPU information, GPU capabilities, version information and settings to clipboard.'>
  <Button on:click={copyDevice} class='btn btn-primary font-bold'>Copy To Clipboard</Button>
</SettingCard>

{#if !SUPPORTS.isAndroid}
  <SettingCard title='Log Output' description='Copy debug logs to clipboard. Once you enable a logging level you can use this to quickly copy the created logs to clipboard instead of navigating to the log file in directories.'>
    <Button on:click={copyLogs} class='btn btn-primary font-bold'>Copy To Clipboard</Button>
  </SettingCard>

  <SettingCard title='Open UI Devtools' description="Open devtools for the UI process, this allows to inspect media playback information, rendering performance and more. DO NOT PASTE ANY CODE IN THERE, YOU'RE LIKELY BEING SCAMMED IF SOMEONE TELLS YOU TO!">
    <Button on:click={native.openUIDevtools} class='btn btn-primary font-bold'>Open Devtools</Button>
  </SettingCard>
{/if}
