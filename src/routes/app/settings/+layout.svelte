<script lang='ts'>
  import Heart from 'lucide-svelte/icons/heart'

  import { version } from '$app/environment'
  import SettingsNav from '$lib/components/SettingsNav.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Separator } from '$lib/components/ui/separator'
  import { activityState, idleState, lockedState } from '$lib/modules/idle'
  import native from '$lib/modules/native'
  import { dragScroll } from '$lib/modules/navigate'
  import { cn, highEntropyValues } from '$lib/utils'

  const items = [
    {
      title: 'Player',
      href: '/app/settings/'
    },
    {
      title: 'Client',
      href: '/app/settings/client/'
    },
    {
      title: 'Interface',
      href: '/app/settings/interface/'
    },
    {
      title: 'Extensions',
      href: '/app/settings/extensions/'
    },
    {
      title: 'Accounts',
      href: '/app/settings/accounts/'
    },
    {
      title: 'App',
      href: '/app/settings/app/'
    },
    {
      title: 'Changelog',
      href: '/app/settings/changelog/'
    }
  ]

  let visibilityState: DocumentVisibilityState

  $: active = ($lockedState === 'locked' || visibilityState === 'hidden' || ($idleState === 'active' && $activityState === 'active'))
</script>

<svelte:document bind:visibilityState />

<div class='p-3 md:p-10 md:pb-0 pb-0 size-full flex flex-col'>
  <div class='flex justify-center'>
    <div class='space-y-0.5 lg:max-w-[1440px] w-full'>
      <h2 class='text-2xl font-bold'>Settings</h2>
      <p class='text-muted-foreground'>
        Manage your app settings, preferences and accounts.
      </p>
    </div>
  </div>
  <Separator class='my-3 md:my-6 max-w-[1440px] mx-auto' />
  <div class='flex flex-col lg:flex-row gap-x-12 grow min-h-0 overflow-y-auto lg:justify-center pb-10 md:pb-0' use:dragScroll>
    <aside class='lg:grow lg:max-w-60 flex flex-col sticky top-0 w-full bg-black z-20'>
      <div class='sm:py-4 px-6 py-2 rounded bg-fuchsia-400 flex flex-col gap-1 sm:gap-2 text-base bg-center bg-cover mb-4 text-secondary' style:background-image='url("/flowers.png")'>
        <div class='font-bold'>Support the Project</div>
        <div class='text-xs'>Please consider supporting the development of Hayase by donating!</div>
        <Button on:click={() => native.openURL('https://github.com/sponsors/ThaUnknown/')} size='sm' class='hidden sm:flex font-bold gap-2 max-w-40 lg:max-w-full w-full leading-none shaow-none'>
          <Heart size={18} fill='currentColor' class={cn('drop-shadow-[0_0_1rem_#fa68b6] text-[#fa68b6]', active && 'animate-[hearbeat_1s_ease-in-out_infinite_alternate]')} />
          Donate
        </Button>
      </div>
      <SettingsNav {items} />
      <div class='mt-auto text-xs text-muted-foreground px-4 sm:px-2 py-3 md:py-5 flex flex-row lg:flex-col font-light gap-0.5 gap-x-4 flex-wrap'>
        <div>Interface v{version}</div>
        <div>Native {#await native.version() then version}{version}{/await}</div>
        {#if highEntropyValues}
          {#await highEntropyValues then { architecture, platform, platformVersion }}
            <div>{platform} {platformVersion} {architecture}</div>
          {:catch e}
            <div>Could not obtain device version</div>
          {/await}
        {:else}
          <div>Could not obtain device version</div>
        {/if}
      </div>
    </aside>

    <div class='space-y-3 w-full pb-10 lg:max-w-6xl'>
      <slot />
      <!-- I give up, padding just will not work idk why -->
      <div class='h-4 hidden lg:block' />
    </div>
  </div>
</div>
