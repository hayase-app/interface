<script lang='ts'>
  import { Button } from '../button'
  import { Markdown } from '../markdown'

  import * as Dialog from '#lib/components/ui/dialog'
  import { client } from '#lib/modules/anilist'

  export let isLocked = false

  const viewer = client.client.viewer

  export let threadId: number | undefined = undefined
  export let parentCommentId: number | undefined = undefined
  export let rootCommentId: number | undefined = undefined
  export let id: number | undefined = undefined

  export let value = ''

  const placeholder = 'Write a comment on AniList \n\nDO NOT ASK FOR HELP HERE!\n\nAsking questions such as "why isnt X playing" or "why cant i find any torrents" !__WILL GET YOU BANNED__!\n\nTHIS IS A 3RD PARTY FORUM!'

  function comment () {
    client.comment({ threadId, id, parentCommentId, comment: value, rootCommentId })
  }
</script>

<Dialog.Root portal='#root'>
  <Dialog.Trigger asChild let:builder>
    <Button size='icon-sm' variant='ghost' class='mr-1' disabled={isLocked || !$viewer?.viewer} builders={[builder]}>
      <slot />
    </Button>
  </Dialog.Trigger>
  <Dialog.Content tabindex={null} class='gap-4 bottom-0 border-b-0 !translate-y-[unset] p-0 top-[unset] !pb-4 flex flex-col h-[90%] sm:h-1/2 max-w-full border-0 border-t !rounded-none'>
    <Markdown class='form-control w-full shrink-0 min-h-56 rounded-none flex-grow' {placeholder} bind:value />
    <div class='flex gap-2 justify-end flex-grow-0 px-4'>
      <Dialog.Close asChild let:builder>
        <Button variant='secondary' builders={[builder]}>
          Close
        </Button>
      </Dialog.Close>
      <Dialog.Close asChild let:builder>
        <Button builders={[builder]} on:click={comment}>
          Send
        </Button>
      </Dialog.Close>
    </div>
  </Dialog.Content>
</Dialog.Root>
