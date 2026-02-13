<script lang='ts'>
  // @ts-nocheck i give up with dynamic keys
  import type { ExtensionConfig } from '$lib/modules/extensions/types'

  import { Bolt, Trash } from '$lib/components/icons/animated'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { Input } from '$lib/components/ui/input'
  import { Label } from '$lib/components/ui/label'
  import * as Select from '$lib/components/ui/select'
  import { Switch } from '$lib/components/ui/switch'
  import { storage, savedOptions as exopts } from '$lib/modules/extensions'

  export let config: ExtensionConfig

  function deleteExtension () {
    storage.delete(config.id)
  }
</script>

<div class='flex justify-between flex-col items-end pb-1.5'>
  {#if $exopts[config.id] !== undefined}
    {#if Object.keys(config.options ?? {}).length}
      <Dialog.Root portal='#root'>
        <Dialog.Trigger let:builder asChild>
          <Button builders={[builder]} variant='ghost' size='icon-sm' class='animated-icon'><Bolt size={18} /></Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Header>
            <div class='space-y-4'>
              <Dialog.Title class='font-weight-bold font-bold'>{config.name} Settings</Dialog.Title>
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
                    <Select.Root portal='#root' selected={$exopts[config.id].options[id]} onSelectedChange={({ value }) => { $exopts[config.id].options[id] = value }}>
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
              <div class='pt-3 gap-3 mt-auto flex flex-col sm:flex-row-reverse'>
                <Dialog.Close let:builder asChild>
                  <Button variant='secondary' builders={[builder]}>Cancel</Button>
                  <Button variant='destructive' on:click={deleteExtension} builders={[builder]}>Delete Extension</Button>
                </Dialog.Close>
              </div>
            </div>
          </Dialog.Header>
        </Dialog.Content>
      </Dialog.Root>
    {:else}
      <Button variant='ghost' size='icon-sm' class='animated-icon select:text-red-600' on:click={deleteExtension}>
        <Trash size={16} />
      </Button>
    {/if}
    <Switch class='mt-auto' bind:checked={$exopts[config.id].enabled} hideState={true} />
  {/if}
</div>
