<script lang='ts'>
  import type { SvelteHTMLElements, SVGAttributes } from 'svelte/elements'

  export let name: string | undefined = undefined
  export let color = 'currentColor'
  export let size: number | string = 24
  export let strokeWidth: number | string = 2
  export let absoluteStrokeWidth = false
  export let iconNode: Array<[elementName: keyof SvelteHTMLElements, attrs: SVGAttributes<SVGSVGElement>]> = []

  const defaultAttributes: SVGAttributes<SVGSVGElement> = {
    xmlns: 'http://www.w3.org/2000/svg',
    width: 24,
    height: 24,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round'
  }

  $: classes = ['lucide-icon', 'lucide', name ? `lucide-${name}` : '', $$props.class].filter(Boolean).join(' ')
  $: hasA11yProp = Object.keys($$restProps).some(prop => prop.startsWith('aria-') || prop === 'role')
</script>

<svg
  {...defaultAttributes}
  {...(!hasA11yProp ? { 'aria-hidden': 'true' } : undefined)}
  {...$$restProps}
  width={size}
  height={size}
  stroke={color}
  stroke-width={absoluteStrokeWidth ? Number(strokeWidth) * 24 / Number(size) : strokeWidth}
  class={classes}
>
  {#each iconNode as [tag, attrs], index (index)}
    <svelte:element this={tag} {...attrs} />
  {/each}
  <slot />
</svg>
