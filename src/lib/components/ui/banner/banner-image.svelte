<script lang='ts' context='module'>
  import { writable } from 'simple-store-svelte'

  import type { Media } from '$lib/modules/anilist'

  import { cn } from '$lib/utils'

  export const bannerSrc = writable<Media | null>(null)

  export const hideBanner = writable(false)
</script>

<script lang='ts'>
  import { Banner } from '../img'

  import type { HTMLAttributes } from 'svelte/elements'

  import { afterNavigate } from '$app/navigation'
  import { page } from '$app/stores'
  import { breakpoints } from '$lib/utils'

  type $$Props = HTMLAttributes<HTMLImageElement>

  let className: $$Props['class'] = ''
  export { className as class } // TODO: needs nice animations, should update to coverimage on mobile width

  $: isBig = $page.route.id === '/app/home'

  $: debounced = $bannerSrc

  afterNavigate(() => {
    if ($page.route.id === '/app/home' || $page.route.id?.startsWith('/app/anime/')) return
    bannerSrc.value = null
  })
</script>

{#if debounced}
  <div class={cn('object-cover w-screen absolute top-0 left-0 h-full overflow-hidden pointer-events-none bg-black', className)}>
    {#key debounced.id}
      <Banner media={debounced} class='min-w-[100vw] w-screen {isBig ? 'h-[80vh] md:h-[90vh]' : 'h-[23rem]' } banner-gr-1 {$breakpoints.md ? '' : 'banner-gr-sm'} object-cover {$hideBanner ? 'opacity-5' : 'opacity-100'} transition-opacity duration-500 relative banner-gr' />
    {/key}
  </div>
{/if}

<style>
  :global(.banner-gr::after) {
    content: '';
    position: absolute;
    left: 0 ; bottom: 0;
    width: 100%;
    height: 100%;
    background: radial-gradient(75% 65% at 59.18% 34.97%, rgba(0, 0, 0, 0.16) 30.56%, rgba(0, 0, 0, 1) 100%)
  }

  :global(.banner-gr-sm::after) {
    background: radial-gradient(75% 65% at 50% 34.97%, rgba(0, 0, 0, 0.16) 30.56%, rgba(0, 0, 0, 1) 100%) !important
  }
</style>
