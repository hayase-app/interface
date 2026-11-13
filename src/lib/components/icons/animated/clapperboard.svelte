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
  <g class='target-animated-icon [transform-origin:4px_20px]'>
    <g class='target-animated-icon [transform-origin:3px_11px]'>
      <path d='M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3Z' />
      <path d='m6.2 5.3 3.1 3.9' />
      <path d='m12.4 3.4 3.1 4' />
    </g>
    <path d='M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z' />
  </g>
</svg>

<style>
  .target-animated-icon {
    animation: clapperboardOuter 0.8s ease-in-out;
  }

  .target-animated-icon {
    animation: clapperboardInner 0.4s ease-in-out;
  }

  @keyframes clapperboardOuter {
    0%,
    50% {
      transform: rotate(-10deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }

  @keyframes clapperboardInner {
    0% {
      transform: rotate(0deg);
    }
    30% {
      transform: rotate(-10deg);
    }
    60% {
      transform: rotate(16deg);
    }
    100% {
      transform: rotate(0deg);
    }
  }
</style>
