<script lang='ts'>
  import { get } from 'svelte/store'
  import { DataBodyRow, Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSortBy } from 'svelte-headless-table/plugins'

  import Columnheader from '../columnheader.svelte'
  import { ProgressCell, SpeedCell } from '../peers/cells'

  import { goto } from '$app/navigation'
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

  const table = createTable(server.activeTorrents, {
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
      header: 'Download',
      id: 'down',
      cell: ({ value }) => createRender(SpeedCell, { value, type: 'download' })
    }),
    table.column({
      accessor: row => row.speed.up,
      header: 'Upload',
      id: 'up',
      cell: ({ value }) => createRender(SpeedCell, { value, type: 'upload' })
    }),
    table.column({
      accessor: row => row.size.total,
      header: 'Size',
      id: 'size',
      cell: ({ value }) => fastPrettyBytes(value)
    }),
    table.column({
      accessor: row => row.size.downloaded,
      header: 'Downloaded',
      id: 'downloaded',
      cell: ({ value }) => fastPrettyBytes(value)
    }),
    table.column({
      accessor: row => row.size.uploaded,
      header: 'Uploaded',
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
      header: 'Seeders',
      id: 'seeders'
    }),
    table.column({
      accessor: row => row.peers.leechers,
      header: 'Leechers',
      id: 'leechers'
    })
  ])

  const tableModel = table.createViewModel(columns)

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs } = tableModel
</script>

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
                  <Table.Cell {...attrs} class={cn('px-4 h-14 first:pl-6 last:pr-6 text-nowrap', cell.id === 'name' && 'min-w-72 text-wrap break-all', cell.id === 'eta' && 'text-muted-foreground')}>
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
