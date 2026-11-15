<script lang='ts' context='module'>
  import FastForward from '@lucide/svelte/icons/fast-forward'
  import Pause from '@lucide/svelte/icons/pause'
  import Rewind from '@lucide/svelte/icons/rewind'
  import Volume1 from '@lucide/svelte/icons/volume-1'
  import { writable } from 'simple-store-svelte'

  import Play from '#lib/components/icons/Play.svelte'
  import Volume2 from '#lib/components/icons/Volume2.svelte'
  import { settings } from '#lib/modules/settings'

  type AnimationType = 'play' | 'pause' | 'seekforw' | 'seekback' | 'volumeup' | 'volumedown' | (string & {})

  export function playAnimation (type: AnimationType) {
    animations.value = [...animations.value, { type, id: crypto.randomUUID() }]
  }

  function endAnimation (id: string) {
    const animationList = animations.value
    const index = animationList.findIndex(animation => animation.id === id)
    if (index !== -1) animationList.splice(index, 1)

    animations.value = animationList
  }

  interface Animation {
    type: AnimationType
    id: string
  }

  const animations = writable<Animation[]>([])
</script>

{#if !$settings.minimalPlayerUI}
  {#each $animations as { type, id } (id)}
    <div class='absolute animate-pulse-once text-foreground' on:animationend={() => endAnimation(id)}>
      {#if type === 'play'}
        <Play size='64px' fill='currentColor' />
      {:else if type === 'pause'}
        <Pause size='64px' fill='currentColor' />
      {:else if type === 'seekforw'}
        <FastForward size='64px' fill='currentColor' />
      {:else if type === 'seekback'}
        <Rewind size='64px' fill='currentColor' />
      {:else if type === 'volumeup'}
        <Volume2 size='64px' fill='currentColor' />
      {:else if type === 'volumedown'}
        <Volume1 size='64px' fill='currentColor' />
      {:else}
        <div class='text-4xl font-bold text-foreground'>{type}</div>
      {/if}
    </div>
  {/each}
{/if}

<style>
  .animate-pulse-once {
    animation: pulse-once .4s linear;
  }

  @keyframes pulse-once {
    0% {
      opacity: 1;
      scale: 1;
    }
    100% {
      opacity: 0;
      scale: 1.2;
    }
  }
</style>
