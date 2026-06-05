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

  onNavigate(({ to, complete, delta, from }) => {
    if (
      !document.startViewTransition ||
      (SUPPORTS.isIOS && delta != null) || // iOS has their own animations for back/forward navigation that conflict with view transitions, sasuga Apple
      fullscreenElement || // chrome can hang when trying to do view transitions while in fullscreen
      (to?.route.id === '/app/player' && SUPPORTS.isMobile) // same as above, but only on mobile since only it forces fullscreen
    ) return

    return new Promise((resolve) => {
      document.startViewTransition(() => {
        resolve()
        return complete
      })
    })
  })

  $: scale = SUPPORTS.isAndroidTV ? $settings.uiScale / devicePixelRatio : SUPPORTS.isMobile ? $settings.uiScale : 1

  native.navigate(({ target, value }) => {
    if (target !== 'extensions' || !value) return
    extensionInstalURL.set(sanitizeExtensionUrl(new URL(value, 'http://localhost').searchParams.get('url') ?? value))
  })

  let fullscreenElement: Element | undefined

  // horrific hack, but on iPadOS, disabling insets causes lock to be RESPECTED, even tho spec says on Tablets it should be ignored, re-enabling insets correcly ignores lock!
  // too buggy for now, maybe revisit in the future
  // $: if (!fullscreenElement && !SUPPORTS.isIPad) screen.orientation.lock?.('portrait').catch(() => {})

  // once again, iOS at its finest
  document.body.style.webkitUserSelect = 'none'
  document.body.style.userSelect = 'none'
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
