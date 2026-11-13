<script lang='ts'>
  export let animate = true
</script>

<div class='p-4 shrink-0'>
  <div class='animate-[load-in_0.3s_ease_0s_1] aspect-[152/290] w-[9.5rem] flex flex-col'>
    <div class='h-[13.5rem] bg-background rounded w-full'>
      <div class='bg-primary/5 size-full rounded' class:animate-pulse={animate} />
    </div>
    <div class='mt-4 bg-background rounded h-2 w-28'>
      <div class='bg-primary/5 size-full rounded' class:animate-pulse={animate} />
    </div>
    <div class='mt-2 bg-background rounded h-2 w-20'>
      <div class='bg-primary/5 size-full rounded' class:animate-pulse={animate} />
    </div>
  </div>
</div>
