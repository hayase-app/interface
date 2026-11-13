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
  <path d='M8 3H5a2 2 0 0 0-2 2v3' class='target-animated-icon -translate-x-[2px] -translate-y-[2px]' />
  <path d='M21 8V5a2 2 0 0 0-2-2h-3' class='target-animated-icon translate-x-[2px] -translate-y-[2px]' />
  <path d='M3 16v3a2 2 0 0 0 2 2h3' class='target-animated-icon -translate-x-[2px] translate-y-[2px]' />
  <path d='M16 21h3a2 2 0 0 0 2-2v-3' class='target-animated-icon translate-x-[2px] translate-y-[2px]' />
</svg>
