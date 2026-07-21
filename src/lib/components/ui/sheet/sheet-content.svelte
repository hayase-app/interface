<script lang='ts'>
  import { fly } from 'svelte/transition'
  import Cross2 from 'svelte-radix/Cross2.svelte'

  import { Close as SheetClose } from '../dialog/index.js'

  import { SheetOverlay, SheetPortal, type Side, sheetTransitions, sheetVariants } from './index.js'

  import { cn } from '$lib/utils.js'

  let className: string | undefined = undefined
  export let side: Side = 'right'
  export { className as class }

  $: inTransitionConfig = sheetTransitions[side ?? 'right'].in
  $: outTransitionConfig = sheetTransitions[side ?? 'right'].out
</script>

<SheetPortal>
  <SheetOverlay />
  <div
    in:fly={inTransitionConfig}
    out:fly={outTransitionConfig}
    class={cn(sheetVariants({ side }), className)}
    {...$$restProps}
  >
    <slot />
    <SheetClose
      class='ring-offset-background focus:ring-ring data-[state=open]:bg-secondary absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none'
    >
      <Cross2 class='h-4 w-4' />
      <span class='sr-only'>Close</span>
    </SheetClose>
  </div>
</SheetPortal>
