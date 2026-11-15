<script lang='ts'>
  import { Render, Subscribe, createRender, createTable } from 'svelte-headless-table'
  import { addSortBy, addTableFilter } from 'svelte-headless-table/plugins'
  import MagnifyingGlass from 'svelte-radix/MagnifyingGlass.svelte'

  import { Input } from '../../input'
  import Columnheader from '../columnheader.svelte'

  import { NameCell, ProgressCell } from './cells'

  import * as Table from '#lib/components/ui/table'
  import { server } from '#lib/modules/torrent'
  import { cn, fastPrettyBytes } from '#lib/utils'

  const table = createTable(server.files, {
    sort: addSortBy({ toggleOrder: ['asc', 'desc'] }),
    filter: addTableFilter({
      fn: ({ filterValue, value }) => value.toLowerCase().includes(filterValue.toLowerCase())
    })
  })

  const columns = table.createColumns([
    table.column({
      accessor: 'name',
      header: 'File Name',
      id: 'name',
      cell: ({ value }) => createRender(NameCell, { value })
    }),
    table.column({
      accessor: 'size',
      header: 'Size',
      id: 'size',
      plugins: { filter: { exclude: true } },
      cell: ({ value }) => fastPrettyBytes(value)
    }),
    table.column({
      accessor: 'progress',
      header: 'Progress',
      id: 'progress',
      plugins: { filter: { exclude: true } },
      cell: ({ value }) => createRender(ProgressCell, { value })
    }),
    table.column({ accessor: 'selections', header: 'Streams', id: 'selections' })
  ])

  const tableModel = table.createViewModel(columns)

  const { headerRows, pageRows, tableAttrs, tableBodyAttrs, pluginStates } = tableModel

  const filterValue = pluginStates.filter.filterValue
</script>

<div class='flex items-center scale-parent relative pb-2 overflow-visible'>
  <Input
    class='pl-9 bg-background select:bg-accent select:text-accent-foreground shadow-sm no-scale placeholder:opacity-50'
    placeholder='Search by File Name...'
    bind:value={$filterValue} />
  <MagnifyingGlass class='h-4 w-4 shrink-0 opacity-50 absolute left-3 text-muted-foreground z-10 pointer-events-none' />
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
                  {#if cell.id !== 'flags'}
                    <Columnheader {props}>
                      <Render of={cell.render()} />
                    </Columnheader>
                  {:else}
                    <div class='text-sm px-4'>
                      <Render of={cell.render()} />
                    </div>
                  {/if}
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
            <Table.Row {...rowAttrs} class='h-12 [content-visibility:auto] [contain-intrinsic-height:auto_48px] contain-strict'>
              {#each row.cells as cell (cell.id)}
                <Subscribe attrs={cell.attrs()} let:attrs>
                  <Table.Cell {...attrs} class={cn('px-4 h-14 first:pl-6 last:pr-6 text-nowrap', cell.id === 'name' && 'text-wrap break-all')}>
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
            No files downloaded yet.
          </Table.Cell>
        </Table.Row>
      {/if}
    </Table.Body>
  </Table.Root>
</div>
