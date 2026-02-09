<script lang='ts' context='module'>
  import { flip } from 'svelte/animate'
  import { cubicInOut } from 'svelte/easing'
</script>

<script lang='ts'>
  import type { UserFrag } from '$lib/modules/anilist/queries'
  import type { ResultOf } from 'gql.tada'

  import { cn } from '$lib/utils'

  let className: string | undefined | null = undefined
  export { className as class }

  export let overlap = 8
  export let border = 4
  export let users: Array<ResultOf<typeof UserFrag>> = []
</script>

<div
  class={cn(
    'flex',
    '[&>*:not(:first-child)]:-ml-[var(--avatars-overlap)] [&>*:not(:first-child)]:relative',
    '[&>*:not(:last-child)]:[mask-image:radial-gradient(50%_50%_at_calc(150%_-_var(--avatars-overlap))_center,transparent_calc(100%_+_var(--avatars-border)_-_1px),black_calc(100%_+_var(--avatars-border)))]',
    className
  )}
  style:--avatars-overlap='{overlap}px'
  style:--avatars-border='{border}px'
>
  {#each users as user, i (user.id ?? i)}
    <div animate:flip={{ duration: 100, easing: cubicInOut }}>
      <slot {user} />
    </div>
  {/each}
</div>
