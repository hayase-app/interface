<script lang='ts'>
  // import { getContext } from 'svelte'
  import Cross2 from 'svelte-radix/Cross2.svelte'

  // import { DIALOG_KEY, type DialogContext } from './dialog-context.js'

  import * as Dialog from './index.js'

  import type { HTMLAttributes } from 'svelte/elements'

  import { cn, flyAndScale } from '$lib/utils.js'

  // const api = getContext<DialogContext>(DIALOG_KEY)

  type $$Props = HTMLAttributes<HTMLDivElement> & {
    class?: string
  }

  // const api = getContext<DialogContext>(DIALOG_KEY)
  // function focusTrap (node: HTMLElement) {
  //   const focusable = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

  //   function getFocusable () {
  //     return [...node.querySelectorAll<HTMLElement>(focusable)]
  //   }

  //   function handleKeydown (e: KeyboardEvent) {
  //     if (e.key === 'Escape') {
  //       api.closeDialog()
  //       return
  //     }

  //     if (e.key === 'Tab') {
  //       const elements = getFocusable()
  //       if (elements.length === 0) return

  //       const first = elements[0]!
  //       const last = elements[elements.length - 1]!

  //       if (e.shiftKey && document.activeElement === first) {
  //         e.preventDefault()
  //         last.focus()
  //       } else if (!e.shiftKey && document.activeElement === last) {
  //         e.preventDefault()
  //         first.focus()
  //       }
  //     }
  //   }

  //   node.addEventListener('keydown', handleKeydown)

  //   requestAnimationFrame(() => {
  //     const elements = getFocusable()
  //     if (elements.length > 0) {
  //       elements[0]!.focus()
  //     }
  //   })

  //   return {
  //     destroy () {
  //       node.removeEventListener('keydown', handleKeydown)
  //     }
  //   }
  // }

  let className: $$Props['class'] = ''
  export { className as class }
</script>

<Dialog.Portal>
  <Dialog.Overlay />
  <!-- <div
    use:focusTrap
    transition:flyAndScale={{ -->
  <div
    transition:flyAndScale={{
      duration: 200,
      base: 'translate(-50%, -50%)'
    }}
    class={cn(
      'bg-popover fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border p-6 shadow-lg sm:rounded-lg md:w-full',
      className
    )}
    {...$$restProps}
  >
    <slot />
    <Dialog.Close
      class='ring-offset-background focus:ring-ring data-[state=open]:bg-accent/70 data-[state=open]:text-muted-foreground absolute right-4 top-4 rounded-sm transition-opacity select:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none'
    >
      <Cross2 class='size-4' />
      <span class='sr-only'>Close</span>
    </Dialog.Close>
  </div>
</Dialog.Portal>
