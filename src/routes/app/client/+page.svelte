<script lang='ts'>
  import { goto } from '$app/navigation'
  import { breakpoints } from '$lib/utils'

  $: if ($breakpoints.md) goto('/#/app/client/overview', { replaceState: true })
</script>
