<script lang='ts'>
  import { cn } from '$lib/utils'

  export let color = 'currentColor'
  export let size: string | number = 24
  export let strokeWidth: string | number = 2
  let className = ''

  export { className as class }
</script>

<svg
  xmlns='http://www.w3.org/2000/svg'
  width={size}
  height={size}
  viewBox='0 0 24 24'
  fill='none'
  stroke={color}
  stroke-width={strokeWidth}
  stroke-linecap='round'
  stroke-linejoin='round'
  class={cn(className, 'overflow-visible [&_.target-animated-icon]:transition-transform [&_.target-animated-icon]:duration-300 [&_.target-animated-icon]:ease-back-out')}
  {...$$restProps}
>
  <path d='M8 3v3a2 2 0 0 1-2 2H3' class='target-animated-icon translate-x-px translate-y-px' />
  <path d='M21 8h-3a2 2 0 0 1-2-2V3' class='target-animated-icon -translate-x-px translate-y-px' />
  <path d='M3 16h3a2 2 0 0 1 2 2v3' class='target-animated-icon translate-x-px -translate-y-px' />
  <path d='M16 21v-3a2 2 0 0 1 2-2h3' class='target-animated-icon -translate-x-px -translate-y-px' />
</svg>
