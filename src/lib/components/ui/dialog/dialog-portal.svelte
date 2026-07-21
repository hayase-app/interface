<script lang='ts'>
  import { getContext } from 'svelte'

  import { DIALOG_KEY, type DialogContext } from './dialog-context.js'

  const api = getContext<DialogContext>(DIALOG_KEY)
  const dialogOpen = api.open

  export let to: string | HTMLElement | undefined = undefined

  let className = ''
  export { className as class }

  $: target = to ?? api.portal

  function portal (node: HTMLElement) {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    const mount = el ?? document.body

    mount.appendChild(node)

    return {
      destroy () {
        if (node.parentNode) node.remove()
      }
    }
  }
</script>

{#if $dialogOpen}
  <div use:portal class={className} role='dialog'>
    <slot />
  </div>
{/if}
