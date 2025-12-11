<script lang='ts'>
  import { Slider as SliderPrimitive } from 'bits-ui'

  import { cn } from '$lib/utils.js'

  type $$Props = SliderPrimitive.Props

  let className: $$Props['class'] = undefined
  export let value: $$Props['value'] = [0]
  export { className as class }

  let wrapper: HTMLDivElement

  function capture (e: PointerEvent) {
    wrapper.setPointerCapture(e.pointerId)
  }
  function release (e: PointerEvent) {
    wrapper.releasePointerCapture(e.pointerId)
  }
</script>

<div class='contents' on:pointerup on:pointerdown={capture} on:pointerup={release} on:pointercancel={release} bind:this={wrapper} on:keyup on:keydown>
  <SliderPrimitive.Root
    bind:value
    class={cn('relative flex w-full touch-none select-none items-center', className)}
    {...$$restProps}
    let:thumbs
  >
    <span class='bg-primary/20 relative h-1.5 w-full grow overflow-hidden rounded-full'>
      <SliderPrimitive.Range class='bg-primary absolute h-full' />
    </span>

    {#each thumbs as thumb (thumb)}
      <SliderPrimitive.Thumb
        {thumb}
        class='border-primary/50 bg-background focus-visible:ring-ring block h-4 w-4 rounded-full border shadow transition-colors focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none disabled:opacity-50'
      />
    {/each}
  </SliderPrimitive.Root>
</div>
