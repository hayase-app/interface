<script lang='ts'>
  import { Dialog as DialogPrimitive } from 'bits-ui'

  import { pushState } from '$app/navigation'
  import { page } from '$app/stores'

  type $$Props = DialogPrimitive.Props

  const dialog = crypto.randomUUID()

  export let open: $$Props['open'] = false

  $: state = $page.state
  $: hasState = state.dialog === dialog

  $: stateChange(hasState)

  // handle navigation via back/forwards history buttons
  function stateChange (hasState: boolean) {
    if (hasState) {
      open = true
    } else {
      open = false
    }
  }

  function onOpenChange (open: boolean) {
    $$restProps.onOpenChange?.(open)
    if (open) {
      if (!hasState) {
        pushState(location.href, { ...state, dialog })
      // state.dialog = dialog
      }
    } else {
      if (hasState) history.back()
    }
  }
</script>

<DialogPrimitive.Root bind:open {...$$restProps} {onOpenChange}>
  <slot />
</DialogPrimitive.Root>
