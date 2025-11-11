<script lang='ts'>
  import Volume2 from 'lucide-svelte/icons/volume-2'
  import VolumeX from 'lucide-svelte/icons/volume-x'
  import { createEventDispatcher } from 'svelte'

  import { createSourceList } from './indivious'

  import { click } from '$lib/modules/navigate'

  export let id: string

  const dispatch = createEventDispatcher<{hide: boolean}>()

  let muted = true
  function toggleMute () {
    muted = !muted
  }

  let hide = true

  function init () {
    console.log('inited!')
    hide = false
    dispatch('hide', false)
  }

  function volume (video: HTMLVideoElement) {
    video.volume = 0.2
  }
</script>

<!-- indivious is nice because its faster, but not reliable -->
<!-- <video src={`https://inv.tux.pizza/latest_version?id=${media.trailer.id}&itag=18`}
    class='w-full h-full position-absolute left-0'
    class:d-none={hide}
    playsinline
    preload='none'
    loop
    use:volume
    bind:muted
    on:loadeddata={() => { hide = false }}
    autoplay /> -->
{#await createSourceList(id) then ids}
  {#if ids.length}
    <div class='h-full w-full overflow-clip absolute top-0 rounded-t'>
      <div class='absolute z-10 top-0 right-0 p-3' class:hide use:click={toggleMute}>
        {#if muted}
          <VolumeX size='1rem' fill='currentColor' class='pointer-events-none' />
        {:else}
          <Volume2 size='1rem' fill='currentColor' class='pointer-events-none' />
        {/if}
      </div>
      <video
        class='w-full border-0 absolute left-0 h-[calc(100%+200px)] top-1/2 transform-gpu -translate-y-1/2 pointer-events-none'
        class:hide
        autoplay
        playsinline
        preload='none'
        loop
        bind:muted
        use:volume
        on:loadeddata={init}>
        {#each ids as src (src)}
          <source {src} />
        {/each}
      </video>
    </div>
    <div class='h-full w-full overflow-clip absolute top-0 rounded-t blur-2xl saturate-200 -z-10 pointer-events-none'>
      <video
        class='w-full border-0 absolute left-0 h-[calc(100%+200px)] top-1/2 transform-gpu -translate-y-1/2'
        class:hide
        autoplay
        playsinline
        preload='none'
        loop
        muted>
        {#each ids as src (src)}
          <source {src} />
        {/each}
      </video>
    </div>
  {/if}
{/await}

<style>
  .absolute {
    transition: opacity 0.3s;
  }
  .absolute.hide {
    opacity: 0;
  }
</style>
