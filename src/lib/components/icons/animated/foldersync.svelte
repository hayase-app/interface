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
  class={cn(className, 'overflow-visible')}
  {...$$restProps}
>
  <path
    d='M9 20H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H20a2 2 0 0 1 2 2v.5'
  />
  <g class='target-animated-icon [transform-box:fill-box] origin-center -rotate-[50deg] transition-transform duration-[400ms] ease-back-out'>
    <path d='M12 10v4h4' />
    <path d='m12 14 1.535-1.605a5 5 0 0 1 8 1.5' />
    <path d='M22 22v-4h-4' />
    <path d='m22 18-1.535 1.605a5 5 0 0 1-8-1.5' />
  </g>
</svg>
