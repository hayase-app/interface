<script lang='ts'>
  import { cn } from '$lib/utils'

  export let color = 'currentColor'
  export let size = 24
  export let strokeWidth = 2
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
  class={cn(className, 'overflow-visible [transform-origin:center] [&_.target-animated-icon]:transition-transform [&_.target-animated-icon]:duration-200 [&_.target-animated-icon]:ease-in')}
  {...$$restProps}
>
  <g class='target-animated-icon -translate-y-px'>
    <path d='M3 6h18' />
    <path d='M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' />
  </g>
  <path d='M19 8v12c0 1-1 2-2 2H7c-1 0-2-1-2-2V8' class='target-animated-icon translate-y-px' />
</svg>
