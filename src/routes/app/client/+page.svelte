<script lang='ts'>
  import { breakpoints } from '#lib/utils'
  import { goto } from '$app/navigation'

  $: if ($breakpoints.md) goto('/#/app/client/overview', { replace: true })
</script>
