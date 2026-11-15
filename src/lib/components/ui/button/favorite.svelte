<script lang='ts'>
  import type { Media } from '#lib/modules/anilist'

  import { Heart } from '#lib/components/icons/animated'
  import { Button, iconSizes, type Props } from '#lib/components/ui/button'
  import { authAggregator, fav } from '#lib/modules/auth'
  import { clickwrap, keywrap } from '#lib/modules/navigate'
  import { cn } from '#lib/utils'

  type $$Props = Props & { media: Media }

  let className: $$Props['class'] = ''
  export { className as class }
  export let media: Media
  export let size: NonNullable<$$Props['size']> = 'icon-sm'
  export let variant: NonNullable<$$Props['variant']> = 'ghost'

  async function toggleFav () {
    await authAggregator.toggleFav(media.id)
  }
</script>

<Button {size} {variant} class={cn(className, 'animated-icon')} on:click={clickwrap(toggleFav)} on:keydown={keywrap(toggleFav)}>
  <Heart fill={fav(media) ? 'currentColor' : 'transparent'} size={iconSizes[size]} />
</Button>
