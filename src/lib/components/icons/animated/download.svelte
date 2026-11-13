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
  class={cn(className, 'overflow-visible [&_.target-animated-icon]:transition-transform [&_.target-animated-icon]:duration-300 [&_.target-animated-icon]:ease-back-in-out')}
  {...$$restProps}
>
  <path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />
  <g>
    <polyline points='7 10 12 15 17 10' class='target-animated-icon translate-y-[2px]' />
    <line x1='12' x2='12' y1='15' y2='3' class='target-animated-icon translate-y-[2px]' />
  </g>
</svg>
