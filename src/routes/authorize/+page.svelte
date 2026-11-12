<script lang='ts'>
  import { Separator } from '$lib/components/ui/separator'
  import SUPPORTS from '$lib/modules/settings/supports'

  const search = new URL(location.hash.slice('#/authorize'.length), location.origin).search

  const channel = new BroadcastChannel('hayase-auth')

  channel.postMessage(search)

  channel.close()

  // The Android app can open this page in the system browser, which does not share the channel with the app.
  // TODO: in the future all the isIOS checks in */auth/*.ts should be replaced with isMobile and this should be deleted.
  const isSystemBrowser = SUPPORTS.isAndroid && !navigator.userAgent.includes('; wv)') && !window.opener
  if (isSystemBrowser) {
    location.href = 'hayase://authorize/' + search
  } else {
    window.close()
  }
</script>

<div class='size-full flex flex-col grow items-center justify-center gap-9'>
  <div class='overflow-x-hidden overflow-y-scroll relative flex justify-center items-center text-foreground px-15 w-full font-light'>
    <div class='w-96 sm:!hidden justify-center items-center flex-col flex'>
      <div class='text-6xl'>Redirecting...</div>
      <Separator class='my-6 w-40' />
      <div class='text-xl text-wrap max-w-full'>This should take no more than a second.</div>
    </div>
    <div class='max-w-4xl w-full hidden justify-center items-center sm:!flex'>
      <div class='text-6xl'>Redirecting...</div>
      <Separator class='mx-6 h-20' orientation='vertical' />
      <div class='text-xl text-wrap max-w-full'>This should take no more than a second.</div>
    </div>
  </div>
</div>
