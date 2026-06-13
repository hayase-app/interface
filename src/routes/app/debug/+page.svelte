<script lang='ts'>
  import { get } from 'svelte/store'
  import { toast } from 'svelte-sonner'

  import { version } from '$app/environment'
  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import native from '$lib/modules/native'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { server } from '$lib/modules/torrent'
  import { fastPrettyBytes, saveFile } from '$lib/utils'

  function wrapToast (fn: () => Promise<unknown>) {
    return async function () {
      try {
        await fn()
      } catch (error) {
        toast.error('Failed to save file!', {
          description: (error as Error).message,
          duration: 15_000
        })
      }
    }
  }

  async function device () {
    const [device, appVersion] = await Promise.all([native.getDeviceInfo() as Promise<object>, native.version()])
    const [hasUpdate] = await Promise.allSettled([native.updateReady()])
    const info = {
      appVersion,
      version,
      hasUpdate,
      appInfo: {
        userAgent: await navigator.userAgentData?.getHighEntropyValues?.(['architecture', 'platform', 'platformVersion']),
        support: SUPPORTS
      },
      ...device
    }
    await saveFile(info, 'hayase-device-info')
  }

  async function logs () {
    const logs = await native.getLogs()
    await saveFile(logs, 'hayase-logs', 'ansi')
  }

  async function settingsFile () {
    const set = { ...$settings }
    set.nzbPassword = '***'
    set.nzbLogin = '***'
    await saveFile(set, 'hayase-settings')
  }

  async function torrent () {
    const active = await get(server.active)
    if (!active) throw new Error('No active torrent found')
    const hash = active.files[0]!.hash

    const [storage, info, trackers, protocol] = await Promise.all([
      native.checkAvailableSpace(),
      native.torrentInfo(hash),
      native.trackers(hash),
      native.protocolStatus(hash)
    ])

    await saveFile({ storage: fastPrettyBytes(storage), info, trackers, protocol }, 'hayase-torrent-capabilities')
  }

  async function media () {
    const video: string[] = []
    const decoder: Array<VideoDecoderConfig | AudioDecoderConfig> = []

    const formats = [
      'video/mp4; codecs="avc1.42E01E"',
      'video/mp4; codecs="avc1.4D401E"',
      'video/mp4; codecs="avc1.6e003"',
      'video/mp4; codecs="hev1.1.6.L93.B0"',
      'video/mp4; codecs="av01.0.05M.08"',
      'audio/mp4; codecs="ac-3"',
      'audio/mp4; codecs="dtsc"',
      'audio/mp4; codecs="truehd"',
      'audio/mp4; codecs="opus"',
      'audio/mp4; codecs="flac"',
      'audio/mp4; codecs="alac"',
      'audio/mp4; codecs="vorbis"',
      'audio/mp4; codecs="mp3"',
      'audio/mp4; codecs="mp4a.40.2"'
    ] as const

    const el = document.createElement('video')
    for (const format of formats) {
      if (el.canPlayType(format)) video.push(format)
      const codec = format.match(/codecs="(.+)"/)![1]!
      try {
        const { config, supported } = format.startsWith('video') ? await VideoDecoder.isConfigSupported({ codec }) : await AudioDecoder.isConfigSupported({ codec, sampleRate: 48000, numberOfChannels: 2 })
        if (supported && config) decoder.push(config)
      } catch {}
    }

    if (!('audioTracks' in HTMLVideoElement.prototype)) {
      video.push('audioTracks')
    }

    await saveFile({ video, decoder }, 'hayase-media-capabilities')
  }
</script>

<div class='p-3 md:p-10 md:pb-0 pb-0 size-full flex flex-col gap-4 overflow-y-auto'>
  <div class='flex justify-center'>
    <div class='space-y-0.5 lg:max-w-[1440px] w-full'>
      <h2 class='text-2xl font-bold'>Debug Page</h2>
      <p class='text-muted-foreground'>If you're here because you're looking for support with Hayase, you're in the right place! Otherwise, you might want to check the <a href='/#/app/settings' class='text-blue-500 hover:underline'>settings</a> page.</p>
    </div>
  </div>
  <SettingCard title='App and Device Info' description='Save app and device debug info and capabilities, such as GPU information, GPU capabilities, version information and settings to a file.'>
    <Button on:click={wrapToast(device)} class='btn btn-primary font-bold'>Save</Button>
  </SettingCard>
  <SettingCard title='Device Logs' description='Save device logs to a file, which can be useful for debugging issues. If you want to share these logs with the developers, please make sure to check the contents of the logs before sharing, as they might contain sensitive information.'>
    <Button on:click={wrapToast(logs)} class='btn btn-primary font-bold'>Save</Button>
  </SettingCard>
  <SettingCard title='Settings' description='Save current settings to a file, which can be useful for debugging issues or sharing your configuration with others.'>
    <Button on:click={wrapToast(settingsFile)} class='btn btn-primary font-bold'>Save</Button>
  </SettingCard>
  <SettingCard title='Torrent Capabilities' description='Save torrent capabilities of the device, which can be useful for debugging issues with torrenting. This includes information about supported protocols, encryption, and other torrent-related features.'>
    <Button on:click={wrapToast(torrent)} class='btn btn-primary font-bold'>Save</Button>
  </SettingCard>
  <SettingCard title='Media Capabilities' description='Save media capabilities of the device, which can be useful for debugging issues with media playback. This includes information about supported codecs, DRM capabilities, and other media-related features.'>
    <Button on:click={wrapToast(media)} class='btn btn-primary font-bold'>Save</Button>
  </SettingCard>
</div>
