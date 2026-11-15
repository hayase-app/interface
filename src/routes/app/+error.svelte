<script lang='ts'>
  import { page } from '#lib/app-state'
  import Load from '#lib/components/ui/img/load.svelte'
  import { Separator } from '#lib/components/ui/separator'
</script>

<div class='size-full flex flex-col grow items-center justify-center gap-9'>
  <div class='overflow-x-hidden overflow-y-scroll relative flex justify-center items-center text-foreground px-15 w-full font-light'>
    <div class='w-96 sm:!hidden justify-center items-center flex-col flex'>
      <div class='text-6xl'>{$page.status}</div>
      <Separator class='my-6 w-40' />
      <div class='text-lg text-wrap max-w-full'>{$page.error?.message ?? 'Error'}</div>
    </div>
    <div class='w-[38rem] hidden justify-center items-center sm:!flex'>
      <div class='text-6xl'>{$page.status}</div>
      <Separator class='mx-6 h-20' orientation='vertical' />
      <div class='text-lg text-wrap max-w-full'>{$page.error?.message ?? 'Error'}</div>
    </div>
  </div>
  <Load src='/confused.webp' alt='huh' class='w-96 max-w-full' />
</div>
