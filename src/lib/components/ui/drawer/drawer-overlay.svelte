<script lang='ts'>
  import { Drawer as DrawerPrimitive } from 'vaul-svelte'

  import SUPPORTS from '#lib/modules/settings/supports'
  import { cn } from '#lib/utils'

  type $$Props = DrawerPrimitive.OverlayProps

  export let el: $$Props['el'] = undefined
  let className: $$Props['class'] = undefined
  export { className as class }
</script>

<DrawerPrimitive.Overlay
  bind:el
  class={cn('custom-bg fixed inset-0 z-50', !SUPPORTS.isUnderPowered && 'backdrop-blur-sm', className)}
  {...$$restProps}
>
  <slot />
</DrawerPrimitive.Overlay>
