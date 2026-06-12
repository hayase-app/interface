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

  let className: $$Props['class'] = undefined
  export { className as class }

  $: isActive = $page.route.id?.startsWith(href?.slice(2) ?? '')
</script>

<Button variant='ghost' {href} class={cn(className, 'px-2 w-10 relative md:pl-4 md:w-12 md:rounded-l-none group/sidebar duration-300', isActive ? '!text-background' : 'text-foreground')} {...$$restProps}>
  {#if isActive}
    <div class='bg-primary absolute inset-0 rounded-md md:rounded-l-none group-select/sidebar:bg-primary/70 -z-[1]' in:send={{ key }} out:receive={{ key }} />
  {/if}
  <slot />
</Button>
