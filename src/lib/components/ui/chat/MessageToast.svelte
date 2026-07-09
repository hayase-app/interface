<script lang='ts'>
  import ChatProfile from './ChatProfile.svelte'

  import type { ChatMessage } from '.'

  export let msg: ChatMessage

  $: ({ user, message, date } = msg)
</script>

<div class='w-full flex flex-row-reverse'>
  <ChatProfile {user} />
  <div class='flex flex-col px-2 items-end flex-auto'>
    <div class='pb-1 flex flex-row items-center px-1'>
      <div class='font-bold text-sm'>
        {user.name}
      </div>
      <div class='text-muted-foreground pl-2 text-[10px] leading-relaxed'>
        {date.toLocaleTimeString()}
      </div>
    </div>
    <div class='bg-muted py-2 px-3 rounded-t-xl rounded-l-xl mb-1 select-all text-xs whitespace-pre-wrap max-w-[calc(100%-100px)]'>
      {message}
    </div>
  </div>
</div>
