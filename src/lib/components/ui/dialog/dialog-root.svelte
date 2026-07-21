<script lang='ts'>
  import { setContext } from 'svelte'
  import { writable } from 'svelte/store'

  import { DIALOG_KEY, type DialogContext } from './dialog-context.js'

  import { pushState } from '$app/navigation'
  import { page } from '$app/stores'

  const dialog = crypto.randomUUID()

  export let open = false
  export let portal: string | HTMLElement = '#root'

  const _open = writable(open)

  let changing = false
  let lastHasState: boolean | undefined = undefined

  $: state = $page.state
  $: hasState = state?.dialog === dialog

  // Sync from history (popstate / back / forward)
  // Only fires when hasState changes, NOT when $_open changes
  $: if (hasState !== lastHasState) {
    lastHasState = hasState
    if (hasState !== $_open) {
      _open.set(hasState)
      open = hasState
    }
  }

  // Sync from parent prop changes (e.g. SearchModal's close() → bind:open)
  $: if (open !== $_open) {
    onOpenChange(open)
  }

  function onOpenChange (value: boolean) {
    if (value === $_open || changing) return

    changing = true

    if (value) {
      pushState(location.href, { ...$page.state, dialog })
      state.dialog = dialog
    } else {
      if (hasState) {
        history.back()
        changing = false
      }
    }

    _open.set(value)
    open = value
    $$restProps.onOpenChange?.(value)
    changing = false
  }

  const api: DialogContext = {
    portal,
    open: _open,
    openDialog: () => onOpenChange(true),
    closeDialog: () => onOpenChange(false)
  }

  setContext(DIALOG_KEY, api)
</script>

<slot />
