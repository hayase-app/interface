<script lang='ts'>
  import TriangleAlert from 'lucide-svelte/icons/triangle-alert'

  import { Button } from '$lib/components/ui/button'
  import { IRC } from '$lib/components/ui/irc'
  import { prevAgreed } from '$lib/modules/irc'

  function agree () {
    $prevAgreed = true
  }
</script>

{#if $prevAgreed}
  <IRC />
{:else}
  <div class='flex grow h-full items-center justify-center flex-col'>
    <div class='flex flex-col max-w-[30rem] w-full xs:px-5 py-5 items-center text-center'>
      <TriangleAlert class='text-background max-w-full' size='12rem' fill='#f59e0b' />
      <div class='text-3xl font-bold'>
        Content Warning
      </div>
      <div class='text-muted-foreground pt-5'>
        This chat is completely unmoderated and may contain content that is not suitable for all audiences.
      </div>
      <div class='text-muted-foreground pt-2'>
        Be wary of impersonation.<br /> Staff will <span class='font-bold text-muted-foreground'>NEVER</span> show up on this chat.
      </div>
      <div class='mt-7 gap-3 flex justify-center'>
        <Button variant='secondary' href='/#/app/home' size='lg'>Nope</Button>
        <Button variant='destructive' size='lg' on:click={agree}>Continue</Button>
      </div>
    </div>
  </div>
{/if}
