<script lang='ts'>
  export let data
</script>

<div class='p-3 md:p-10 md:pb-0 pb-0 size-full flex flex-col gap-6 items-center overflow-y-auto'>
  <div class='space-y-0.5 w-full'>
    <h2 class='text-2xl font-bold'>License Information</h2>
    <p class='text-muted-foreground'>
      License information for the apps interface and its dependencies.
    </p>
  </div>
  <pre class='whitespace-pre-wrap text-sm select-text break-all'>{data.licenseText}</pre>
</div>
