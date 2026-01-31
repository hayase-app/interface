<script lang='ts'>
  import { Tabs as TabsPrimitive } from 'bits-ui'

  import { cn } from '$lib/utils.js'

  type $$Props = TabsPrimitive.ListProps & {
    orientation?: 'horizontal' | 'vertical'
  }

  let className: $$Props['class'] = undefined
  export { className as class }
  export let orientation: 'horizontal' | 'vertical' = 'horizontal'
</script>

<TabsPrimitive.List
  class={cn(
    orientation === 'horizontal' ? 'h-9 items-center justify-center' : 'flex-col gap-1 max-w-72 w-full',
    'bg-muted text-muted-foreground rounded-lg p-1 inline-flex',
    className
  )}
  {...$$restProps}
>
  <slot />
</TabsPrimitive.List>
