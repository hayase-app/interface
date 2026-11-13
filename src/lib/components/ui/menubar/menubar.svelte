<script lang='ts'>
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import ArrowRight from 'lucide-svelte/icons/arrow-right'

  import { Button } from '../button'

  import Wrapper from './wrapper.svelte'

  import { afterNavigate } from '$app/navigation'
  import native from '$lib/modules/native'
  import { click } from '$lib/modules/navigate'
  import { debug, settings, SUPPORTS } from '$lib/modules/settings'

  function tabindex (node: HTMLElement) {
    node.tabIndex = -1
  }
  let fullscreenElement: HTMLElement | null = null

  $: draggable = fullscreenElement ? 'custom-not-draggable' : 'custom-draggable'

  let currentPosition = history.length
  let totalPositions = 0

  $: hasNext = currentPosition < totalPositions
  $: hasPrevious = currentPosition > 1

  afterNavigate(({ type, delta }) => {
    if (type === 'popstate' && delta !== undefined) {
      currentPosition += delta
    } else {
      // For 'link', 'goto', etc., we are pushing a new entry
      // The new position is the new length of history
      currentPosition = history.length
    }
    totalPositions = history.length
  })

  function next () {
    if (hasNext) history.forward()
  }
  function previous () {
    if (hasPrevious) history.back()
  }
</script>

<svelte:document bind:fullscreenElement />

{#if !SUPPORTS.isAndroid && !SUPPORTS.isIOS}
  <Wrapper let:platform>
    {@const isMac = platform === 'macOS'}
    <div class='w-full top-0 z-[2000] flex justify-between {draggable} absolute h-8'>
      <div class='flex gap-1.5 items-end ml-14 {isMac ? '!ml-20' : ''}'>
        {#if $settings.showNavigation}
          <Button size='icon-sm' variant='ghost' disabled={!hasPrevious} class='p-1 shrink-0 custom-not-draggable text-foreground' tabindex={-1} on:click={previous}>
            <ArrowLeft strokeWidth='1.2' class='size-5' />
          </Button>
          <Button size='icon-sm' variant='ghost' disabled={!hasNext} class='p-1 shrink-0 custom-not-draggable text-foreground' tabindex={-1} on:click={next}>
            <ArrowRight strokeWidth='1.2' class='size-5' />
          </Button>
        {/if}
      </div>
      {#if !isMac}
        <div class='window-controls custom-not-draggable flex text-foreground'>
          <button class='flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.minimise} use:tabindex>
            <svg class='size-3' role='img' viewBox='0 0 12 12'><rect fill='currentColor' height='1' width='10' x='1' y='6' />
          </button>
          <button class='flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.maximise} use:tabindex>
            <svg class='size-3' role='img' viewBox='0 0 12 12'><rect fill='none' height='9' stroke='currentColor' width='9' x='1.5' y='1.5' />
          </button>
          <button class='flex items-center justify-center h-8 w-[46px] hover:!bg-[#e81123] active:!bg-[#f1707a] select:bg-secondary-foreground/30' use:click={native.close} use:tabindex>
            <svg class='size-3' role='img' viewBox='0 0 12 12'><polygon fill='currentColor' fill-rule='evenodd' points='11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1' />
          </button>
        </div>
      {/if}
    </div>
  </Wrapper>
{/if}
{#if $debug}
  <div class='z-[1000] text-center fixed font-bold pointer-events-none top-0 left-0 bg-[#f63220] shadow-[0_0_0_999px_#f63220] [clip-path:inset(0_-100%)] origin-top-right -translate-x-[29.3%] -rotate-45'>Debug Mode!</div>
{/if}
