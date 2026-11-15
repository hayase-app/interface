<script lang='ts'>
  // @ts-nocheck i give up with dynamic keys
  import { get } from 'idb-keyval'

  import type { ExtensionConfig } from '#lib/modules/extensions/types'

  import { Bolt, Code } from '#lib/components/icons/animated'
  import { Button } from '#lib/components/ui/button'
  import * as Dialog from '#lib/components/ui/dialog'
  import { Input } from '#lib/components/ui/input'
  import { Label } from '#lib/components/ui/label'
  import * as Select from '#lib/components/ui/select'
  import { Switch } from '#lib/components/ui/switch'
  import { savedOptions as exopts } from '#lib/modules/extensions'

  export let config: ExtensionConfig
</script>

<div class='flex justify-between flex-col items-end pb-1.5'>
  {#if $exopts[config.id] !== undefined}
    <div class='flex'>
      <Dialog.Root portal='#root'>
        <Dialog.Trigger let:builder asChild>
          <Button builders={[builder]} variant='ghost' size='icon-sm' class='animated-icon'><Code size={18} /></Button>
        </Dialog.Trigger>
        <Dialog.Content class='flex max-h-[95%] max-w-[95%] overflow-auto flex-col w-[80vw] h-[70vh]'>
          <Dialog.Title class='font-weight-bold font-bold'>{config.name} Source Code</Dialog.Title>
          {#await get(config.id)}
            Loading...
          {:then code}
            <code class='break-all flex max-h-full overflow-auto whitespace-pre-wrap w-max'>{code}</code>
          {/await}
          <Dialog.Close let:builder asChild>
            <Button variant='secondary' builders={[builder]}>Close</Button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Root>
      {#if Object.keys(config.options ?? {}).length}
        <Dialog.Root portal='#root'>
          <Dialog.Trigger let:builder asChild>
            <Button builders={[builder]} variant='ghost' size='icon-sm' class='animated-icon'><Bolt size={18} /></Button>
          </Dialog.Trigger>
          <Dialog.Content class='flex max-h-[95%] overflow-auto flex-col'>
            <Dialog.Title class='font-weight-bold font-bold'>{config.name} Settings</Dialog.Title>
            <div class='flex flex-col max-h-full gap-y-4 overflow-auto'>
              {#each Object.entries(config.options ?? {}) as [id, options] (id)}
                {#if options.type === 'string'}
                  <div class='space-y-2'>
                    <Label for={id} class='leading-[unset] grow font-bold'>{options.description}</Label>
                    <Input type='text' {id} placeholder={options.default} bind:value={$exopts[config.id].options[id]} />
                  </div>
                {:else if options.type === 'number'}
                  <div class='space-y-2'>
                    <Label for={id} class='leading-[unset] grow font-bold'>{options.description}</Label>
                    <Input type='number' {id} placeholder={options.default} bind:value={$exopts[config.id].options[id]} />
                  </div>
                {:else if options.type === 'boolean'}
                  <div class='flex items-center space-x-2'>
                    <Label for={id} class='leading-[unset] grow font-bold'>{options.description}</Label>
                    <Switch {id} bind:checked={$exopts[config.id].options[id]} />
                  </div>
                {:else if options.type === 'select'}
                  <div class='space-y-2'>
                    <Label for={id} class='leading-[unset] grow font-bold'>{options.description}</Label>
                    <Select.Root
                      portal='#root'
                      selected={$exopts[config.id].options[id] == null
                        ? undefined
                        : { value: $exopts[config.id].options[id], label: String($exopts[config.id].options[id]) }}
                      onSelectedChange={({ value }) => { $exopts[config.id].options[id] = value }}>
                      <Select.Trigger {id}>
                        <Select.Value placeholder={options.default} />
                      </Select.Trigger>
                      <Select.Content fitViewport={true} class='overflow-y-auto'>
                        {#each options.values ?? [] as value, i (i)}
                          <Select.Item {value} label={value}>{value}</Select.Item>
                        {/each}
                      </Select.Content>
                    </Select.Root>
                  </div>
                {/if}
              {/each}
            </div>
            <Dialog.Close let:builder asChild>
              <Button variant='secondary' builders={[builder]}>Close</Button>
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Root>
      {:else}
        <Button disabled variant='ghost' size='icon-sm' class='animated-icon'><Bolt size={18} /></Button>
      {/if}
    </div>
    <Switch class='mt-auto' bind:checked={$exopts[config.id].enabled} hideState={true} />
  {/if}
</div>
