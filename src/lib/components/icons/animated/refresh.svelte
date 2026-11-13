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
  class={cn(className, 'overflow-visible align-middle target-animated-icon rotate-[50deg] origin-center transition-transform duration-[400ms] ease-back-out')}
  {...$$restProps}
>
  <path d='M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' fill='none' />
  <path d='M21 3v5h-5' fill='none' />
  <path d='M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' fill='none' />
  <path d='M8 16H3v5' fill='none' />
</svg>
