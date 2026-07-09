<script lang='ts'>
  import SendHorizontal from 'lucide-svelte/icons/send-horizontal'

  import Messages from './Messages.svelte'

  import { Button } from '$lib/components/ui/button'
  import { Textarea } from '$lib/components/ui/textarea'
  import { navigate } from '$lib/modules/navigate'
  import { w2globby } from '$lib/modules/w2g/lobby'

  let message = ''

  function sendMessage () {
    const trimmed = message.trim()
    if (!trimmed) return
    $w2globby?.message(trimmed)
    message = ''
  }

  function checkInput (e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && message.trim()) {
      sendMessage()
      e.preventDefault()
    }
    navigate(e)
  }
</script>

<div class='flex flex-col justify-end overflow-clip flex-grow px-4 pb-4 h-full min-h-0 w-96 max-w-full'>
  <div class='h-full overflow-y-scroll min-h-0 w-full flex flex-col-reverse'>
    {#if $w2globby}
      <Messages messages={$w2globby.messages} />
    {/if}
  </div>
  <div class='flex mt-4 gap-2' on:keydown|capture|stopPropagation={checkInput}>
    <Textarea
      bind:value={message}
      class='h-auto px-3 w-full flex-grow-1 resize-none min-h-0 border-0 select:bg-accent select:text-accent-foreground [field-sizing:content]'
      autocomplete='off'
      maxlength={256}
      placeholder='Message' />
    <Button on:click={sendMessage} size='icon' class='mt-auto border-0' variant='outline'>
      <SendHorizontal size={18} />
    </Button>
  </div>
</div>
