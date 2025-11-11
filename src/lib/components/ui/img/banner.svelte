<script lang='ts'>
  import { Load } from '.'

  import type { HTMLAttributes } from 'svelte/elements'

  import { banner, cover, title, type Media } from '$lib/modules/anilist'
  import { episodes } from '$lib/modules/anizip'
  import { breakpoints } from '$lib/utils'

  export let media: Media

  type $$Props = HTMLAttributes<HTMLImageElement> & { media: Media }

  $: src = $breakpoints.md ? banner(media) : cover(media)
  $: isYoutube = src?.startsWith('https://i.ytimg.com/')
  let className: $$Props['class'] = ''
  export { className as class }

  // hq720 or maxresdefault is highest, but default so omitted
  const sizes = ['sddefault', 'hqdefault', 'mqdefault', 'default']
  let sizeAttempt = 0

  function verifyThumbnail (e: Event) {
    if (!isYoutube) return
    const img = e.target as HTMLImageElement
    if (img.naturalWidth === 120 && img.naturalHeight === 90) {
      img.src = `https://i.ytimg.com/vi/${media.trailer?.id}/${sizes[sizeAttempt++]}.jpg`
    }
  }
</script>

{#if $breakpoints.md}
  {#await episodes(media.id) then metadata}
    {@const banner = metadata?.images?.find(i => i.coverType === 'Fanart')?.url}
    {@const cover = metadata?.images?.find(i => i.coverType === 'Poster')?.url}
    {@const fallback = banner || cover}
    {#if fallback}
      <Load src={fallback} alt={title(media)} class={className} />
    {:else if src}
      <Load {src} alt={title(media)} class={className} on:load={verifyThumbnail} />
    {/if}
  {/await}
{:else if src}
  <Load {src} alt={title(media)} class={className} on:load={verifyThumbnail} />
{/if}
