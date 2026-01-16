<script lang='ts'>
  import { version } from '$app/environment'
  import SettingsNav from '$lib/components/SettingsNav.svelte'
  import { Separator } from '$lib/components/ui/separator'
  import native from '$lib/modules/native'
  import { dragScroll } from '$lib/modules/navigate'
  import { highEntropyValues } from '$lib/utils'

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
</script>

<div class='p-3 md:p-10 md:pb-0 pb-0 w-full h-full flex flex-col'>
  <div class='flex justify-center'>
    <div class='space-y-0.5 lg:max-w-[1310px] w-full'>
      <h2 class='text-2xl font-bold'>Settings</h2>
      <p class='text-muted-foreground'>
        Manage your app settings, preferences and accounts.
      </p>
    </div>
  </div>
  <Separator class='my-3 md:my-6 max-w-[1310px] mx-auto' />
  <div class='flex flex-col lg:flex-row gap-x-12 grow min-h-0 overflow-y-scroll lg:justify-center pb-10 md:pb-0' use:dragScroll>
    <aside class='lg:grow lg:max-w-60 flex flex-col sticky top-0 w-full bg-black z-20'>
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

    <div class='space-y-3 w-full pb-10 lg:max-w-5xl'>
      <slot />
      <!-- I give up, padding just will not work idk why -->
      <div class='h-4 hidden lg:block' />
    </div>
  </div>
</div>
