<script lang='ts'>
  export let animate = true
</script>

<div class='p-4 shrink-0'>
  <div class='animate-[load-in_0.3s_ease_0s_1] w-[16rem] flex flex-col'>
    <div class='h-[9rem] w-full bg-primary/5 rounded' class:animate-pulse={animate} />
    <div class='mt-4 bg-primary/5 rounded h-2 w-28' class:animate-pulse={animate} />
    <div class='mt-2 bg-primary/5 rounded h-2 w-20' class:animate-pulse={animate} />
  </div>
</div>
