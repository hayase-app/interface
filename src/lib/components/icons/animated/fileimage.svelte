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
  <path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' />
  <path d='M14 2v4a2 2 0 0 0 2 2h4' />
  <circle cx='10' cy='12' r='2' />
  <path d='m20 17-1.296-1.296a2.41 2.41 0 0 0-3.408 0L9 22' />
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
