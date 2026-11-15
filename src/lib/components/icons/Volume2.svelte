<script lang='ts'>
  import Icon from './Icon.svelte'

  import type { SvelteHTMLElements, SVGAttributes } from 'svelte/elements'

  type Attrs = SVGAttributes<SVGSVGElement>
  const iconNode: Array<[elementName: keyof SvelteHTMLElements, attrs: Attrs]> = [
    ['path', { d: 'M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z' }],
    ['path', { d: 'M16 9a5 5 0 0 1 0 6' }],
    ['path', { d: 'M19.364 18.364a9 9 0 0 0 0-12.728', fill: 'none' }]
  ]
</script>

<Icon name='volume-2' {...$$props} {iconNode} viewBox='0 0 24 24'>
  <slot />
</Icon>
