<script lang='ts'>
  import { Drawer as DrawerPrimitive } from 'vaul-svelte'

  import type { HTMLAttributes } from 'svelte/elements'

  import { cn } from '$lib/utils.js'

  type $$Props = HTMLAttributes<HTMLHeadingElement> & { el?: HTMLHeadingElement | undefined }

  export let el: $$Props['el'] = undefined
  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<DrawerPrimitive.Title
  bind:el
  class={cn('text-lg font-semibold leading-none tracking-tight', className)}
  {...$$restProps}
>
  <slot />
</DrawerPrimitive.Title>
