<script lang='ts'>
  import '../app.css'
  import '@fontsource-variable/nunito'
  import '@fontsource/geist-mono'
  import '$lib/modules/gamepad'
  import { ProgressBar } from '@prgm/sveltekit-progress-bar'
  import { setContext } from 'svelte'
  import { toast } from 'svelte-sonner'

  import { onNavigate } from '$app/navigation'
  // import Backplate from '$lib/components/Backplate.svelte'
  import Online from '$lib/components/Online.svelte'
  import InstallPrompt, { extensionInstalURL } from '$lib/components/ui/extensions/ExtensionInstallPrompt.svelte'
  import { Menubar } from '$lib/components/ui/menubar'
  import { Toaster } from '$lib/components/ui/sonner'
  import { sanitizeExtensionUrl } from '$lib/modules/extensions/storage'
  import native from '$lib/modules/native'
  import { inputType } from '$lib/modules/navigate'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { cn } from '$lib/utils'

  native.errors(error => {
    toast.error('Torrent Process Error!', { description: error?.stack ?? error?.message, duration: 15_000 })
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
    if (!document.startViewTransition || SUPPORTS.isIOS) return

    return new Promise((resolve) => {
      document.startViewTransition(async () => {
        resolve()
        await navigation.complete
      })
    })
  })

  $: scale = SUPPORTS.isAndroidTV ? $settings.uiScale / devicePixelRatio : (SUPPORTS.isAndroid || SUPPORTS.isIOS) ? $settings.uiScale : 1

  native.navigate(({ target, value }) => {
    if (target !== 'extensions' || !value) return
    extensionInstalURL.set(sanitizeExtensionUrl(new URL(value, 'http://localhost').searchParams.get('url') ?? value))
  })

  let fullscreenElement: Element | undefined

  $: if (!fullscreenElement) screen.orientation.lock?.('portrait')
</script>

<svelte:head>
  <meta name='viewport' content='width={scale <= 1 ? 'device-width' : 1}, initial-scale={scale}, minimum-scale={scale}, maximum-scale={scale}, user-scalable=no, viewport-fit=cover' />
</svelte:head>

<svelte:document bind:fullscreenElement />

<div class={cn('size-full flex flex-col bg-black relative overflow-clip')} id='root' data-input={$inputType} on:contextmenu|preventDefault>
  <ProgressBar zIndex={100} bind:complete {displayThresholdMs} />
  <Toaster position='top-right' expand={true} />

  <Menubar />
  <Online />
  {#if $extensionInstalURL}
    <InstallPrompt />
  {/if}
  <slot />
</div>
<!-- {#if !SUPPORTS.isAndroid}
  <Backplate {root} />
{/if} -->
