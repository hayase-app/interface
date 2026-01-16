<script lang='ts'>
  import { DataBodyRow, Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSelectedRows, addSortBy, addTableFilter } from 'svelte-headless-table/plugins'
  import MagnifyingGlass from 'svelte-radix/MagnifyingGlass.svelte'
  import { toast } from 'svelte-sonner'

  import { Button } from '../../button'
  import Columnheader from '../columnheader.svelte'

  import { MediaCell, NameCell, StatusCell, DateCell, CheckboxCell } from './cells'

  import type { LibraryEntry } from 'native'

  import { goto } from '$app/navigation'
  import { FolderSync, Trash } from '$lib/components/icons/animated'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import * as Table from '$lib/components/ui/table'
  import { client } from '$lib/modules/anilist'
  import native from '$lib/modules/native'
  import { server } from '$lib/modules/torrent'
  import { cn, fastPrettyBytes } from '$lib/utils'

  const lib = server.library

  const table = createTable(lib, {
    select: addSelectedRows(),
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] }),
    filter: addTableFilter({
      fn: ({ filterValue, value }) => value.toLowerCase().includes(filterValue.toLowerCase())
    })
  })

  const columns = table.createColumns([
    table.column({
      accessor: 'mediaID',
      header: 'Series',
      id: 'series',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? createRender(MediaCell, { value }) : '?'
    }),
    table.column({
      accessor: 'episode',
      header: 'Episode',
      id: 'episode',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value?.toString() ?? '?'
    }),
    table.column({ accessor: 'files', header: 'Files', id: 'files', plugins: { filter: { exclude: true } } }),
    table.column({
      accessor: 'size',
      header: 'Size',
      id: 'size',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? fastPrettyBytes(value) : '?'
    }),
    table.column({
      accessor: 'progress',
      header: 'Status',
      id: 'completed',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? createRender(StatusCell, { value: value === 1 }) : '?'
    }),
    table.column({
      accessor: 'date',
      header: 'Date',
      id: 'date',
      plugins: { sort: { getSortValue: e => e ?? 0 }, filter: { exclude: true } },
      cell: ({ value }) => value ? createRender(DateCell, { value }) : '?'
    }),
    table.column({
      accessor: e => e?.name ?? e.hash,
      header: 'Torrent Name',
      id: 'name',
      plugins: { sort: { getSortValue: e => e ?? '' } },
      cell: ({ value }) => createRender(NameCell, { value })
    }),
    table.display({
      id: 'select',
      header: (_, { pluginStates }) => {
        const { allPageRowsSelected } = pluginStates.select
        return createRender(CheckboxCell, {
          checked: allPageRowsSelected,
          'aria-label': 'Select all'
        })
      },
      cell: ({ row }, { pluginStates }) => {
        const { getRowState } = pluginStates.select
        const { isSelected } = getRowState(row)
        return createRender(CheckboxCell, {
          checked: isSelected,
          'aria-label': 'Select row'
        })
      },
      plugins: {
        sort: {
          disable: true
        }
      }
    })
  ])

  const tableModel = table.createViewModel(columns)

  const { headerRows, pageRows, rows, tableAttrs, tableBodyAttrs, pluginStates } = tableModel

  async function playEntry ({ mediaID, episode, hash }: LibraryEntry) {
    if (!mediaID || !hash) return
    const media = await client.single(mediaID)
    if (!media.data?.Media) return // TODO: log this?
    server.play(hash, media.data.Media, episode)
    goto('/app/player/')
  }

  const { filterValue } = pluginStates.filter
  const { selectedDataIds, someRowsSelected } = pluginStates.select

  function getSelected () {
    return Object.keys($selectedDataIds).map(id => $lib[id as unknown as number]).filter(e => e) as LibraryEntry[]
  }

  function rescanTorrents () {
    toast.promise(native.rescanTorrents(getSelected().map(e => e.hash)), {
      loading: 'Rescanning torrents...',
      success: 'Rescan complete',
      error: e => {
        console.error(e)
        return 'Failed to rescan torrents\n' + ('stack' in (e as object) ? (e as Error).stack : 'Unknown error')
      },
      description: 'This may take a VERY long while depending on the number of torrents.'
    })
  }

  function deleteTorrents () {
    toast.promise(
      native.deleteTorrents(getSelected().map(e => e.hash))
        .then(() => server.updateLibrary()
          .then(() => pluginStates.select.selectedDataIds.clear())
        ), {
        loading: 'Deleting torrents...',
        success: 'Torrents deleted',
        error: e => {
          console.error(e)
          return 'Failed to delete torrents\n' + ('stack' in (e as object) ? (e as Error).stack : 'Unknown error')
        },
        description: 'This may take a while depending on the library size.'
      })
  }

