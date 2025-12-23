<script lang='ts'>
  export let animate = true
</script>

<div class='p-4 shrink-0'>
  <div class='item w-[9.5rem] flex flex-col'>
    <div class='h-[13.5rem] bg-black rounded w-full'>
      <div class='bg-primary/5 size-full rounded' class:animate-pulse={animate} />
    </div>
    <div class='mt-4 bg-black rounded h-2 w-28'>
      <div class='bg-primary/5 size-full rounded' class:animate-pulse={animate} />
    </div>
    <div class='mt-2 bg-black rounded h-2 w-20'>
      <div class='bg-primary/5 size-full rounded' class:animate-pulse={animate} />
    </div>
  </div>
</div>

<style>
  .item {
    animation: 0.3s ease 0s 1 load-in;
    aspect-ratio: 152/290;
  }
</style>
