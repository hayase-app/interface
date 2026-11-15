<script lang='ts'>
  import { Command as CommandPrimitive } from 'cmdk-sv'

  import { keywrap } from '#lib/modules/navigate'
  import { cn } from '#lib/utils'

  type $$Props = CommandPrimitive.ItemProps

  let className: $$Props['class'] = ''
  export { className as class }

  function click (e: KeyboardEvent) {
    const target = e.target as HTMLElement
    target.click()
  }
</script>

<CommandPrimitive.Item
  {...$$restProps}
  asChild={true}
  let:action
  let:attrs
>
  <div {...$$restProps} on:keydown={keywrap(click)} use:action {...attrs} tabindex={0} class={cn(
    'select:bg-accent select:text-accent-foreground relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
    className
  )}>
    <slot {action} {attrs} />
  </div>
</CommandPrimitive.Item>
