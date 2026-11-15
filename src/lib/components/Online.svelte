<script lang='ts'>
  import CloudOff from '@lucide/svelte/icons/cloud-off'

  import AnilistError from './icons/AnilistError.svelte'

  import urqlClient from '#lib/modules/anilist/urql-client'
  import online from '#lib/modules/online'

  let hideFirst = false
  $: if (!$online && !hideFirst) {
    hideFirst = true
  }

  const error = urqlClient.error
</script>

{#if $online && hideFirst}
  <div class='bg-green-600 text-foreground text-sm justify-center items-center flex flex-row online overflow-clip relative z-40 px-4 shrink-0'>
    Back online
  </div>
{:else if !$online}
  <div class='bg-muted text-foreground text-sm justify-center items-center flex flex-row top-0 offline overflow-clip relative z-40 px-4 shrink-0'>
    <CloudOff size={16} class='me-2' />
    Offline
  </div>
{:else if $error}
  <div class='bg-red-800 text-foreground text-sm justify-center items-center flex flex-row top-0 offline overflow-clip relative z-40 px-4 shrink-0 w-full'>
    <AnilistError class='size-[1.1rem] me-1.5 flex-shrink-0' />
    <div class='text-ellipsis text-nowrap max-w-full overflow-clip min-w-0 leading-none'>
      AniList: {$error.message || 'Unknown error'}
    </div>
  </div>
{/if}

<style>
  .online {
    animation: hide 300ms forwards 2s;
  }
  @keyframes hide {
    from {
      height: 24px;
    }
    to {
      height: 0;
      padding-top: 0;
      padding-bottom: 0;
    }
  }
  .offline {
    height: 0;
    padding-top: 0;
    padding-bottom: 0;
    animation: show 300ms forwards 2s;
  }
  @keyframes show {
    from {
      height: 0;
    }
    to {
      height: 24px;
      padding-top: 2px;
      padding-bottom: 2px;
    }
  }
</style>
