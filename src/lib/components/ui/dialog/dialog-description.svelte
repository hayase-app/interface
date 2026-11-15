<script lang='ts'>
  import { cn } from '#lib/utils'

  let className: string | undefined = ''
  export { className as class }
</script>

<p class={cn('text-muted-foreground text-sm', className)} {...$$restProps}>
  <slot />
</p>
