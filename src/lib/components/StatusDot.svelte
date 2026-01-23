<script lang='ts'>
  import { tv, type VariantProps } from 'tailwind-variants'

  import type { HTMLAttributes } from 'svelte/elements'

  import { cn } from '$lib/utils'

  const dotvariants = tv({
    base: 'inline-flex size-[0.55rem] me-1 rounded-full',
    variants: {
      variant: {
        CURRENT: 'bg-[rgb(61,180,242)]',
        PLANNING: 'bg-[rgb(247,154,99)]',
        COMPLETED: 'bg-[rgb(123,213,85)]',
        PAUSED: 'bg-[rgb(250,122,122)]',
        REPEATING: 'bg-[#3baeea]',
        DROPPED: 'bg-[rgb(200,80,80)]',
        PENDING: 'bg-[rgb(180,180,180)]'
      }
    },
    defaultVariants: {
      variant: 'CURRENT'
    }
  })

  export let variant: VariantProps<typeof dotvariants>['variant'] = 'CURRENT'

  type $$Props = HTMLAttributes<HTMLSpanElement> & { variant: VariantProps<typeof dotvariants>['variant']}

  let className: $$Props['class'] = ''
  export { className as class }
</script>

<span class={cn(dotvariants({ variant }), className)}><slot /></span>
