<script lang='ts'>
  import '../app.css'
  import '@fontsource-variable/nunito'
  import '@fontsource/geist-mono'
  import '$lib/modules/navigate'
  import { ProgressBar } from '@prgm/sveltekit-progress-bar'
  import { setContext } from 'svelte'
  import { toast } from 'svelte-sonner'

  import { onNavigate } from '$app/navigation'
  // import Backplate from '$lib/components/Backplate.svelte'
  import Online from '$lib/components/Online.svelte'
  import { Menubar } from '$lib/components/ui/menubar'
  import { Toaster } from '$lib/components/ui/sonner'
  import native from '$lib/modules/native'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { cn } from '$lib/utils'

  let root: HTMLDivElement

  native.errors(error => {
    toast.error('Torrent Process Error!', { description: error?.stack ?? error?.message })
    console.error(error)
  })

  const displayThresholdMs = 150
  let complete: ((settleTime: number | undefined) => void) | undefined
  setContext('stop-progress-bar', () => {
    setTimeout(() => {
      complete?.(0)
    }, displayThresholdMs)
  })

  onNavigate((navigation) => {
    if (!document.startViewTransition) return

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve()
        await navigation.complete
      })
    })
  })
</script>

<svelte:head>
  <meta name='viewport' content='width=device-width, initial-scale={SUPPORTS.isAndroidTV ? $settings.uiScale / devicePixelRatio : SUPPORTS.isAndroid ? $settings.uiScale : 1}, maximum-scale=2, user-scalable=0, viewport-fit=cover' />
</svelte:head>

<div class={cn('w-full h-full flex flex-col backface-hidden bg-black relative overflow-clip')} bind:this={root} id='root'>
  <ProgressBar zIndex={100} bind:complete {displayThresholdMs} />
  <Toaster position='top-right' expand={true} />

  <Menubar />
  <Online />
  <slot />
</div>
<!-- {#if !SUPPORTS.isAndroid}
  <Backplate {root} />
{/if} -->
