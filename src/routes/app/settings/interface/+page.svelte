<!-- <script lang='ts' context='module'>
  import { append, element } from 'svelte/internal'
  import { persisted } from 'svelte-persisted-store'

  const style = element('style')
  style.id = 'customThemes'
  append(document.head, style)

  export const variables = persisted('theme', '')

  variables.subscribe(value => {
    style.textContent = `:root{${value.replace(/{|}/g, '')}}`
  })
</script> -->

<script lang='ts'>
  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import { SingleCombo } from '$lib/components/ui/combobox'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Slider } from '$lib/components/ui/slider'
  import { Switch } from '$lib/components/ui/switch'
  // import { Textarea } from '$lib/components/ui/textarea'
  // import native from '$lib/modules/native'
  import { settings, SUPPORTS } from '$lib/modules/settings'

  const angle = {
    default: 'Default',
    d3d9: 'D3D9',
    d3d11: 'D3D11',
    warp: 'Warp',
    gl: 'GL',
    gles: 'GLES',
    swiftshader: 'SwiftShader',
    vulkan: 'Vulkan',
    metal: 'Metal'
  }

  let value = [$settings.uiScale]
  let prevScale = $settings.uiScale
  let dialogOpen = false
  let countdown = 10
  let countdownInterval: ReturnType<typeof setInterval>

  function saveScale () {
    prevScale = $settings.uiScale
    $settings.uiScale = value[0]!
    dialogOpen = true
    countdown = 10
    clearInterval(countdownInterval)
    countdownInterval = setInterval(() => {
      countdown--
      if (countdown <= 0) revertScale()
    }, 1000)
  }

  function keep () {
    clearInterval(countdownInterval)
    prevScale = $settings.uiScale
    dialogOpen = false
  }

  function revertScale () {
    clearInterval(countdownInterval)
    $settings.uiScale = prevScale
    value = [prevScale]
    dialogOpen = false
  }

  const titleTypes = {
    ANILIST: 'Anilist Account Preference',
    ROMAJI: 'Romaji (Shingeki no Kyojin)',
    ENGLISH: 'English (Attack on Titan)',
    NATIVE: 'Native (進撃の巨人)'
  } as const
</script>

{#if !SUPPORTS.isAndroid && !SUPPORTS.isIOS}
  <div class='font-weight-bold text-xl font-bold'>Rich Pressence Settings</div>
  <SettingCard let:id title='Show Details in Discord Rich Presence' description='Shows currently played anime and episode in Discord rich presence.'>
    <Switch {id} bind:checked={$settings.showDetailsInRPC} />
  </SettingCard>
{/if}
<!-- <SettingCard let:id title='CSS Variables' description='Used for custom themes. Can change colors, sizes, spacing and more. Supports only variables.'>
  <Textarea class='form-control w-60 shrink-0 mw-full bg-dark' placeholder='--accent-color: #e5204c;' bind:value={$variables} {id} />
</SettingCard> -->
<div class='font-weight-bold text-xl font-bold'>Appearance Settings</div>
<SettingCard let:id title='Show Hentai' description={'Shows hentai content throughout the app. If disabled all hentai content will be hidden and not shown in search results, but shown if present in your list.\n\nThis is also an AniList account setting, so make sure it is enabled in account settings as well to avoid inconsistencies.'}>
  <Switch {id} bind:checked={$settings.showHentai} />
</SettingCard>
<SettingCard let:id title='Hide Spoilers' description='Hides potential spoilers such as titles, descriptions, episode images and ratings throughout the app.'>
  <Switch {id} bind:checked={$settings.hideSpoilers} />
</SettingCard>
<SettingCard title='Title Language' description='What language should anime titles be displayed in.'>
  <SingleCombo bind:value={$settings.titleType} items={titleTypes} class='w-60 shrink-0 border-input border' />
</SettingCard>
<div class='font-weight-bold text-xl font-bold'>UI Settings</div>
<SettingCard title='UI Scale' description='Change the zoom level of the interface.' let:id>
  <Slider bind:value min={0.3} max={2.5} step={0.1} class='w-60 shrink-0' on:pointerup={saveScale} on:keyup={saveScale} on:keydown={saveScale} />
  <div class='text-muted-foreground text-xs'>{Number(value[0]).toFixed(1)}</div>
</SettingCard>
<SettingCard title='Navigation Buttons' description="Show backwards/forwards navigation buttons for when mouse buttons aren't available." let:id>
  <Switch {id} bind:checked={$settings.showNavigation} />
</SettingCard>
{#if !SUPPORTS.isAndroid && !SUPPORTS.isIOS}
  <SettingCard title='ANGLE Backend' description="What ANGLE backend to use for rendering. DON'T CHANGE WITHOUT REASON! On some Windows machines D3D9 might help with flicker. Changing this setting to something your device doesn't support might prevent Hayase from opening which will require a full reinstall. While Vulkan is an available option it might not be fully supported on Linux.">
    <SingleCombo bind:value={$settings.angle} items={angle} class='w-40 shrink-0 border-input border' />
  </SettingCard>
  <!--
    <div class='font-weight-bold text-xl font-bold'>UI Settings</div>
    <SettingCard title='Idle Animation' description='Enable/Disable the 3d idle animation. Changing this setting will restart the app.' let:id>
      <Switch bind:checked={$settings.idleAnimation} on:click={native.restart} {id} />
    </SettingCard> -->
{/if}

<Dialog.Root portal='#root' bind:open={dialogOpen}>
  <Dialog.Content class='max-w-md w-full bg-black'>
    <Dialog.Header>
      <Dialog.Title class='font-weight-bold font-bold'>Keep this UI scale?</Dialog.Title>
      <Dialog.Description>
        The interface zoom has been changed. Reverting to the previous scale in {countdown} seconds.
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <Button variant='destructive' on:click={revertScale}>Revert</Button>
      <Button on:click={keep}>Keep Changes</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
