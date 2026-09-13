<script lang='ts'>
  import { get } from 'svelte/store'
  import { DataBodyRow, Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSelectedRows, addSortBy } from 'svelte-headless-table/plugins'
  import { toast } from 'svelte-sonner'

  import Columnheader from '../columnheader.svelte'
  import { CheckboxCell } from '../library/cells'
  import { ProgressCell, SpeedCell } from '../peers/cells'

  import type { TorrentInfo } from 'native'

  import { goto } from '$app/navigation'
  import { Trash } from '$lib/components/icons/animated'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import * as Table from '$lib/components/ui/table'
  import { client } from '$lib/modules/anilist'
  import { server } from '$lib/modules/torrent'
  import { cn, eta, fastPrettyBytes } from '$lib/utils'

  async function playTorrent (hash: string) {
    const entry = get(server.library).find(({ hash: entryHash }) => entryHash === hash)
    if (!entry?.mediaID) return
    const media = await client.single(entry.mediaID)
    if (!media.data?.Media) return
    server.playHash(hash, media.data.Media, entry.episode)
    goto('/#/app/player')
  }

  const torrents = server.activeTorrents

  const table = createTable(torrents, {
    select: addSelectedRows(),
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] })
  })

  const columns = table.createColumns([
    table.column({
      accessor: 'name',
      header: 'Name',
      id: 'name',
      cell: ({ value }) => value || 'Unknown'
    }),
    table.column({
      accessor: 'progress',
      header: 'Progress',
      id: 'progress',
      cell: ({ value }) => createRender(ProgressCell, { value })
    }),
    table.column({
      accessor: row => row.speed.down,
      header: 'Down',
      id: 'down',
      cell: ({ value }) => createRender(SpeedCell, { value, type: 'download', compact: true })
    }),
    table.column({
      accessor: row => row.speed.up,
      header: 'Up',
      id: 'up',
      cell: ({ value }) => createRender(SpeedCell, { value, type: 'upload', compact: true })
    }),
    table.column({
      accessor: row => row.size.total,
      header: 'Size',
      id: 'size',
      cell: ({ value }) => fastPrettyBytes(value)
    }),
    table.column({
      accessor: row => row.size.downloaded,
      header: 'DL',
      id: 'downloaded',
      cell: ({ value }) => fastPrettyBytes(value)
    }),
    table.column({
      accessor: row => row.size.uploaded,
      header: 'UL',
      id: 'uploaded',
      cell: ({ value }) => fastPrettyBytes(value)
    }),
    table.column({
      accessor: row => row.time.remaining / 1000,
      header: 'ETA',
      id: 'eta',
      cell: ({ value }) => eta(value)
    }),
    table.column({
      accessor: row => row.peers.seeders,
      header: 'Seed',
      id: 'seeders'
    }),
    table.column({
      accessor: row => row.peers.leechers,
      header: 'Leech',
      id: 'leechers'
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

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates } = tableModel

  const { selectedDataIds, someRowsSelected } = pluginStates.select

  function getSelected () {
    return Object.keys($selectedDataIds).map(id => $torrents[id as unknown as number]).filter(e => e) as TorrentInfo[]
  }

  function removeTorrents () {
    toast.promise(server.removeBackgroundDownloads(getSelected().map(({ hash }) => hash)).then(() => selectedDataIds.clear()), {
      loading: 'Removing from background downloads...',
      success: 'Removed from background downloads',
      error: e => {
        console.error(e)
        return 'Failed to remove from background downloads\n' + ('stack' in (e as object) ? (e as Error).stack : 'Unknown error')
      }
    })
  }
</script>

<div class='flex justify-end pb-2'>
  <Dialog.Root portal='#root'>
    <Dialog.Trigger asChild let:builder>
      <Button variant='destructive' size='icon' class='border-0 animated-icon' builders={[builder]} disabled={!$someRowsSelected}>
        <Trash class={cn('size-4')} />
      </Button>
    </Dialog.Trigger>
    <Dialog.Content class='max-w-5xl flex flex-col !w-auto'>
      <Dialog.Header>
        <Dialog.Title>Remove from background downloads?</Dialog.Title>
        <Dialog.Description>
          You are about to remove {$someRowsSelected ? Object.keys($selectedDataIds).length : '0'} torrent(s) from background downloads. Downloaded files are not deleted.
        </Dialog.Description>
        <ul class='text-xs text-muted-foreground pl-5 space-y-2 py-4 list-disc overflow-clip max-h-[50vh] overflow-y-auto'>
          {#each getSelected() as entry (entry.hash)}
            <li class='text-ellipsis text-nowrap max-w-full'>{entry.name}</li>
          {/each}
        </ul>
      </Dialog.Header>
      <Dialog.Footer>
        <Dialog.Close let:builder asChild>
          <Button variant='destructive' builders={[builder]} on:click={removeTorrents}>
            Remove
          </Button>
        </Dialog.Close>
        <Dialog.Close let:builder asChild>
          <Button variant='secondary' builders={[builder]}>Cancel</Button>
        </Dialog.Close>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
</div>

<div class='rounded-md border size-full overflow-clip contain-strict'>
  <Table.Root {...$tableAttrs} class='max-h-full'>
    <Table.Header class='px-5'>
      {#each $headerRows as headerRow, i (i)}
        <Subscribe rowAttrs={headerRow.attrs()}>
          <Table.Row class='sticky top-0 bg-background z-[2]'>
            {#each headerRow.cells as cell (cell.id)}
              <Subscribe
                attrs={cell.attrs()}
                props={cell.props()}
                let:attrs
                let:props>
                <Table.Head {...attrs} class={cn('px-0 first:pl-2 h-12 last:pr-2', cell.id === 'name' && 'w-full')}>
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
            <Table.Row {...rowAttrs} class='h-12 cursor-pointer' on:click={() => { if (row instanceof DataBodyRow) playTorrent(row.original.hash) }}>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn(
                    'px-3 h-14 first:pl-4 last:pr-4 text-nowrap',
                    cell.id === 'name' && 'min-w-48 w-full text-wrap break-all',
                    cell.id === 'eta' && 'text-muted-foreground',
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
            No active torrents.
          </Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>