// TODO once new resolver is implemented
  // $: allIDsPromise = client.multiple($lib.map(e => e.mediaID))
</script>

<div class='flex gap-2'>
  <div class='flex items-center scale-parent relative pb-2 overflow-visible grow'>
    <Input
      class='pl-9 bg-black select:bg-accent select:text-accent-foreground shadow-sm no-scale placeholder:opacity-50'
      placeholder='Search by Torrent Name...'
      bind:value={$filterValue} />
    <MagnifyingGlass class='h-4 w-4 shrink-0 opacity-50 absolute left-3 text-muted-foreground z-10 pointer-events-none' />
  </div>
  <Button variant='secondary' size='icon' class='border-0 animated-icon' on:click={rescanTorrents} disabled={!$someRowsSelected}>
    <FolderSync class={cn('size-4')} />
  </Button>
  <Dialog.Root portal='#root'>
    <Dialog.Trigger asChild let:builder>
      <Button variant='destructive' size='icon' class='border-0 animated-icon' builders={[builder]} disabled={!$someRowsSelected}>
        <Trash class={cn('size-4')} />
      </Button>
    </Dialog.Trigger>
    <Dialog.Content class='max-w-5xl flex flex-col !w-auto'>
      <Dialog.Header>
        <Dialog.Title>Are you absolutely sure?</Dialog.Title>
        <Dialog.Description>
          You are about to permanently delete {$someRowsSelected ? Object.keys($selectedDataIds).length : '0'} torrent(s) from your library. This action cannot be undone.
        </Dialog.Description>
        <ul class='text-xs text-muted-foreground pl-5 space-y-2 py-4 list-disc overflow-clip max-h-[50vh] overflow-y-auto'>
          {#each getSelected() as entry (entry.hash)}
            <li class='text-ellipsis text-nowrap max-w-full'>{entry.name}</li>
          {/each}
        </ul>
      </Dialog.Header>
      <Dialog.Footer>
        <Dialog.Close let:builder asChild>
          <Button variant='destructive' builders={[builder]} on:click={deleteTorrents}>
            Delete
          </Button>
        </Dialog.Close>
        <Dialog.Close let:builder asChild>
          <Button variant='secondary' builders={[builder]}>Cancel</Button>
        </Dialog.Close>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>
<div class='text-muted-foreground flex-1 text-sm text-right mb-1'>
  {Object.keys($selectedDataIds).length} of {$rows.length} row(s) selected.
</div>
<div class='rounded-md border size-full overflow-clip contain-strict'>
  <Table.Root {...$tableAttrs} class='max-h-full'>
    <Table.Header class='px-5'>
      {#each $headerRows as headerRow, i (i)}
        <Subscribe rowAttrs={headerRow.attrs()}>
          <Table.Row class='sticky top-0 bg-black z-[2]'>
            {#each headerRow.cells as cell (cell.id)}
              <Subscribe
                attrs={cell.attrs()}
                props={cell.props()}
                let:attrs
                let:props>
                <Table.Head {...attrs} class={cn('px-0 first:pl-2 h-12 last:pr-2')}>
                  <Columnheader {props}>
                    <Render of={cell.render()} />
                  </Columnheader>
                </Table.Head>
              </Subscribe>
            {/each}
          </Table.Row>
        </Subscribe>
      {/each}
    </Table.Header>
    <Table.Body {...$tableBodyAttrs} class='max-h-full overflow-y-scroll'>
      {#if $pageRows.length}
        {#each $pageRows as row (row.id)}
          <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
            <Table.Row {...rowAttrs} class={cn('h-14 [content-visibility:auto] [contain-intrinsic-height:auto_56px] contain-strict', (row instanceof DataBodyRow) && row.original.mediaID ? 'cursor-pointer' : 'cursor-not-allowed')} on:click={() => { if (row instanceof DataBodyRow) playEntry(row.original) }}>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn(
                    'px-4 min-h-14 first:pl-6 last:pr-6 text-nowrap',
                    (cell.id === 'episode') && 'text-muted-foreground',
                    (cell.id === 'series' || cell.id === 'name') && 'min-w-72 text-wrap break-all',
                    cell.id === 'select' && 'p-0 relative [&>div]:absolute'
                  )}>
                    <Render of={cell.render()} />
                  </Table.Cell>
                </Subscribe>
              {/each}
            </Table.Row>
          </Subscribe>
        {/each}
      {:else}
        <Table.Row>
          <Table.Cell colspan={columns.length} class='h-40 text-center'>
            No torrents downloaded yet.
          </Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>
