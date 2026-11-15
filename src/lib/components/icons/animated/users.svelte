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
  <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
  <circle cx='9' cy='7' r='4' />
  <path d='M22 21v-2a4 4 0 0 0-3-3.87' class='target-animated-icon' />
  <path d='M16 3.13a4 4 0 0 1 0 7.75' class='target-animated-icon' />
</svg>

<style>
  .target-animated-icon {
    animation: users-slide 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
  }

  @keyframes users-slide {
    0% {
      transform: translateX(0);
    }
    50% {
      transform: translateX(-6px);
    }
    100% {
      transform: translateX(0);
    }
  }
</style>
