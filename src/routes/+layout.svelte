<script lang='ts'>
  import '../app.css'
  import '@fontsource-variable/nunito'
  import '@fontsource/geist-mono'
  import '$lib/modules/navigate'
  import { ProgressBar } from '@prgm/sveltekit-progress-bar'
  import { setContext } from 'svelte'
  import { toast } from 'svelte-sonner'

  import { onNavigate } from '$app/navigation'
  import Backplate from '$lib/components/Backplate.svelte'
  import Online from '$lib/components/Online.svelte'
  import { bannerSrc } from '$lib/components/ui/banner'
  import { Menubar } from '$lib/components/ui/menubar'
  import { Toaster } from '$lib/components/ui/sonner'
  import native from '$lib/modules/native'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { cn } from '$lib/utils'

  let root: HTMLDivElement

  let updateProgress = 0

  native.updateProgress(progress => {
    updateProgress = progress
  })
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

<div class={cn('w-full h-full flex flex-col backface-hidden relative overflow-clip preserve-3d grain bg-center bg-cover bg-no-repeat')} bind:this={root} id='root' style:--progress='{100 - updateProgress}%' style:--url='url({$bannerSrc?.coverImage?.extraLarge})'>
  <ProgressBar zIndex={100} bind:complete {displayThresholdMs} />
  <Toaster position='top-right' expand={true} />

  <Menubar />
  <Online />
  <slot />
</div>
{#if !SUPPORTS.isAndroid}
  <Backplate {root} />
{/if}

<style>
  .grain {
    /* background-blend-mode: multiply; */
    /* --darken-color: hsl(from var(--bg-color) h calc(s * 0.6) calc(l * 0.4));
    background: linear-gradient(135deg, var(--darken-color), color-mix(in srgb, var(--darken-color) 95%, red 5%)); */
    background: var(--url);
    /* backdrop-filter: blur(100px); */
  }
  /* .grain:before {
    content: "";
    z-index: -1;
    background-color: transparent;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'%3E%3Cfilter id='a'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23a)'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 182px;
    opacity: 0.2;
    top: 0;
    left: 0;
    position: absolute;
    width: 100%;
    height: 100%;
  } */
</style>
