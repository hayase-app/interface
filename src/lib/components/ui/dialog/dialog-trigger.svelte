<script lang='ts'>
  import { getContext } from 'svelte'

  import { DIALOG_KEY, type DialogContext } from './dialog-context.js'

  const api = getContext<DialogContext>(DIALOG_KEY)

  export let asChild = false

  let className = ''
  export { className as class }

  const builder = createBuilder()

  function createBuilder () {
    const action = (node: HTMLElement) => {
      const clickHandler = () => api.openDialog()
      node.addEventListener('click', clickHandler)

      const unsub = api.open.subscribe(open => {
        node.setAttribute('aria-expanded', String(open))
        node.setAttribute('data-state', open ? 'open' : 'closed')
      })

      return {
        destroy () {
          node.removeEventListener('click', clickHandler)
          unsub()
        }
      }
    }

    return {
      'aria-haspopup': 'dialog',
      'aria-expanded': false,
      'data-state': 'closed',
      action
    }
  }
</script>

{#if asChild}
  <slot {builder} />
{:else}
  <button
    use:builder.action
    aria-haspopup='dialog'
    aria-expanded='false'
    data-state='closed'
    class={className}
    {...$$restProps}
  >
    <slot {builder} />
  </button>
{/if}
