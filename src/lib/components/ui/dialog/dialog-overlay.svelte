<script lang='ts'>
  import { getContext } from 'svelte'
  import { fade } from 'svelte/transition'

  import { DIALOG_KEY, type DialogContext } from './dialog-context.js'

  import SUPPORTS from '$lib/modules/settings/supports'
  import { cn } from '$lib/utils.js'

  const api = getContext<DialogContext>(DIALOG_KEY)

  let className: string | undefined = ''
  export { className as class }

  function handlePointerDown (e: PointerEvent) {
    if (e.button !== 0) return
    api.closeDialog()
  }
</script>

<div
  transition:fade={{
    duration: 150
  }}
  on:pointerdown|self={handlePointerDown}
  class={cn('custom-bg absolute inset-0 z-50', !SUPPORTS.isUnderPowered && 'backdrop-blur-sm', className)}
  {...$$restProps}
/>
