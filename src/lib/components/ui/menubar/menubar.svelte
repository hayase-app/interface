<script lang='ts'>
  import ArrowLeft from 'lucide-svelte/icons/arrow-left'
  import ArrowRight from 'lucide-svelte/icons/arrow-right'
  import MagnifyingGlass from 'svelte-radix/MagnifyingGlass.svelte'

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

  afterNavigate(({ delta }) => {
    currentPosition += delta ?? 1
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
    <div class='w-[calc(100%-44px)] left-[44px] top-0 z-[2000] grid grid-cols-[auto_1fr_auto] absolute h-8'>
      <div class='col-1 ml-1.5 flex gap-1.5 items-center {draggable} {!isMac ? 'w-[138px]' : ''}'>
        <Button size='icon-sm' variant='ghost' disabled={!hasPrevious} class='w-6 h-6 p-1 shrink-0 not-draggable text-white' on:click={previous}>
          <ArrowLeft />
        </Button>
        <Button size='icon-sm' variant='ghost' disabled={!hasNext} class='w-6 h-6 p-1 shrink-0 not-draggable  text-white' on:click={next}>
          <ArrowRight />
        </Button>
      </div>
      <div class='w-full flex items-center justify-center {draggable}'>
        <Button size='sm' variant='ghost' class='h-[25px] p-1 shrink-0 not-draggable text-white pl-5 pr-6 gap-2 py-0 text-xs'>
          <MagnifyingGlass class='size-4 shrink-0' />
          <div>
            Search...
          </div>
        </Button>
        <!-- <div class='flex items-center scale-parent relative not-draggable'>
          <Input
            class='pl-9 border-0 bg-background select:bg-accent select:text-accent-foreground shadow-sm no-scale placeholder:opacity-50 capitalize max-w-60'
            placeholder='Search' />
          <MagnifyingGlass class='h-4 w-4 shrink-0 opacity-50 absolute left-3 text-muted-foreground z-10 pointer-events-none' />
        </div> -->
      </div>
      {#if !isMac}
        <div class='window-controls not-draggable flex text-white'>
          <button class='max-button flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.minimise} use:tabindex>
            <svg class='svg-controls w-3 h-3' role='img' viewBox='0 0 12 12'><rect fill='currentColor' height='1' width='10' x='1' y='6' />
          </button>
          <button class='restore-button flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.maximise} use:tabindex>
            <svg class='svg-controls w-3 h-3' role='img' viewBox='0 0 12 12'><rect fill='none' height='9' stroke='currentColor' width='9' x='1.5' y='1.5' />
          </button>
          <button class='close-button flex items-center justify-center h-8 w-[46px] select:bg-secondary-foreground/30' use:click={native.close} use:tabindex>
            <svg class='svg-controls w-3 h-3' role='img' viewBox='0 0 12 12'><polygon fill='currentColor' fill-rule='evenodd' points='11 1.576 6.583 6 11 10.424 10.424 11 6 6.583 1.576 11 1 10.424 5.417 6 1 1.576 1.576 1 6 5.417 10.424 1' />
          </button>
        </div>
      {:else}
        <div class='w-[60px] {draggable}' />
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
  .window-controls button:active {
    background: rgba(255, 255, 255, 0.4);
  }
  .close-button:hover {
    background: #e81123 !important;
  }
  .close-button:active {
    background: #f1707a !important;
  }
</style>
