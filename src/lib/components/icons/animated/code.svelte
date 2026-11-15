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
  <path d='m18 16 4-4-4-4' class='target-animated-icon path2' />
  <path d='m6 8-4 4 4 4' class='target-animated-icon path1' />
  <path d='m14.5 4-5 16' />
</svg>

<style>
  .target-animated-icon.path1 {
    animation: messageCircleCodePath2Animation 0.6s ease-in-out;
  }

  .target-animated-icon.path2 {
    animation: messageCircleCodePath3Animation 0.6s ease-in-out;
  }

  @keyframes messageCircleCodePath2Animation {
    0% {
      transform: translateX(0);
    }
    33.33% {
      transform: translateX(-1.5px);
    }
    66.67% {
      transform: translateX(0.75px);
    }
    100% {
      transform: translateX(0);
    }
  }

  @keyframes messageCircleCodePath3Animation {
    0% {
      transform: translateX(0);
    }
    33.33% {
      transform: translateX(1.5px);
    }
    66.67% {
      transform: translateX(-0.75px);
    }
    100% {
      transform: translateX(0);
    }
  }
</style>
