<script lang='ts'>
  import { Drawer as DrawerPrimitive } from 'vaul-svelte'

  import type { DialogDescriptionProps } from 'bits-ui'

  import { cn } from '$lib/utils.js'

  type $$Props = DialogDescriptionProps

  export let el: $$Props['el'] = undefined
  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<DrawerPrimitive.Description
  bind:el
  class={cn('text-muted-foreground text-sm', className)}
  {...$$restProps}
>
  <slot />
</DrawerPrimitive.Description>
