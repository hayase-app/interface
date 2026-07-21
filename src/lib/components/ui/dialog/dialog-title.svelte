<script lang='ts'>
  import { cn } from '$lib/utils.js'

  let className = ''
  export { className as class }
</script>

<h2 class={cn('text-lg font-semibold leading-none tracking-tight', className)} {...$$restProps}>
  <slot />
</h2>
