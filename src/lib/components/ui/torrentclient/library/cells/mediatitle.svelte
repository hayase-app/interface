<script lang='ts'>
  import { client } from '$lib/modules/anilist'

  export let value: number

  const query = client.singleTitle(value)
</script>

{#if $query.fetching}
  ...
{:else if $query.error}
  ?
{:else if $query.data?.Media}
  {$query.data.Media.title?.userPreferred ?? '?'}
{:else}
  ?
{/if}
