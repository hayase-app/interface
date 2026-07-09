<script lang='ts'>
  import type { ChatUser } from '.'

  import Profile from '$lib/components/ui/profile/Profile.svelte'
  import client from '$lib/modules/anilist/client'

  export let user: ChatUser

  let open = false

  $: store = (open && !user.guest) ? client.user(Number(user.id)) : undefined

  $: profile = $store?.data?.User ?? user
</script>

<Profile user={profile} bind:open />
