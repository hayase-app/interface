<script lang='ts'>
  import { X } from 'lucide-svelte'
  import { onDestroy } from 'svelte'

  import type { SvelteMediaTimeRange } from 'svelte/elements'

  import { Button } from '$lib/components/ui/button'
  import { toTS } from '$lib/utils'

  export let subtitleDelay: number
  export let currentTime: number
  export let safeduration: number
  export let readyState: number
  export let volume: number
  export let video: Pick<HTMLVideoElement, 'requestVideoFrameCallback' | 'cancelVideoFrameCallback' | 'getVideoPlaybackQuality' | 'clientWidth' | 'clientHeight' | 'playbackRate' | 'audioTracks' | 'videoTracks'>
  export let buffered: SvelteMediaTimeRange[]
  export let videoWidth: number
  export let videoHeight: number
  export let close: () => void

  const readyStates = ['HAVE_NOTHING', 'HAVE_METADATA', 'HAVE_CURRENT_DATA', 'HAVE_FUTURE_DATA', 'HAVE_ENOUGH_DATA']

  let fps = '-'
  let frameTime = '-'
  let presented: number | null = null
  let dropped = 0
  let droppedPercent: string | null = null
  let viewport = '-'
  let resolution = '-'
  let bufferHealth = '-'
  let speed = 1

  $: audioTracks = video.audioTracks?.length ?? 0
  $: videoTracks = video.videoTracks?.length ?? 0

  function getBufferHealth (time: number) {
    for (const buffer of buffered) {
      if (time < buffer.end && time >= buffer.start) {
        return (buffer.end - time) | 0
      }
    }
    return 0
  }

  let vfcId: number
  let frameTimeout: ReturnType<typeof setTimeout>
  let prevMetadata: VideoFrameCallbackMetadata | null = null

  function processFrame (now: number, metadata: VideoFrameCallbackMetadata) {
    if (prevMetadata && prevMetadata !== metadata) {
      const dt = metadata.mediaTime - prevMetadata.mediaTime
      const df = metadata.presentedFrames - prevMetadata.presentedFrames
      if (dt > 0 && df > 0) fps = (df / dt).toFixed(1)
    }

    presented = metadata.presentedFrames
    frameTime = metadata.processingDuration != null
      ? (metadata.processingDuration * 1000).toFixed(2) + ' ms'
      : '-'

    const quality = video.getVideoPlaybackQuality()
    dropped = quality.droppedVideoFrames
    droppedPercent = quality.totalVideoFrames && dropped
      ? ((dropped / quality.totalVideoFrames) * 100).toFixed(2)
      : null

    viewport = video.clientWidth + 'x' + video.clientHeight
    resolution = videoWidth + 'x' + videoHeight
    bufferHealth = getBufferHealth(currentTime) + ' s'
    speed = video.playbackRate || 1

    prevMetadata = metadata
    frameTimeout = setTimeout(poll, 250)
  }

  function poll () {
    vfcId = video.requestVideoFrameCallback(processFrame)
  }

  frameTimeout = setTimeout(poll, 250)

  onDestroy(() => {
    clearTimeout(frameTimeout)
    video.cancelVideoFrameCallback(vfcId)
  })
</script>

<div class='absolute top-5 left-5 z-10 w-72 pointer-events-auto'>
  <div class='rounded-xl border border-foreground/10 bg-background/70 backdrop-blur-xl shadow-2xl overflow-hidden'>
    <div class='flex items-center justify-between px-4 py-3 border-b border-foreground/10'>
      <h2 class='text-sm font-semibold tracking-wide text-foreground/90'>Stats for Nerds</h2>
      <Button variant='ghost' size='icon-sm' on:click={close}>
        <X size={16} />
      </Button>
    </div>
    <div class='p-4 space-y-3 text-xs'>
      <div class='space-y-1.5'>
        <div class='font-medium text-foreground/50 uppercase tracking-wider text-[10px]'>Video</div>
        <div class='space-y-1'>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Resolution</span>
            <span class='text-foreground font-mono tabular-nums'>{resolution}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Viewport</span>
            <span class='text-foreground font-mono tabular-nums'>{viewport}</span>
          </div>
        </div>
      </div>
      <hr class='border-foreground/5' />
      <div class='space-y-1.5'>
        <div class='font-medium text-foreground/50 uppercase tracking-wider text-[10px]'>Performance</div>
        <div class='space-y-1'>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>FPS</span>
            <span class='text-foreground font-mono tabular-nums font-medium'>{fps}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Presented Frames</span>
            <span class='text-foreground font-mono tabular-nums'>{presented?.toLocaleString() ?? '-'}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Frame Time</span>
            <span class='text-foreground font-mono tabular-nums'>{frameTime}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Dropped Frames</span>
            <span class='text-foreground font-mono tabular-nums'>{dropped.toLocaleString()}{#if droppedPercent} <span class='text-foreground/40'>({droppedPercent}%)</span>{/if}</span>
          </div>
        </div>
      </div>
      <hr class='border-foreground/5' />
      <div class='space-y-1.5'>
        <div class='font-medium text-foreground/50 uppercase tracking-wider text-[10px]'>Playback</div>
        <div class='space-y-1'>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Position</span>
            <span class='text-foreground font-mono tabular-nums'>{toTS(currentTime)} / {toTS(safeduration)}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Speed</span>
            <span class='text-foreground font-mono tabular-nums'>x{speed.toFixed(2)}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Volume</span>
            <span class='text-foreground font-mono tabular-nums'>{(volume * 100).toFixed(0)}%</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Subtitle Delay</span>
            <span class='text-foreground font-mono tabular-nums'>{subtitleDelay.toFixed(1)}s</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Ready State</span>
            <span class='text-foreground font-mono tabular-nums'>{readyStates[readyState] ?? readyState}</span>
          </div>
        </div>
      </div>
      <hr class='border-foreground/5' />
      <div class='space-y-1.5'>
        <div class='font-medium text-foreground/50 uppercase tracking-wider text-[10px]'>Tracks</div>
        <div class='space-y-1'>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Audio</span>
            <span class='text-foreground font-mono tabular-nums'>{audioTracks}</span>
          </div>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Video</span>
            <span class='text-foreground font-mono tabular-nums'>{videoTracks}</span>
          </div>
        </div>
      </div>
      <hr class='border-foreground/5' />
      <div class='space-y-1.5'>
        <div class='font-medium text-foreground/50 uppercase tracking-wider text-[10px]'>Buffer</div>
        <div class='space-y-1'>
          <div class='flex justify-between items-center'>
            <span class='text-foreground/60'>Health</span>
            <span class='text-foreground font-mono tabular-nums'>{bufferHealth}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
