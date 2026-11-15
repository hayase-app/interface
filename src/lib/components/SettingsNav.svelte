<script lang='ts'>
  import { cubicInOut } from 'svelte/easing'
  import { crossfade } from 'svelte/transition'

  import { Button } from './ui/button'

  import { page } from '#lib/app-state'
  import { breakpoints, cn } from '#lib/utils'

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
    {@const isActive = href.slice(2) === $page.route.id}
    <Button {href} variant={isActive ? 'default' : 'ghost'} data-sveltekit-reset='false' size={$breakpoints.md ? 'default' : 'lg'} class='bg-muted md:bg-transparent relative font-semibold justify-start last:odd:col-span-2'>
      {#if isActive}
        <div class='bg-primary absolute inset-0 rounded-md' in:send={{ key }} out:receive={{ key }} />
      {/if}
      <div class='relative transition-colors duration-300'>
        {title}
      </div>
    </Button>
  {/each}
</nav>
