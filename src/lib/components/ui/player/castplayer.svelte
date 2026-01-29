<script lang='ts' context='module'>
  import { writable } from 'svelte/store'

  import native from '$lib/modules/native'

  native.getDisplays(dis => displays.set(dis))
  export const displays = writable<Array<{ friendlyName: string, host: string }>>([])

  const stopCast = (host: string) => {
    native.castClose(host)
    activeDisplay.set(null)
  }

  export const activeDisplay = writable<{ friendlyName: string, host: string } | null>(null)
</script>

<script lang='ts'>
  import SkipBack from 'lucide-svelte/icons/skip-back'
  import SkipForward from 'lucide-svelte/icons/skip-forward'
  import Square from 'lucide-svelte/icons/square'

  import { Button } from '../button'

  import EpisodesModal from './episodesmodal.svelte'

  import type { ResolvedFile } from './resolver'
  import type { MediaInfo } from './util'

  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import * as Dialog from '$lib/components/ui/dialog'
  import { authAggregator } from '$lib/modules/auth'
  import { settings } from '$lib/modules/settings'
  import { toTS } from '$lib/utils'

  export let mediaInfo: MediaInfo
  export let videoFiles: ResolvedFile[]
  export let selectFile: (file: ResolvedFile) => void
  export let prev: (() => void) = () => {}
  export let next: (() => void) = () => {}
  let wrapper: HTMLDivElement

  $: isMiniplayer = $page.route.id !== '/app/player'

  function openPlayer () {
    if (isMiniplayer) goto('/app/player/')
  }
  const startTime = Date.now()

  const elapsed = writable(0, (set) => {
    const interval = setInterval(() => {
      set((Date.now() - startTime) / 1000)
    }, 1000)

    return () => clearInterval(interval)
  })

  let completed = false
  function checkComplete (elapsed: number) {
    if (completed || !$settings.playerAutocomplete) return
    const fromend = Math.max(180, duration / 10)
    if (duration - fromend < elapsed) {
      authAggregator.watch(mediaInfo.media, mediaInfo.episode)
      completed = true
    }
  }

  $: checkComplete($elapsed)

  const duration = (mediaInfo.media.duration ?? 24) * 60

  function clamp (value: number): number {
    return Math.min(Math.max(value, 0), 100)
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const actualMedia = {
    contentId: mediaInfo.file.lan,
    contentType: mediaInfo.file.type,
    metadata: {
      metadataType: 2,
      posterUrl: mediaInfo.session.image,
      title: mediaInfo.session.title,
      subtitle: mediaInfo.session.description
    },
    streamType: 'BUFFERED',
    mediaCategory: 'VIDEO'
  } as Parameters<typeof native.castPlay>[3]

  const host = $activeDisplay!.host
</script>

<div class='flex-col w-full flex-shrink-0 relative overflow-clip flex justify-center items-center bg-black {isMiniplayer ? 'aspect-video cursor-pointer' : 'h-full' } px-8' on:click={openPlayer} bind:this={wrapper}>
  <div class='flex flex-col gap-2 text-left' class:min-w-[320px]={!isMiniplayer}>
    <div class='text-white text-2xl font-bold leading-none line-clamp-1 mb-2'>Now Casting</div>
    <EpisodesModal portal={wrapper} {mediaInfo} />
    {#await native.castPlay(host, mediaInfo.file.hash, mediaInfo.file.id, actualMedia)}
      <div class='ml-auto self-end text-sm leading-none font-light text-nowrap mt-3'>{toTS(Math.min($elapsed, duration))} / {toTS(duration)}</div>
      <div class='relative w-full h-1 flex items-center justify-center overflow-clip rounded-[2px]'>
        <div class='bg-[rgba(217,217,217,0.4)] absolute left-0 w-full h-0.5' />
        <div class='bg-white absolute w-full left-0 h-0.5 transform-gpu' style:--tw-translate-x='{clamp($elapsed / duration * 100) - 100}%' />
      </div>
    {:then _}
      <div class='ml-auto self-end text-sm leading-none font-light text-nowrap mt-3'>{toTS(Math.min((Date.now() - startTime) / 1000, duration))} / {toTS(duration)}</div>
      <div class='relative w-full h-1 flex items-center justify-center overflow-clip rounded-[2px]'>
        <div class='bg-[rgba(217,217,217,0.4)] absolute left-0 w-full h-0.5' />
        <div class='bg-white absolute w-full left-0 h-0.5 transform-gpu' style:--tw-translate-x='{clamp((Date.now() - startTime) / 10 / duration) - 100}%' />
      </div>
    {:catch error}
      <div class='text-red-500 text-sm font-light leading-none whitespace-pre-wrap'>{error.stack}</div>
    {/await}
    {#if !isMiniplayer}
      <div class='flex w-full pt-3 gap-2'>
        <Button class='w-12 h-12' variant='destructive' on:click={() => stopCast(host)}>
          <Square size='24px' fill='currentColor' />
        </Button>
        <Button class='p-3 w-12 h-12' variant='ghost' on:click={prev} disabled={!prev}>
          <SkipBack size='24px' fill='currentColor' strokeWidth='1' />
        </Button>
        <Dialog.Root portal={wrapper}>
          <Dialog.Trigger asChild let:builder>
            <Button class='py-3 px-8 h-12 text-lg font-bold mx-auto' variant='ghost' builders={[builder]}>
              Playlist
            </Button>
          </Dialog.Trigger>
          <Dialog.Content class='bg-black p-10 py-6 border-4 max-w-5xl w-auto max-h-[calc(100%-1rem)] items-center flex flex-col rounded-xl overflow-y-auto z-[100]'>
            {#each videoFiles as file, i (i)}
              <Button on:click={() => selectFile(file)} variant='ghost'>
                <span class='text-ellipsis text-nowrap overflow-clip'>{file.name}</span>
              </Button>
            {/each}
          </Dialog.Content>
        </Dialog.Root>
        <Button class='p-3 w-12 h-12' variant='ghost' on:click={next} disabled={!next}>
          <SkipForward size='24px' fill='currentColor' strokeWidth='1' />
        </Button>
      </div>
    {/if}
  </div>
</div>
