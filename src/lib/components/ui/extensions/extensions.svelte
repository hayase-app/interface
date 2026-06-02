<script lang='ts'>
  import GitBranch from 'lucide-svelte/icons/git-branch'
  import Globe from 'lucide-svelte/icons/globe'
  import Plus from 'lucide-svelte/icons/plus'
  import { toast } from 'svelte-sonner'

  import { Button, iconSizes } from '../button'

  import ExtensionCard from './ExtensionCard.svelte'
  import ExtensionSettings from './ExtensionSettings.svelte'

  import StatusDot from '$lib/components/StatusDot.svelte'
  import { Input } from '$lib/components/ui/input'
  import * as Tabs from '$lib/components/ui/tabs'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import { savedConfigs, storage } from '$lib/modules/extensions'
  let value = 'extensions'

  let extensionInput = ''

  let importPromise = Promise.resolve()

  function importExtension (ext = extensionInput) {
    importPromise = (async () => {
      try {
        await storage.import(ext)
      } catch (err) {
        const error = err as Error
        toast.error(error.cause as string, { description: error.message, duration: 15_000 })
      }
    })()
  }

  export async function test (id: string) {
    return await storage.codeManager.extensions.get(id)?.test()
  }
// TODO: import files
</script>

<Tabs.Root bind:value class='w-full'>
  <div class='flex justify-between items-center gap-3 sm:flex-row flex-col'>
    <Tabs.List class='grid w-full grid-cols-2 md:max-w-72'>
      <Tabs.Trigger tabindex={0} value='extensions'>Extensions</Tabs.Trigger>
      <Tabs.Trigger tabindex={0} value='repositories'>Repositories</Tabs.Trigger>
    </Tabs.List>
  </div>
  <div class='gap-3 flex py-3 sm:flex-row flex-col'>
    <Tooltip.Root>
      <Tooltip.Trigger class='w-full' tabindex={-1}>
        <Input class='bg-neutral-950 border-none' type='url' placeholder='https://example.com/manifest.json' bind:value={extensionInput} />
      </Tooltip.Trigger>
      <Tooltip.Content class='max-w-full w-52'>
        Destination URL of the extension manifest to import extensions from. This can be a direct URL to a .json file, an npm package prefixed with npm:, a file in a github repository prefixed with gh: or a file with the file: prefix and the code inlined as text.
      </Tooltip.Content>
    </Tooltip.Root>
    {#await importPromise}
      <Button class='font-bold flex items-center justify-center w-full sm:w-56 max-w-full shrink-0 !pointer-events-auto cursor-wait' disabled size='default'>
        <Plus size={iconSizes.lg} class='mr-2' />
        Importing extensions....
      </Button>
    {:then _}
      <Button class='font-bold flex items-center justify-center w-full sm:w-56 max-w-full shrink-0' size='default' on:click={() => importExtension()}>
        <Plus size={iconSizes.lg} class='mr-2' />
        Import Extensions
      </Button>
    {/await}
  </div>
  <Tabs.Content value='extensions' class='mt-0' tabindex={-1}>
    <div class='flex flex-col gap-y-2 justify-center'>
      {#each Object.entries($savedConfigs) as [id, config] (id)}
        <ExtensionCard {config}>
          <div slot='leading'>
            {#await test(id)}
              <Tooltip.Root>
                <Tooltip.Trigger class='inline' tabindex={-1}>
                  <StatusDot variant='PENDING' />
                </Tooltip.Trigger>
                <Tooltip.Content class='max-w-full w-52'>
                  This extension is currently being tested for online status.
                </Tooltip.Content>
              </Tooltip.Root>
            {:then res}
              <Tooltip.Root>
                <Tooltip.Trigger class='inline' tabindex={-1}>
                  <StatusDot variant='COMPLETED' />
                </Tooltip.Trigger>
                <Tooltip.Content class='max-w-full w-52'>
                  {#if res === true || res == null}
                    This extension is online and reachable.
                  {:else if res === false}
                    This extension is offline and unreachable, but the extension expects this.
                  {:else}
                    {res}
                  {/if}
                </Tooltip.Content>
              </Tooltip.Root>
            {:catch error}
              <Tooltip.Root>
                <Tooltip.Trigger class='inline' tabindex={-1}>
                  <StatusDot variant='DROPPED' />
                </Tooltip.Trigger>
                <Tooltip.Content class='max-w-full w-52'>
                  {#if error === false}
                    This extension is offline and unreachable.
                  {:else}
                    {error.message ?? error.stack ?? error}
                  {/if}
                </Tooltip.Content>
              </Tooltip.Root>
            {/await}
          </div>
          <ExtensionSettings slot='actions' {config} />
        </ExtensionCard>
      {:else}
        <div class='px-4 py-6 gap-y-4 flex flex-col items-center'>
          <div class='text-bold text-2xl'>
            Looks like there's nothing here...
          </div>
          <div class='text-sm text-muted-foreground'>
            Import some extensions.
          </div>
        </div>
      {/each}
    </div>
  </Tabs.Content>
  <Tabs.Content value='repositories' class='mt-0' tabindex={-1}>
    <div class='flex flex-col gap-y-2 justify-center'>
      {#each Object.entries(Object.groupBy(Object.values($savedConfigs), saved => saved.update ?? '')) as [id, extensions] (id) }
        {@const url = new URL(id)}
        <div class='bg-neutral-950 px-4 py-3 rounded-md flex flex-row space-x-3 justify-between items-center w-full'>
          <div class='flex space-x-2 items-center'>
            {#if url.protocol === 'gh:'}
              <GitBranch class='w-5 h-5 text-muted-foreground' />
            {:else if url.protocol === 'npm:'}
              <svg class='w-5 h-5 text-muted-foreground' xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'><path fill='currentColor' d='M2 38.5h124v43.71H64v7.29H36.44v-7.29H2Zm6.89 36.43h13.78V53.07h6.89v21.86h6.89V45.79H8.89Zm34.44-29.14v36.42h13.78v-7.28h13.78V45.79Zm13.78 7.29H64v14.56h-6.89Zm20.67-7.29v29.14h13.78V53.07h6.89v21.86h6.89V53.07h6.89v21.86h6.89V45.79Z' /></svg>
            {:else}
              <Globe class='w-5 h-5 text-muted-foreground' strokeWidth='1px' />
            {/if}
            <div>
              {url.protocol.startsWith('http') ? url.hostname : url.href}
            </div>
          </div>
          <div class='text-xs text-muted-foreground'>
            {extensions?.length ?? 0} Extensions
          </div>
        </div>
      {:else}
        <div class='px-4 py-6 gap-y-4 flex flex-col items-center'>
          <div class='text-bold text-2xl'>
            Looks like there's nothing here...
          </div>
          <div class='text-sm text-muted-foreground'>
            Import some extensions in the field above.
          </div>
        </div>
      {/each}
    </div>
  </Tabs.Content>
</Tabs.Root>
