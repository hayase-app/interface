<script lang='ts'>
  import { cn } from '$lib/utils.js'

  let className: string | undefined = undefined
  export { className as class }
</script>

<h2 class={cn('text-foreground text-lg font-semibold', className)} {...$$restProps}>
  <slot />
</h2>
