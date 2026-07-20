<script lang='ts'>
  import ExternalLink from 'lucide-svelte/icons/external-link'
  import Plus from 'lucide-svelte/icons/plus'
  import Trash from 'lucide-svelte/icons/trash-2'
  import { toast } from 'svelte-sonner'

  import type { PluginInfo } from 'native'

  import { Button, iconSizes } from '$lib/components/ui/button'
  import * as Dialog from '$lib/components/ui/dialog'
  import Plugincard from '$lib/components/ui/plugins/plugincard.svelte'
  import native from '$lib/modules/native'

  let plugins = native.pluginList()

  let pending: PluginInfo | undefined
  let open = false

  async function toastPromise<T> (promise: Promise<T>) {
    try {
      return await promise
    } catch (err) {
      const error = err as Error
      console.error(error)
      toast.error('Plugin Error!', { description: error.message, duration: 15_000 })
    }
  }

  async function pickPlugin () {
    pending = await toastPromise(native.pluginImport())
    open = !!pending
  }
  function close (open: boolean) {
    if (!open) pending = undefined
  }

  async function install () {
    await toastPromise(native.pluginImport(pending?.id))
    plugins = native.pluginList()
  }

  async function remove (id: string) {
    await toastPromise(native.pluginDelete(id))
    plugins = native.pluginList()
  }
</script>

<div class='font-weight-bold text-xl font-bold'>Plugins</div>
<p class='text-muted-foreground text-sm'>
  Hayase supports plugins in the form of Chromium extensions. They can be installed as unpacked folders via manifest.json, packed .crx archives or .zip archives.
</p>
<p class='text-sm font-bold'>
  These are for power users, are ENTIRELY OPTIONAL, and should not be installed blindly, they can easily break the entire app, and are not necessary for normal app use!!!
</p>
<Button class='font-bold flex items-center justify-center w-full sm:w-56 max-w-full shrink-0' size='default' on:click={pickPlugin}>
  <Plus size={iconSizes.lg} class='mr-2' />
  Import Plugin
</Button>
<div class='flex flex-col gap-y-2 justify-center'>
  {#await plugins then list}
    {#each list as plugin (plugin.id)}
      <Plugincard {plugin}>
        <Button variant='ghost' size='icon-sm' class='animated-icon' on:click={() => toastPromise(native.pluginPopup(plugin.id))}>
          <ExternalLink size={16} />
        </Button>
        <Button variant='destructive' size='icon-sm' on:click={() => remove(plugin.id)}>
          <Trash size={16} />
        </Button>
      </Plugincard>
    {/each}
  {/await}
</div>
<Dialog.Root portal='#root' bind:open onOpenChange={close}>
  <Dialog.Content class='flex max-h-[95%] max-w-[95%] overflow-auto flex-col'>
    <Dialog.Title>Review the Plugin and its permissions.</Dialog.Title>
    {#if pending}
      <Plugincard plugin={pending} />
    {/if}
    <Dialog.Close let:builder asChild>
      <Button class='font-bold' builders={[builder]} on:click={install}>Install Plugin</Button>
    </Dialog.Close>
    <Dialog.Close let:builder asChild>
      <Button variant='secondary' builders={[builder]}>Close</Button>
    </Dialog.Close>
  </Dialog.Content>
</Dialog.Root>
