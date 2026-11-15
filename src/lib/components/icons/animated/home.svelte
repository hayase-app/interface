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
  class={cn(className, 'overflow-visible')}
  {...$$restProps}
>
  <path
    d='M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'
  />
  <path d='M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' class='target-animated-icon' />
</svg>

<style>
  .target-animated-icon {
    stroke-dasharray: 22;
    stroke-dashoffset: 0;
    animation: doorAnimation 0.6s ease-out forwards;
  }

  @keyframes doorAnimation {
    0% {
      stroke-dashoffset: 22;
      opacity: 0;
    }
    15% {
      stroke-dashoffset: 22;
      opacity: 0;
    }
    100% {
      stroke-dashoffset: 0;
      opacity: 1;
    }
  }
</style>
