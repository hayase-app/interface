<script lang='ts'>
  import ChatProfile from './ChatProfile.svelte'

  import type { ChatUser } from '.'

  export let users: ChatUser[]

  $: processed = Object.entries(users)
</script>

<div class='flex flex-col w-full md:w-72 max-w-full px-5 overflow-y-auto md:max-h-full max-h-[40%] min-h-0 pb-2'>
  <div>
    {#each processed as [key, user] (key)}
      <div class='flex items-center pb-2'>
        <ChatProfile {user} />
        <div class='text-md pl-2'>
          {user.name}
        </div>
      </div>
    {/each}
  </div>
</div>
