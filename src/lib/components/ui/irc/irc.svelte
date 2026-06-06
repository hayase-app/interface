<script lang='ts' context='module'>
  import { client } from '$lib/modules/anilist'
  import MessageClient from '$lib/modules/irc'
</script>

<script lang='ts'>
  import { basename, extname } from 'path'

  import Interface from './interface.svelte'

  import { irc } from '$lib/modules/irc/lobby'

  const viewer = client.client.viewer

  let ident: { nick: string, id: string, pfpid: string, type: 'al' | 'guest', ext: string, prefix: string } = { nick: 'Guest-' + crypto.randomUUID().slice(0, 6), id: crypto.randomUUID().slice(0, 6), pfpid: '', ext: '', prefix: '', type: 'guest' }

  if ($viewer?.viewer) {
    const url = $viewer.viewer.avatar?.large ?? '' // /path/b11111-aaaaaaa.png
    const id = '' + $viewer.viewer.id // 11111
    const ext = extname(url) // .png
    const base = basename(url, ext) // b11111-aaaaaaa
    const pfpid = base.slice(id.length + 2) // aaaaaaa
    ident = { nick: $viewer.viewer.name, id, pfpid, type: 'al', ext: ext.slice(1), prefix: base[0] ?? '' }
  }

  $irc ??= MessageClient.new(ident)
</script>

{#if $irc}
  {#await $irc}
    <div class='size-full flex items-center justify-center flex-col text-muted-foreground text-lg'>
      <svg
        xmlns='http://www.w3.org/2000/svg'
        width='24'
        height='24'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        class='animate-spin mb-2'>
        <path d='M21 12a9 9 0 1 1-6.219-8.56' />
      </svg>
      Loading...
    </div>
  {:then client}
    <Interface {client} />
  {/await}
{/if}
