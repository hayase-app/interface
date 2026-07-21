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
      const clickHandler = () => api.closeDialog()
      node.addEventListener('click', clickHandler)

      return {
        destroy () {
          node.removeEventListener('click', clickHandler)
        }
      }
    }

    return { action }
  }
</script>

{#if asChild}
  <slot {builder} />
{:else}
  <button use:builder.action class={className} {...$$restProps}>
    <slot {builder} />
  </button>
{/if}
