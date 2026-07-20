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
  import { toast } from 'svelte-sonner'

  import SettingCard from '$lib/components/SettingCard.svelte'
  import { Button } from '$lib/components/ui/button'
  import { SingleCombo } from '$lib/components/ui/combobox'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Slider } from '$lib/components/ui/slider'
  import { Switch } from '$lib/components/ui/switch'
  // import { Textarea } from '$lib/components/ui/textarea'
  import * as ToggleGroup from '$lib/components/ui/toggle-group'
  // import native from '$lib/modules/native'
  import { navigate } from '$lib/modules/navigate'
  import { defaults, settings, SUPPORTS } from '$lib/modules/settings'
  import { readFile, saveFile } from '$lib/utils'

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

  let prevTheme = $settings.theme
  $: if (!$settings.theme) {
    $settings.theme = prevTheme
  } else {
    prevTheme = $settings.theme
  }

  const themes = [
    { value: 'default', label: 'Blackout' },
    { value: 'light', label: 'Whiteout' },
    { value: 'catppuccin', label: 'Catppuccin' },
    { value: 'dracula', label: 'Dracula' },
    { value: 'amber', label: 'Amber' },
    { value: 'lavender', label: 'Lavender' },
    { value: 'system', label: 'System' },
    { value: 'custom', label: 'Custom' }
  ]

  const customVarDefs = [
    { key: '--custom-background', label: 'Background' },
    { key: '--custom-foreground', label: 'Foreground' },
    { key: '--custom-muted', label: 'Muted' },
    { key: '--custom-muted-foreground', label: 'Muted Foreground' },
    { key: '--custom-card', label: 'Card' },
    { key: '--custom-card-foreground', label: 'Card Foreground' },
    { key: '--custom-popover', label: 'Popover' },
    { key: '--custom-popover-foreground', label: 'Popover Foreground' },
    { key: '--custom-border', label: 'Border' },
    { key: '--custom-input', label: 'Input' },
    { key: '--custom-primary', label: 'Primary' },
    { key: '--custom-primary-foreground', label: 'Primary Foreground' },
    { key: '--custom-secondary', label: 'Secondary' },
    { key: '--custom-secondary-foreground', label: 'Secondary Foreground' },
    { key: '--custom-accent', label: 'Accent' },
    { key: '--custom-accent-foreground', label: 'Accent Foreground' },
    { key: '--custom-destructive', label: 'Destructive' },
    { key: '--custom-destructive-foreground', label: 'Destructive Foreground' },
    { key: '--custom-ring', label: 'Ring' }
  ] as const

  const titleTypes = {
    ANILIST: 'Anilist Account Preference',
    ROMAJI: 'Romaji (Shingeki no Kyojin)',
    ENGLISH: 'English (Attack on Titan)',
    NATIVE: 'Native (進撃の巨人)'
  } as const

  function resetCustomTheme () {
    $settings.customThemeColors = { ...defaults.customThemeColors }
  }

  async function exportCustomTheme () {
    try {
      await saveFile($settings.customThemeColors, 'hayase-custom-theme')
    } catch (error) {
      toast.error('Failed to copy custom theme', {
        description: (error as Error).message
      })
    }
  }

  async function importCustomTheme () {
    try {
      const parsed = await readFile()
      for (const k in parsed) {
        if (!customVarDefs.some(({ key }) => key === k)) {
          throw new Error('Invalid custom theme format')
        }
      }
      $settings.customThemeColors = { ...defaults.customThemeColors, ...parsed }
    } catch (error) {
      toast.error('Failed to paste custom theme', {
        description: (error as Error).message
      })
    }
  }
</script>

<div class='font-weight-bold text-xl font-bold'>Display Preferences</div>
<SettingCard title='Title Language' description='What language should anime titles be displayed in.'>
  <SingleCombo bind:value={$settings.titleType} items={titleTypes} class='w-60 shrink-0 border-input border' />
</SettingCard>
<SettingCard let:id title='Show Hentai' description={'Shows hentai content throughout the app. If disabled all hentai content will be hidden and not shown in search results, but shown if present in your list.\n\nThis is also an AniList account setting, so make sure it is enabled in account settings as well to avoid inconsistencies.'}>
  <Switch {id} bind:checked={$settings.showHentai} />
</SettingCard>
<SettingCard let:id title='Hide Spoilers' description='Hides potential spoilers such as titles, descriptions, episode images and ratings throughout the app.'>
  <Switch {id} bind:checked={$settings.hideSpoilers} />
