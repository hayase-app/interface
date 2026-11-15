<script lang='ts'>
  import { cn } from '#lib/utils'

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
  class={cn(className, 'overflow-visible target-animated-icon')}
  {...$$restProps}
>
  <path d='m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' />
</svg>

<style>
  .target-animated-icon {
    animation: primaryAnimation 0.5s ease-in-out;
  }

  @keyframes primaryAnimation {
    0% {
      transform: scale(1) rotate(0deg);
    }
    20% {
      transform: scale(1.05) rotate(-7deg);
    }
    40% {
      transform: scale(1.05) rotate(7deg);
    }
    100% {
      transform: scale(1) rotate(0deg);
    }
  }
</style>
