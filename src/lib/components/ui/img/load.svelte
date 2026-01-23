<script lang='ts'>
  import type { HTMLImgAttributes } from 'svelte/elements'

  import { SUPPORTS } from '$lib/modules/settings'
  import { cn } from '$lib/utils'

  type $$Props = HTMLImgAttributes & { color?: string | null | undefined }

  export let src: $$Props['src'] = ''
  export let alt: $$Props['alt'] = ''
  let className: $$Props['class'] = ''
  export { className as class }

  export let color: string | null | undefined = 'transparent'

  let ready = false

  async function test (e: Event & { currentTarget: EventTarget & Element }) {
    const target = e.currentTarget as HTMLImageElement
    await target.decode()
    ready = true
  }
</script>

<div style:background={color ?? '#1890ff'} class={cn('overflow-clip', className)}>
  <img {src} {alt} on:load on:load={test} class={cn(className, SUPPORTS.isUnderPowered ? 'transition-opacity load-in-no-blur' : 'transition-[opacity,filter] load-in', !ready && 'opacity-0 blur-none')} decoding='async' loading='lazy' style:background={color ?? '#1890ff'} />
</div>

<style>
  @keyframes load-in {
    0% {
      opacity: 0;
      filter: blur(6px);
    }
    100% {
      opacity: 1;
      filter: blur(0);
    }
  }

  @keyframes load-in-no-blur {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  .load-in {
    animation: load-in 0.3s ease-out 0s 1;
  }

  .load-in-no-blur {
    animation: load-in-no-blur 0.3s ease-out 0s 1;
  }
</style>
