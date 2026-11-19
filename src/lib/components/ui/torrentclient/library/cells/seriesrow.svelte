<script lang='ts'>
  import { writable } from 'svelte/store'

  import CheckboxCell from './checkboxcell.svelte'
  import DateCell from './date.svelte'
  import StatusCell from './status.svelte'

  import type { LibraryEntry } from 'native'
  import type { DataBodyRow } from 'svelte-headless-table'
  import type { SelectedRowsState } from 'svelte-headless-table/plugins'

  import * as Table from '#lib/components/ui/table'
  import { client } from '#lib/modules/anilist'
  import { cn, fastPrettyBytes } from '#lib/utils'

  export let rows: Array<DataBodyRow<LibraryEntry>>
  export let columnIds: string[]
  export let columnWidths: Record<string, string>
  export let selectedDataIds: SelectedRowsState<LibraryEntry>['selectedDataIds']

  $: entries = rows.map(row => row.original)
  $: query = client.singleCard(entries[0]?.mediaID ?? 0, 'cache-only')

  $: files = entries.reduce((sum, entry) => sum + entry.files, 0)
  $: size = entries.reduce((sum, entry) => sum + (entry.size || 0), 0)
  $: date = Math.max(...entries.map(entry => entry.date || 0))

  const selected = writable(false)
  $: ids = rows.map(row => row.dataId)
  $: allSelected = ids.every(id => $selectedDataIds[id])
  $: $selected = allSelected
  // the values only differ after a click on the checkbox
  $: if ($selected !== allSelected) {
    if ($selected) selectedDataIds.addAll(ids)
    else selectedDataIds.removeAll(ids)
  }
</script>

{#each columnIds as columnId (columnId)}
  <Table.Cell class={cn(
    'px-4 last:pr-6 text-nowrap text-muted-foreground content-center',
    columnWidths[columnId],
    columnId === 'select' && 'p-0 relative [&>div]:absolute'
  )}>
    {#if columnId === 'series'}
      {#if $query.data?.Media}
        <div class='flex items-center gap-3 min-w-0 w-full text-foreground'>
          {#if $query.data.Media.coverImage?.medium}
            <img src={$query.data.Media.coverImage.medium} alt='' class='h-12 w-8 shrink-0 rounded object-cover' decoding='async' loading='lazy' />
          {/if}
          <div class='truncate font-medium'>{$query.data.Media.title?.userPreferred ?? 'TBA'}</div>
        </div>
      {:else}
        <div class='flex items-center gap-3 min-w-0 w-full'>
          <div class='h-12 w-8 shrink-0 rounded bg-muted animate-pulse' />
          <div class='h-3.5 w-40 max-w-full bg-muted animate-pulse rounded' />
        </div>
      {/if}
    {:else if columnId === 'files'}
      {files}
    {:else if columnId === 'size'}
      {size ? fastPrettyBytes(size) : '?'}
    {:else if columnId === 'completed'}
      <StatusCell value={entries.every(entry => entry.progress === 1)} />
    {:else if columnId === 'date'}
      {#if date}
        <DateCell value={date} />
      {:else}
        ?
      {/if}
    {:else if columnId === 'select'}
      <CheckboxCell checked={selected} aria-label='Select series' />
    {/if}
  </Table.Cell>
{/each}
