<script lang='ts'>
  import { cn } from '$lib/utils'

  let className: string | undefined | null = undefined
  export { className as class }

  export let overlap = 8
  export let border = 4
</script>

<div
  class={cn(
    'flex',
    '[&>*:not(:first-child)]:-ml-[var(--avatars-overlap)] [&>*:not(:first-child)]:relative',
    '[&>*:not(:last-child)]:[mask-image:radial-gradient(50%_50%_at_calc(150%_-_var(--avatars-overlap))_center,transparent_calc(100%_+_var(--avatars-border)_-_1px),black_calc(100%_+_var(--avatars-border)))]',
    className
  )}
  style:--avatars-overlap='{overlap}px'
  style:--avatars-border='{border}px'
>
  <slot />
</div>
