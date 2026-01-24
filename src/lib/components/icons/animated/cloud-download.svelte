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
  <g>
    <path d='M12 13v8l-4-4' class='target-animated-icon' />
    <path d='m12 21 4-4' class='target-animated-icon' />
  </g>
  <path d='M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284' />
</svg>

<style>
  .target-animated-icon {
    transform: translateY(2px);
    transition: transform 0.3s cubic-bezier(0.68, -0.6, 0.32, 1.6);
  }
  div {
    display: inline-block;
  }
</style>
