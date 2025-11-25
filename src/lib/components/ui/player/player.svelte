<script lang='ts'>
  import Captions from 'lucide-svelte/icons/captions'
  // import Cast from 'lucide-svelte/icons/cast'
  import Contrast from 'lucide-svelte/icons/contrast'
  import DecimalsArrowLeft from 'lucide-svelte/icons/decimals-arrow-left'
  import DecimalsArrowRight from 'lucide-svelte/icons/decimals-arrow-right'
  import FastForward from 'lucide-svelte/icons/fast-forward'
  import List from 'lucide-svelte/icons/list'
  import Pause from 'lucide-svelte/icons/pause'
  import PictureInPicture2 from 'lucide-svelte/icons/picture-in-picture-2'
  import Proportions from 'lucide-svelte/icons/proportions'
  import RefreshCcw from 'lucide-svelte/icons/refresh-ccw'
  import Rewind from 'lucide-svelte/icons/rewind'
  import RotateCcw from 'lucide-svelte/icons/rotate-ccw'
  import RotateCw from 'lucide-svelte/icons/rotate-cw'
  import ScreenShare from 'lucide-svelte/icons/screen-share'
  import SkipBack from 'lucide-svelte/icons/skip-back'
  import SkipForward from 'lucide-svelte/icons/skip-forward'
  import Volume1 from 'lucide-svelte/icons/volume-1'
  import Volume2 from 'lucide-svelte/icons/volume-2'
  import VolumeX from 'lucide-svelte/icons/volume-x'
  import { onDestroy, onMount } from 'svelte'
  import { fade } from 'svelte/transition'
  import { persisted } from 'svelte-persisted-store'
  import { toast } from 'svelte-sonner'
  import VideoDeband from 'video-deband'

  import ProgressButton from '../button/progress-button.svelte'

  import Animations, { playAnimation } from './animations.svelte'
  import DownloadStats from './downloadstats.svelte'
  import EpisodesModal from './episodesmodal.svelte'
  import { condition, loadWithDefaults } from './keybinds.svelte'
  import Options from './options.svelte'
  import PictureInPicture from './pip'
  import Seekbar from './seekbar.svelte'
  import Subs from './subtitles'
  import Thumbnailer from './thumbnailer'
  import { findChapter, getChaptersAniSkip, getChapterTitle, isChapterSkippable, sanitizeChapters, screenshot, type Chapter, type MediaInfo } from './util'
  import Volume from './volume.svelte'

  import type { ResolvedFile } from './resolver'
  import type { TorrentFile } from 'native'
  import type { SvelteMediaTimeRange } from 'svelte/elements'

  import { beforeNavigate, goto } from '$app/navigation'
  import { page } from '$app/stores'
  import PictureInPictureOff from '$lib/components/icons/PictureInPicture.svelte'
  import PictureInPictureExit from '$lib/components/icons/PictureInPictureExit.svelte'
  import Play from '$lib/components/icons/Play.svelte'
  import Subtitles from '$lib/components/icons/Subtitles.svelte'
  import { Maximize, Minimize } from '$lib/components/icons/animated'
  import { Button, iconSizes } from '$lib/components/ui/button'
  import { authAggregator } from '$lib/modules/auth'
  import { isPlaying } from '$lib/modules/idle'
  import native from '$lib/modules/native'
  import { click, inputType, keywrap } from '$lib/modules/navigate'
  import { settings, SUPPORTS } from '$lib/modules/settings'
  import { w2globby } from '$lib/modules/w2g/lobby'
  import { getAnimeProgress, setAnimeProgress } from '$lib/modules/watchProgress'
  import { toTS, scaleBlurFade, cn } from '$lib/utils'

  export let mediaInfo: MediaInfo
  export let otherFiles: TorrentFile[]
  export let videoFiles: ResolvedFile[]
  export let selectFile: (file: ResolvedFile) => void
  export let prev: (() => void) | undefined = undefined
  export let next: (() => void) | undefined = undefined
  // bindings
  // values
  let videoHeight = 9
  let videoWidth = 16
  let currentTime = 0
  let seekPercent = 0
  let duration = 1
  const playbackRate = persisted('playbackRate', 1, {
    serializer: {
      stringify: (value) => value.toString(),
      parse: (value) => Math.min(16, Math.max(0.1, parseFloat(value)))
    }
  })
  let buffered: SvelteMediaTimeRange[] = []
  let subtitleDelay = 0
  $: buffer = Math.max(...buffered.map(({ end }) => end))
  let readyState = 0
  $: safeduration = isFinite(duration) ? duration : currentTime
  const volume = persisted('volume', 1)
  $: exponentialVolume = SUPPORTS.isAndroid ? 1 : $volume ** 3
  let muted = false

  const timeFormat = persisted('timeFormat', 'positive' as 'positive' | 'negative')

  // elements
  let fullscreenElement: HTMLElement | null = null
  let video: HTMLVideoElement
  let wrapper: HTMLDivElement

  let subtitles: Subs | undefined
  let deband: VideoDeband | undefined

  const pip = new PictureInPicture()
  $: pip._setElements(video, subtitles, deband)
  const pipElementStore = pip.element
  $: pictureInPictureElement = $pipElementStore

  const thumbnailer = new Thumbnailer(mediaInfo.file.url)
  onMount(() => thumbnailer.setVideo(video))

  onDestroy(() => {
    pip.destroy()
    thumbnailer.destroy()
  })

  // @ts-expect-error bad type infer
  $: if (subtitles?.renderer) subtitles.renderer.timeOffset = Number(subtitleDelay)

  // state
  let seeking = false
  let ended = false
  let paused = true
  let pointerMoving = false
  let fastForwarding = false
  // const cast = false

  $: $isPlaying = !paused

  $: buffering = readyState < 3
  $: immersed = (!buffering && !paused && !ended && !pictureInPictureElement && !pointerMoving) || fastForwarding
  $: isMiniplayer = $page.route.id !== '/app/player'

  $: if (!isMiniplayer && SUPPORTS.isAndroidTV) fullscreen()

  let pointerMoveTimeout = 0
  function resetMove (time = 300) {
    clearTimeout(pointerMoveTimeout)
    pointerMoving = true
    pointerMoveTimeout = setTimeout(() => {
      pointerMoving = false
    }, time)
  }

  // functions
  function playPause () {
    playAnimation(paused ? 'play' : 'pause')
    return paused ? video.play() : video.pause()
  }
  function fullscreen () {
    return fullscreenElement ? document.exitFullscreen() : document.getElementById('episodeListTarget')!.requestFullscreen()
  }

  // function toggleCast () {
  // // TODO: never
  // }

  $: fullscreenElement ? screen.orientation.lock('landscape') : screen.orientation.unlock()

  beforeNavigate(({ to }) => {
    if (fullscreenElement && to?.route.id !== '/app/player') fullscreen()
  })

  function checkAudio () {
    if ('audioTracks' in HTMLVideoElement.prototype && video.audioTracks) {
      if (!video.audioTracks.length) {
        toast.error('Audio Codec Unsupported', {
          description: "This torrent's audio codec is not supported, try a different release by disabling Autoplay Torrents in Torrent settings. You can also use external players like MPV."
        })
      } else if (video.audioTracks.length > 1) {
        const preferredTrack = [...video.audioTracks].find(({ language }) => language === $settings.audioLanguage)
        if (preferredTrack) return selectAudio(preferredTrack.id)

        const japaneseTrack = [...video.audioTracks].find(({ language }) => language === 'jpn')
        if (japaneseTrack) return selectAudio(japaneseTrack.id)
      }
    } else {
      video.requestVideoFrameCallback(() => {
        // using capturestream.getAudioTracks() could work too
        if ('webkitAudioDecodedByteCount' in video && video.webkitAudioDecodedByteCount === 0) {
          toast.error('Audio Codec Unsupported', {
            description: "This torrent's audio codec is not supported, try a different release by disabling Autoplay Torrents in Torrent settings. You can also use external players like MPV."
          })
        }
      })
    }
  }
  function changeVolume (delta: number) {
    playAnimation(delta > 0 ? 'volumeup' : 'volumedown')
    $volume = Math.min(1, Math.max(0, $volume + delta))
  }
  function selectAudio (id: string) {
    if (id) {
      for (const track of video.audioTracks ?? []) {
        track.enabled = track.id === id
        playAnimation(track.label)
      }
      seek(-0.2) // stupid fix because video freezes up when chaging tracks
    }
  }
  function selectVideo (id: string) {
    if (id) {
      for (const track of video.videoTracks ?? []) {
        track.selected = track.id === id
        playAnimation(track.label)
      }
    }
  }
  function seek (time: number) {
    // WARN: this causes all subscriptions to video to re-run!!!
    video.currentTime = currentTime = currentTime + time
    // currentTime = currentTime + time
    playAnimation(time > 0 ? 'seekforw' : 'seekback')
  }
  function seekTo (time: number) {
    video.currentTime = currentTime = time
    playAnimation(time > currentTime ? 'seekforw' : 'seekback')
  }
  let wasPaused = false
  function startSeek () {
    wasPaused = paused
    if (!paused) video.pause()
  }

  function finishSeek () {
    seekTo(seekPercent * safeduration / 100)
    if (!wasPaused) video.play()
  }

  let chapters: Chapter[] = []
  const chaptersPromise = native.chapters(mediaInfo.file.hash, mediaInfo.file.id)
  async function loadChapters (pr: typeof chaptersPromise, safeduration: number) {
    const nativeChapters = await pr
    if (nativeChapters.length) {
      chapters = sanitizeChapters(nativeChapters, safeduration)
      return
    }

    const idMal = mediaInfo.media.idMal
    if (!idMal) return
    const aniSkipChapters = await getChaptersAniSkip(idMal, mediaInfo.episode, safeduration)
    if (!aniSkipChapters.length) return
    chapters = sanitizeChapters(aniSkipChapters, safeduration)
  }
  $: loadChapters(chaptersPromise, safeduration)

  function createSubtitles (video: HTMLVideoElement) {
    subtitles = new Subs(video, otherFiles, mediaInfo.file)
    return {
      destroy: () => {
        subtitles?.destroy()
      }
    }
  }

  function createDeband (video: HTMLVideoElement, playerDeband: boolean) {
    const create = () => {
      if (deband) return
      try {
        deband = new VideoDeband(video)
        deband.canvas.classList.add('deband-canvas', 'w-full', 'h-full', 'pointer-events-none', 'object-contain')
        video.before(deband.canvas)
      } catch (e) {
        console.error('Failed to create video deband:', e)
        destroy()
      }
    }

    const destroy = () => {
      deband?.destroy()
      deband?.canvas.remove()
      deband = undefined
    }

    if (playerDeband) create()

    return {
      destroy,
      update: (playerDeband: boolean) => {
        if (playerDeband) {
          create()
        } else {
          destroy()
        }
      }
    }
  }

  let completed = false
  async function checkCompletion () {
    if (!completed && $settings.playerAutocomplete) {
      const fromend = Math.max(180, safeduration / 10)
      if (safeduration && currentTime && readyState && safeduration - fromend < currentTime) {
        authAggregator.watch(mediaInfo.media, mediaInfo.episode)
        completed = true
      }
    }
  }

  // other
  $: if (ended && $settings.playerAutoplay && !isMiniplayer) next?.()

  function handleVisibility (visibility: DocumentVisibilityState) {
    if (!ended && $settings.playerPause && !pictureInPictureElement) {
      if (visibility === 'hidden') {
        visibilityPaused = paused
        paused = true
      } else {
        if (!visibilityPaused) paused = false
      }
    }
  }
  let visibilityPaused = true
  let visibilityState: DocumentVisibilityState
  $: handleVisibility(visibilityState)

  function autoPlay () {
    if (!isMiniplayer) video.play()
  }

  const interval = setInterval(() => {
    video.load()
  }, 10_000)

  onDestroy(() => clearInterval(interval))

  $: if (readyState > 0) clearInterval(interval)

  let currentSkippable: string | null = null
  function checkSkippableChapters () {
    const current = findChapter(currentTime, chapters)
    const wasSkippable = currentSkippable
    if (current) {
      currentSkippable = isChapterSkippable(current)
      if ($settings.playerSkip && !wasSkippable) animating = true
    }
  }

  function stopAnimation () {
    animating = false
  }

  let animating = false

  function skip () {
    const current = findChapter(currentTime, chapters)
    if (current) {
      if (!isChapterSkippable(current) && (current.end - current.start) > 100) {
        currentTime = currentTime + 85
      } else {
        const endtime = current.end + 0.5
        currentTime = endtime
        currentSkippable = null
      }
    } else if (currentTime < 10) {
      currentTime = 90
    } else if (safeduration - currentTime < 90) {
      currentTime = safeduration
    } else {
      currentTime = currentTime + 85
    }
  }

  let stats: {
    fps?: string
    presented?: number
    dropped?: number
    processing?: string
    viewport?: string
    resolution?: string
    buffer?: string
    speed?: number
  } | null = null
  let requestCallback: number | null = null
  function toggleStats () {
    if (requestCallback) {
      stats = null
      video.cancelVideoFrameCallback(requestCallback)
      requestCallback = null
    } else {
      requestCallback = video.requestVideoFrameCallback((a, b) => {
        stats = {}
        handleStats(a, b, b)
      })
    }
  }
  async function handleStats (now: number, metadata: VideoFrameCallbackMetadata, lastmeta: VideoFrameCallbackMetadata) {
    if (stats) {
      const msbf = (metadata.mediaTime - lastmeta.mediaTime) / (metadata.presentedFrames - lastmeta.presentedFrames)
      const fps = (1 / msbf).toFixed(3)
      stats = {
        fps,
        presented: metadata.presentedFrames,
        dropped: video.getVideoPlaybackQuality().droppedVideoFrames,
        processing: metadata.processingDuration + ' ms',
        viewport: video.clientWidth + 'x' + video.clientHeight,
        resolution: videoWidth + 'x' + videoHeight,
        buffer: getBufferHealth(metadata.mediaTime) + ' s',
        speed: video.playbackRate || 1
      }
      setTimeout(() => video.requestVideoFrameCallback((n, m) => handleStats(n, m, metadata)), 200)
    }
  }
  function getBufferHealth (time: number) {
    for (let index = video.buffered.length; index--;) {
      if (time < video.buffered.end(index) && time >= video.buffered.start(index)) {
        return (video.buffered.end(index) - time) | 0
      }
    }
    return 0
  }

  $: seekIndex = Math.max(0, Math.floor(seekPercent * safeduration / 100 / thumbnailer.interval))

  $: playbackIndex = Math.max(0, Math.floor(currentTime / thumbnailer.interval))

  $: if (readyState && !seekIndex) thumbnailer._paintThumbnail(video, playbackIndex)

  $: native.setMediaSession(mediaInfo.session, mediaInfo.media.id, safeduration)
  $: native.setPositionState({ duration: safeduration, position: Math.min(Math.max(0, currentTime), safeduration), playbackRate: $playbackRate }, readyState === 0 ? 'none' : paused ? 'paused' : 'playing')
  $: native.setPlayBackState(readyState === 0 ? 'none' : paused ? 'paused' : 'playing')
  native.setActionHandler('play', playPause)
  native.setActionHandler('pause', playPause)
  native.setActionHandler('seekto', ({ seekTime }) => seekTo(seekTime ?? 0))
  native.setActionHandler('seekbackward', () => seek(-Number($settings.playerSeek)))
  native.setActionHandler('seekforward', () => seek(Number($settings.playerSeek)))
  native.setActionHandler('previoustrack', () => prev?.())
  native.setActionHandler('nexttrack', () => next?.())
  // about://flags/#auto-picture-in-picture-for-video-playback
  native.setActionHandler('enterpictureinpicture', () => {
    goto('/app/player')
    pip.pip(true)
  })

  let openSubs: () => Promise<void>

  function cycleSubtitles (e: KeyboardEvent | MouseEvent) {
    if (!subtitles) return
    const entries = Object.entries(subtitles._tracks.value)
    if (!entries.length) return
    const offset = e.shiftKey ? -1 : 1
    const index = entries.findIndex(([index]) => index === subtitles!.current.value) + offset
    const [id, info] = entries.at(index) ?? [-1, { meta: { name: 'Off', language: 'Eng' } }]
    playAnimation(info.meta.name ?? info.meta.language ?? 'Eng')
    subtitles.selectCaptions(id)
  }

  function seekBarKey (event: KeyboardEvent) {
    if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()
      event.stopPropagation()
    }

    switch (event.key) {
      case 'ArrowLeft':
        seek(-Number($settings.playerSeek))
        break
      case 'ArrowRight':
        seek(Number($settings.playerSeek))
        break
      case 'Enter':
        playPause()
        break
    }
  }
  let fitWidth = false
  loadWithDefaults({
    KeyX: {
      fn: () => screenshot(video, subtitles),
      id: 'screenshot_monitor',
      icon: ScreenShare,
      type: 'icon',
      desc: 'Save Screenshot to Clipboard'
    },
    KeyI: {
      fn: () => toggleStats(),
      icon: List,
      id: 'list',
      type: 'icon',
      desc: 'Toggle Stats'
    },
    Space: {
      fn: (e) => {
        if ('repeat' in e && e.repeat) return
        playPause()
      },
      id: 'play_arrow',
      icon: Play,
      type: 'icon',
      desc: 'Play/Pause'
    },
    KeyN: {
      fn: () => next?.(),
      id: 'skip_next',
      icon: SkipForward,
      type: 'icon',
      desc: 'Next Episode'
    },
    KeyB: {
      fn: () => prev?.(),
      id: 'skip_previous',
      icon: SkipBack,
      type: 'icon',
      desc: 'Previous Episode'
    },
    KeyA: {
      fn: () => {
        $settings.playerDeband = !$settings.playerDeband
      },
      id: 'deblur',
      icon: Contrast,
      type: 'icon',
      desc: 'Toggle Video Debanding'
    },
    KeyM: {
      fn: () => (muted = !muted),
      id: 'volume_off',
      icon: VolumeX,
      type: 'icon',
      desc: 'Toggle Mute'
    },
    KeyP: {
      fn: () => pip.pip(),
      id: 'picture_in_picture',
      icon: PictureInPicture2,
      type: 'icon',
      desc: 'Toggle Picture in Picture'
    },
    KeyF: {
      fn: () => fullscreen(),
      id: 'fullscreen',
      icon: Maximize,
      type: 'icon',
      desc: 'Toggle Fullscreen'
    },
    KeyS: {
      fn: () => skip(),
      id: '+90',
      desc: 'Skip Intro/90s'
    },
    KeyW: {
      fn: () => { fitWidth = !fitWidth },
      id: 'fit_width',
      icon: Proportions,
      type: 'icon',
      desc: 'Toggle Video Cover'
    },
    // KeyD: {
    //   fn: () => toggleCast(),
    //   id: 'cast',
    //   icon: Cast,
    //   type: 'icon',
    //   desc: 'Toggle Cast [broken]'
    // },
    KeyC: {
      fn: (e) => cycleSubtitles(e),
      id: 'subtitles',
      icon: Captions,
      type: 'icon',
      desc: 'Cycle Subtitles'
    },
    ArrowLeft: {
      fn: (e) => {
        if ($inputType === 'dpad') return
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        seek(-Number($settings.playerSeek))
      },
      id: 'fast_rewind',
      icon: Rewind,
      type: 'icon',
      desc: 'Rewind'
    },
    ArrowRight: {
      fn: (e) => {
        if ($inputType === 'dpad') return
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        seek(Number($settings.playerSeek))
      },
      id: 'fast_forward',
      icon: FastForward,
      type: 'icon',
      desc: 'Seek'
    },
    ArrowUp: {
      fn: (e) => {
        if ($inputType === 'dpad') return
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        changeVolume(0.05)
      },
      id: 'volume_up',
      icon: Volume2,
      type: 'icon',
      desc: 'Volume Up'
    },
    ArrowDown: {
      fn: (e) => {
        if ($inputType === 'dpad') return
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        changeVolume(-0.05)
      },
      id: 'volume_down',
      icon: Volume1,
      type: 'icon',
      desc: 'Volume Down'
    },
    BracketLeft: {
      fn: () => { $playbackRate = Math.min(16, Math.max(0.1, $playbackRate - 0.1)) },
      id: 'history',
      icon: RotateCcw,
      type: 'icon',
      desc: 'Decrease Playback Rate'
    },
    BracketRight: {
      fn: () => { $playbackRate = Math.min(16, Math.max(0.1, $playbackRate + 0.1)) },
      id: 'update',
      icon: RotateCw,
      type: 'icon',
      desc: 'Increase Playback Rate'
    },
    Backslash: {
      fn: () => { $playbackRate = 1 },
      icon: RefreshCcw,
      id: 'schedule',
      type: 'icon',
      desc: 'Reset Playback Rate'
    },
    Semicolon: {
      fn: () => { subtitleDelay -= 0.1 },
      icon: DecimalsArrowLeft,
      type: 'icon',
      id: 'subtitle_delay_minus',
      desc: 'Decrease Subtitle Delay'
    },
    Quote: {
      fn: () => { subtitleDelay += 0.1 },
      icon: DecimalsArrowRight,
      type: 'icon',
      id: 'subtitle_delay_plus',
      desc: 'Increase Subtitle Delay'
    }
  })

  $condition = () => !isMiniplayer

  function holdToFF (document: HTMLElement, type: 'key' | 'pointer') {
    const ctrl = new AbortController()
    let timeout = 0
    let oldPlaybackRate = $playbackRate
    let wasPaused = paused
    const startFF = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if (fastForwarding) return
        wasPaused = paused
        paused = false
        fastForwarding = true
        oldPlaybackRate = $playbackRate
        $playbackRate = 2
      }, 1000)
    }
    const endFF = () => {
      clearTimeout(timeout)
      if (!fastForwarding) return
      fastForwarding = false
      $playbackRate = oldPlaybackRate
      paused = wasPaused
    }
    document.addEventListener(type + 'down' as 'keydown' | 'pointerdown', event => {
      if (isMiniplayer) return
      if ('code' in event && (event.code !== 'Space')) return
      if ('button' in event && event.button !== 0) return
      if ('repeat' in event && event.repeat) return
      if ('pointerId' in event) {
        document.setPointerCapture(event.pointerId)
      }
      startFF()
    }, { signal: ctrl.signal })
    document.addEventListener(type + 'up' as 'keyup' | 'pointerup', event => {
      if (isMiniplayer) return
      if ('code' in event && event.code !== 'Space') return
      if ('pointerId' in event) document.releasePointerCapture(event.pointerId)
      endFF()
    }, { signal: ctrl.signal })

    if (type === 'pointer') {
      document.addEventListener('pointercancel', event => {
        if ('pointerId' in event) document.releasePointerCapture(event.pointerId)
        endFF()
      }, { signal: ctrl.signal })
    }

    return { destroy: () => ctrl.abort() }
  }

  function updateState (state: { paused: boolean, time: number }) {
    currentTime = state.time
    paused = state.paused
  }

  $: $w2globby?.playerStateChanged({ paused, time: Math.floor(currentTime) })
  $: $w2globby?.on('player', updateState)

  function loadAnimeProgress () {
    if (!mediaInfo.media.id || !mediaInfo.episode) return

    const animeProgress = getAnimeProgress(mediaInfo.media.id)
    if (!animeProgress || animeProgress.episode !== mediaInfo.episode) return

    currentTime = Math.max(animeProgress.currentTime - 5, 0)
  }

  function saveAnimeProgress () {
    if (!mediaInfo.media.id || !mediaInfo.episode) return

    if (buffering || paused || video.readyState < 4) return

    setAnimeProgress(mediaInfo.media.id, { episode: mediaInfo.episode, currentTime: video.currentTime, safeduration })
  }
  const saveProgressLoop = setInterval(saveAnimeProgress, 10000)
  onDestroy(() => clearInterval(saveProgressLoop))

  function handleWheel ({ shiftKey, deltaY }: WheelEvent) {
    const sign = Math.sign(deltaY)
    if (shiftKey) {
      seek(Number($settings.playerSeek) * sign * -1)
    } else {
      changeVolume(-0.05 * sign)
    }
  }

  function toggleTimeFormat () {
    $timeFormat = $timeFormat === 'negative' ? 'positive' : 'negative'
  }
