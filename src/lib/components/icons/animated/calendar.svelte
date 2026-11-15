<script lang='ts'>
  import { cn } from '#lib/utils'

  export let color = 'currentColor'
  export let size = 24
  export let strokeWidth = 2
  let className = ''

  export { className as class }

  const DOTS = [
    { cx: 8, cy: 14 },
    { cx: 12, cy: 14 },
    { cx: 16, cy: 14 },
    { cx: 8, cy: 18 },
    { cx: 12, cy: 18 },
    { cx: 16, cy: 18 }
  ]

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
  <path d='M8 2v4' />
  <path d='M16 2v4' />
  <rect width='18' height='18' x='3' y='4' rx='2' />
  <path d='M3 10h18' />
  {#each DOTS as dot, index (index)}
    <circle
      cx={dot.cx}
      cy={dot.cy}
      r='1'
      fill={color}
      stroke='none'
      class='target-animated-icon'
      style='animation-delay: {index * 0.17}s'
    />
  {/each}
</svg>

<style>
  .target-animated-icon {
    animation: pulse 0.8s;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.3;
    }
    100% {
      opacity: 1;
    }
  }
</style>
