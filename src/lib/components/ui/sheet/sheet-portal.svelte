<script lang='ts'>
  import { Portal as DialogPortal } from '../dialog/index.js'

  import { cn } from '$lib/utils.js'

  let className: string | undefined = undefined
  export { className as class }
</script>

<DialogPortal class={cn(className)} {...$$restProps}>
  <slot />
</DialogPortal>
