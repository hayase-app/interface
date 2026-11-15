<script lang='ts'>
  import { cn } from '#lib/utils'

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
  class={cn(className, 'overflow-visible target-animated-icon')}
  {...$$restProps}
>
  <circle cx='11' cy='11' r='8' />
  <path d='m21 21-4.3-4.3' />
</svg>

<style>
  .target-animated-icon {
    animation: search-bounce 1s ease-in-out;
  }

  @keyframes search-bounce {
    0%,
    100% {
      transform: translateX(0) translateY(0);
    }
    25% {
      transform: translateX(0) translateY(-4px);
    }
    50% {
      transform: translateX(-3px) translateY(0);
    }
  }
</style>
