<script lang='ts'>
  import { Render, Subscribe, createTable } from 'svelte-headless-table'
  import { addSortBy } from 'svelte-headless-table/plugins'

  import * as Table from '#lib/components/ui/table'
  import { server } from '#lib/modules/torrent'
  import { cn } from '#lib/utils'

  const table = createTable(server.trackers, {
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] })
  })

  const columns = table.createColumns([
    table.column({
      accessor: 'announce',
      header: 'Tracker',
      id: 'announce'
    }),
    table.column({
      accessor: 'failed',
      header: 'Status',
      id: 'status',
      cell: ({ value }) => value ? 'Failed' : 'Working'
    }),
    table.column({
      accessor: 'downloaded',
      header: 'Downloaded',
      id: 'downloaded'
    }),
    table.column({
      accessor: 'complete',
      header: 'Seeders',
      id: 'complete'
    }),
    table.column({
      accessor: 'incomplete',
      header: 'Leechers',
      id: 'incomplete'
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
                <Table.Head {...attrs} class={cn('px-0 first:pl-2 h-12 last:pr-2', cell.id === 'progress' && 'w-full')}>
                  <div class='text-sm px-4'>
                    <Render of={cell.render()} />
                  </div>
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
            <Table.Row {...rowAttrs} class='h-12'>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn('px-4 h-14 first:pl-6 last:pr-6 text-nowrap', cell.id === 'time' && 'text-muted-foreground')}>
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
            Loading...
          </Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>
