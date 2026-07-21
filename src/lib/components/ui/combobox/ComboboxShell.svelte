<script lang='ts'>
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Popover from '$lib/components/ui/popover'
  import { breakpoints, cn, flyAndScale } from '$lib/utils'

  export let open = false
  export let portal = '#root'
  export let forcePopover = false
</script>

{#if $breakpoints.md || forcePopover}
  <Popover.Root bind:open let:ids {portal}>
    <Popover.Trigger asChild let:builder>
      <slot name='trigger' {builder} />
    </Popover.Trigger>
    <Popover.Content class={cn('p-0 border-0 z-[1000]')} sameWidth={true}>
      <slot name='content' triggerId={ids.trigger} isMobile={false} />
    </Popover.Content>
  </Popover.Root>
{:else}
  <Dialog.Root bind:open {portal}>
    <Dialog.Trigger asChild let:builder>
      <slot name='trigger' {builder} />
    </Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay />
      <div
        transition:flyAndScale={{
          duration: 200,
          base: 'translate(-50%, 0)'
        }}
        class='bg-popover text-popover-foreground fixed left-[50%] top-[10%] z-50 flex w-full max-w-[clamp(0px,95dvw,30rem)] translate-x-[-50%] flex-col rounded-lg shadow-lg max-h-[80dvh] overflow-hidden'
      >
        <slot name='content' triggerId='' isMobile={true} />
      </div>
    </Dialog.Portal>
  </Dialog.Root>
{/if}
