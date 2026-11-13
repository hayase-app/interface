<script lang='ts'>
  import { cn } from '$lib/utils'

  export let color = 'currentColor'
  export let size: number | string = 24
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
  class={cn(className, 'overflow-visible')}
  {...$$restProps}
>
  <path d='m15 18-6-6 6-6' class='target-animated-icon -translate-x-[3px] transition-transform duration-200 ease-in' />
</svg>
