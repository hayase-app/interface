<script lang='ts' context='module'>
  import { writable } from 'svelte/store'

  export const extensionInstalURL = writable('')
</script>

<script lang='ts'>
  import { toast } from 'svelte-sonner'

  import ExtensionCard from './ExtensionCard.svelte'

  import type { ExtensionConfig } from '$lib/modules/extensions/types'

  import { Code } from '$lib/components/icons/animated'
  import { Button } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import { safejson, safejs, savedConfigs, storage } from '$lib/modules/extensions'

  let configs: ExtensionConfig[] = []
  let error: string | null = null
  let importing = false
  let isOpen = true

  $: if (!isOpen) $extensionInstalURL = ''

  async function fetchManifest () {
    if (!$extensionInstalURL) {
      error = 'No extension URL provided.'
      return
    }

    const all = await safejson<ExtensionConfig[]>($extensionInstalURL)
    if (!all) {
      error = 'Could not fetch extension manifest from the provided URL.'
      return
    }

    const invalid = all.filter(c => !storage._validateConfig(c))
    if (invalid.length) {
      error = `Invalid extension config: ${invalid.map(c => c.name || c.id).join(', ')}`
      return
    }
    configs = all
  }

  function close () {
    isOpen = false
  }

  fetchManifest()

  async function install () {
    if (!$extensionInstalURL) return
    importing = true
    try {
      await storage.import($extensionInstalURL)
      toast.success('Extensions installed successfully!')
      close()
    } catch (err) {
      const error = err as Error
      toast.error(error.cause as string, { description: error.message, duration: 15_000 })
      importing = false
    }
  }

  $: existingIds = new Set(Object.keys($savedConfigs))
  $: newConfigs = configs.filter(c => !existingIds.has(c.id))
  $: existingConfigs = configs.filter(c => existingIds.has(c.id))
</script>

<Dialog.Root portal='#root' bind:open={isOpen}>
  <Dialog.Content class='flex flex-col max-h-[95%] max-w-3xl bg-black p-4 md:p-6'>
    <Dialog.Header>
      <Dialog.Title>Install Extensions</Dialog.Title>
      <Dialog.Description class='truncate'>
        {$extensionInstalURL}
      </Dialog.Description>
    </Dialog.Header>

    {#if configs === undefined && !error}
      <div class='overflow-y-auto flex flex-col flex-1 min-h-0 items-center justify-center gap-4 py-8'>
        <div class='animate-spin size-6 border-2 border-neutral-400 border-t-transparent rounded-full' />
        <p class='text-muted-foreground'>Fetching extension manifest...</p>
      </div>
    {:else if error}
      <div class='overflow-y-auto flex flex-col flex-1 min-h-0 items-center justify-center gap-4 py-8 text-center'>
        <p class='text-destructive font-bold text-lg'>Failed to load</p>
        <p class='text-muted-foreground text-sm'>{error}</p>
        <p class='text-muted-foreground text-xs break-all'>{$extensionInstalURL}</p>
      </div>
    {:else if configs}
      <div class='overflow-y-auto flex flex-col gap-3 flex-1 min-h-0'>
        {#each newConfigs as config (config.id)}
          <ExtensionCard {config}>
            <div slot='actions'>
              <Dialog.Root portal='#root'>
                <Dialog.Trigger let:builder asChild>
                  <Button builders={[builder]} variant='ghost' size='icon-sm' class='animated-icon'><Code size={18} /></Button>
                </Dialog.Trigger>
                <Dialog.Content class='flex max-h-[95%] max-w-[95%] overflow-auto flex-col !w-auto'>
                  <Dialog.Title class='font-weight-bold font-bold'>{config.name} Source Code</Dialog.Title>
                  {#await safejs(config.code)}
                    <div class='flex items-center justify-center py-8'>
                      <div class='animate-spin size-4 border-2 border-neutral-400 border-t-transparent rounded-full' />
                    </div>
                  {:then code}
                    {#if code}
                      <code class='break-all flex max-h-full overflow-auto whitespace-pre-wrap w-max'>{code}</code>
                    {:else}
                      <p class='text-muted-foreground text-sm p-4'>Failed to load source code.</p>
                    {/if}
                  {/await}
                  <Dialog.Close let:builder asChild>
                    <Button variant='secondary' builders={[builder]}>Close</Button>
                  </Dialog.Close>
                </Dialog.Content>
              </Dialog.Root>
            </div>
          </ExtensionCard>
        {/each}
        {#if existingConfigs.length}
          <div class='bg-neutral-900 border border-neutral-800 px-4 py-3 rounded-md'>
            <p class='text-sm font-bold text-muted-foreground'>Already Installed</p>
            <p class='text-xs text-muted-foreground mt-1'>
              {existingConfigs.map(c => c.name).join(', ')} already exist and will be skipped.
            </p>
          </div>
        {/if}
      </div>
    {/if}

    <Dialog.Footer class='gap-2'>
      {#if error}
        <Button variant='secondary' on:click={close}>Close</Button>
      {:else if configs !== undefined}
        {#if !newConfigs.length && existingConfigs.length}
          <Button variant='secondary' on:click={close}>Close</Button>
        {:else}
          <Button variant='secondary' on:click={close} disabled={importing}>Cancel</Button>
          <Button on:click={install} disabled={importing || !newConfigs.length}>
            {#if importing}
              Installing...
            {:else}
              Install ({newConfigs.length})
            {/if}
          </Button>
        {/if}
      {/if}
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
