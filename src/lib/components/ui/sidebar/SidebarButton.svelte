<script lang='ts' context='module'>
  import { cubicInOut } from 'svelte/easing'
  import { crossfade } from 'svelte/transition'

  const [send, receive] = crossfade({
    duration: 150,
    easing: cubicInOut
  })

  const key = 'active-sidebar-tab'
</script>

<script lang='ts'>
  import { page } from '$app/stores'
  import { Button, type Props } from '$lib/components/ui/button'
  import { cn } from '$lib/utils.js'

  type $$Props = Props
  export let href: string | null | undefined = undefined

  function matchPath (path: string, page: { url: URL }) {
    return page.url.pathname.startsWith(path)
  }

  let className: $$Props['class'] = undefined
  export { className as class }

  $: isActive = href && matchPath(href, $page)
</script>

<Button variant='ghost' {href} class={cn('size-[34px] relative group/sidebar text-primary', className)} {...$$restProps} on:click>
  {#if isActive}
    <div class='bg-primary/10 absolute inset-0 rounded-md' in:send={{ key }} out:receive={{ key }} />
  {/if}
  <div class='relative transition-colors duration-300 pointer-events-none'>
    <slot />
  </div>
</Button>
