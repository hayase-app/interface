<script lang='ts'>
  import { get } from 'svelte/store'
  import { toast } from 'svelte-sonner'

  import { version } from '$app/environment'
  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Table from '$lib/components/ui/table'
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

  const AUDIO_CODECS = [
    { codec: 'opus', name: 'Opus' },
    { codec: 'mp4a.40.2', name: 'AAC LC' },
    { codec: 'mp3', name: 'MP3' },
    { codec: 'vorbis', name: 'Vorbis' },
    { codec: 'flac', name: 'FLAC' },
    { codec: 'alac', name: 'ALAC' },
    { codec: 'ac-3', name: 'AC-3' },
    { codec: 'dtsc', name: 'DTS Core' },
    { codec: 'truehd', name: 'TrueHD' }
  ] as const

  type AudioCodecKey = (typeof AUDIO_CODECS)[number]['codec']

  const SAMPLE_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000, 88200, 96000] as const
  type SampleRate = (typeof SAMPLE_RATES)[number]
  const CHANNELS = [8, 6, 4, 2, 1] as const

  const VIDEO_CODECS = [
    { codec: 'avc1.420033', name: 'H.264 Baseline' },
    { codec: 'avc1.4D0033', name: 'H.264 Main' },
    { codec: 'avc1.640033', name: 'H.264 High' },
    { codec: 'avc1.6E0033', name: 'H.264 High 10' },
    { codec: 'avc1.7A0033', name: 'H.264 High 4:2:2' },
    { codec: 'avc1.F40033', name: 'H.264 High 4:4:4' },
    { codec: 'hev1.1.6.L93.B0', name: 'H.265 Main' },
    { codec: 'hev1.2.4.L93.B0', name: 'H.265 Main 10' },
    { codec: 'hev1.4.4.L93.B0', name: 'H.265 Main 4:2:2' },
    { codec: 'hev1.6.4.L93.B0', name: 'H.265 Main 4:4:4' },
    { codec: 'av01.0.05M.08', name: 'AV1 P0' },
    { codec: 'av01.1.05M.08', name: 'AV1 P1' },
    { codec: 'av01.2.05M.10', name: 'AV1 P2 10-bit' },
    { codec: 'vp09.00.10.08', name: 'VP9 P0' },
    { codec: 'vp09.02.10.08', name: 'VP9 P2' },
    { codec: 'vp8', name: 'VP8' }
  ] as const

  type VideoCodecKey = (typeof VIDEO_CODECS)[number]['codec']
  type ResolutionLabel = (typeof RESOLUTIONS)[number]['label']

  const RESOLUTIONS = [
    { width: 426, height: 240, label: '240p' },
    { width: 640, height: 360, label: 'QHD' },
    { width: 854, height: 480, label: 'SD' },
    { width: 1280, height: 720, label: 'HD' },
    { width: 1920, height: 1080, label: 'FHD' },
    { width: 2560, height: 1440, label: '2K' },
    { width: 3840, height: 2160, label: '4K' },
    { width: 7680, height: 4320, label: '8K' }
  ] as const

  const mediaPromise = Promise.all([testAudio(), testVideo()])

  async function testAudio () {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {} as Record<AudioCodecKey, Record<SampleRate, number>>
    for (const { codec } of AUDIO_CODECS) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const rates = {} as Record<SampleRate, number>
      result[codec] = rates
      await Promise.all(SAMPLE_RATES.map(async sampleRate => {
        for (const numberOfChannels of CHANNELS) {
          try {
            const { supported } = await AudioDecoder.isConfigSupported({ codec, sampleRate, numberOfChannels })
            if (supported) {
              rates[sampleRate] = numberOfChannels
              return
            }
          } catch {}
        }
        rates[sampleRate] = 0
      }))
    }
    return result
  }

  async function testVideo () {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const result = {} as Record<VideoCodecKey, Record<ResolutionLabel, boolean>>
    for (const { codec } of VIDEO_CODECS) {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const resolutions = {} as Record<ResolutionLabel, boolean>
      result[codec] = resolutions
      await Promise.all(RESOLUTIONS.map(async ({ label, width, height }) => {
        try {
          const { supported } = await VideoDecoder.isConfigSupported({ codec, codedWidth: width, codedHeight: height })
          resolutions[label] = !!supported
        } catch {
          resolutions[label] = false
        }
      }))
    }
    return result
  }

  async function media () {
    const video: string[] = []
    const decoder: Array<VideoDecoderConfig | AudioDecoderConfig> = []

    const el = document.createElement('video')

    for (const { codec } of VIDEO_CODECS) {
      const format = `video/mp4; codecs="${codec}"`
      if (el.canPlayType(format)) video.push(format)
    }

    for (const { codec } of AUDIO_CODECS) {
      const format = `audio/mp4; codecs="${codec}"`
      if (el.canPlayType(format)) video.push(format)
    }

    if (!('audioTracks' in HTMLVideoElement.prototype)) {
      video.push('audioTracks')
    }

    const [audioMatrix, videoMatrix] = await mediaPromise

    await saveFile({ video, decoder, audioMatrix, videoMatrix }, 'hayase-media-capabilities')
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

  {#await mediaPromise}
    <div class='flex justify-center py-8'>
      <p class='text-muted-foreground'>Testing media capabilities...</p>
    </div>
  {:then [audioMatrix, videoMatrix]}
    <div class='space-y-1.5'>
      <h3 class='text-lg font-bold'>Audio Codec Support</h3>
      <p class='text-muted-foreground text-xs pb-1'>Maximum supported channels per sample rate. <span class='text-green-500 font-medium'>≥6ch</span> · <span class='text-foreground'>2–4ch</span> · <span class='text-muted-foreground/40'>unsupported</span></p>
      <div class='rounded-md border overflow-auto'>
        <Table.Root class='table-fixed'>
          <Table.Header>
            <Table.Row>
              <Table.Head class='sticky left-0 z-20 bg-background text-[11px]/4 font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50 w-[140px]'>Codec</Table.Head>
              {#each SAMPLE_RATES as rate (rate)}
                <Table.Head class='text-right text-[11px]/4 font-semibold uppercase tracking-wider text-muted-foreground last:pr-5'>{(rate / 1000).toFixed(0)}k</Table.Head>
              {/each}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each AUDIO_CODECS as { codec, name }, i (i)}
              <Table.Row class={i % 2 === 1 ? 'bg-muted/20' : ''}>
                <Table.Cell class='sticky left-0 z-10 bg-background font-medium text-xs border-r border-border/50 w-[140px]'>{name}</Table.Cell>
                {#each SAMPLE_RATES as rate (rate)}
                  {@const ch = audioMatrix[codec][rate]}
                  <Table.Cell class={'text-right text-xs tabular-nums last:pr-5' + (ch >= 6 ? ' text-green-500 font-medium' : ch >= 2 ? ' text-foreground' : ch >= 1 ? ' text-amber-400' : ' text-muted-foreground/30')}>{ch ? `${ch}ch` : '—'}</Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </div>

    <div class='space-y-1.5'>
      <h3 class='text-lg font-bold'>Video Codec Support</h3>
      <p class='text-muted-foreground text-xs pb-1'>Decoding support per codec and resolution. <span class='text-green-500 font-medium'>✓ supported</span> · <span class='text-muted-foreground/40'>— unsupported</span></p>
      <div class='rounded-md border overflow-auto'>
        <Table.Root class='table-fixed'>
          <Table.Header>
            <Table.Row>
              <Table.Head class='sticky left-0 z-20 bg-background text-[11px]/4 font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/50 w-[140px]'>Codec</Table.Head>
              {#each RESOLUTIONS as res (res)}
                <Table.Head class='text-right text-[11px]/4 font-semibold uppercase tracking-wider text-muted-foreground last:pr-5'>{res.label}</Table.Head>
              {/each}
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {#each VIDEO_CODECS as { codec, name }, i (i)}
              <Table.Row class={i % 2 === 1 ? 'bg-muted/20' : ''}>
                <Table.Cell class='sticky left-0 z-10 bg-background font-medium text-xs border-r border-border/50 w-[140px]'>{name}</Table.Cell>
                {#each RESOLUTIONS as res (res)}
                  {@const ok = videoMatrix[codec][res.label]}
                  <Table.Cell class={'text-right text-xs tabular-nums last:pr-5' + (ok ? ' text-green-500 font-medium' : ' text-muted-foreground/30')}>{ok ? '✓' : '—'}</Table.Cell>
                {/each}
              </Table.Row>
            {/each}
          </Table.Body>
        </Table.Root>
      </div>
    </div>
  {:catch error}
    <div class='flex justify-center py-8'>
      <p class='text-destructive'>{error.message}</p>
    </div>
  {/await}
</div>
