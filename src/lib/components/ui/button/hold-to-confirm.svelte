<script lang='ts'>
  import { Button, type Props } from './index.js'

  import * as Tooltip from '#lib/components/ui/tooltip'
  import { cn } from '#lib/utils'

  type $$Props = Props & {
    label?: string
    hint?: string
    onconfirm: () => void
  }

  export let label = 'I understand'
  export let hint = 'Hold to accept'
  export let variant: Props['variant'] = 'destructive'
  export let onconfirm: () => void

  let className: $$Props['class'] = ''
  export { className as class }
</script>

<div class={cn('hold-root relative inline-flex w-full', className)}>
  <Tooltip.Root>
    <Tooltip.Trigger let:builder tabindex={-1} asChild>
      <Button
        builders={[builder]}
        {variant}
        class='hold-button relative w-full overflow-hidden font-bold text-wrap h-auto min-h-0'>
        <span class='hold-fill pointer-events-none absolute inset-y-0 left-0 w-0 bg-foreground/20' on:animationend={onconfirm} />
        <span class='relative z-10'>{label}</span>
      </Button>
    </Tooltip.Trigger>
    <Tooltip.Content>{hint}</Tooltip.Content>
  </Tooltip.Root>
</div>

<style>
  @property --hold-shake {
    syntax: '<length>';
    inherits: true;
    initial-value: 0px;
  }

  /* The ramp grows --hold-shake on the wrapper. The button inherits it and shakes. */
  .hold-root:has(:global(.hold-button):active) {
    animation: hold-shake-ramp 3s linear forwards;
  }

  .hold-root:has(:global(.hold-button):active) :global(.hold-button) {
    animation: hold-shake 0.35s linear infinite;
    will-change: transform;
  }

  .hold-root:has(:global(.hold-button):active) .hold-fill {
    animation: hold-fill 3s linear forwards;
  }

  @keyframes hold-shake-ramp {
    0% { --hold-shake: 0.25px; }
    25% { --hold-shake: 1px; }
    50% { --hold-shake: 2px; }
    75% { --hold-shake: 3px; }
    100% { --hold-shake: 4px; }
  }

  @keyframes hold-shake {
    0%, 100% { transform: translate(var(--hold-shake), calc(var(--hold-shake) * -0.5)); }
    15% { transform: translate(calc(var(--hold-shake) * -0.8), calc(var(--hold-shake) * 0.9)); }
    35% { transform: translate(calc(var(--hold-shake) * 0.9), calc(var(--hold-shake) * 0.4)); }
    55% { transform: translate(calc(var(--hold-shake) * -1), calc(var(--hold-shake) * -0.7)); }
    75% { transform: translate(calc(var(--hold-shake) * 0.6), calc(var(--hold-shake) * 1)); }
    85% { transform: translate(calc(var(--hold-shake) * -0.7), calc(var(--hold-shake) * 0.3)); }
  }

  @keyframes hold-fill {
    from { width: 0%; }
    to { width: 100%; }
  }
</style>
