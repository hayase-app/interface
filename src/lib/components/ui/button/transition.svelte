<script lang='ts'>
  import { Button, type Props } from '#lib/components/ui/button'
  import { clickwrap, keywrap } from '#lib/modules/navigate'
  import { cn, scaleBlurFade } from '#lib/utils'

  type $$Props = Props & { duration?: number }
  export let duration: $$Props['duration'] = 300

  let className: $$Props['class'] = ''
  export { className as class }

  let toggled = false
  let timeout: ReturnType<typeof setTimeout>

  export let size: NonNullable<$$Props['size']> = 'icon-sm'
  export let variant: NonNullable<$$Props['variant']> = 'ghost'

  function handleClick () {
    if (toggled) return

    toggled = true
    clearTimeout(timeout)
    timeout = setTimeout(() => {
      toggled = false
    }, duration! + 500)
  }
</script>

<Button {size} {variant} class={cn(className, 'relative')} on:click={clickwrap(handleClick)} on:click on:keydown={keywrap(handleClick)}>
  {#if toggled}
    <div class='absolute inset-0 flex items-center justify-center' transition:scaleBlurFade={{ duration }}>
      <slot name='transition' />
    </div>
  {:else}
    <div class='absolute inset-0 flex items-center justify-center' transition:scaleBlurFade={{ duration }}>
      <slot name='base' />
    </div>
  {/if}
</Button>
