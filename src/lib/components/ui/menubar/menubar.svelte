<script lang='ts'>
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import ArrowRight from 'lucide-svelte/icons/arrow-right'

  import { Button } from '../button'

  import Wrapper from './wrapper.svelte'

  import { afterNavigate } from '$app/navigation'
  import native from '$lib/modules/native'
  import { click } from '$lib/modules/navigate'
  import { debug, SUPPORTS } from '$lib/modules/settings'

  function tabindex (node: HTMLElement) {
    node.tabIndex = -1
  }
  let fullscreenElement: HTMLElement | null = null

  $: draggable = fullscreenElement ? 'not-draggable' : 'draggable'

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

{#if !SUPPORTS.isAndroid}
  <Wrapper let:platform>
    {@const isMac = platform === 'macOS'}
    <div class='w-full top-0 z-[2000] flex justify-between {draggable} absolute h-8'>
      <div class='ml-1.5 flex gap-1.5 items-center {isMac ? '!ml-12' : ''}'>
        <Button size='icon-sm' variant='ghost' disabled={!hasPrevious} class='p-1 shrink-0 not-draggable text-white' tabindex={-1} on:click={previous}>
          <ArrowLeft strokeWidth='1.2' class='size-5' />
        </Button>
        <Button size='icon-sm' variant='ghost' disabled={!hasNext} class='p-1 shrink-0 not-draggable text-white' tabindex={-1} on:click={next}>
          <ArrowRight strokeWidth='1.2' class='size-5' />
        </Button>
      </div>
      {#if !isMac}
        <div class='window-controls not-draggable flex text-white'>
          <button class='flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.minimise} use:tabindex>
            <svg class='size-3' role='img' viewBox='0 0 12 12'><rect fill='currentColor' height='1' width='10' x='1' y='6' />
          </button>
          <button class='flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.maximise} use:tabindex>
            <svg class='size-3' role='img' viewBox='0 0 12 12'><rect fill='none' height='9' stroke='currentColor' width='9' x='1.5' y='1.5' />
          </button>
          <button class='flex items-center justify-center h-8 w-[46px] close-button select:bg-secondary-foreground/30' use:click={native.close} use:tabindex>
            <svg class='size-3' role='img' viewBox='0 0 12 12'><polygon fill='currentColor' fill-rule='evenodd' points='11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1' />
          </button>
        </div>
      {/if}
    </div>
  </Wrapper>
{/if}
{#if $debug}
  <div class='ribbon z-[1000] text-center fixed font-bold pointer-events-none'>Debug Mode!</div>
{/if}

<style>
  .ribbon {
    background: #f63220;
    box-shadow: 0 0 0 999px #f63220;
    clip-path: inset(0 -100%);
    inset: 0 auto auto 0;
    transform-origin: 100% 0;
    transform: translate(-29.3%) rotate(-45deg);
  }
  .close-button:hover {
    background: #e81123 !important;
  }
  .close-button:active {
    background: #f1707a !important;
  }
</style>
