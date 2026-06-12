<script lang='ts'>
  import { goto } from '$app/navigation'
  import { breakpoints } from '$lib/utils'

  $: if ($breakpoints.md) goto('/#/app/settings/player', { replaceState: true })
</script>
