<script lang='ts'>
  import { set } from 'idb-keyval'

  import { Button } from '#lib/components/ui/button'
  import * as Dialog from '#lib/components/ui/dialog'
  import { Input } from '#lib/components/ui/input'
  import connect, { HOSTNAME, REMOTE_HOSTS_KEY, type LocalHostInfo, type SavedHostInfo } from '#lib/modules/remote'

  const PORT = 49734
  const HOST = `https://${HOSTNAME}:${PORT}`
  const HANDSHAKE_TIMEOUT = 3 * 60 * 1000

  export let data

  let busy = false
  let error = ''
  let addOpen = false
  let addUrl = ''
  let addKey = ''

  async function requestInfo (domain: string, signal?: AbortSignal) {
    const response = await fetch(domain, { cache: 'no-store', signal })
    if (!response.ok) throw new Error(`The host answered with status ${response.status}.`)
    return await response.json() as LocalHostInfo
  }

  let ctrl = new AbortController()
  let popup: Window | null

  async function handshake (domain: string) {
    // A new attempt replaces the previous one.
    ctrl.abort()
    popup?.close()

    const _ctrl = ctrl = new AbortController()
    const _popup = popup = open(domain, 'hayase-local', 'popup,width=420,height=680')

    const timeout = setTimeout(() => _ctrl.abort(), HANDSHAKE_TIMEOUT)

    try {
      while (!_ctrl.signal.aborted) {
        try {
          const info = await requestInfo(domain, ctrl.signal)
          _ctrl.abort()
          _popup?.close()
          return info
        } catch {}
      }
      throw new Error(`The host did not answer within ${HANDSHAKE_TIMEOUT / 60000} minutes.`)
    } finally {
      clearTimeout(timeout)
    }
  }

  // Only a remote endpoint survives a network change, so only it is saved.
  // The name or the url is the identity, so a new key replaces the saved entry.
  // A host reports its external address without the port, so add the default port.
  async function saveRemoteHost (host: SavedHostInfo) {
    const url = new URL(/^https?:\/\//i.test(host.external) ? host.external : `https://${host.external}`)
    if (!url.port) url.port = String(PORT)
    const saved = { ...host, external: url.origin }
    const hosts = data.savedHosts.filter(item => item.name !== saved.name && item.external !== saved.external)
    hosts.push(saved)
    await set(REMOTE_HOSTS_KEY, hosts)
    data.savedHosts = hosts
  }

  async function connectHost (domain = HOST, savedKey?: string) {
    busy = true
    error = ''
    try {
      let key = savedKey
      if (key) {
        await handshake(domain)
      } else {
        const info = await handshake(domain)
        if (!info) return
        key = info.key
        if (!key) throw new Error('The host did not return a key.')
        if (info.external) await saveRemoteHost({ name: info.name, external: info.external, key })
      }
      await connect(key, domain)
    } catch (err) {
      console.error(err)
      const e = err as Error
      error = e.message
    } finally {
      busy = false
    }
  }

  function openAddRemote () {
    error = ''
    addUrl = ''
    addKey = ''
    addOpen = true
  }

  async function submitAddRemote () {
    const value = addUrl.trim().replace(/\/+$/, '')
    const key = addKey.trim()
    if (!value || !key) return

    const external = /^https?:\/\//i.test(value) ? value : `https://${value}`
    try {
      await saveRemoteHost({ name: new URL(external).host, external, key })
    } catch (parseError) {
      console.error(parseError)
    } finally {
      addOpen = false
    }
  }

  $: canAddRemote = !!addUrl.trim() && !!addKey.trim()
</script>

<div class='size-full overflow-y-auto'>
  <div class='mx-auto flex w-full max-w-md flex-col gap-10 px-6 py-12'>
    <section class='flex flex-col gap-3'>
      <h2 class='text-xl font-bold'>Local</h2>
      <Button class='font-bold' disabled={busy} on:click={() => connectHost(HOST)}>Connect to Local</Button>
    </section>

    <section class='flex flex-col gap-3'>
      <div class='flex items-center justify-between'>
        <h2 class='text-xl font-bold'>Remote</h2>
        <Button variant='secondary' size='sm' class='font-bold' disabled={busy} on:click={openAddRemote}>Add</Button>
      </div>
      {#if data.savedHosts.length > 0}
        <div class='flex flex-col gap-2'>
          {#each data.savedHosts as host (host.external)}
            <Button variant='secondary' class='justify-start font-bold' disabled={busy} on:click={() => connectHost(host.external, host.key)}>{host.name}</Button>
          {/each}
        </div>
      {:else}
        <p class='text-sm text-muted-foreground'>Any saved remote connections will show up here.</p>
      {/if}
    </section>

    {#if error}
      <p class='text-sm text-red-500'>{error}</p>
    {/if}
  </div>
</div>

<Dialog.Root portal='#root' bind:open={addOpen}>
  <Dialog.Content class='flex max-w-sm flex-col gap-3 bg-background'>
    <Dialog.Header>
      <Dialog.Title>Add Remote Connection</Dialog.Title>
    </Dialog.Header>
    <Input bind:value={addUrl} placeholder='192.168.1.20:49734' aria-label='Address' />
    <Input bind:value={addKey} placeholder='a1b2c3d4e5f6...' aria-label='Key' />
    <Dialog.Footer class='gap-2'>
      <Dialog.Close let:builder asChild>
        <Button builders={[builder]} variant='secondary'>Cancel</Button>
      </Dialog.Close>
      <Button disabled={!canAddRemote} on:click={submitAddRemote}>Add</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
