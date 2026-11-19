<script lang='ts'>
  import { DataBodyRow, Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSelectedRows, addSortBy, addTableFilter } from 'svelte-headless-table/plugins'
  import MagnifyingGlass from 'svelte-radix/MagnifyingGlass.svelte'
  import { toast } from 'svelte-sonner'

  import { Button } from '../../button'
  import Columnheader from '../columnheader.svelte'

  import { MediaCell, SeriesRow, StatusCell, DateCell, CheckboxCell } from './cells'

  import type { LibraryEntry } from 'native'
  import type { BodyRow } from 'svelte-headless-table'

  import { Download, FolderSync, Trash } from '#lib/components/icons/animated'
  import * as Dialog from '#lib/components/ui/dialog'
  import { Input } from '#lib/components/ui/input'
  import * as Table from '#lib/components/ui/table'
  import { client } from '#lib/modules/anilist'
  import { IDCard, IDCards } from '#lib/modules/anilist/queries'
  import native from '#lib/modules/native'
  import { server } from '#lib/modules/torrent'
  import { cn, fastPrettyBytes } from '#lib/utils'
  import { goto } from '$app/navigation'

  const lib = server.library

  async function loadCards (entries: LibraryEntry[]) {
    const missing = [...new Set(entries.map(({ mediaID }) => mediaID))].filter((id): id is number => !!id && !client.client.readQuery(IDCard, { id }, { requestPolicy: 'cache-only' })?.data?.Media)
    for (let i = 0; i < missing.length; i += 50) {
      await client.client.query(IDCards, { ids: missing.slice(i, i + 50) })
    }
  }

  $: loadCards($lib)

  const table = createTable(lib, {
    select: addSelectedRows(),
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] }),
    filter: addTableFilter({
      fn: ({ filterValue, value }) => value.toLowerCase().includes(filterValue.toLowerCase())
    })
  })

  const columns = table.createColumns([
    table.column({
      accessor: row => row,
      header: 'Series',
      id: 'series',
      plugins: {
        sort: { getSortValue: (entry: LibraryEntry) => entry.mediaID ?? 0 },
        filter: { getFilterValue: entry => entry.name ?? entry.hash }
      },
      cell: ({ value }) => createRender(MediaCell, { mediaID: value.mediaID, episode: value.episode, name: value.name })
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
      header: 'Download',
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

  const { sortKeys } = pluginStates.sort

  function seriesGroups (rows: Array<BodyRow<LibraryEntry>>) {
    const groups = new Map<BodyRow<LibraryEntry>, Array<DataBodyRow<LibraryEntry>>>()
    let group: Array<DataBodyRow<LibraryEntry>> = []
    for (const row of rows) {
      if (!(row instanceof DataBodyRow) || !row.original.mediaID) continue
      if (group[0]?.original.mediaID !== row.original.mediaID) group = []
      group.push(row)
      groups.set(row, group)
    }
    return groups
  }

  $: groups = $sortKeys[0]?.id === 'series' ? seriesGroups($pageRows) : new Map()

  async function playEntry ({ mediaID, episode, hash }: LibraryEntry) {
    if (!mediaID || !hash) return
    const media = await client.single(mediaID)
    if (!media.data?.Media) return // TODO: log this?
    server.playHash(hash, media.data.Media, episode)
    goto('/#/app/player')
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

  function downloadTorrents () {
    toast.promise(
      Promise.all(getSelected().filter((entry): entry is LibraryEntry & { mediaID: number } => !!entry.mediaID).map(({ hash, mediaID, episode }) => server.backgroundDownload(hash, mediaID, episode))), {
        loading: 'Adding to background downloads...',
        success: 'Added to background downloads',
        error: e => {
          console.error(e)
          return 'Failed to add to background downloads\n' + ('stack' in (e as object) ? (e as Error).stack : 'Unknown error')
        }
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
</script>

<div class='flex gap-2'>
  <div class='flex items-center scale-parent relative pb-2 overflow-visible grow'>
    <Input
      class='pl-9 bg-background select:bg-accent select:text-accent-foreground shadow-sm no-scale placeholder:opacity-50'
      placeholder='Search by Torrent Name...'
      bind:value={$filterValue} />
    <MagnifyingGlass class='h-4 w-4 shrink-0 opacity-50 absolute left-3 text-muted-foreground z-10 pointer-events-none' />
  </div>
  <Button variant='secondary' size='icon' class='border-0 animated-icon' on:click={downloadTorrents} disabled={!$someRowsSelected}>
    <Download class={cn('size-4')} />
  </Button>
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
  <!-- containment does not apply to table rows. the rows use a grid layout. -->
  <Table.Root {...$tableAttrs} class='block' style='--library-columns: minmax(0, 1fr) 6.5rem 8rem 12.5rem 11.5rem 5.5rem'>
    <Table.Header class='block sticky top-0 z-[2] bg-background'>
      {#each $headerRows as headerRow, i (i)}
        <Subscribe rowAttrs={headerRow.attrs()}>
          <Table.Row class='grid grid-cols-[var(--library-columns)]'>
            {#each headerRow.cells as cell (cell.id)}
              <Subscribe
                attrs={cell.attrs()}
                props={cell.props()}
                let:attrs
                let:props>
                <Table.Head {...attrs} class={cn('px-0 first:pl-4 h-12 last:pr-2 content-center')}>
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
    <Table.Body {...$tableBodyAttrs} class='block'>
      {#if $pageRows.length}
        {#each $pageRows as row (row.id)}
          {@const group = groups.get(row)}
          {@const inGroup = group && group.length > 1}
          {#if inGroup && group[0] === row}
            <Table.Row class='min-h-16 [content-visibility:auto] [contain-intrinsic-height:auto_64px] border-b-0 hover:bg-transparent grid grid-cols-[var(--library-columns)]'>
              <SeriesRow rows={group} columnIds={row.cells.map(cell => cell.id)} {selectedDataIds} />
            </Table.Row>
          {/if}
          <Subscribe rowAttrs={row.attrs()} let:rowAttrs>
            <Table.Row {...rowAttrs} class={cn(
              'min-h-16 [content-visibility:auto]',
              inGroup ? 'min-h-11 [contain-intrinsic-height:auto_48px]' : '[contain-intrinsic-height:auto_68px]',
              (row instanceof DataBodyRow) && row.original.mediaID ? 'cursor-pointer' : 'cursor-not-allowed',
              inGroup && group.at(-1) !== row && 'border-b-0',
              'grid grid-cols-[var(--library-columns)]'
            )} on:click={() => { if (row instanceof DataBodyRow) playEntry(row.original) }}>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn(
                    'px-4 last:pr-6 text-nowrap content-center',
                    cell.id === 'select' && 'p-0 relative [&>div]:absolute'
                  )}>
                    {#if inGroup && cell.id === 'series' && row instanceof DataBodyRow}
                      <!-- the series header row above the group shows the cover and the title -->
                      <div class='min-w-0'>
                        <div class='text-xs'>Episode {row.original.episode ?? '?'}</div>
                        <div class='truncate text-xs text-muted-foreground/70' title={row.original.name}>{row.original.name}</div>
                      </div>
                    {:else}
                      <Render of={cell.render()} />
                    {/if}
                  </Table.Cell>
                </Subscribe>
              {/each}
            </Table.Row>
          </Subscribe>
        {/each}
      {:else}
        <Table.Row class='grid grid-cols-[var(--library-columns)]'>
          <Table.Cell colspan={columns.length} class='col-span-full h-40 text-center'>
            No torrents saved on your drive yet.
          </Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>
