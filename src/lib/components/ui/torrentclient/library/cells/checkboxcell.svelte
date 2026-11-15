<script lang='ts'>
  import type { HTMLButtonAttributes } from 'svelte/elements'
  import type { Writable } from 'svelte/store'

  import { Checkbox } from '#lib/components/ui/checkbox'

  type $$Props = HTMLButtonAttributes & {
    checked: Writable<boolean>
  }
  export let checked: Writable<boolean>

  function check () {
    checked.update(value => !value)
  }
</script>

<div class='w-full inset-0 h-full flex justify-center items-center' on:click|self={check} on:click|stopPropagation|stopImmediatePropagation>
  <Checkbox bind:checked={$checked} {...$$restProps} class='mx-4' />
</div>
