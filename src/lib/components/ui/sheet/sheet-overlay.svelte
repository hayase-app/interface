<script lang='ts'>
  import { Overlay as DialogOverlay } from '../dialog/index.js'

  import SUPPORTS from '$lib/modules/settings/supports'
  import { cn } from '$lib/utils.js'

  let className: string | undefined = undefined
  export { className as class }
</script>

<DialogOverlay
  class={cn(!SUPPORTS.isUnderPowered && 'backdrop-blur-sm', className)}
  {...$$restProps}
>
  <slot />
</DialogOverlay>