</SettingCard>

<div class='font-weight-bold text-xl font-bold'>Appearance</div>
<SettingCard class='md:flex-col md:items-start' title='Color Theme' description='Select a color theme for the interface.'>
  <ToggleGroup.Root type='single' bind:value={$settings.theme} asChild let:builder variant='ghost'>
    <div class='grid sm:grid-cols-2 gap-3 w-full' use:builder.action {...builder} on:keydown|capture|stopPropagation={navigate}>
      {#each themes as { value, label } (value)}
        <ToggleGroup.Item {value} class='{value === 'default' ? 'theme-default' : 'theme-' + value} h-auto py-8 relative bg-background/40 select:bg-background/50'>
          <div class='absolute top-4 left-4 text-xl font-bold text-foreground'>{label}</div>
          <div class='flex flex-col items-center gap-1 px-6 max-w-[260px] pt-4'>
            <div class='text-xs text-foreground/85'>The quick brown fox</div>
            <div class='text-[10px] text-muted-foreground'>Muted description text</div>
            <div class='flex items-center gap-1.5 mt-0.5'>
              <Button variant='default' size='xs'>Primary</Button>
              <Button variant='secondary' size='xs'>Secondary</Button>
              <Button variant='ghost' size='xs'>Ghost</Button>
            </div>
            <Input readonly value='Sample' class='h-6 text-[10px] mt-0.5' />
            <div class='flex items-center gap-1.5 mt-0.5'>
              <Switch checked={false} hideState />
            </div>
            <Slider value={[40]} class='w-full mt-0.5' />
          </div>
        </ToggleGroup.Item>
      {/each}
    </div>
  </ToggleGroup.Root>
</SettingCard>
{#if $settings.theme === 'custom'}
  <SettingCard class='md:flex-col md:items-start' title='Custom Theme Colors' description='Customize each color variable for the custom theme.'>
    <div class='grid grid-cols-2 gap-x-6 gap-y-2 w-full'>
      {#each customVarDefs as def (def.key)}
        <div class='flex items-center gap-2 text-sm text-muted-foreground'>
          <Input type='color' bind:value={$settings.customThemeColors[def.key]} class='size-7 cursor-pointer border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg' />
          <span>{def.label}</span>
        </div>
      {/each}
    </div>
    <div class='flex gap-2 mt-4'>
      <Button variant='destructive' on:click={resetCustomTheme}>Reset</Button>
      <Button variant='secondary' on:click={importCustomTheme}>Import</Button>
      <Button variant='secondary' on:click={exportCustomTheme}>Export</Button>
    </div>
  </SettingCard>
{/if}
<SettingCard title='Navigation Buttons' description="Show backwards/forwards navigation buttons for when mouse buttons aren't available." let:id>
  <Switch {id} bind:checked={$settings.showNavigation} />
</SettingCard>
<SettingCard title='UI Scale' description='Change the zoom level of the interface.' let:id>
  <Slider bind:value min={0.3} max={2.5} step={0.1} class='w-60 shrink-0' on:pointerup={saveScale} on:keyup={saveScale} on:keydown={saveScale} />
  <div class='text-muted-foreground text-xs'>{Number(value[0]).toFixed(1)}</div>
</SettingCard>

{#if !SUPPORTS.isAndroid && !SUPPORTS.isIOS}
  <div class='font-weight-bold text-xl font-bold'>Advanced</div>
  <SettingCard let:id title='Show Details in Discord Rich Presence' description='Shows currently played anime and episode in Discord rich presence.'>
    <Switch {id} bind:checked={$settings.showDetailsInRPC} />
  </SettingCard>
  <SettingCard title='ANGLE Backend' description="What ANGLE backend to use for rendering. DON'T CHANGE WITHOUT REASON! On some Windows machines D3D9 might help with flicker. Changing this setting to something your device doesn't support might prevent Hayase from opening which will require a full reinstall. While Vulkan is an available option it might not be fully supported on Linux.">
    <SingleCombo bind:value={$settings.angle} items={angle} class='w-40 shrink-0 border-input border' />
  </SettingCard>
  <!--
    <SettingItem title='Idle Animation' description='Enable/Disable the 3d idle animation. Changing this setting will restart the app.' let:id>
      <Switch bind:checked={$settings.idleAnimation} on:click={native.restart} {id} />
    </SettingItem> -->
{/if}

<Dialog.Root portal='#root' bind:open={dialogOpen}>
  <Dialog.Content class='max-w-md w-full bg-background'>
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
