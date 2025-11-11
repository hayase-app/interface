<script lang='ts'>
  import Heart from 'lucide-svelte/icons/heart'
  import Play from 'lucide-svelte/icons/play'

  import SidebarButton from './SidebarButton.svelte'

  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import Logo from '$lib/components/icons/Logo.svelte'
  import { Home, Search, Calendar, Users, Download, Bolt, LogIn } from '$lib/components/icons/animated'
  import * as Avatar from '$lib/components/ui/avatar'
  import client from '$lib/modules/auth/client'
  import { lockedState, idleState, activityState } from '$lib/modules/idle'
  import native from '$lib/modules/native'
  import { SUPPORTS } from '$lib/modules/settings'
  import { cn, highEntropyValues } from '$lib/utils'

  const auth = client.hasAuth

  $: hasAuth = $auth

  let visibilityState: DocumentVisibilityState

  $: active = ($lockedState === 'locked' || visibilityState === 'hidden' || ($idleState === 'active' && $activityState === 'active')) && $page.route.id !== '/app/player' && !SUPPORTS.isUnderPowered

  let isMac = false

  if (highEntropyValues) highEntropyValues.then(({ platform }) => { isMac = platform === 'macOS' })
</script>

<svelte:document bind:visibilityState />

<!-- <BannerImage class='absolute top-0 left-0 w-14 -z-10 hidden md:block' /> -->
<Logo class={cn('h-10 object-contain w-4 hidden md:block text-white cursor-pointer', isMac && 'mt-3')} on:click={() => goto('/app/home/')} />
{#if SUPPORTS.isAndroidTV}
  <SidebarButton href='/app/player/' class='hidden md:flex py-0'>
    <Play size={14} />
  </SidebarButton>
{/if}
<SidebarButton href='/app/home/' class='animated-icon'>
  <Home size={16} />
</SidebarButton>
<SidebarButton href='/app/search/' class='animated-icon'>
  <Search size={16} />
</SidebarButton>
<SidebarButton href='/app/schedule/' class='animated-icon'>
  <Calendar size={16} />
</SidebarButton>
<SidebarButton href='/app/w2g/' class='animated-icon'>
  <Users size={16} />
</SidebarButton>
<!-- <SidebarButton href='/app/chat/' class='animated-icon'>
  <Messages size={16} />
</SidebarButton> -->
<SidebarButton href='/app/client/' id='sidebar-client' data-down='#sidebar-donate' class='animated-icon'>
  <Download size={16} />
</SidebarButton>
<SidebarButton variant='ghost' id='sidebar-donate' data-up='#sidebar-client' on:click={() => native.openURL('https://github.com/sponsors/ThaUnknown/')} class='mt-auto text-[#fa68b6] select:text-[#fa68b6]'>
  <Heart size={16} fill='currentColor' class={cn('drop-shadow-[0_0_1rem_#fa68b6]', active && 'animate-[hearbeat_1s_ease-in-out_infinite_alternate]')} />
</SidebarButton>
<SidebarButton href='/app/settings/' class='animated-icon'>
  <Bolt size={16} />
</SidebarButton>
<SidebarButton href='/app/profile/'>
  <!-- <SidebarButton href='/app/profile/' class='hidden md:flex py-0 animated-icon'> -->
  {#if hasAuth}
    {@const viewer = client.profile()}
    <Avatar.Root class='size-6 rounded-md'>
      <Avatar.Image src={viewer?.avatar?.large ?? ''} alt={viewer?.name} />
      <Avatar.Fallback>{viewer?.name}</Avatar.Fallback>
    </Avatar.Root>
  {:else}
    <LogIn size={16} />
  {/if}
</SidebarButton>