</script>

<svelte:document bind:fullscreenElement bind:visibilityState use:holdToFF={'key'} />

<div class='w-full h-full relative content-center bg-black overflow-clip text-left touch-none' class:fitWidth class:seeking class:pip={pictureInPictureElement} bind:this={wrapper} on:navigate={() => resetMove(2000)} on:wheel={handleWheel} on:keydown={stopAnimation} on:focusin={stopAnimation} on:pointerenter={stopAnimation} on:pointermove={stopAnimation}>
  <video class='w-full h-full touch-none' preload='metadata' class:cursor-none={immersed} class:cursor-pointer={isMiniplayer} class:object-cover={fitWidth} class:opacity-0={$settings.playerDeband || seeking || pictureInPictureElement} class:absolute={$settings.playerDeband} class:top-0={$settings.playerDeband}
    use:createSubtitles
    use:createDeband={$settings.playerDeband}
    use:holdToFF={'pointer'}
    crossorigin='anonymous'
    src={mediaInfo.file.url}
    bind:videoHeight
    bind:videoWidth
    bind:currentTime
    bind:duration
    bind:ended
    bind:paused
    bind:muted
    bind:readyState
    bind:buffered
    bind:playbackRate={$playbackRate}
    bind:volume={exponentialVolume}
    bind:this={video}
    on:click={() => isMiniplayer ? goto('/app/player') : playPause()}
    on:dblclick={fullscreen}
    on:loadeddata={checkAudio}
    on:loadedmetadata={loadAnimeProgress}
    on:timeupdate={checkSkippableChapters}
    on:timeupdate={checkCompletion}
    on:loadedmetadata={autoPlay}
    on:pointermove={() => resetMove()}
  />
  {#if !isMiniplayer}
    <div class='absolute w-full h-full flex items-center justify-center top-0 pointer-events-none'>
      <DownloadStats {immersed} />
      {#if seeking}
        {#await thumbnailer.getThumbnail(seekIndex) then src}
          {#if src}
            <img {src} alt='thumbnail' class='w-full h-full bg-black absolute top-0 right-0 object-contain' loading='lazy' decoding='async' class:!object-cover={fitWidth} />
          {/if}
        {/await}
      {/if}
      {#if stats}
        <div class='absolute top-10 left-10 border-white/15 border bg-black/60 pointer-events-auto px-3 py-2 rounded'>
          <button class='absolute right-3 top-1' type='button' use:click={toggleStats}>×</button>
          FPS: {stats.fps}<br />
          Presented frames: {stats.presented}<br />
          Dropped frames: {stats.dropped}<br />
          Frame time: {stats.processing}<br />
          Viewport: {stats.viewport}<br />
          Resolution: {stats.resolution}<br />
          Buffer health: {stats.buffer}<br />
          Playback speed: x{stats.speed?.toFixed(1)}<br />
          Subtitle delay: {subtitleDelay} sec
        </div>
      {/if}
      <Options {wrapper} bind:openSubs {video} {seekTo} {selectAudio} {selectVideo} {fullscreen} {chapters} {subtitles} {videoFiles} {selectFile} {pip} bind:playbackRate={$playbackRate} bind:subtitleDelay id='player-options-button-top'
        class='{($settings.minimalPlayerUI || SUPPORTS.isAndroid) ? 'inline-flex' : 'mobile:inline-flex hidden'} p-3 size-12 absolute z-[1] top-4 left-4 bg-black/20 pointer-events-auto transition-opacity delay-150 select:opacity-100 {immersed && 'opacity-0'}' />
      {#if fastForwarding}
        <div class='absolute top-10 font-bold text-sm animate-[fade-in_.4s_ease] flex items-center leading-none bg-black/60 px-4 py-2 rounded-2xl'>x2 <FastForward class='ml-2' size='12' fill='currentColor' /></div>
      {/if}
      {#if !SUPPORTS.isAndroidTV}
        <div class='mobile:flex hidden gap-10 absolute items-center transition-opacity select:opacity-100 z-[0]' class:opacity-0={immersed || seeking}>
          <Button class='p-3 size-10 pointer-events-auto rounded-[50%] bg-black/20' variant='ghost' disabled={!prev} on:click={() => prev?.()}>
            <SkipBack fill='currentColor' strokeWidth='1' />
          </Button>
          <Button class='p-2.5 size-12 pointer-events-auto rounded-[50%] bg-black/20' variant='ghost' on:click={playPause}>
            {#if paused}
              <Play fill='currentColor' class='p-0.5' />
            {:else}
              <Pause fill='currentColor' strokeWidth='1' />
            {/if}
          </Button>
          <Button class='p-3 size-10 pointer-events-auto rounded-[50%] bg-black/20' variant='ghost' disabled={!next} on:click={() => next?.()}>
            <SkipForward fill='currentColor' strokeWidth='1' />
          </Button>
        </div>
        <div class='size-full mobile:flex hidden justify-between absolute'>
          <div class='h-full w-1/4 pointer-events-auto' on:dblclick|stopPropagation={() => seek(-Number($settings.playerSeek))} use:holdToFF={'pointer'} />
          <div class='h-full w-1/4 pointer-events-auto' on:dblclick|stopPropagation={() => seek(Number($settings.playerSeek))} use:holdToFF={'pointer'} />
        </div>
      {/if}
      {#if buffering}
        <div in:fade={{ duration: 200, delay: 500 }} out:fade={{ duration: 200 }}>
          <div class='border-[3px] rounded-[50%] w-10 h-10 drop-shadow-lg border-transparent border-t-white animate-spin' />
        </div>
      {/if}
      <Animations />
    </div>
    {#if currentSkippable}
      <ProgressButton onclick={skip} bind:animating size='default' duration={3000} class={cn('px-7 font-bold absolute bottom-40 right-10 transition-opacity delay-150', immersed && !animating && 'opacity-0')}>
        Skip {currentSkippable}
      </ProgressButton>
    {/if}
    <div class='absolute w-full bottom-0 flex flex-col gradient px-6 py-3 transition-opacity delay-150 select:opacity-100' class:opacity-0={immersed}>
      <div class='flex justify-between gap-12 items-end'>
        <div class='flex flex-col gap-2 text-left cursor-pointer'>
          <EpisodesModal portal={wrapper} {mediaInfo} />
        </div>
        <div class='flex flex-col gap-2 grow-0 items-end self-end text-shadow-lg'>
          <div class='text-[rgba(217,217,217,0.6)] text-sm leading-none font-light line-clamp-1 capitalize'>{getChapterTitle(seeking ? seekPercent * safeduration / 100 : currentTime, chapters) || ''}</div>
          <div class='ml-auto self-end text-sm leading-none font-light text-nowrap' use:click={toggleTimeFormat}>
            {#if $timeFormat === 'positive'}
              {toTS(seeking ? seekPercent * safeduration / 100 : currentTime)} / {toTS(safeduration)}
            {:else}
              -{toTS(safeduration - (seeking ? seekPercent * safeduration / 100 : currentTime))} / {toTS(safeduration)}
            {/if}
          </div>
        </div>
      </div>
      <Seekbar {duration} {currentTime} buffer={buffer / duration * 100} {chapters} bind:seeking bind:seek={seekPercent} on:seeked={finishSeek} on:seeking={startSeek} {thumbnailer} on:keydown={seekBarKey} on:dblclick={fullscreen} />
      <div class='justify-between gap-2 {($settings.minimalPlayerUI || SUPPORTS.isAndroid) ? 'hidden' : 'mobile:hidden flex'}'>
        <div class='flex text-white gap-2'>
          <Button class='p-3 size-12 relative shrink-0' variant='ghost' on:click={playPause} on:keydown={keywrap(playPause)} id='player-play-pause-button' data-up='#player-seekbar'>
            {#if paused}
              <div transition:scaleBlurFade class='absolute'>
                <Play size='24px' fill='currentColor' class='p-0.5' />
              </div>
            {:else}
              <div transition:scaleBlurFade class='absolute'>
                <Pause size='24px' fill='currentColor' strokeWidth='1' />
              </div>
            {/if}
          </Button>
          {#if prev}
            <Button class='p-3 size-12' variant='ghost' on:click={prev} on:keydown={keywrap(prev)} id='player-prev-button' data-up='#player-seekbar' data-right='#player-next-button, #player-volume-button, #player-options-button'>
              <SkipBack size='24px' fill='currentColor' strokeWidth='1' />
            </Button>
          {/if}
          {#if next}
            <Button class='p-3 size-12' variant='ghost' on:click={next} on:keydown={keywrap(next)} id='player-next-button' data-up='#player-seekbar' data-right='#player-volume-button, #player-options-button'>
              <SkipForward size='24px' fill='currentColor' strokeWidth='1' />
            </Button>
          {/if}
          <Volume bind:volume={$volume} bind:muted />
        </div>
        <div class='flex gap-2'>
          {#if $playbackRate !== 1 && $playbackRate}
            <div class='flex justify-center items-center leading-none text-base font-bold px-1 pt-0.5'>
              x{$playbackRate?.toFixed(1)}
            </div>
          {/if}
          <Options {fullscreen} {wrapper} {seekTo} bind:openSubs {video} {selectAudio} {selectVideo} {chapters} {subtitles} {videoFiles} {selectFile} {pip} bind:playbackRate={$playbackRate} bind:subtitleDelay id='player-options-button' />
          {#if subtitles}
            <Button class='p-3 size-12' variant='ghost' on:click={openSubs} on:keydown={keywrap(openSubs)} data-up='#player-seekbar'>
              <Subtitles size='24px' fill='currentColor' strokeWidth='0' />
            </Button>
          {/if}
          <Button class='p-3 size-12 relative shrink-0' variant='ghost' on:click={() => pip.pip()} on:keydown={keywrap(() => pip.pip())} data-up='#player-seekbar'>
            {#if pictureInPictureElement}
              <div transition:scaleBlurFade class='absolute'>
                <PictureInPictureExit size='24px' strokeWidth='2' />
              </div>
            {:else}
              <div transition:scaleBlurFade class='absolute'>
                <PictureInPictureOff size='24px' strokeWidth='2' />
              </div>
            {/if}
          </Button>
          <!-- {#if false}
            <Button class='p-3 size-12' variant='ghost' on:click={toggleCast} on:keydown={keywrap(toggleCast)} data-up='#player-seekbar'>
              {#if cast}
                <Cast size='24px' fill='white' strokeWidth='2' />
              {:else}
                <Cast size='24px' strokeWidth='2' />
              {/if}
            </Button>
          {/if} -->
          <Button class='p-3 size-12 relative animated-icon shrink-0' variant='ghost' on:click={fullscreen} on:keydown={keywrap(fullscreen)} data-up='#player-seekbar'>
            {#if fullscreenElement}
              <div transition:scaleBlurFade class='absolute'>
                <Minimize size='24px' class='p-0.5' strokeWidth='2.5' />
              </div>
            {:else}
              <div transition:scaleBlurFade class='absolute'>
                <Maximize size='24px' class='p-0.5' strokeWidth='2.5' />
              </div>
            {/if}
          </Button>
        </div>
      </div>
    </div>
  {:else}
    <div class='absolute w-full left-0 bottom-0 flex justify-center'>
      <Button variant='ghost' class='drop-shadow-[0_0_7px_#000] mb-1 relative' size='icon' on:pointerdown={e => { e.stopPropagation(); playPause() }}>
        {#if paused}
          <div transition:scaleBlurFade class='absolute'>
            <Play size={iconSizes.lg} fill='currentColor' class='px-0.5' />
          </div>
        {:else}
          <div transition:scaleBlurFade class='absolute'>
            <Pause size={iconSizes.lg} fill='currentColor' strokeWidth='1' />
          </div>
        {/if}
      </Button>
    </div>
  {/if}
</div>

<style>
  .fitWidth :global(.deband-canvas) {
    object-fit: cover !important;
  }

  .seeking :global(.deband-canvas), .pip :global(.deband-canvas), .seeking :global(.JASSUB) {
    display: none;
  }

  .gradient {
    background: linear-gradient(to top, oklab(0 0 0 / 0.85) 0%, oklab(0 0 0 / 0.7) 35%, oklab(0 0 0 / 0) 100%);
  }

  .gradient-to-bottom {
    background: linear-gradient(to bottom, oklab(0 0 0 / 0.85) 0%, oklab(0 0 0 / 0.7) 35%, oklab(0 0 0 / 0) 100%);
  }
</style>
