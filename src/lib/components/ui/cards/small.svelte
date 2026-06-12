<script lang='ts'>
  import CalendarDays from 'lucide-svelte/icons/calendar-days'
  import Tv from 'lucide-svelte/icons/tv'

  import StatusDot from '../../StatusDot.svelte'
  import { Load } from '../img'

  import PreviewCard from './preview.svelte'

  import type { Media } from '$lib/modules/anilist/types'

  import { goto } from '$app/navigation'
  import { coverMedium, format, title } from '$lib/modules/anilist/util'
  import { list } from '$lib/modules/auth'
  import { hover } from '$lib/modules/navigate'

  export let media: Media

  let hoverable = true

  export { hoverable as hover }

  let hidden = true

  function onclick () {
    goto(`/#/app/anime/${media.id}`)
  }
  function onhover (state: boolean) {
    hidden = !state
  }

  $: status = list(media)
</script>

<div class='text-foreground cursor-pointer shrink-0 relative pointer-events-auto active:z-[10] focus-visible:z-[10]' use:hover={[onclick, onhover]}>
  {#if !hidden && hoverable}
    <PreviewCard {media} />
  {/if}
  <div class='item w-[11.5rem] h-[323px] flex flex-col p-4 [content-visibility:auto] [contain-intrinsic-size:auto_9.5rem_auto_291px]'>
    <div class='h-[13.5rem]'>
      <Load src={coverMedium(media)} alt='cover' class='object-cover size-full rounded' color={media.coverImage?.color} />
    </div>
    <div class='pt-3 font-black text-[.8rem] line-clamp-2'>
      {#if status}
        <StatusDot variant={status} />
      {/if}
      {title(media)}
    </div>
    <div class='flex text-muted-foreground mt-auto pt-2 justify-between'>
      <div class='flex text-xs font-medium'>
        <CalendarDays class='w-[1rem] h-[1rem] mr-1 -ml-0.5' />
        {media.seasonYear ?? media.startDate?.year ?? 'TBA'}
      </div>
      <div class='flex text-xs font-medium'>
        {format(media)}
        <Tv class='w-[1rem] h-[1rem] ml-1 -mr-0.5' />
      </div>
    </div>
  </div>
</div>

<style>
  .item {
    animation: 0.3s ease 0s 1 load-in;
  }
</style>
