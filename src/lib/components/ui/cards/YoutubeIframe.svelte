<script lang='ts' context='module'>
  import { get, writable } from 'svelte/store'

  const ORIGIN = 'https://www.youtube-nocookie.com'
  // a parked player still costs ~10% of a core, even when it holds an unplayable video, so don't keep it forever
  const PARKED_LIFETIME = 30_000
  const ENDED = 0
  const PLAYING = 1
  const CUED = 5

  // moveBefore keeps an iframe loaded when it changes parent, every other DOM move reloads it
  const canMove = 'moveBefore' in Element.prototype

  const params = new URLSearchParams({
    autoplay: '1',
    controls: '0',
    disablekb: '1',
    cc_lang_pref: 'ja',
    rel: '0',
    playsinline: '1',
    fs: '0',
    mute: '1',
    enablejsapi: '1'
  })

  interface PlayerMessage {
    event: string
    info: { playerState?: number, videoData?: { video_id: string, isPlayable: boolean } } | null
  }

  const frame = document.createElement('iframe')
  frame.setAttribute('credentialless', '')
  frame.className = 'w-full border-0 absolute left-0 h-[calc(100%+200px)] top-1/2 transform-gpu -translate-y-1/2 pointer-events-none'
  frame.title = 'trailer'
  frame.allow = 'autoplay'

  const ready = writable(false)
  const playerState = writable(-1)
  const videoId = writable('')
  const playable = writable(true)

  function send (func: string, args: unknown[] | null = null) {
    frame.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*')
  }

  function unload () {
    frame.remove()
    ready.set(false)
    playerState.set(-1)
    videoId.set('')
  }

  let listenInterval: ReturnType<typeof setInterval> | undefined
  frame.addEventListener('load', () => {
    ready.set(false)
    playerState.set(-1)
    // the player ignores the listening request until its scripts run, so repeat it until the player answers
    clearInterval(listenInterval)
    listenInterval = setInterval(() => frame.contentWindow?.postMessage('{"event":"listening","id":1,"channel":"widget"}', '*'), 100)
  })

  addEventListener('message', ({ origin, source, data }) => {
    if (origin !== ORIGIN || source !== frame.contentWindow) return
    clearInterval(listenInterval)
    const { event, info } = JSON.parse(data as string) as PlayerMessage
    if (event === 'onReady') {
      send('setVolume', [30])
      ready.set(true)
    }
    if (info?.playerState !== undefined) playerState.set(info.playerState)
    if (info?.videoData) {
      videoId.set(info.videoData.video_id)
      playable.set(info.videoData.isPlayable)
    }
  })

  let unloadTimeout: ReturnType<typeof setTimeout> | undefined

  function attach (host: HTMLElement, id: string) {
    clearTimeout(unloadTimeout)
    frame.hidden = false
    if (canMove && frame.isConnected) {
      host.moveBefore(frame, null)
    } else {
      frame.src = `${ORIGIN}/embed/${id}?${params}`
      host.append(frame)
    }
  }

  // Svelte removes the DOM before it runs onDestroy and action cleanups, and a removed iframe unloads.
  // An outro runs before the removal, so it can still move the shared player out of this card.
  function park (host: HTMLElement) {
    if (frame.parentElement !== host) return {}
    // a player that isn't ready yet ignores commands, so it would keep playing while parked
    if (!canMove || !get(ready)) {
      unload()
      return {}
    }
    send('stopVideo')
    send('mute')
    frame.hidden = true
    // a plain append would reload the iframe, moveBefore keeps the player loaded
    document.body.moveBefore(frame, null)
    unloadTimeout = setTimeout(unload, PARKED_LIFETIME)
    return {}
  }
</script>

<script lang='ts'>
  import VolumeX from '@lucide/svelte/icons/volume-x'
  import { createEventDispatcher, onDestroy } from 'svelte'

  import Volume2 from '#lib/components/icons/Volume2.svelte'
  import { click } from '#lib/modules/navigate'

  export let id: string

  const dispatch = createEventDispatcher<{hide: boolean}>()

  // a player boot costs more than a second of CPU across the renderer and GPU processes, so don't start one for a pointer that only passes over the card
  let mounted = false
  const mountTimeout = setTimeout(() => { mounted = true }, 500)

  let hide = true

  $: current = mounted && $videoId === id
  // after parking the player is stopped, and it can still hold the video of another card
  $: if (mounted && $ready && (!current || $playerState === CUED)) send('loadVideoById', [id])
  $: if (current && !$playable) dispatch('hide', true)
  $: if (current && $playerState === PLAYING) {
    hide = false
    dispatch('hide', false)
  }
  // youtube started being annoying with buttons, playlist is required for loop to work, but it force shows extra buttons
  // so we loop the video manually
  $: if (current && $playerState === ENDED) send('seekTo', [0, true])

  let muted = true
  function toggleMute () {
    send(muted ? 'unMute' : 'mute')
    muted = !muted
  }

  onDestroy(() => clearTimeout(mountTimeout))
</script>

<!-- indivious is nice because its faster, but not reliable -->
<!-- <video src={`https://inv.tux.pizza/latest_version?id=${media.trailer.id}&itag=18`}
    class='size-full position-absolute left-0'
    class:d-none={hide}
    playsinline
    preload='none'
    loop
    use:volume
    bind:muted
    on:loadeddata={() => { hide = false }}
    autoplay /> -->

<div class='size-full absolute top-0'>
  <div class='absolute z-10 top-0 right-0 p-3 transition-opacity duration-300' class:opacity-0={hide} use:click={toggleMute}>
    {#if muted}
      <VolumeX size='1rem' fill='currentColor' class='pointer-events-none' />
    {:else}
      <Volume2 size='1rem' fill='currentColor' class='pointer-events-none' />
    {/if}
  </div>
  {#if mounted}
    <div class='absolute -inset-28 z-0 pointer-events-none will-change-[opacity]'>
      <div class='absolute inset-28 overflow-hidden rounded-t transition-opacity duration-300' class:opacity-0={hide} use:attach={id} out:park|global />
      <div class='glow-ring absolute inset-0 backdrop-blur-[35px] backdrop-saturate-200' />
    </div>
  {/if}
</div>

<style>
  .glow-ring {
    mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 504 368' preserveAspectRatio='none'%3E%3Cpath fill-rule='evenodd' fill='white' d='M0,0H504V368H0ZM116,112H388A4,4,0,0,1,392,116V256H112V116A4,4,0,0,1,116,112Z'/%3E%3C/svg%3E");
    mask-size: 100% 100%;
    mask-position: 0 0;
    mask-repeat: no-repeat;
  }
</style>
