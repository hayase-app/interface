<script lang='ts'>
  import { cubicInOut } from 'svelte/easing'
  import { crossfade } from 'svelte/transition'

  import { Button } from './ui/button'

  import { page } from '$app/stores'
  import { breakpoints, cn } from '$lib/utils.js'

  let className: string | undefined | null = ''
  export let items: Array<{ href: string, title: string }>
  export { className as class }

  const [send, receive] = crossfade({
    duration: 150,
    easing: cubicInOut
  })

  const key = 'active-settings-tab'
</script>

<nav class={cn('flex flex-col md:flex-row lg:flex-col gap-y-1 gap-x-2 pb-2 sm:pb-0', className)}>
  {#each items as { href, title }, i (i)}
    {@const isActive = $page.url.pathname === href}
    <Button {href} variant='ghost' data-sveltekit-noscroll size={$breakpoints.md ? 'default' : 'lg'} class='bg-neutral-950 md:bg-transparent relative font-semibold justify-start last:odd:col-span-2'>
      {#if isActive}
        <div class='bg-white absolute inset-0 rounded-md' in:send={{ key }} out:receive={{ key }} />
      {/if}
      <div class='relative text-white transition-colors duration-300' class:!text-black={isActive}>
        {title}
      </div>
    </Button>
  {/each}
</nav>
