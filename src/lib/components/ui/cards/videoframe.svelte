<script lang='ts'>
  import VolumeX from 'lucide-svelte/icons/volume-x'
  import { createEventDispatcher } from 'svelte'

  import Volume2 from '$lib/components/icons/Volume2.svelte'
  import { click } from '$lib/modules/navigate'
  import SUPPORTS from '$lib/modules/settings/supports'

  export let src: string

  const dispatch = createEventDispatcher<{hide: boolean}>()

  let hide = true

  let muted = true
  function toggleMute () {
    muted = !muted
  }

  function load () {
    hide = false
    dispatch('hide', false)
  }
</script>

<div class='size-full overflow-clip absolute top-0 rounded-t'>
  <div class='absolute z-10 top-0 right-0 p-3 transition-opacity duration-300' class:opacity-0={hide} use:click={toggleMute}>
    {#if muted}
      <VolumeX size='1rem' fill='currentColor' class='pointer-events-none' />
    {:else}
      <Volume2 size='1rem' fill='currentColor' class='pointer-events-none' />
    {/if}
  </div>
  <video
    crossorigin='anonymous'
    class='w-full border-0 absolute left-0 h-[calc(100%+200px)] top-1/2 transform-gpu -translate-y-1/2 pointer-events-none transition-opacity duration-300'
    class:opacity-0={hide}
    autoplay
    bind:muted
    loop
    volume={0.2}
    on:loadeddata={load}
    {src}
  />
</div>
{#if !SUPPORTS.isUnderPowered}
  <div class='size-full overflow-clip absolute top-0 rounded-t blur-2xl saturate-200 -z-10 pointer-events-none'>
    <video
      crossorigin='anonymous'
      class='w-full border-0 absolute left-0 h-[calc(100%+200px)] top-1/2 transform-gpu -translate-y-1/2 transition-opacity duration-300'
      class:opacity-0={hide}
      muted
      autoplay
      loop
      {src}
    />
  </div>
{/if}
