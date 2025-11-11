<script lang='ts'>
  import Menu from 'lucide-svelte/icons/menu'
  import X from 'lucide-svelte/icons/x'

  import SidebarButton from './SidebarButton.svelte'

  import { onNavigate } from '$app/navigation'
  import { breakpoints } from '$lib/utils'

  let open = false // 152 x 140

  onNavigate(() => {
    open = false
  })

  let container: HTMLDivElement | undefined

  function outsideclick (node: HTMLDivElement) {
    const ctrl = new AbortController()

    node.addEventListener('click', e => {
      if (!container || container.contains(e.target as Node)) return
      open = false
    }, { signal: ctrl.signal })

    return { destroy: () => ctrl.abort() }
  }
</script>

<svelte:window use:outsideclick />

{#if !$breakpoints.md}
  <div class='shrink-0 z-50 bg-black absolute left-4 bottom-4 w-[52px] h-[52px] flex rounded-md items-end justify-end overflow-clip transition-[width,height] group-fullscreen/fullscreen:hidden' class:!w-[134px]={open} class:!h-[134px]={open} bind:this={container}>
    <div class='p-2 grid grid-cols-3 gap-2 shrink-0'>
      <slot />
      <SidebarButton variant='ghost' class='relative' on:click={() => { open = !open }}>
        {#if open}
          <X size={18} fill='currentColor' class='pointer-events-none' />
        {:else}
          <Menu size={18} fill='currentColor' class='pointer-events-none' />
        {/if}
      </SidebarButton>
    </div>
  </div>
{:else}
  <div class='w-12 flex flex-col items-center pb-2 z-10 shrink-0 gap-1.5 group-fullscreen/fullscreen:hidden'>
    <slot />
  </div>
{/if}
